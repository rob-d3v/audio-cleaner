"""Filtro passa-altas — remove ronco de graves, tráfego, handling noise."""

from __future__ import annotations

from pedalboard import HighpassFilter, Pedalboard
from pydantic import Field

from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams


class HighpassParams(StageParams):
    freq: float = Field(default=80.0, ge=20.0, le=400.0, description="Frequência de corte (Hz)")


class HighpassStage(Stage):
    id = "highpass"
    name_key = "stages.highpass"
    category = "cleanup"
    Params = HighpassParams

    def process(self, buf: AudioBuffer, params: HighpassParams, ctx: StageContext) -> AudioBuffer:
        board = Pedalboard([HighpassFilter(cutoff_frequency_hz=params.freq)])
        out = board(buf.data, buf.sample_rate)
        return AudioBuffer(out, buf.sample_rate)
