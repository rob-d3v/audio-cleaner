"""Audio Cleaner — app factory FastAPI."""

from __future__ import annotations

import asyncio
import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI

from app import __version__
from app.config import data_dir
from app.deps import get_jobs, get_library, get_recorder
from app.errors import install_error_handlers

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    get_jobs().set_loop(loop)
    get_recorder().set_loop(loop)
    get_library()  # constrói o índice em memória a partir do disco
    yield


def _api_router() -> APIRouter:
    from app.api import (
        advanced,
        albums,
        analysis,
        importer,
        jobs,
        lyrics,
        processing,
        projects,
        prompts,
        record,
        system,
        takes,
        templates,
    )

    api = APIRouter(prefix="/api")

    @api.get("/system/info")
    def system_info() -> dict:
        return {
            "version": __version__,
            "data_dir": str(data_dir()),
            "ffmpeg": shutil.which("ffmpeg") is not None,
        }

    for mod in (system, projects, lyrics, prompts, albums, takes, processing,
                record, jobs, templates, importer, analysis, advanced):
        api.include_router(mod.router)
    return api


def create_app() -> FastAPI:
    app = FastAPI(title="Audio Cleaner", version=__version__, lifespan=lifespan)
    install_error_handlers(app)
    app.include_router(_api_router())

    from app.api import ws

    app.include_router(ws.router)

    if FRONTEND_DIST.exists():
        app.frontend("/", directory=str(FRONTEND_DIST))

    return app


app = create_app()


def run() -> None:
    import uvicorn

    from app.config import get_settings

    settings = get_settings()
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)


if __name__ == "__main__":
    run()
