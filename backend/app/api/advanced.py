"""Rotas avançadas (Fase 3): melhor janela de 2 min, separação de fontes e stems.

Todas as operações pesadas rodam como jobs no pool "heavy". A separação exige o
extra "separate" (audio-separator) — sem ele, respondemos 409 MODEL_NOT_INSTALLED.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.analysis.best_two_min import best_window
from app.core.capabilities import get_capabilities
from app.core.jobs import JobContext, JobManager
from app.core.library import LibraryStore
from app.deps import get_jobs, get_library
from app.errors import ModelNotInstalledError, NotFoundError
from app.pipeline.separation import DEFAULT_MODEL, separate_take

router = APIRouter(tags=["advanced"])

Lib = Annotated[LibraryStore, Depends(get_library)]
Jobs = Annotated[JobManager, Depends(get_jobs)]

_STEM_RE = re.compile(r"^[A-Za-z0-9_-]+$")


class SeparateBody(BaseModel):
    model: str | None = None


@router.post("/takes/{take_id}/best-two-min")
def best_two_min(take_id: str, library: Lib, jobs: Jobs, variant: str = "raw") -> dict:
    """Melhor janela contígua de ~2 min (para o Suno Voices). Job kind 'best2min'."""
    path = library.take_audio_path(take_id, variant)  # 404 cedo

    def _run(ctx: JobContext) -> dict:
        ctx.progress(0.1, message_key="jobs.analyzing")
        result = best_window(path)
        ctx.progress(1.0)
        return result

    job = jobs.submit("best2min", _run, pool="heavy")
    return {"job_id": job.id}


@router.post("/takes/{take_id}/separate")
def separate(take_id: str, body: SeparateBody, library: Lib, jobs: Jobs) -> dict:
    """Separa o take em voz/instrumental. Job kind 'separate'. Exige extra 'separate'."""
    library.get_take(take_id)  # 404 cedo
    if not get_capabilities().get("separate"):
        raise ModelNotInstalledError(detail={"feature": "separate", "extra": "separate"})
    model = body.model or DEFAULT_MODEL

    def _run(ctx: JobContext) -> dict:
        return separate_take(library, take_id, ctx, model=model)

    job = jobs.submit("separate", _run, pool="heavy")
    return {"job_id": job.id}


@router.get("/takes/{take_id}/stems")
def list_stems(take_id: str, library: Lib) -> dict:
    """Lista os stems disponíveis por modelo (caminhos relativos ao take_dir)."""
    tdir = library.take_dir(take_id)  # 404
    stems_root = tdir / "stems"
    models: list[dict] = []
    if stems_root.is_dir():
        for model_dir in sorted(stems_root.iterdir()):
            if not model_dir.is_dir():
                continue
            files = {
                wav.stem: f"stems/{model_dir.name}/{wav.name}"
                for wav in sorted(model_dir.glob("*.wav"))
            }
            if files:
                models.append({"model_slug": model_dir.name, "stems": files})
    return {"take_id": take_id, "models": models}


@router.get("/takes/{take_id}/stem/{name}")
def get_stem(take_id: str, name: str, library: Lib, model: str | None = None) -> FileResponse:
    """Faz stream de um stem WAV (ex.: vocals, instrumental). `model` opcional."""
    tdir = library.take_dir(take_id)  # 404
    if not _STEM_RE.match(name) or (model is not None and not _STEM_RE.match(model)):
        raise NotFoundError(f"stem {take_id}/{name}")
    stems_root = tdir / "stems"

    candidates: list[Path] = []
    if model:
        candidates.append(stems_root / model / f"{name}.wav")
    elif stems_root.is_dir():
        for model_dir in sorted(stems_root.iterdir()):
            if model_dir.is_dir():
                candidates.append(model_dir / f"{name}.wav")

    path = next((c for c in candidates if c.exists()), None)
    if path is None:
        raise NotFoundError(f"stem {take_id}/{name}")
    return FileResponse(path, media_type="audio/wav", filename=f"{take_id}-{name}.wav")
