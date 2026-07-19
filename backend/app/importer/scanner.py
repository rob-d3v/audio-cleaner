"""Scanner de importação: varre uma pasta (1 subpasta por música) e monta preview.

Read-only, profundidade 2, sem seguir symlinks. Detecta versões de áudio,
letra .txt, links .gdoc, assets .flp e capa. Tolera nomes acentuados.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

from app.errors import AppError, PathNotFoundError
from app.importer.markers import DEFAULT_MARKER_MAPPING, analyze_folder_name

AUDIO_EXTS = {".mp3", ".wav", ".wma", ".m4a", ".flac", ".ogg", ".aac"}
LOSSLESS_EXTS = {".wav", ".flac"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
COVER_HINTS = ("capa", "cover", "folder", "front")
ASSET_EXTS = {".flp", ".als", ".ptx", ".band", ".mmp"}


def _gdoc_url(path: Path) -> str | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return None
    if isinstance(data, dict):
        if data.get("url"):
            return str(data["url"])
        doc_id = data.get("doc_id") or data.get("resource_id") or data.get("id")
        if doc_id:
            return f"https://docs.google.com/document/d/{doc_id}/edit"
    return None


def _scan_song_folder(folder: Path, mapping: dict[str, str]) -> dict[str, Any] | None:
    audio: list[dict] = []
    lyrics: list[dict] = []
    links: list[dict] = []
    assets: list[dict] = []
    images: list[Path] = []
    warnings: list[str] = []

    try:
        entries = sorted(folder.iterdir())
    except OSError:
        return None

    for f in entries:
        if not f.is_file():
            continue
        ext = f.suffix.lower()
        if ext in AUDIO_EXTS:
            audio.append({
                "file": f.name,
                "format": ext.lstrip("."),
                "size_mb": round(f.stat().st_size / 1e6, 2),
                "mtime": f.stat().st_mtime,
                "needs_transcode": ext not in LOSSLESS_EXTS,
                "suggested_take_name": f.stem,
            })
        elif ext == ".txt":
            try:
                preview = f.read_text(encoding="utf-8", errors="replace")[:120]
            except OSError:
                preview = ""
            lyrics.append({"file": f.name, "bytes": f.stat().st_size, "preview": preview})
        elif ext == ".gdoc":
            url = _gdoc_url(f)
            if url:
                links.append({"file": f.name, "type": "gdoc", "url": url})
            else:
                links.append({"file": f.name, "type": "gdoc", "url": None})
                warnings.append("gdoc_unparsed")
        elif ext in ASSET_EXTS:
            assets.append({"file": f.name, "type": ext.lstrip("."), "path": str(f)})
        elif ext in IMAGE_EXTS:
            images.append(f)

    if not audio:
        return None

    if len(lyrics) > 1:
        warnings.append("multiple_lyrics_files")
        lyrics.sort(key=lambda x: x["bytes"], reverse=True)

    cover = None
    if images:
        named = [p for p in images if any(h in p.stem.lower() for h in COVER_HINTS)]
        chosen = named[0] if named else max(images, key=lambda p: p.stat().st_size)
        cover = {"file": chosen.name}

    info = analyze_folder_name(folder.name, mapping)
    return {
        "folder": str(folder),
        **info,
        "audio": sorted(audio, key=lambda a: a["mtime"]),
        "lyrics": lyrics,
        "links": links,
        "assets": assets,
        "cover": cover,
        "warnings": warnings,
    }


def scan_import(path: str, mapping: dict[str, str] | None = None) -> dict[str, Any]:
    root = Path(path)
    if not root.exists():
        raise PathNotFoundError({"path": path})
    if not root.is_dir():
        raise AppError("path is not a directory", code="PATH_NOT_DIR",
                       http_status=400, message_key="errors.path_not_dir")

    mapping = mapping or DEFAULT_MARKER_MAPPING
    items: list[dict] = []
    unmatched: list[str] = []

    # A própria raiz pode conter áudios soltos (não numa subpasta) → 1 "música" avulsa.
    root_item = _scan_song_folder(root, mapping)

    for entry in sorted(root.iterdir()):
        if entry.is_dir():
            item = _scan_song_folder(entry, mapping)
            if item:
                items.append(item)
        elif entry.is_file() and entry.suffix.lower() in AUDIO_EXTS and root_item is None:
            unmatched.append(str(entry))

    if root_item:
        root_item["suggested_name"] = analyze_folder_name(root.name, mapping)["suggested_name"]
        items.insert(0, root_item)

    return {
        "root": str(root),
        "scanned_folders": len(items),
        "items": items,
        "unmatched_files": unmatched,
        "ffmpeg_available": shutil.which("ffmpeg") is not None,
    }
