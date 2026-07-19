"""Decodificação de áudio enviado pelo navegador (gravação remota/mobile).

O navegador grava via MediaRecorder (webm/opus, mp4/aac) ou WAV e faz upload;
aqui convertemos para float32 mono 48 kHz e gravamos raw.wav PCM_24 no take.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import soxr

TARGET_SR = 48000


def decode_upload(raw: bytes, suffix: str = ".webm") -> np.ndarray:
    """Decodifica bytes de áudio arbitrários para float32 mono 48 kHz.

    Tenta soundfile (WAV/FLAC/OGG); cai para ffmpeg (webm/opus, mp4/aac, mp3…).
    """
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw)
        tmp_path = Path(tmp.name)
    try:
        if suffix.lower() in (".wav", ".flac", ".ogg"):
            try:
                data, sr = sf.read(tmp_path, dtype="float32", always_2d=True)
                mono = data.mean(axis=1)
                if sr != TARGET_SR:
                    mono = soxr.resample(mono, sr, TARGET_SR).astype(np.float32)
                return np.asarray(mono, dtype=np.float32)
            except Exception:  # noqa: BLE001 — cai no ffmpeg
                pass
        if shutil.which("ffmpeg") is None:
            raise RuntimeError("ffmpeg_missing")
        proc = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(tmp_path), "-ac", "1",
             "-ar", str(TARGET_SR), "-f", "f32le", "-"],
            capture_output=True, timeout=600,
        )
        if proc.returncode != 0 or not proc.stdout:
            raise RuntimeError(
                f"decode_failed: {proc.stderr.decode('utf-8', 'replace')[:200]}"
            )
        return np.frombuffer(proc.stdout, dtype=np.float32).copy()
    finally:
        tmp_path.unlink(missing_ok=True)


def save_upload_as_take(library, project_id: str, raw: bytes, *,
                        suffix: str = ".webm", session_label: str | None = None) -> dict:
    """Cria um take a partir do áudio enviado. Retorna {take_id, duration_s}."""
    from app.models import Take

    data = decode_upload(raw, suffix)
    take_id, tdir = library.create_take(project_id)
    sf.write(tdir / "raw.wav", data, TARGET_SR, subtype="PCM_24")
    take = Take(
        id=take_id, project_id=project_id,
        duration_s=round(len(data) / TARGET_SR, 3),
        sample_rate=TARGET_SR, channels=1,
        origin="recorded", transcoded=True, session_label=session_label,
    )
    library.save_take(take)
    return {"take_id": take_id, "duration_s": take.duration_s}
