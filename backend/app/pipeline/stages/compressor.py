"""Compressão suave — controla dinâmica sem esmagar (alvo: voz para treino de IA)."""

from __future__ import annotations

from pedalboard import Compressor, Pedalboard
from pydantic import Field

from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams


class CompressorParams(StageParams):
    threshold_db: float = Field(default=-18.0, ge=-60.0, le=0.0)
    ratio: float = Field(default=2.0, ge=1.0, le=10.0)
    attack_ms: float = Field(default=5.0, ge=0.1, le=100.0)
    release_ms: float = Field(default=100.0, ge=10.0, le=1000.0)


class CompressorStage(Stage):
    id = "compressor"
    name_key = "stages.compressor"
    category = "dynamics"
    Params = CompressorParams

    def process(self, buf: AudioBuffer, params: CompressorParams,
                ctx: StageContext) -> AudioBuffer:
        board = Pedalboard([Compressor(threshold_db=params.threshold_db, ratio=params.ratio,
                                       attack_ms=params.attack_ms,
                                       release_ms=params.release_ms)])
        out = board(buf.data, buf.sample_rate)
        return AudioBuffer(out, buf.sample_rate)
