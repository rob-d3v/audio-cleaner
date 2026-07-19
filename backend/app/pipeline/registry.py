"""Registro de estágios: id → instância. Exporta metadados + JSON Schema pra API."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.pipeline.base import Stage
from app.pipeline.stages.compressor import CompressorStage
from app.pipeline.stages.deesser import DeesserStage
from app.pipeline.stages.denoise_nr import DenoiseNrStage
from app.pipeline.stages.eq import EqStage
from app.pipeline.stages.highpass import HighpassStage
from app.pipeline.stages.limiter import LimiterStage
from app.pipeline.stages.loudness import LoudnessStage
from app.pipeline.stages.trim_silence import TrimSilenceStage

# ordem canônica da cadeia — a UI apresenta nesta sequência
STAGE_ORDER = [
    "highpass",
    "denoise_nr",
    "denoise_dfn3",
    "dereverb_uvr",
    "deesser",
    "eq",
    "compressor",
    "limiter",
    "loudness",
    "trim_silence",
]


@lru_cache
def get_registry() -> dict[str, Stage]:
    stages: list[Stage] = [
        HighpassStage(),
        DenoiseNrStage(),
        DeesserStage(),
        EqStage(),
        CompressorStage(),
        LimiterStage(),
        LoudnessStage(),
        TrimSilenceStage(),
    ]
    # estágios opcionais (extras pesados) entram aqui quando implementados
    try:
        from app.pipeline.stages.denoise_dfn3 import DenoiseDfn3Stage

        stages.append(DenoiseDfn3Stage())
    except ImportError:
        pass
    try:
        from app.pipeline.stages.dereverb_uvr import DereverbUvrStage

        stages.append(DereverbUvrStage())
    except ImportError:
        pass
    return {s.id: s for s in stages}


def stages_info(capabilities: dict[str, bool] | None = None) -> list[dict[str, Any]]:
    registry = get_registry()
    ordered = [registry[sid] for sid in STAGE_ORDER if sid in registry]
    return [
        {
            "id": s.id,
            "name_key": s.name_key,
            "category": s.category,
            "params_schema": s.Params.model_json_schema(),
            "defaults": s.Params().model_dump(),
            "requires": s.requires_extra,
            "available": s.available(capabilities),
        }
        for s in ordered
    ]
