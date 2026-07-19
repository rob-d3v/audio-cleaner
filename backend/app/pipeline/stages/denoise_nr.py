"""Redução de ruído espectral (noisereduce) — fallback leve, sempre disponível."""

from __future__ import annotations

import numpy as np
from pydantic import Field

from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams


class DenoiseNrParams(StageParams):
    strength: float = Field(default=0.85, ge=0.0, le=1.0, description="Intensidade da redução")
    stationary: bool = Field(default=False, description="Ruído estacionário (ventilador, hiss)")


class DenoiseNrStage(Stage):
    id = "denoise_nr"
    name_key = "stages.denoise_nr"
    category = "cleanup"
    Params = DenoiseNrParams

    def process(self, buf: AudioBuffer, params: DenoiseNrParams, ctx: StageContext) -> AudioBuffer:
        import noisereduce as nr

        data = buf.data
        mono = data if data.ndim == 1 else data.mean(axis=1)
        out = nr.reduce_noise(
            y=mono,
            sr=buf.sample_rate,
            stationary=params.stationary,
            prop_decrease=params.strength,
        )
        return AudioBuffer(np.asarray(out, dtype=np.float32), buf.sample_rate)
