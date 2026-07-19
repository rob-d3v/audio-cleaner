"""Executor de importação: copia arquivos para a biblioteca e cria projetos.

Roda como job. Nunca modifica a pasta de origem (só lê/copia). Tolerante a
falhas por arquivo: um áudio corrompido vira "skipped", o job continua.
"""

from __future__ import annotations

import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
import soxr

from app.core.jobs import JobContext
from app.core.library import LibraryStore, now_iso
from app.models import ImportInfo, Link, Take

TARGET_SR = 48000


def _decode_to_mono48k(src: Path) -> np.ndarray:
    """Decodifica qualquer áudio para float32 mono 48k. WAV/FLAC via soundfile,
    o resto via ffmpeg (wma/m4a/mp3/ogg)."""
    ext = src.suffix.lower()
    if ext in (".wav", ".flac", ".ogg"):
        try:
            data, sr = sf.read(src, dtype="float32", always_2d=True)
            mono = data.mean(axis=1)
            if sr != TARGET_SR:
                mono = soxr.resample(mono, sr, TARGET_SR).astype(np.float32)
            return np.asarray(mono, dtype=np.float32)
        except Exception:  # noqa: BLE001 — cai no ffmpeg
            pass
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg_missing")
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(src), "-ac", "1", "-ar", str(TARGET_SR),
         "-f", "f32le", "-"],
        capture_output=True, timeout=600,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"decode_failed: {proc.stderr.decode('utf-8', 'replace')[:200]}")
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def _mtime_iso(mtime: float | None) -> str:
    if mtime is None:
        return now_iso()
    return datetime.fromtimestamp(mtime, tz=UTC).isoformat()


def execute_import(library: LibraryStore, items: list[dict[str, Any]],
                   ctx: JobContext, copy_originals: bool = True) -> dict:
    created: list[dict] = []
    skipped: list[dict] = []
    total = max(1, len(items))

    for idx, item in enumerate(items):
        ctx.check_cancelled()
        name = item.get("project_name") or item.get("suggested_name") or "Sem título"
        ctx.progress(idx / total, message_key="import.creating_project")

        proj = library.create_project(name, item.get("mode", "voice"))
        src_folder = item.get("folder", "")
        patch: dict[str, Any] = {
            "status": item.get("status", "em_progresso"),
            "import_info": ImportInfo(source_path=src_folder, imported_at=now_iso()).model_dump(),
        }
        if item.get("track_hint") is not None:
            patch["track_hint"] = item["track_hint"]
        if item.get("album_id"):
            patch["album_id"] = item["album_id"]

        # links (.gdoc, .flp) — nunca copia, só referencia
        links = []
        for i, lk in enumerate(item.get("links", [])):
            links.append(Link(id=f"l{i}", type=lk.get("type", "url"),
                              label=lk.get("label", lk.get("type", "link")),
                              target=lk.get("target") or lk.get("url") or "").model_dump())
        if links:
            patch["links"] = links
        library.update_project(proj.id, patch)

        # áudios → takes
        takes_ok = 0
        for aud in item.get("audio", []):
            if not aud.get("include", True):
                continue
            src = Path(src_folder) / aud["file"]
            try:
                data = _decode_to_mono48k(src)
                take_id, tdir = library.create_take(proj.id)
                sf.write(tdir / "raw.wav", data, TARGET_SR, subtype="PCM_24")
                if copy_originals:
                    orig = tdir / f"original{src.suffix.lower()}"
                    shutil.copy2(src, orig)
                take = Take(
                    id=take_id, project_id=proj.id,
                    created_at=_mtime_iso(aud.get("mtime")),
                    duration_s=round(len(data) / TARGET_SR, 3),
                    sample_rate=TARGET_SR, channels=1,
                    origin="imported", original_file=f"original{src.suffix.lower()}",
                    transcoded=aud.get("needs_transcode", True),
                    session_label=aud.get("suggested_take_name"),
                )
                library.save_take(take)
                takes_ok += 1
            except Exception as exc:  # noqa: BLE001 — falha por arquivo não aborta o job
                reason = "needs_ffmpeg" if str(exc) == "ffmpeg_missing" else "decode_failed"
                skipped.append({"file": aud["file"], "reason_key": f"import.{reason}"})

        # letra
        lyrics = item.get("lyrics") or []
        chosen_lyric = item.get("lyrics_file")
        if not chosen_lyric and lyrics:
            chosen_lyric = lyrics[0]["file"]
        if chosen_lyric:
            lpath = Path(src_folder) / chosen_lyric
            if lpath.exists():
                try:
                    text = lpath.read_text(encoding="utf-8", errors="replace")
                    library.save_lyrics(proj.id, text, snapshot=True)
                except OSError:
                    pass

        # capa
        cover_file = item.get("cover_file") or (item.get("cover") or {}).get("file")
        if cover_file:
            cpath = Path(src_folder) / cover_file
            if cpath.exists():
                ext = "png" if cpath.suffix.lower() == ".png" else "jpg"
                try:
                    library.save_cover(proj.id, cpath.read_bytes(), ext)
                except Exception:  # noqa: BLE001
                    pass

        created.append({"project_id": proj.id, "name": name, "takes": takes_ok})

    ctx.progress(1.0)
    return {"created": created, "skipped": skipped,
            "created_count": len(created), "skipped_count": len(skipped)}
