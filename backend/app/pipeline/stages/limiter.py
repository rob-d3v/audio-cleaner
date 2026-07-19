"""Limiter — teto de pico (Suno pede picos entre -12 e -6 dBFS)."""

from __future__ import annotations

import numpy as np
from pedalboard import Limiter, Pedalboard
from pydantic import Field

from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams


class LimiterParams(StageParams):
    ceiling_db: float = Field(default=-6.0, ge=-24.0, le=0.0)
    release_ms: float = Field(default=100.0, ge=10.0, le=1000.0)


class LimiterStage(Stage):
    id = "limiter"
    name_key = "stages.limiter"
    category = "dynamics"
    Params = LimiterParams

    def process(self, buf: AudioBuffer, params: LimiterParams, ctx: StageContext) -> AudioBuffer:
        board = Pedalboard([Limiter(threshold_db=params.ceiling_db,
                                    release_ms=params.release_ms)])
        out = board(buf.data, buf.sample_rate)
        # Rede de segurança brickwall: garante o teto mesmo se o limiter do
        # pedalboard deixar passar transientes (o contrato do estágio é
        # "pico <= ceiling"). Só age nos poucos samples que ultrapassam.
        ceiling = 10.0 ** (params.ceiling_db / 20.0)
        np.clip(out, -ceiling, ceiling, out=out)
        return AudioBuffer(out, buf.sample_rate)
