"""Rotas de sistema: info, capacidades, presets, estágios do pipeline."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.core import presets as presets_mod
from app.core.capabilities import get_capabilities
from app.core.processing import stage_capabilities
from app.pipeline.registry import stages_info

router = APIRouter(tags=["system"])


@router.get("/system/capabilities")
def capabilities() -> dict:
    return get_capabilities()


@router.get("/pipeline/stages")
def pipeline_stages() -> list[dict]:
    return stages_info(stage_capabilities())


@router.get("/presets")
def list_presets() -> list[dict]:
    return presets_mod.list_presets()


class PresetBody(BaseModel):
    preset: dict[str, Any]


@router.post("/presets", status_code=201)
def save_preset(body: PresetBody) -> dict:
    return presets_mod.save_user_preset(body.preset)


@router.delete("/presets/{preset_id}", status_code=204)
def delete_preset(preset_id: str) -> Response:
    presets_mod.delete_user_preset(preset_id)
    return Response(status_code=204)
