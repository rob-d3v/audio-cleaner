"""RecorderService — máquina de estados de gravação (idle → recording → finalizing → idle).

Captura via sounddevice.InputStream em float32. O callback do PortAudio apenas
enfileira blocos (nunca faz I/O); uma thread escritora drena a fila, grava bytes
crus em ``recording.part``, alimenta o Meter e publica MeterFrames para a camada
de API via callbacks thread-safe (loop.call_soon_threadsafe).

No stop, o .part é lido, reamostrado para 48 kHz se necessário (soxr) e salvo
como ``raw.wav`` PCM_24. A persistência do Take fica na camada de API — o
serviço devolve um dict com os metadados da gravação.
"""

from __future__ import annotations

import asyncio
import queue
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any, Protocol

import numpy as np
import sounddevice as sd
import soundfile as sf
import soxr

from app.errors import DeviceBusyError, RecorderBusyError, SampleRateUnsupportedError

TARGET_SAMPLERATE = 48000
PART_FILENAME = "recording.part"
WAV_FILENAME = "raw.wav"

_BUSY_HINTS = ("busy", "unavailable", "in use", "access denied", "exclusive", "-9985", "-9996")


class SupportsCreateTake(Protocol):
    """Contrato mínimo exigido do store pela gravação (duck-typed, injetado)."""

    def create_take(self, project_id: str) -> tuple[str, Path]: ...


def _map_stream_error(exc: Exception) -> Exception:
    text = str(exc).lower()
    if any(hint in text for hint in _BUSY_HINTS):
        return DeviceBusyError(str(exc))
    return SampleRateUnsupportedError(str(exc))


def _device_default_samplerate(device_id: int | None) -> int | None:
    try:
        info = sd.query_devices(device_id)
        return int(info["default_samplerate"])
    except Exception:
        return None


def _device_name(device_id: int | None) -> str | None:
    try:
        info = sd.query_devices(device_id)
        return str(info["name"])
    except Exception:
        return None


