"""Orquestra os detectores → AnalysisReport + sugestões de correção (params_patch)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

from app.analysis import detectors as d


def _issues(report: dict) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    hum = report["hum"]
    if hum["detected"]:
        out.append({
            "code": f"hum_{hum['base_freq']}hz",
            "severity": "warning",
            "message_key": "analysis.hum",
            "fix": {"stage": "eq", "params_patch": {"notch_hum_freq": hum["base_freq"]}},
        })
    if report["clipping"]["count"] > 0:
        out.append({
            "code": "clipping",
            "severity": "error",
            "message_key": "analysis.clipping",
            "fix": {"stage": "limiter", "params_patch": {"ceiling_db": -6.0}},
        })
    if report["sibilance"]["score"] > 0.6:
        out.append({
            "code": "sibilance",
            "severity": "warning",
            "message_key": "analysis.sibilance",
            "fix": {"stage": "deesser", "params_patch": {}},
        })
    snr = report["noise"]["snr_db"]
    if snr < 30:
        out.append({
            "code": "high_noise",
            "severity": "warning",
            "message_key": "analysis.high_noise",
            "fix": {"stage": "denoise_nr", "params_patch": {"strength": 0.9}},
        })
    lufs = report["loudness"]["lufs_integrated"]
    if lufs is not None and lufs < -24:
        out.append({
            "code": "low_level",
            "severity": "info",
            "message_key": "analysis.low_level",
            "fix": {"stage": "loudness", "params_patch": {}},
        })
    if abs(report["dc_offset"]) > 0.002:
        out.append({
            "code": "dc_offset",
            "severity": "info",
            "message_key": "analysis.dc_offset",
            "fix": {"stage": "highpass", "params_patch": {"freq": 40}},
        })
    return out


def analyze_file(path: Path, variant: str = "raw") -> dict:
    data, sr = sf.read(path, dtype="float32", always_2d=False)
    x = data if data.ndim == 1 else data.mean(axis=1)
    x = np.asarray(x, dtype=np.float32)

    report: dict[str, Any] = {
        "schema_version": 1,
        "variant": variant,
        "duration_s": round(len(x) / sr, 3),
        "sample_rate": sr,
        "loudness": d.loudness_metrics(x, sr),
        "noise": d.noise_floor(x, sr),
        "clipping": d.clipping(x),
        "hum": d.hum(x, sr),
        "sibilance": d.sibilance(x, sr),
        "dc_offset": d.dc_offset(x),
        "silence": d.silence(x, sr),
    }
    report["issues"] = _issues(report)
    return report
