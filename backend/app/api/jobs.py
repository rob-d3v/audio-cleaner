"""Rotas de jobs: consulta e cancelamento."""

from __future__ import annotations

from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.jobs import JobManager
from app.deps import get_jobs
from app.errors import NotFoundError

router = APIRouter(tags=["jobs"])

Jobs = Annotated[JobManager, Depends(get_jobs)]


@router.get("/jobs/{job_id}")
def get_job(job_id: str, jobs: Jobs) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise NotFoundError(f"job {job_id}")
    return asdict(job)


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, jobs: Jobs) -> dict:
    ok = jobs.cancel(job_id)
    if not ok:
        raise NotFoundError(f"job {job_id}")
    return {"ok": True}