class RecorderService:
    """Instância única que grava um take por vez.

    Estados: "idle" | "recording" | "finalizing". Modo monitor (medição sem
    gravação) roda apenas quando idle e é reportado em status()["monitoring"].
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state = "idle"

        # Callbacks da camada de API (chamados no event loop via call_soon_threadsafe
        # quando set_loop() foi chamado; senão, chamados na thread escritora).
        self.on_meter: Callable[[Any], None] | None = None
        self.on_event: Callable[[dict], None] | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

        # Estado da gravação corrente.
        self._stream: Any = None
        self._queue: queue.Queue | None = None
        self._writer: threading.Thread | None = None
        self._meter = None
        self._take_id: str | None = None
        self._take_dir: Path | None = None
        self._project_id: str | None = None
        self._device_id: int | None = None
        self._capture_samplerate = TARGET_SAMPLERATE
        self._channels = 1
        self._needs_resample = False
        self._samples_captured = 0
        self._overflow_count = 0

        # Modo monitor.
        self._monitor_stream: Any = None
        self._monitor_queue: queue.Queue | None = None
        self._monitor_thread: threading.Thread | None = None
        self._monitor_stop = threading.Event()

        # Resultado da última finalização (útil após auto-stop por desconexão).
        self.last_result: dict | None = None

    # ------------------------------------------------------------------ wiring

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def _dispatch(self, cb: Callable, *args: Any) -> None:
        loop = self._loop
        if loop is not None and loop.is_running():
            loop.call_soon_threadsafe(cb, *args)
        else:
            cb(*args)

    def _emit_meter(self, frame: Any) -> None:
        if self.on_meter is not None:
            self._dispatch(self.on_meter, frame)

    def _emit_event(self, event: dict) -> None:
        if self.on_event is not None:
            self._dispatch(self.on_event, event)

    def _emit_state(self) -> None:
        self._emit_event({"type": "record_state", **self.status()})

    # ------------------------------------------------------------------ status

    def status(self) -> dict:
        elapsed = self._samples_captured / self._capture_samplerate if self._capture_samplerate else 0.0
        return {
            "state": self._state,
            "take_id": self._take_id,
            "elapsed_s": round(elapsed, 3),
            "monitoring": self._monitor_stream is not None,
        }

    # ------------------------------------------------------------------ stream

    def _open_stream(
        self, device_id: int | None, samplerate: int, channels: int, callback: Callable
    ) -> tuple[Any, int]:
        """Abre InputStream em ``samplerate``; se falhar, tenta a taxa padrão do device.

        Retorna (stream, taxa_usada). Erros são mapeados para DeviceBusyError ou
        SampleRateUnsupportedError.
        """
        try:
            stream = sd.InputStream(
                device=device_id,
                samplerate=samplerate,
                channels=channels,
                dtype="float32",
                callback=callback,
            )
            return stream, samplerate
        except sd.PortAudioError as exc:
            first_error = exc

        fallback = _device_default_samplerate(device_id)
        if fallback is not None and fallback != samplerate:
            try:
                stream = sd.InputStream(
                    device=device_id,
                    samplerate=fallback,
                    channels=channels,
                    dtype="float32",
                    callback=callback,
                )
                return stream, fallback
            except sd.PortAudioError as exc:
                raise _map_stream_error(exc) from exc
        raise _map_stream_error(first_error) from first_error

    def _callback(self, indata: np.ndarray, frames: int, _time_info: Any, status: Any) -> None:
        # NUNCA fazer I/O aqui — apenas enfileirar e contar flags.
        if status and getattr(status, "input_overflow", False):
            self._overflow_count += 1
        self._samples_captured += frames
        q = self._queue
        if q is not None:
            try:
                q.put_nowait(np.array(indata, dtype=np.float32, copy=True))
            except queue.Full:
                self._overflow_count += 1

    # ------------------------------------------------------------------- start

    def start(
        self,
        project_id: str,
        device_id: int | None,
        store: SupportsCreateTake,
        samplerate: int = TARGET_SAMPLERATE,
        channels: int = 1,
    ) -> str:
        with self._lock:
            if self._state != "idle":
                raise RecorderBusyError({"state": self._state, "take_id": self._take_id})
            if self._monitor_stream is not None:
                self._stop_monitor_locked()

            take_id, take_dir = store.create_take(project_id)
            take_dir.mkdir(parents=True, exist_ok=True)

            self._samples_captured = 0
            self._overflow_count = 0
            self._queue = queue.Queue(maxsize=512)

            stream, used_sr = self._open_stream(device_id, samplerate, channels, self._callback)

            self._stream = stream
            self._capture_samplerate = used_sr
            self._needs_resample = used_sr != TARGET_SAMPLERATE
            self._channels = channels
            self._take_id = take_id
            self._take_dir = take_dir
            self._project_id = project_id
            self._device_id = device_id

            from app.core.metering import Meter

            self._meter = Meter(samplerate=used_sr)

            self._writer = threading.Thread(
                target=self._writer_loop, name="recorder-writer", daemon=True
            )
            self._state = "recording"
            self._writer.start()
            stream.start()

        self._emit_state()
        return take_id

    # ------------------------------------------------------------------ writer

    def _writer_loop(self) -> None:
        assert self._take_dir is not None and self._queue is not None and self._meter is not None
        part_path = self._take_dir / PART_FILENAME
        disconnected = False
        with open(part_path, "ab") as f:
            while True:
                try:
                    item = self._queue.get(timeout=0.25)
                except queue.Empty:
                    stream = self._stream
                    if (
                        self._state == "recording"
                        and stream is not None
                        and not getattr(stream, "active", True)
                    ):
                        disconnected = True
                        break
                    continue
                if item is None:  # sentinela do stop()
                    break
                f.write(item.tobytes())
                self._emit_meter(self._meter.feed(item))
        if disconnected:
            self._handle_disconnect()

    def _handle_disconnect(self) -> None:
        """Auto-stop: dispositivo sumiu no meio da gravação — finaliza o take parcial."""
        with self._lock:
            if self._state != "recording":
                return
            self._state = "finalizing"
        try:
            self._stream.stop()
            self._stream.close()
        except Exception:
            pass
        result = self._finalize()
        take_id = result["take_id"]
        with self._lock:
            self._reset_session()
        self.last_result = result
        self._emit_event({"type": "error", "code": "DEVICE_DISCONNECTED", "take_id": take_id})
        self._emit_state()

    # -------------------------------------------------------------------- stop

    def stop(self) -> dict:
        """Para a gravação e finaliza o take.

        Retorna {take_id, project_id, duration_s, sample_rate, channels, path,
        device, input_overflows}. A camada de API persiste o Take.
        """
        with self._lock:
            if self._state != "recording":
                raise RecorderBusyError({"state": self._state, "detail": "not recording"})
            self._state = "finalizing"
            stream = self._stream
            q = self._queue
            writer = self._writer

        try:
            stream.stop()
            stream.close()
        except Exception:
            pass
        if q is not None:
            q.put(None)  # sentinela: escreve o que restou e sai
        if writer is not None:
            writer.join(timeout=10.0)

        result = self._finalize()
        with self._lock:
            self._reset_session()
        self.last_result = result
        self._emit_state()
        return result

    def _reset_session(self) -> None:
        self._state = "idle"
        self._stream = None
        self._queue = None
        self._writer = None
        self._meter = None
        self._take_id = None
        self._take_dir = None
        self._project_id = None
        self._samples_captured = 0

    def _finalize(self) -> dict:
        """Lê o .part, reamostra se preciso, grava raw.wav PCM_24 e apaga o .part."""
        assert self._take_dir is not None and self._take_id is not None
        part_path = self._take_dir / PART_FILENAME
        wav_path = self._take_dir / WAV_FILENAME

        data = np.fromfile(part_path, dtype=np.float32)
        if self._channels > 1:
            usable = (data.size // self._channels) * self._channels
            data = data[:usable].reshape(-1, self._channels)

        if self._needs_resample and data.size:
            data = soxr.resample(data, self._capture_samplerate, TARGET_SAMPLERATE)
            data = np.asarray(data, dtype=np.float32)

        sf.write(wav_path, data, TARGET_SAMPLERATE, subtype="PCM_24")
        part_path.unlink(missing_ok=True)

        n_frames = data.shape[0]
        duration_s = n_frames / TARGET_SAMPLERATE
        return {
            "take_id": self._take_id,
            "project_id": self._project_id,
            "duration_s": round(duration_s, 4),
            "sample_rate": TARGET_SAMPLERATE,
            "channels": self._channels,
            "path": str(wav_path),
            "device": {
                "id": self._device_id,
                "name": _device_name(self._device_id),
                "capture_samplerate": self._capture_samplerate,
                "needs_resample": self._needs_resample,
            },
            "input_overflows": self._overflow_count,
        }

    # ----------------------------------------------------------------- monitor

    def start_monitor(
        self, device_id: int | None, samplerate: int = TARGET_SAMPLERATE, channels: int = 1
    ) -> None:
        """Medição sem gravação: stream + Meter, sem thread escritora nem arquivo."""
        with self._lock:
            if self._state != "idle":
                raise RecorderBusyError({"state": self._state})
            if self._monitor_stream is not None:
                self._stop_monitor_locked()

            mon_queue: queue.Queue = queue.Queue(maxsize=64)

            def _mon_callback(indata: np.ndarray, _frames: int, _time: Any, _status: Any) -> None:
                try:
                    mon_queue.put_nowait(np.array(indata, dtype=np.float32, copy=True))
                except queue.Full:
                    pass

            stream, used_sr = self._open_stream(device_id, samplerate, channels, _mon_callback)

            from app.core.metering import Meter

            meter = Meter(samplerate=used_sr)
            self._monitor_queue = mon_queue
            self._monitor_stop.clear()

            def _mon_loop() -> None:
                while not self._monitor_stop.is_set():
                    try:
                        block = mon_queue.get(timeout=0.25)
                    except queue.Empty:
                        continue
                    self._emit_meter(meter.feed(block))

            self._monitor_thread = threading.Thread(
                target=_mon_loop, name="recorder-monitor", daemon=True
            )
            self._monitor_stream = stream
            self._monitor_thread.start()
            stream.start()

    def stop_monitor(self) -> None:
        with self._lock:
            self._stop_monitor_locked()

    def _stop_monitor_locked(self) -> None:
        stream = self._monitor_stream
        self._monitor_stream = None
        self._monitor_stop.set()
        if stream is not None:
            try:
                stream.stop()
                stream.close()
            except Exception:
                pass
        thread = self._monitor_thread
        self._monitor_thread = None
        if thread is not None:
            thread.join(timeout=2.0)
        self._monitor_queue = None


_recorder: RecorderService | None = None


def get_recorder() -> RecorderService:
    """Singleton do serviço de gravação (dependency da camada de API)."""
    global _recorder
    if _recorder is None:
        _recorder = RecorderService()
    return _recorder
