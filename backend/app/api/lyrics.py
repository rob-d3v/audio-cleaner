"""Rotas de letras: leitura, autosave com snapshot, histórico de versões."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.library import LibraryStore
from app.deps import get_library

router = APIRouter(tags=["lyrics"])

Lib = Annotated[LibraryStore, Depends(get_library)]


class LyricsBody(BaseModel):
    text: str = ""
    snapshot: bool = False


@router.get("/projects/{project_id}/lyrics")
def get_lyrics(project_id: str, library: Lib) -> dict:
    return library.get_lyrics(project_id)


@router.put("/projects/{project_id}/lyrics")
def put_lyrics(project_id: str, body: LyricsBody, library: Lib) -> dict:
    return library.save_lyrics(project_id, body.text, snapshot=body.snapshot)


@router.get("/projects/{project_id}/lyrics/versions")
def list_versions(project_id: str, library: Lib) -> list[dict]:
    return library.list_lyric_versions(project_id)


@router.get("/projects/{project_id}/lyrics/versions/{ts}")
def get_version(project_id: str, ts: str, library: Lib) -> dict:
    return {"text": library.get_lyric_version(project_id, ts)}


@router.post("/projects/{project_id}/lyrics/versions/{ts}/restore")
def restore_version(project_id: str, ts: str, library: Lib) -> dict:
    return {"text": library.restore_lyric_version(project_id, ts)}
