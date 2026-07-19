"""Rotas de álbuns (coleção ordenada de projetos)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.core.library import LibraryStore
from app.deps import get_library

router = APIRouter(tags=["albums"])

Lib = Annotated[LibraryStore, Depends(get_library)]


class AlbumCreate(BaseModel):
    name: str


class AlbumPatch(BaseModel):
    name: str | None = None
    project_ids: list[str] | None = None
    cover_project_id: str | None = None


@router.get("/albums")
def list_albums(library: Lib) -> list[dict]:
    return [a.model_dump() for a in library.list_albums()]


@router.post("/albums", status_code=201)
def create_album(body: AlbumCreate, library: Lib) -> dict:
    return library.create_album(body.name).model_dump()


@router.get("/albums/{album_id}")
def get_album(album_id: str, library: Lib) -> dict:
    return library.get_album(album_id).model_dump()


@router.patch("/albums/{album_id}")
def patch_album(album_id: str, body: AlbumPatch, library: Lib) -> dict:
    return library.update_album(album_id, body.model_dump(exclude_unset=True)).model_dump()


@router.delete("/albums/{album_id}", status_code=204)
def delete_album(album_id: str, library: Lib) -> Response:
    library.delete_album(album_id)
    return Response(status_code=204)
