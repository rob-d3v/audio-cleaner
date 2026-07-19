"""Exportação de takes: WAV/FLAC via soundfile, MP3 via ffmpeg.

Valida o resultado contra as restrições do preset (duração máx., faixa de picos)
e devolve warnings com message_keys — nunca bloqueia o export.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
import soxr


@dataclass
class ExportResult:
    file: Path
    warnings: list[dict[str, Any]] = field(default_factory=list)


def _load_mono(path: Path, target_sr: int) -> tuple[np.ndarray, int]:
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    if sr != target_sr:
        mono = soxr.resample(mono, sr, target_sr).astype(np.float32)
        sr = target_sr
    return mono, sr


def export_take(
    source_wav: Path,
    out_dir: Path,
    base_name: str,
    *,
    fmt: str = "wav",
    sample_rate: int = 48000,
    bit_depth: int = 24,
    time_range: tuple[float, float] | None = None,
    export_spec: dict[str, Any] | None = None,
) -> ExportResult:
    spec = export_spec or {}
    data, sr = _load_mono(source_wav, spec.get("sample_rate") or sample_rate)

    if time_range is not None:
        start, end = time_range
        i0, i1 = max(0, int(start * sr)), min(len(data), int(end * sr))
        if i1 > i0:
            data = data[i0:i1]

    warnings: list[dict[str, Any]] = []
    duration_s = len(data) / sr
    peak = float(np.max(np.abs(data))) if len(data) else 0.0
    peak_db = 20 * np.log10(peak) if peak > 0 else -120.0

    max_dur = spec.get("max_duration_s")
    if max_dur and duration_s > max_dur:
        warnings.append({
            "message_key": "export.warn_too_long",
            "params": {"duration_s": round(duration_s, 1), "max_s": max_dur},
        })
    peak_range = spec.get("peak_range_dbfs")
    if peak_range:
        lo, hi = peak_range
        if peak_db < lo or peak_db > hi:
            warnings.append({
                "message_key": "export.warn_peak_out_of_range",
                "params": {"peak_db": round(peak_db, 1), "min": lo, "max": hi},
            })

    out_dir.mkdir(parents=True, exist_ok=True)
    depth = spec.get("bit_depth") or bit_depth
    subtype = {16: "PCM_16", 24: "PCM_24", 32: "FLOAT"}.get(depth, "PCM_24")

    if fmt == "wav":
        out = out_dir / f"{base_name}.wav"
        sf.write(out, data, sr, subtype=subtype)
    elif fmt == "flac":
        out = out_dir / f"{base_name}.flac"
        sf.write(out, data, sr, subtype="PCM_24" if depth >= 24 else "PCM_16")
    elif fmt == "mp3":
        if shutil.which("ffmpeg") is None:
            raise RuntimeError("ffmpeg_missing")
        tmp_wav = out_dir / f"{base_name}.tmp.wav"
        sf.write(tmp_wav, data, sr, subtype="PCM_24")
        out = out_dir / f"{base_name}.mp3"
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(tmp_wav), "-codec:a", "libmp3lame",
                 "-b:a", "320k", str(out)],
                check=True, capture_output=True, timeout=600,
            )
        finally:
            tmp_wav.unlink(missing_ok=True)
    else:
        raise ValueError(f"formato não suportado: {fmt}")

    return ExportResult(file=out, warnings=warnings)
