"""Roteiros de gravação (guias passo-a-passo) carregados de JSON."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.errors import NotFoundError

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts_data"


@lru_cache
def list_scripts() -> list[dict]:
    out = []
    for f in sorted(SCRIPTS_DIR.glob("*.json")):
        out.append(json.loads(f.read_text(encoding="utf-8")))
    return out


def get_script(script_id: str) -> dict:
    for s in list_scripts():
        if s.get("id") == script_id:
            return s
    raise NotFoundError(f"script {script_id}")
