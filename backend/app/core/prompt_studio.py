"""Prompt Studio: templates (builtin + usuário), catálogo de meta-tags e render.

Render é determinístico e sem LLM — substitui {variáveis} e limpa separadores
soltos. O gancho para geração via IA fica reservado para o futuro (não implementado).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app.config import data_dir
from app.errors import AppError, NotFoundError

BUILTIN_DIR = Path(__file__).resolve().parents[1] / "prompt_templates"


def _user_templates_dir() -> Path:
    d = data_dir() / "templates"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _user_tags_file() -> Path:
    return data_dir() / "meta_tags.user.json"


# ------------------------------------------------------------------ templates

def _load_builtin_templates() -> list[dict[str, Any]]:
    out = []
    for f in sorted(BUILTIN_DIR.glob("*.json")):
        if f.name == "meta_tags.json":
            continue
        data = json.loads(f.read_text(encoding="utf-8"))
        if data.get("kind") in ("style", "lyrics"):
            data["builtin"] = True
            out.append(data)
    return out


def _load_user_templates() -> list[dict[str, Any]]:
    out = []
    for f in sorted(_user_templates_dir().glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        data["builtin"] = False
        out.append(data)
    return out


def list_templates(kind: str | None = None) -> list[dict[str, Any]]:
    items = _load_builtin_templates() + _load_user_templates()
    if kind:
        items = [t for t in items if t.get("kind") == kind]
    return items


def get_template(template_id: str) -> dict[str, Any]:
    for t in list_templates():
        if t.get("id") == template_id:
            return t
    raise NotFoundError(f"template {template_id}")


def save_user_template(template: dict[str, Any]) -> dict[str, Any]:
    tid = template.get("id")
    if not tid:
        raise AppError("template id required", code="VALIDATION_ERROR",
                       http_status=422, message_key="errors.validation")
    if (BUILTIN_DIR / f"{tid}.json").exists():
        raise AppError("cannot overwrite builtin template", code="BUILTIN_TEMPLATE",
                       http_status=409, message_key="errors.builtin_template")
    template["builtin"] = False
    f = _user_templates_dir() / f"{tid}.json"
    tmp = f.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(template, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(f)
    return template


def delete_user_template(template_id: str) -> None:
    if (BUILTIN_DIR / f"{template_id}.json").exists():
        raise AppError("cannot delete builtin template", code="BUILTIN_TEMPLATE",
                       http_status=409, message_key="errors.builtin_template")
    f = _user_templates_dir() / f"{template_id}.json"
    if not f.exists():
        raise NotFoundError(f"template {template_id}")
    f.unlink()


# --------------------------------------------------------------------- render

_MULTISPACE = re.compile(r"[ \t]{2,}")


def render_template(template: dict[str, Any], variables: dict[str, Any]) -> str:
    """Monta o prompt final. Variável vazia → placeholder removido + limpeza de
    separadores órfãos (vírgulas duplas, sobras nas pontas). prefix/suffix de cada
    variável só aparecem quando o valor não é vazio."""
    text = template.get("template", "")
    var_defs = {v["name"]: v for v in template.get("variables", [])}

    for name, vdef in var_defs.items():
        raw = variables.get(name, vdef.get("default", ""))
        if isinstance(raw, list):
            join = vdef.get("join", ", ")
            value = join.join(str(x) for x in raw if str(x).strip())
        else:
            value = str(raw).strip() if raw is not None else ""
        if value:
            value = f"{vdef.get('prefix', '')}{value}{vdef.get('suffix', '')}"
        text = text.replace(f"{{{name}}}", value)

    # placeholders não declarados que sobraram → remove
    text = re.sub(r"\{[a-zA-Z0-9_]+\}", "", text)
    # limpeza de separadores órfãos deixados por variáveis vazias
    text = re.sub(r",\s*,", ",", text)
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"[ \t]*,[ \t]*(?=\n)", "", text)
    text = _MULTISPACE.sub(" ", text)
    text = re.sub(r"^[ \t,]+", "", text, flags=re.MULTILINE)
    return text.strip()


# ------------------------------------------------------------------ meta-tags

def list_meta_tags() -> list[dict[str, Any]]:
    builtin = json.loads((BUILTIN_DIR / "meta_tags.json").read_text(encoding="utf-8"))
    user_file = _user_tags_file()
    if user_file.exists():
        try:
            user = json.loads(user_file.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            user = []
        ids = {t["id"] for t in builtin}
        for t in user:
            t["builtin"] = False
            if t.get("id") not in ids:
                builtin.append(t)
    for t in builtin:
        t.setdefault("builtin", True)
    return builtin


def add_user_meta_tag(tag: dict[str, Any]) -> dict[str, Any]:
    if not tag.get("id") or not tag.get("tag"):
        raise AppError("tag id and tag required", code="VALIDATION_ERROR",
                       http_status=422, message_key="errors.validation")
    user_file = _user_tags_file()
    user = []
    if user_file.exists():
        try:
            user = json.loads(user_file.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            user = []
    user = [t for t in user if t.get("id") != tag["id"]]
    tag["builtin"] = False
    user.append(tag)
    tmp = user_file.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(user, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(user_file)
    return tag


def delete_user_meta_tag(tag_id: str) -> None:
    user_file = _user_tags_file()
    if not user_file.exists():
        raise NotFoundError(f"meta tag {tag_id}")
    user = json.loads(user_file.read_text(encoding="utf-8"))
    new = [t for t in user if t.get("id") != tag_id]
    if len(new) == len(user):
        raise NotFoundError(f"meta tag {tag_id}")
    tmp = user_file.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(user_file)
