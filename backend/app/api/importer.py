"""Rotas do importador em massa: scan (preview) e execute (job de cópia)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.jobs import JobContext, JobManager
from app.core.library import LibraryStore
from app.deps import get_jobs, get_library
from app.importer.executor import execute_import
from app.importer.scanner import scan_import

router = APIRouter(tags=["import"])

Lib = Annotated[LibraryStore, Depends(get_library)]
Jobs = Annotated[JobManager, Depends(get_jobs)]


class ScanBody(BaseModel):
    path: str
    marker_mapping: dict[str, str] | None = None


class ExecuteBody(BaseModel):
    items: list[dict[str, Any]]
    copy_originals: bool = True


@router.post("/import/scan")
def import_scan(body: ScanBody) -> dict:
    return scan_import(body.path, body.marker_mapping)


@router.post("/import/execute")
def import_execute(body: ExecuteBody, library: Lib, jobs: Jobs) -> dict:
    def _run(ctx: JobContext) -> dict:
        return execute_import(library, body.items, ctx, copy_originals=body.copy_originals)

    job = jobs.submit("import", _run, pool="io")
    return {"job_id": job.id}
