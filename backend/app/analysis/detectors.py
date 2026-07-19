"""Detectores de problemas de áudio — cada um devolve métricas quantitativas.

Todos operam sobre float32 mono. Os limiares/heurísticas geram o AnalysisReport
e as sugestões de correção (analysis.suggest).
"""

from __future__ import annotations

import numpy as np
import pyloudnorm
from scipy.signal import welch


def _mono(data: np.ndarray) -> np.ndarray:
    return data if data.ndim == 1 else data.mean(axis=1)


def _rms_frames(x: np.ndarray, sr: int, ms: float = 50.0) -> np.ndarray:
    win = max(1, int(sr * ms / 1000))
    n = len(x) // win
    if n == 0:
        return np.array([np.sqrt(np.mean(x**2))]) if len(x) else np.array([0.0])
    frames = x[: n * win].reshape(n, win)
    return np.sqrt((frames**2).mean(axis=1))


def loudness_metrics(x: np.ndarray, sr: int) -> dict:
    meter = pyloudnorm.Meter(sr)
    xf = x.astype(np.float64)
    lufs = meter.integrated_loudness(xf)
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    rms = float(np.sqrt(np.mean(x**2))) if len(x) else 0.0
    return {
        "lufs_integrated": None if not np.isfinite(lufs) else round(float(lufs), 2),
        "peak_dbfs": round(20 * np.log10(peak), 2) if peak > 0 else -120.0,
        "rms_dbfs": round(20 * np.log10(rms), 2) if rms > 0 else -120.0,
    }


def noise_floor(x: np.ndarray, sr: int) -> dict:
    rms = _rms_frames(x, sr)
    rms_db = 20 * np.log10(rms + 1e-9)
    floor = float(np.percentile(rms_db, 10))
    peak_db = float(np.percentile(rms_db, 95))
    return {"floor_dbfs": round(floor, 2), "snr_db": round(peak_db - floor, 2)}


def clipping(x: np.ndarray) -> dict:
    thresh = 0.999
    over = np.abs(x) >= thresh
    if not over.any():
        return {"count": 0, "ratio": 0.0}
    # conta corridas de >=3 amostras consecutivas
    edges = np.diff(np.concatenate([[0], over.view(np.int8), [0]]))
    starts = np.flatnonzero(edges == 1)
    ends = np.flatnonzero(edges == -1)
    runs = int(np.sum((ends - starts) >= 3))
    return {"count": runs, "ratio": round(float(over.mean()), 5)}


def hum(x: np.ndarray, sr: int) -> dict:
    freqs, psd = welch(x, sr, nperseg=min(len(x), 8192))
    psd_db = 10 * np.log10(psd + 1e-12)
    result = {"detected": False, "base_freq": None, "level_db": None}
    best = 0.0
    for base in (50, 60):
        idx = np.argmin(np.abs(freqs - base))
        lo = max(0, idx - 5)
        hi = min(len(psd_db), idx + 6)
        local = np.median(np.concatenate([psd_db[max(0, lo - 10):lo], psd_db[hi:hi + 10]]))
        prominence = psd_db[idx] - local
        if prominence > 8 and prominence > best:
            best = prominence
            result = {"detected": True, "base_freq": base,
                      "level_db": round(float(psd_db[idx]), 1)}
    return result


def sibilance(x: np.ndarray, sr: int) -> dict:
    freqs, psd = welch(x, sr, nperseg=min(len(x), 8192))
    sib = psd[(freqs >= 5000) & (freqs <= 9000)].mean() if len(psd) else 0.0
    body = psd[(freqs >= 1000) & (freqs <= 4000)].mean() if len(psd) else 1e-12
    ratio_db = 10 * np.log10((sib + 1e-12) / (body + 1e-12))
    return {"band_ratio_db": round(float(ratio_db), 2),
            "score": round(float(np.clip((ratio_db + 6) / 12, 0, 1)), 2)}


def dc_offset(x: np.ndarray) -> float:
    return round(float(np.mean(x)), 5) if len(x) else 0.0


def silence(x: np.ndarray, sr: int) -> dict:
    rms = _rms_frames(x, sr, ms=50.0)
    rms_db = 20 * np.log10(rms + 1e-9)
    floor = np.percentile(rms_db, 10)
    active = rms_db > floor + 12
    win = max(1, int(sr * 0.05))
    if not active.any():
        return {"leading_s": round(len(x) / sr, 2), "trailing_s": 0.0, "speech_ratio": 0.0}
    first = int(np.argmax(active))
    last = len(active) - int(np.argmax(active[::-1]))
    return {
        "leading_s": round(first * win / sr, 2),
        "trailing_s": round((len(active) - last) * win / sr, 2),
        "speech_ratio": round(float(active.mean()), 2),
    }
