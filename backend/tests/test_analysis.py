"""Testes dos detectores de análise com sinais sintéticos de problema conhecido."""

from __future__ import annotations

import numpy as np

from app.analysis import detectors as d
from app.analysis.analyzer import _issues

SR = 48000


def tone(freq, dur=2.0, amp=0.3):
    t = np.arange(int(dur * SR)) / SR
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def test_clipping_counted():
    x = tone(440, amp=0.5)
    x[1000:1010] = 1.0  # 10 amostras estouradas
    r = d.clipping(x)
    assert r["count"] >= 1


def test_no_clipping():
    assert d.clipping(tone(440, amp=0.5))["count"] == 0


def test_hum_detected_at_60():
    x = tone(300) + tone(60, amp=0.15)
    r = d.hum(x, SR)
    assert r["detected"] and r["base_freq"] == 60


def test_no_hum_on_clean():
    assert d.hum(tone(300), SR)["detected"] is False


def test_dc_offset():
    x = tone(300) + 0.05
    assert abs(d.dc_offset(x) - 0.05) < 0.01


def test_silence_bounds():
    sig = np.concatenate([np.zeros(SR, dtype=np.float32), tone(300, dur=1.0), np.zeros(SR // 2, dtype=np.float32)])
    r = d.silence(sig, SR)
    assert r["leading_s"] > 0.5
    assert r["trailing_s"] > 0.1


def test_issues_generates_fixes():
    report = {
        "hum": {"detected": True, "base_freq": 60, "level_db": -30},
        "clipping": {"count": 3, "ratio": 0.01},
        "sibilance": {"score": 0.8, "band_ratio_db": 5},
        "noise": {"snr_db": 20},
        "loudness": {"lufs_integrated": -28},
        "dc_offset": 0.005,
    }
    issues = _issues(report)
    codes = {i["code"] for i in issues}
    assert "hum_60hz" in codes
    assert "clipping" in codes
    assert "sibilance" in codes
    # cada issue tem um fix acionável
    assert all("params_patch" in i["fix"] for i in issues)
