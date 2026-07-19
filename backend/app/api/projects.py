"""Rotas de projetos, capa e notas."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.library import LibraryStore
from app.deps import get_library
from app.errors import AppError
from app.models import ProjectMode, ProjectStatus

router = APIRouter(tags=["projects"])

Lib = Annotated[LibraryStore, Depends(get_library)]

MAX_COVER_BYTES = 5 * 1024 * 1024


class ProjectCreate(BaseModel):
    name: str
    mode: ProjectMode = "voice"


class ProjectPatch(BaseModel):
    name: str | None = None
    status: ProjectStatus | None = None
    mode: ProjectMode | None = None
    album_id: str | None = None
    track_hint: int | None = None
    best_take_id: str | None = None
    links: list[dict[str, Any]] | None = None


class TextBody(BaseModel):
    text: str = ""


@router.get("/projects")
def list_projects(library: Lib, status: str | None = None,
                  album_id: str | None = None, q: str | None = None) -> list[dict]:
    return [p.model_dump() for p in library.list_projects(status=status, album_id=album_id, q=q)]


@router.post("/projects", status_code=201)
def create_project(body: ProjectCreate, library: Lib) -> dict:
    return library.create_project(body.name, body.mode).model_dump()


@router.get("/projects/{project_id}")
def get_project(project_id: str, library: Lib) -> dict:
    return library.get_project(project_id).model_dump()


@router.patch("/projects/{project_id}")
def patch_project(project_id: str, body: ProjectPatch, library: Lib) -> dict:
    patch = body.model_dump(exclude_unset=True)
    return library.update_project(project_id, patch).model_dump()


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, library: Lib) -> Response:
    library.delete_project(project_id)
    return Response(status_code=204)


# ------------------------------------------------------------------- capa

@router.put("/projects/{project_id}/cover")
async def put_cover(project_id: str, library: Lib, file: UploadFile) -> dict:
    ext = {"image/jpeg": "jpg", "image/png": "png"}.get(file.content_type or "")
    if ext is None:
        raise AppError("cover must be jpg or png", code="INVALID_COVER",
                       http_status=400, message_key="errors.invalid_cover")
    data = await file.read()
    if len(data) > MAX_COVER_BYTES:
        raise AppError("cover too large", code="COVER_TOO_LARGE",
                       http_status=400, message_key="errors.cover_too_large")
    library.save_cover(project_id, data, ext)
    return {"ok": True}


@router.get("/projects/{project_id}/cover")
def get_cover(project_id: str, library: Lib) -> FileResponse:
    path = library.cover_path(project_id)
    if path is None:
        raise AppError("no cover", code="NOT_FOUND", http_status=404,
                       message_key="errors.not_found")
    return FileResponse(path)


@router.delete("/projects/{project_id}/cover", status_code=204)
def delete_cover(project_id: str, library: Lib) -> Response:
    library.delete_cover(project_id)
    return Response(status_code=204)


# ------------------------------------------------------------------ notas

@router.get("/projects/{project_id}/notes")
def get_notes(project_id: str, library: Lib) -> dict:
    return {"text": library.get_notes(project_id)}


@router.put("/projects/{project_id}/notes")
def put_notes(project_id: str, body: TextBody, library: Lib) -> dict:
    library.save_notes(project_id, body.text)
    return {"ok": True}
