"""Testes do RecorderService com InputStream falso (sem microfone real)."""

from __future__ import annotations

import threading
import time

import numpy as np
import pytest
import sounddevice as sd
import soundfile as sf

from app.core.recorder import RecorderService
from app.errors import DeviceBusyError, RecorderBusyError, SampleRateUnsupportedError

DEVICE_ID = 7
FAKE_DEVICE_INFO = {"name": "Fake Mic", "default_samplerate": 44100.0}


class StubStore:
    """Store mínimo: create_take → (take_id, dir temporário)."""

    def __init__(self, base):
        self.base = base
        self.counter = 0

    def create_take(self, project_id):
        self.counter += 1
        take_id = f"take-{self.counter:03d}"
        take_dir = self.base / project_id / take_id
        take_dir.mkdir(parents=True)
        return take_id, take_dir


def make_fake_stream(
    *,
    fail_rates=frozenset(),
    busy=False,
    n_blocks=10,
    block_dur_s=0.1,
    interval_s=0.005,
    abort_after=None,
    amplitude=0.25,
):
    """Fábrica de classes FakeInputStream com comportamento configurável."""

    class FakeInputStream:
        instances = []

        def __init__(self, device=None, samplerate=None, channels=1, dtype="float32",
                     callback=None, **kwargs):
            if busy:
                raise sd.PortAudioError(
                    "Error opening InputStream: Device unavailable [PaErrorCode -9985]"
                )
            if samplerate in fail_rates:
                raise sd.PortAudioError(
                    f"Error opening InputStream: Invalid sample rate {samplerate}"
                )
            self.samplerate = int(samplerate)
            self.channels = channels
            self.callback = callback
            self.blocksize = int(self.samplerate * block_dur_s)
            self.active = False
            self._thread = None
            FakeInputStream.instances.append(self)

        def start(self):
            self.active = True
            self._thread = threading.Thread(target=self._feed, daemon=True)
            self._thread.start()

        def _feed(self):
            total = n_blocks if abort_after is None else abort_after
            for _ in range(total):
                if not self.active:
                    return
                block = np.full((self.blocksize, self.channels), amplitude, dtype=np.float32)
                self.callback(block, self.blocksize, None, None)
                time.sleep(interval_s)
            if abort_after is not None:
                self.active = False  # simula dispositivo desconectado

        def stop(self):
            self.active = False
            if self._thread is not None and self._thread is not threading.current_thread():
                self._thread.join(timeout=2.0)

        def close(self):
            pass

    return FakeInputStream


def _patch_device_info(monkeypatch):
    monkeypatch.setattr(sd, "query_devices", lambda device=None, kind=None: FAKE_DEVICE_INFO)


