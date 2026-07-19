"""Presets de processamento: builtin (repo, imutáveis) + usuário (data dir)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import data_dir
from app.errors import AppError, NotFoundError

BUILTIN_DIR = Path(__file__).resolve().parents[1] / "presets"


def _user_dir() -> Path:
    d = data_dir() / "presets"
    d.mkdir(parents=True, exist_ok=True)
    return d


def list_presets() -> list[dict[str, Any]]:
    presets: list[dict[str, Any]] = []
    for f in sorted(BUILTIN_DIR.glob("*.json")):
        p = json.loads(f.read_text(encoding="utf-8"))
        p["builtin"] = True
        presets.append(p)
    for f in sorted(_user_dir().glob("*.json")):
        try:
            p = json.loads(f.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        p["builtin"] = False
        presets.append(p)
    return presets


def get_preset(preset_id: str) -> dict[str, Any]:
    for p in list_presets():
        if p.get("id") == preset_id:
            return p
    raise NotFoundError({"preset_id": preset_id})


def save_user_preset(preset: dict[str, Any]) -> dict[str, Any]:
    preset_id = preset.get("id")
    if not preset_id or not str(preset_id).strip():
        raise AppError(code="INVALID_PRESET", http_status=400,
                       message_key="errors.invalid_preset")
    if (BUILTIN_DIR / f"{preset_id}.json").exists():
        raise AppError(code="BUILTIN_PRESET", http_status=409,
                       message_key="errors.builtin_preset")
    preset["builtin"] = False
    f = _user_dir() / f"{preset_id}.json"
    tmp = f.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(preset, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(f)
    return preset


def delete_user_preset(preset_id: str) -> None:
    if (BUILTIN_DIR / f"{preset_id}.json").exists():
        raise AppError(code="BUILTIN_PRESET", http_status=409,
                       message_key="errors.builtin_preset")
    f = _user_dir() / f"{preset_id}.json"
    if not f.exists():
        raise NotFoundError({"preset_id": preset_id})
    f.unlink()
