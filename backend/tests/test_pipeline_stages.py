"""Testes quantitativos dos estágios DSP com fixtures sintéticas determinísticas."""

from __future__ import annotations

import numpy as np
import pytest

from app.pipeline.base import (
    AudioBuffer,
    ChainRunner,
    ChainSpec,
    ChainStageSpec,
    StageContext,
    chain_hash,
)
from app.pipeline.registry import get_registry
from app.pipeline.stages import trim_silence as ts_mod
from app.pipeline.stages.deesser import DeesserParams, DeesserStage
from app.pipeline.stages.highpass import HighpassParams, HighpassStage
from app.pipeline.stages.limiter import LimiterParams, LimiterStage
from app.pipeline.stages.loudness import LoudnessParams, LoudnessStage
from app.pipeline.stages.trim_silence import TrimSilenceParams, TrimSilenceStage

SR = 48000


def tone(freq: float, dur: float = 2.0, amp: float = 0.5, sr: int = SR) -> np.ndarray:
    t = np.arange(int(dur * sr)) / sr
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def band_rms_db(x: np.ndarray, sr: int, lo: float, hi: float) -> float:
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    mask = (freqs >= lo) & (freqs <= hi)
    energy = np.sqrt(np.mean(np.abs(spec[mask]) ** 2)) if mask.any() else 1e-12
    return 20 * np.log10(energy + 1e-12)


def ctx() -> StageContext:
    return StageContext()


def sine_amp(x: np.ndarray, freq: float, sr: int = SR) -> float:
    """Amplitude do componente em `freq` via projeção em seno/cosseno."""
    t = np.arange(len(x)) / sr
    re = np.dot(x, np.cos(2 * np.pi * freq * t)) * 2 / len(x)
    im = np.dot(x, np.sin(2 * np.pi * freq * t)) * 2 / len(x)
    return float(np.hypot(re, im))


class TestHighpass:
    def test_attenuates_low_passes_high(self):
        x = tone(40) + tone(1000)
        buf = AudioBuffer(x, SR)
        out = HighpassStage().process(buf, HighpassParams(freq=150), ctx())
        # grave em 40 Hz atenuado ≥12 dB; 1 kHz praticamente intacto (<1 dB)
        atten = 20 * np.log10(sine_amp(out.data, 40) / sine_amp(x, 40))
        assert atten <= -11  # HPF 2ª ordem em 150Hz corta ~-11.8dB em 40Hz
        passband = 20 * np.log10(sine_amp(out.data, 1000) / sine_amp(x, 1000))
        assert abs(passband) < 1.0


class TestDeesser:
    def test_reduces_sibilant_band_only(self):
        rng = np.random.default_rng(42)
        base = tone(300, dur=2.0, amp=0.3)
        # rajadas de "sibilância": ruído filtrado em 5–9 kHz nos trechos do meio
        noise = rng.normal(0, 0.5, len(base)).astype(np.float32)
        from scipy.signal import butter, sosfilt

        sos = butter(4, [5000, 9000], btype="bandpass", fs=SR, output="sos")
        sib = sosfilt(sos, noise).astype(np.float32)
        burst = np.zeros_like(base)
        burst[SR // 2 : SR] = sib[SR // 2 : SR]
        x = base + burst

        out = DeesserStage().process(
            AudioBuffer(x, SR), DeesserParams(threshold_db=-40, ratio=4.0), ctx()
        )
        seg = slice(SR // 2, SR)
        before = band_rms_db(x[seg], SR, 5000, 9000)
        after = band_rms_db(out.data[seg], SR, 5000, 9000)
        assert before - after >= 2.0
        # banda grave intocada
        assert abs(band_rms_db(out.data[seg], SR, 200, 400) - band_rms_db(x[seg], SR, 200, 400)) < 1.0


class TestLoudness:
    def test_hits_lufs_target(self):
        import pyloudnorm

        x = tone(440, dur=5.0, amp=0.05)
        out = LoudnessStage().process(
            AudioBuffer(x, SR), LoudnessParams(lufs_target=-18, true_peak_max_db=-1), ctx()
        )
        measured = pyloudnorm.Meter(SR).integrated_loudness(out.data.astype(np.float64))
        assert abs(measured - (-18)) < 0.5

    def test_respects_peak_ceiling(self):
        x = tone(440, dur=5.0, amp=0.05)
        out = LoudnessStage().process(
            AudioBuffer(x, SR), LoudnessParams(lufs_target=-6, true_peak_max_db=-6), ctx()
        )
        peak_db = 20 * np.log10(np.max(np.abs(out.data)))
        assert peak_db <= -5.9


class TestLimiter:
    def test_caps_peaks(self):
        x = tone(440, amp=0.99)
        out = LimiterStage().process(AudioBuffer(x, SR), LimiterParams(ceiling_db=-6), ctx())
        peak_db = 20 * np.log10(np.max(np.abs(out.data)))
        assert peak_db <= -5.5


class TestTrimSilence:
    def test_trims_energy_fallback(self, monkeypatch):
        monkeypatch.setattr(ts_mod, "_speech_bounds_vad", lambda *_a, **_k: None)
        silence = np.zeros(SR, dtype=np.float32)
        speech = tone(300, dur=1.0, amp=0.4)
        x = np.concatenate([silence, speech, silence])
        out = TrimSilenceStage().process(
            AudioBuffer(x, SR), TrimSilenceParams(pad_ms=100), ctx()
        )
        # ~1 s de fala + 2×100 ms de respiro (tolerância de janela)
        assert 0.9 < out.duration_s < 1.5


class TestChainRunner:
    def test_full_chain_runs_and_reports_progress(self):
        progress: list[float] = []
        x = tone(300, dur=1.0, amp=0.3) + tone(50, dur=1.0, amp=0.2)
        chain = ChainSpec(
            stages=[
                ChainStageSpec(id="highpass", params={"freq": 100}),
                ChainStageSpec(id="deesser"),
                ChainStageSpec(id="limiter", params={"ceiling_db": -6}),
                ChainStageSpec(id="loudness", params={"lufs_target": -18}),
            ]
        )
        runner = ChainRunner(get_registry())
        out = runner.run(
            AudioBuffer(x, SR), chain,
            StageContext(progress=progress.append),
        )
        assert out.sample_rate == SR
        assert np.isfinite(out.data).all()
        assert progress[-1] == 1.0
        assert progress == sorted(progress)

    def test_disabled_stage_skipped_and_hash_stable(self):
        c1 = ChainSpec(stages=[ChainStageSpec(id="highpass", enabled=False)])
        c2 = ChainSpec(stages=[ChainStageSpec(id="highpass", enabled=False)])
        c3 = ChainSpec(stages=[ChainStageSpec(id="highpass", enabled=True)])
        assert chain_hash(c1) == chain_hash(c2) != chain_hash(c3)

        x = tone(40)
        out = ChainRunner(get_registry()).run(AudioBuffer(x, SR), c1, ctx())
        np.testing.assert_array_equal(out.data, x)

    def test_unknown_stage_raises(self):
        with pytest.raises(KeyError):
            ChainRunner(get_registry()).run(
                AudioBuffer(tone(440), SR),
                ChainSpec(stages=[ChainStageSpec(id="nope")]),
                ctx(),
            )
