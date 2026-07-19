"""Rotas de takes: listagem, CRUD, streaming de áudio com HTTP Range."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.library import LibraryStore
from app.deps import get_library

router = APIRouter(tags=["takes"])

Lib = Annotated[LibraryStore, Depends(get_library)]
_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")
_CHUNK = 256 * 1024


class TakePatch(BaseModel):
    rating: int | None = None
    notes: str | None = None
    session_label: str | None = None


@router.get("/projects/{project_id}/takes")
def list_takes(project_id: str, library: Lib) -> list[dict]:
    return [t.model_dump() for t in library.list_takes(project_id)]


@router.get("/takes/{take_id}")
def get_take(take_id: str, library: Lib) -> dict:
    return library.get_take(take_id).model_dump()


@router.patch("/takes/{take_id}")
def patch_take(take_id: str, body: TakePatch, library: Lib) -> dict:
    return library.update_take(take_id, body.model_dump(exclude_unset=True)).model_dump()


@router.delete("/takes/{take_id}", status_code=204)
def delete_take(take_id: str, library: Lib) -> Response:
    library.delete_take(take_id)
    return Response(status_code=204)


def _stream_file(path: Path, start: int, end: int):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = f.read(min(_CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/takes/{take_id}/audio")
def get_take_audio(take_id: str, library: Lib, variant: str = "raw",
                   range_header: Annotated[str | None, Header(alias="Range")] = None) -> Response:
    path = library.take_audio_path(take_id, variant)
    size = path.stat().st_size
    headers = {"Accept-Ranges": "bytes", "Content-Type": "audio/wav"}

    if range_header:
        m = _RANGE_RE.match(range_header)
        if m:
            g0, g1 = m.group(1), m.group(2)
            start = int(g0) if g0 else 0
            end = int(g1) if g1 else size - 1
            end = min(end, size - 1)
            if start > end:
                return Response(status_code=416,
                                headers={"Content-Range": f"bytes */{size}"})
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"
            headers["Content-Length"] = str(end - start + 1)
            return StreamingResponse(_stream_file(path, start, end), status_code=206,
                                     headers=headers, media_type="audio/wav")

    headers["Content-Length"] = str(size)
    return StreamingResponse(_stream_file(path, 0, size - 1), headers=headers,
                             media_type="audio/wav")
