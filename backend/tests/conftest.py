"""Fixtures compartilhadas: data dir isolado + TestClient."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture
def data_root(tmp_path, monkeypatch) -> Path:
    """Aponta o app para um data dir limpo e reseta os singletons."""
    root = tmp_path / "data"
    root.mkdir()
    monkeypatch.setenv("AUDIO_CLEANER_DATA_DIR", str(root))

    from app import config, deps

    config.get_settings.cache_clear()
    deps.reset_singletons()
    yield root
    config.get_settings.cache_clear()
    deps.reset_singletons()


@pytest.fixture
def client(data_root):
    """TestClient com routers montados (sem servir o SPA)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api import ws
    from app.errors import install_error_handlers
    from app.main import _api_router

    app = FastAPI()
    install_error_handlers(app)
    app.include_router(_api_router())
    app.include_router(ws.router)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def library(data_root):
    from app.core.library import LibraryStore

    return LibraryStore(data_root)
