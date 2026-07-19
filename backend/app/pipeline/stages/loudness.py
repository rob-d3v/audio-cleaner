"""Normalização de loudness LUFS (ITU-R BS.1770 via pyloudnorm) com teto de pico."""

from __future__ import annotations

import numpy as np
import pyloudnorm
from pydantic import Field

from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams


class LoudnessParams(StageParams):
    lufs_target: float = Field(default=-18.0, ge=-36.0, le=-6.0)
    true_peak_max_db: float = Field(default=-6.0, ge=-12.0, le=0.0)


class LoudnessStage(Stage):
    id = "loudness"
    name_key = "stages.loudness"
    category = "dynamics"
    Params = LoudnessParams

    def process(self, buf: AudioBuffer, params: LoudnessParams, ctx: StageContext) -> AudioBuffer:
        data = buf.data if buf.data.ndim == 1 else buf.data.mean(axis=1)
        meter = pyloudnorm.Meter(buf.sample_rate)
        loudness = meter.integrated_loudness(data)
        if not np.isfinite(loudness):
            return buf
        gain_db = params.lufs_target - loudness
        out = data * (10.0 ** (gain_db / 20.0))

        # respeita o teto de pico mesmo que fique abaixo do LUFS alvo
        peak = float(np.max(np.abs(out))) if len(out) else 0.0
        ceiling = 10.0 ** (params.true_peak_max_db / 20.0)
        if peak > ceiling:
            out = out * (ceiling / peak)
        return AudioBuffer(out.astype(np.float32), buf.sample_rate)
