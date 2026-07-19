"""Rotas de prompts por projeto (estilo / letra) com histórico."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.library import LibraryStore, now_iso
from app.deps import get_library
from app.errors import AppError
from app.models import PromptEntry

router = APIRouter(tags=["prompts"])

Lib = Annotated[LibraryStore, Depends(get_library)]
_KINDS = {"style", "lyrics_prompt"}


class PromptBody(BaseModel):
    text: str
    template_id: str | None = None
    variables: dict[str, Any] = {}


def _check_kind(kind: str) -> None:
    if kind not in _KINDS:
        raise AppError(f"invalid prompt kind {kind}", code="VALIDATION_ERROR",
                       http_status=422, message_key="errors.validation")


@router.get("/projects/{project_id}/prompts")
def get_prompts(project_id: str, library: Lib) -> dict:
    p = library.get_prompts(project_id)
    return {
        "style": {"current": p.style.current.model_dump() if p.style.current else None,
                  "history_count": len(p.style.history)},
        "lyrics_prompt": {
            "current": p.lyrics_prompt.current.model_dump() if p.lyrics_prompt.current else None,
            "history_count": len(p.lyrics_prompt.history)},
    }


@router.put("/projects/{project_id}/prompts/{kind}")
def set_prompt(project_id: str, kind: str, body: PromptBody, library: Lib) -> dict:
    _check_kind(kind)
    entry = PromptEntry(text=body.text, template_id=body.template_id,
                        variables=body.variables, updated_at=now_iso())
    library.set_prompt(project_id, kind, entry)  # type: ignore[arg-type]
    return {"ok": True}


@router.get("/projects/{project_id}/prompts/{kind}/history")
def get_history(project_id: str, kind: str, library: Lib) -> list[dict]:
    _check_kind(kind)
    return [e.model_dump() for e in library.get_prompt_history(project_id, kind)]  # type: ignore[arg-type]
