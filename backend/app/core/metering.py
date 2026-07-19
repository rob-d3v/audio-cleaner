"""Medição de nível para o VU meter — RMS, pico, peak-hold e indicador de clip."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

DB_FLOOR = -120.0
CLIP_THRESHOLD = 0.999


@dataclass
class MeterFrame:
    """Um frame de medição: níveis em dBFS no instante ``t`` (segundos decorridos)."""

    t: float
    rms_db: float
    peak_db: float
    peak_hold_db: float
    clip: bool


def _to_db(value: float) -> float:
    """Amplitude linear → dBFS, com piso em DB_FLOOR (evita log de 0)."""
    if value <= 0.0:
        return DB_FLOOR
    return max(DB_FLOOR, float(20.0 * np.log10(value)))


class Meter:
    """Acumula blocos float32 e produz MeterFrames.

    - RMS e pico calculados por bloco.
    - Peak-hold: mantém o maior pico por ``peak_hold_s`` segundos; depois
      cai para o pico do bloco atual.
    - Clip: qualquer amostra com |x| >= CLIP_THRESHOLD acende o indicador,
      que fica travado (latch) por ``clip_hold_s`` segundos.
    """

    def __init__(
        self,
        samplerate: int = 48000,
        peak_hold_s: float = 1.5,
        clip_hold_s: float = 0.5,
    ) -> None:
        self.samplerate = samplerate
        self.peak_hold_s = peak_hold_s
        self.clip_hold_s = clip_hold_s
        self._samples = 0
        self._peak_hold_db = DB_FLOOR
        self._peak_hold_t = 0.0
        self._clip_until: float | None = None

    @property
    def elapsed_s(self) -> float:
        return self._samples / self.samplerate

    def reset(self) -> None:
        self._samples = 0
        self._peak_hold_db = DB_FLOOR
        self._peak_hold_t = 0.0
        self._clip_until = None

    def feed(self, block: np.ndarray) -> MeterFrame:
        """Processa um bloco (frames,) ou (frames, channels) float32."""
        block = np.asarray(block)
        n_frames = block.shape[0]
        self._samples += n_frames
        t = self.elapsed_s

        abs_block = np.abs(block)
        peak = float(abs_block.max()) if block.size else 0.0
        rms = float(np.sqrt(np.mean(np.square(block, dtype=np.float64)))) if block.size else 0.0

        rms_db = _to_db(rms)
        peak_db = _to_db(peak)

        # Peak-hold: novo pico maior renova o hold; expirado, cai para o pico atual.
        if peak_db >= self._peak_hold_db or (t - self._peak_hold_t) >= self.peak_hold_s:
            self._peak_hold_db = peak_db
            self._peak_hold_t = t

        # Clip latch.
        clip_now = bool(peak >= CLIP_THRESHOLD)
        if clip_now:
            self._clip_until = t + self.clip_hold_s
        clip = clip_now or (self._clip_until is not None and t <= self._clip_until)

        return MeterFrame(
            t=t,
            rms_db=rms_db,
            peak_db=peak_db,
            peak_hold_db=self._peak_hold_db,
            clip=clip,
        )
