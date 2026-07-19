"""Rotas de análise de áudio e roteiros de gravação."""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends

from app.analysis.analyzer import analyze_file
from app.core.jobs import JobContext, JobManager
from app.core.library import LibraryStore
from app.core.scripts import get_script, list_scripts
from app.deps import get_jobs, get_library

router = APIRouter(tags=["analysis"])

Lib = Annotated[LibraryStore, Depends(get_library)]
Jobs = Annotated[JobManager, Depends(get_jobs)]


@router.post("/takes/{take_id}/analyze")
def analyze(take_id: str, library: Lib, jobs: Jobs, variant: str = "raw") -> dict:
    path = library.take_audio_path(take_id, variant)
    tdir = library.take_dir(take_id)

    def _run(ctx: JobContext) -> dict:
        ctx.progress(0.2, message_key="jobs.analyzing")
        report = analyze_file(path, variant)
        out = tdir / f"analysis.{variant}.json"
        tmp = out.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(out)
        ctx.progress(1.0)
        return report

    job = jobs.submit("analyze", _run, pool="heavy")
    return {"job_id": job.id}


@router.get("/takes/{take_id}/analysis")
def get_analysis(take_id: str, library: Lib, variant: str = "raw") -> dict:
    from app.errors import NotFoundError

    tdir = library.take_dir(take_id)
    f = tdir / f"analysis.{variant}.json"
    if not f.exists():
        raise NotFoundError(f"analysis {take_id}/{variant}")
    return json.loads(f.read_text(encoding="utf-8"))


@router.get("/scripts")
def get_scripts() -> list[dict]:
    return list_scripts()


@router.get("/scripts/{script_id}")
def get_script_by_id(script_id: str) -> dict:
    return get_script(script_id)
