"""Injeção de dependências — singletons compartilhados pela API."""

from __future__ import annotations

from functools import lru_cache

from app.core.jobs import JobManager
from app.core.library import LibraryStore
from app.core.recorder import RecorderService
from app.core.recorder import get_recorder as _get_recorder


@lru_cache
def get_library() -> LibraryStore:
    return LibraryStore()


@lru_cache
def get_jobs() -> JobManager:
    return JobManager()


def get_recorder() -> RecorderService:
    return _get_recorder()


def reset_singletons() -> None:
    """Usado em testes para reconstruir os singletons com um data dir limpo."""
    get_library.cache_clear()
    get_jobs.cache_clear()