def _wait_until(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


def test_start_stop_produces_raw_wav_48k_pcm24(tmp_path, monkeypatch):
    n_blocks = 10
    fake_cls = make_fake_stream(n_blocks=n_blocks)
    monkeypatch.setattr(sd, "InputStream", fake_cls)
    _patch_device_info(monkeypatch)

    recorder = RecorderService()
    store = StubStore(tmp_path)
    frames = []
    recorder.on_meter = frames.append

    take_id = recorder.start("proj-a", DEVICE_ID, store)
    assert take_id == "take-001"
    assert recorder.status()["state"] == "recording"

    expected_samples = n_blocks * 4800
    assert _wait_until(lambda: recorder.status()["elapsed_s"] >= expected_samples / 48000)

    result = recorder.stop()
    assert recorder.status()["state"] == "idle"

    assert result["take_id"] == take_id
    assert result["sample_rate"] == 48000
    assert result["channels"] == 1
    assert result["device"]["name"] == "Fake Mic"
    assert result["device"]["needs_resample"] is False

    wav_path = tmp_path / "proj-a" / take_id / "raw.wav"
    assert wav_path.exists()
    assert not (tmp_path / "proj-a" / take_id / "recording.part").exists()

    info = sf.info(str(wav_path))
    assert info.samplerate == 48000
    assert info.subtype == "PCM_24"
    assert abs(info.frames - expected_samples) <= 4800  # ±1 bloco
    assert result["duration_s"] == pytest.approx(info.frames / 48000, abs=1e-3)

    assert frames, "writer deve emitir MeterFrames"
    assert frames[0].rms_db == pytest.approx(-12.04, abs=0.05)  # DC 0.25


def test_fallback_samplerate_resamples_to_48k(tmp_path, monkeypatch):
    n_blocks = 5
    fake_cls = make_fake_stream(fail_rates={48000}, n_blocks=n_blocks)
    monkeypatch.setattr(sd, "InputStream", fake_cls)
    _patch_device_info(monkeypatch)  # default do device: 44100

    recorder = RecorderService()
    take_id = recorder.start("proj-b", DEVICE_ID, StubStore(tmp_path))

    captured = n_blocks * 4410  # blocos de 0.1 s a 44100
    assert _wait_until(lambda: recorder.status()["elapsed_s"] >= captured / 44100)
    result = recorder.stop()

    assert result["device"]["capture_samplerate"] == 44100
    assert result["device"]["needs_resample"] is True
    assert result["sample_rate"] == 48000

    info = sf.info(result["path"])
    assert info.samplerate == 48000
    expected_out = round(captured * 48000 / 44100)
    assert abs(info.frames - expected_out) <= 4800  # comprimento escalado ±1 bloco
    assert result["take_id"] == take_id


def test_busy_device_raises_device_busy(tmp_path, monkeypatch):
    monkeypatch.setattr(sd, "InputStream", make_fake_stream(busy=True))
    _patch_device_info(monkeypatch)

    recorder = RecorderService()
    with pytest.raises(DeviceBusyError):
        recorder.start("proj-c", DEVICE_ID, StubStore(tmp_path))
    assert recorder.status()["state"] == "idle"


def test_unsupported_rates_raise_sample_rate_error(tmp_path, monkeypatch):
    monkeypatch.setattr(sd, "InputStream", make_fake_stream(fail_rates={48000, 44100}))
    _patch_device_info(monkeypatch)

    recorder = RecorderService()
    with pytest.raises(SampleRateUnsupportedError):
        recorder.start("proj-d", DEVICE_ID, StubStore(tmp_path))
    assert recorder.status()["state"] == "idle"


def test_double_start_raises_recorder_busy(tmp_path, monkeypatch):
    monkeypatch.setattr(sd, "InputStream", make_fake_stream(n_blocks=200))
    _patch_device_info(monkeypatch)

    recorder = RecorderService()
    store = StubStore(tmp_path)
    recorder.start("proj-e", DEVICE_ID, store)
    try:
        with pytest.raises(RecorderBusyError):
            recorder.start("proj-e", DEVICE_ID, store)
    finally:
        recorder.stop()


def test_stop_when_idle_raises(tmp_path):
    recorder = RecorderService()
    with pytest.raises(RecorderBusyError):
        recorder.stop()


def test_device_disconnect_auto_finalizes(tmp_path, monkeypatch):
    fake_cls = make_fake_stream(n_blocks=10, abort_after=3)
    monkeypatch.setattr(sd, "InputStream", fake_cls)
    _patch_device_info(monkeypatch)

    recorder = RecorderService()
    events = []
    recorder.on_event = events.append

    take_id = recorder.start("proj-f", DEVICE_ID, StubStore(tmp_path))
    assert _wait_until(lambda: recorder.status()["state"] == "idle", timeout=10.0)

    codes = [e.get("code") for e in events if e.get("type") == "error"]
    assert "DEVICE_DISCONNECTED" in codes

    states = [e.get("state") for e in events if e.get("type") == "record_state"]
    assert states[-1] == "idle"

    assert recorder.last_result is not None
    assert recorder.last_result["take_id"] == take_id
    wav_path = tmp_path / "proj-f" / take_id / "raw.wav"
    assert wav_path.exists()
    info = sf.info(str(wav_path))
    assert info.frames == 3 * 4800  # take parcial preservado


def test_monitor_mode_emits_meter_without_files(tmp_path, monkeypatch):
    monkeypatch.setattr(sd, "InputStream", make_fake_stream(n_blocks=5))
    _patch_device_info(monkeypatch)

    recorder = RecorderService()
    frames = []
    recorder.on_meter = frames.append

    recorder.start_monitor(DEVICE_ID)
    assert recorder.status()["monitoring"] is True
    assert _wait_until(lambda: len(frames) >= 3)
    recorder.stop_monitor()
    assert recorder.status()["monitoring"] is False
    assert recorder.status()["state"] == "idle"
    assert not list(tmp_path.rglob("*"))  # nada gravado em disco
