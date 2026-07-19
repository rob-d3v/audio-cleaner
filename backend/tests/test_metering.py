"""Testes do Meter — valores dBFS exatos, clip latch e peak-hold com decay."""

from __future__ import annotations

import numpy as np
import pytest

from app.core.metering import DB_FLOOR, Meter

SR = 48000
BLOCK = 4800  # 0.1 s por bloco


def sine_block(amplitude: float, n: int = BLOCK, freq: float = 1000.0) -> np.ndarray:
    t = np.arange(n) / SR
    return (amplitude * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def quiet_block(amplitude: float = 0.05) -> np.ndarray:
    return np.full(BLOCK, amplitude, dtype=np.float32)


def test_sine_rms_and_peak_db():
    meter = Meter(samplerate=SR)
    frame = meter.feed(sine_block(0.5))
    # Senoide 0.5: RMS = 0.5/sqrt(2) → -9.03 dBFS; pico = 0.5 → -6.02 dBFS.
    assert frame.rms_db == pytest.approx(-9.03, abs=0.02)
    assert frame.peak_db == pytest.approx(-6.02, abs=0.02)
    assert frame.peak_hold_db == pytest.approx(-6.02, abs=0.02)
    assert frame.t == pytest.approx(0.1)
    assert frame.clip is False


def test_silence_hits_floor():
    meter = Meter(samplerate=SR)
    frame = meter.feed(np.zeros(BLOCK, dtype=np.float32))
    assert frame.rms_db == DB_FLOOR
    assert frame.peak_db == DB_FLOOR


def test_multichannel_block():
    meter = Meter(samplerate=SR)
    stereo = np.stack([sine_block(0.5), sine_block(0.5)], axis=1)
    frame = meter.feed(stereo)
    assert frame.rms_db == pytest.approx(-9.03, abs=0.02)
    assert frame.t == pytest.approx(0.1)  # t avança por frames, não por amostras


def test_clip_latches_for_half_second():
    meter = Meter(samplerate=SR)
    clip = quiet_block()
    clip[100] = 1.0
    frame = meter.feed(clip)  # termina em t=0.1, latch até 0.6
    assert frame.clip is True

    latched = [meter.feed(quiet_block()).clip for _ in range(5)]  # t=0.2..0.6
    assert all(latched)

    frame = meter.feed(quiet_block())  # t=0.7 > 0.6 → soltou
    assert frame.clip is False


def test_peak_hold_decays_after_1_5s():
    meter = Meter(samplerate=SR)
    meter.feed(sine_block(0.5))  # pico -6.02 seg em t=0.1

    # Blocos quietos até t=1.5: hold ainda no pico alto (t-hold_t < 1.5).
    for _ in range(14):  # t=0.2 .. 1.5
        frame = meter.feed(quiet_block())
        assert frame.peak_hold_db == pytest.approx(-6.02, abs=0.02)

    # t=1.6 → decorreu 1.5 s desde o hold → cai para o pico atual (0.05 → -26.02).
    frame = meter.feed(quiet_block())
    assert frame.peak_hold_db == pytest.approx(-26.02, abs=0.02)


def test_new_peak_refreshes_hold():
    meter = Meter(samplerate=SR)
    meter.feed(sine_block(0.25))  # hold -12.04
    frame = meter.feed(sine_block(0.5))  # pico maior renova
    assert frame.peak_hold_db == pytest.approx(-6.02, abs=0.02)
