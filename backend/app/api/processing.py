"""Rotas de processamento e exportação de takes (executadas como jobs)."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import data_dir
from app.core import presets as presets_mod
from app.core.jobs import JobContext, JobManager
from app.core.library import LibraryStore
from app.core.processing import process_take
from app.deps import get_jobs, get_library
from app.errors import AppError
from app.export.exporter import export_take
from app.pipeline.base import ChainSpec

router = APIRouter(tags=["processing"])

Lib = Annotated[LibraryStore, Depends(get_library)]
Jobs = Annotated[JobManager, Depends(get_jobs)]


class ProcessBody(BaseModel):
    chain: dict[str, Any]
    source: str = "raw"


class ExportBody(BaseModel):
    variant: str = "raw"
    preset: str | None = None
    format: str = "wav"
    range_start_s: float | None = None
    range_end_s: float | None = None


@router.post("/takes/{take_id}/process")
def process(take_id: str, body: ProcessBody, library: Lib, jobs: Jobs) -> dict:
    chain = ChainSpec.model_validate(body.chain)
    library.get_take(take_id)  # 404 cedo

    def _run(ctx: JobContext) -> dict:
        return process_take(library, take_id, chain, ctx, source_variant=body.source)

    job = jobs.submit("process", _run, pool="heavy")
    return {"job_id": job.id}


@router.post("/takes/{take_id}/export")
def export(take_id: str, body: ExportBody, library: Lib, jobs: Jobs) -> dict:
    src = library.take_audio_path(take_id, body.variant)
    export_spec: dict[str, Any] = {}
    if body.preset:
        preset = presets_mod.get_preset(body.preset)
        export_spec = preset.get("export", {})
    fmt = body.format or export_spec.get("format", "wav")

    time_range = None
    if body.range_start_s is not None and body.range_end_s is not None:
        time_range = (body.range_start_s, body.range_end_s)

    out_dir = data_dir() / "exports"
    base_name = f"{take_id}-{body.variant}"

    def _run(ctx: JobContext) -> dict:
        ctx.progress(0.1, message_key="jobs.exporting")
        try:
            result = export_take(Path(src), out_dir, base_name, fmt=fmt,
                                 time_range=time_range, export_spec=export_spec)
        except RuntimeError as exc:
            if str(exc) == "ffmpeg_missing":
                raise AppError("ffmpeg required for mp3", code="FFMPEG_MISSING",
                               http_status=409, message_key="errors.ffmpeg_missing") from exc
            raise
        ctx.progress(1.0)
        return {"file": result.file.name, "filename": result.file.name,
                "warnings": result.warnings, "take_id": take_id}

    job = jobs.submit("export", _run, pool="io")
    return {"job_id": job.id}


@router.get("/exports/{filename}/download")
def download_export(filename: str) -> FileResponse:
    safe = Path(filename).name
    path = data_dir() / "exports" / safe
    if not path.exists():
        raise AppError("export not found", code="NOT_FOUND", http_status=404,
                       message_key="errors.not_found")
    return FileResponse(path, filename=safe)
