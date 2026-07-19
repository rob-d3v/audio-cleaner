"""Modelos Pydantic persistidos em JSON (project.json, take.json, álbuns, prompts)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()

ProjectStatus = Literal["idea", "em_progresso", "quase", "pronto"]
ProjectMode = Literal["voice", "voice_guitar"]
LinkType = Literal["flp", "gdoc", "url", "file"]
TakeOrigin = Literal["recorded", "imported"]
PromptKind = Literal["style", "lyrics_prompt"]

PROMPT_HISTORY_MAX = 50


class Link(BaseModel):
    id: str
    type: LinkType
    label: str
    target: str


class ImportInfo(BaseModel):
    source_path: str
    imported_at: str


class Project(BaseModel):
    schema_version: int = 1
    id: str
    name: str
    status: ProjectStatus = "em_progresso"
    mode: ProjectMode = "voice"
    created_at: str
    updated_at: str
    album_id: str | None = None
    track_hint: int | None = None
    best_take_id: str | None = None
    cover: bool = False
    links: list[Link] = []
    import_info: ImportInfo | None = None


class ProcessedVariant(BaseModel):
    chain_hash: str
    chain: dict[str, Any]
    created_at: str


class Take(BaseModel):
    schema_version: int = 1
    id: str
    project_id: str
    created_at: str = Field(default_factory=_now_iso)
    duration_s: float = 0.0
    sample_rate: int = 0
    channels: int = 1
    device: dict[str, Any] | None = None
    rating: int = 0
    notes: str = ""
    origin: TakeOrigin = "recorded"
    original_file: str | None = None
    transcoded: bool = False
    session_label: str | None = None
    processed: list[ProcessedVariant] = []


class Album(BaseModel):
    schema_version: int = 1
    id: str
    name: str
    created_at: str
    project_ids: list[str] = []
    cover_project_id: str | None = None


class PromptEntry(BaseModel):
    text: str
    template_id: str | None = None
    variables: dict[str, Any] = {}
    updated_at: str


class PromptSlot(BaseModel):
    current: PromptEntry | None = None
    history: list[PromptEntry] = []


class ProjectPrompts(BaseModel):
    schema_version: int = 1
    style: PromptSlot = PromptSlot()
    lyrics_prompt: PromptSlot = PromptSlot()
