"""Interpretação de marcadores no nome da pasta → status sugerido + nome limpo.

Convenções observadas na pasta do usuário (E:\\Robbs\\Pride\\Music\\ROBBS):
    "@Nome"            → em progresso
    "#Nome"            → pronto
    "%Nome"            → quase
    "-----@Nome"       → ideia (rascunho antigo)
    "Nome (quase)"     → quase
    "03 - Nome"        → track_hint=3 (prefixo numérico, removido do nome)
O mapeamento é editável na UI do wizard; estes são apenas defaults.
"""

from __future__ import annotations

import re

DEFAULT_MARKER_MAPPING: dict[str, str] = {
    "(quase)": "quase",
    "%": "quase",
    "#": "pronto",
    "@": "em_progresso",
    "-----": "idea",
}

_NUM_PREFIX = re.compile(r"^\s*(\d{1,3})\s*[-._)]?\s+")
_LEADING_SYMBOLS = re.compile(r"^[\s@#%\-]+")
_QUASE_SUFFIX = re.compile(r"\s*\(quase\)\s*$", re.IGNORECASE)


def analyze_folder_name(raw: str, mapping: dict[str, str] | None = None) -> dict:
    """Retorna {name_raw, suggested_name, markers, suggested_status, track_hint}."""
    mapping = mapping or DEFAULT_MARKER_MAPPING
    name = raw
    markers: dict[str, object] = {"prefix_symbol": None, "suffix": None, "numeric_prefix": None}
    status: str | None = None

    if raw.startswith("-----"):
        # rascunho antigo: o "-----" domina, ignora um @ que venha logo depois
        markers["prefix_symbol"] = "-----"
        status = mapping.get("-----", status)
    else:
        stripped = raw.lstrip()
        for sym in ("@", "#", "%"):
            if stripped.startswith(sym):
                markers["prefix_symbol"] = sym
                status = mapping.get(sym, status)
                break

    if _QUASE_SUFFIX.search(name):
        markers["suffix"] = "(quase)"
        status = mapping.get("(quase)", status)
        name = _QUASE_SUFFIX.sub("", name)

    name = _LEADING_SYMBOLS.sub("", name)

    m = _NUM_PREFIX.match(name)
    if m:
        markers["numeric_prefix"] = int(m.group(1))
        name = _NUM_PREFIX.sub("", name)

    name = name.strip() or raw.strip()
    return {
        "name_raw": raw,
        "suggested_name": name,
        "markers": markers,
        "suggested_status": status or "em_progresso",
        "track_hint": markers["numeric_prefix"],
    }
