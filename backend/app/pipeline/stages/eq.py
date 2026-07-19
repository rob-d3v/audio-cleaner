"""EQ paramétrico simples: shelves + até 2 peaks + notch de hum opcional."""

from __future__ import annotations

from pedalboard import HighShelfFilter, LowShelfFilter, PeakFilter, Pedalboard
from pydantic import Field

from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams


class EqParams(StageParams):
    low_shelf_freq: float = Field(default=120.0, ge=40.0, le=500.0)
    low_shelf_gain_db: float = Field(default=0.0, ge=-12.0, le=12.0)
    high_shelf_freq: float = Field(default=8000.0, ge=2000.0, le=16000.0)
    high_shelf_gain_db: float = Field(default=0.0, ge=-12.0, le=12.0)
    peak1_freq: float = Field(default=250.0, ge=60.0, le=16000.0)
    peak1_gain_db: float = Field(default=0.0, ge=-12.0, le=12.0)
    peak1_q: float = Field(default=1.0, ge=0.3, le=10.0)
    peak2_freq: float = Field(default=3000.0, ge=60.0, le=16000.0)
    peak2_gain_db: float = Field(default=0.0, ge=-12.0, le=12.0)
    peak2_q: float = Field(default=1.0, ge=0.3, le=10.0)
    notch_hum_freq: float = Field(default=0.0, ge=0.0, le=120.0,
                                  description="0 = desligado; 50 ou 60 remove hum da rede")


class EqStage(Stage):
    id = "eq"
    name_key = "stages.eq"
    category = "tone"
    Params = EqParams

    def process(self, buf: AudioBuffer, params: EqParams, ctx: StageContext) -> AudioBuffer:
        plugins = []
        if params.low_shelf_gain_db:
            plugins.append(LowShelfFilter(cutoff_frequency_hz=params.low_shelf_freq,
                                          gain_db=params.low_shelf_gain_db))
        if params.high_shelf_gain_db:
            plugins.append(HighShelfFilter(cutoff_frequency_hz=params.high_shelf_freq,
                                           gain_db=params.high_shelf_gain_db))
        for freq, gain, q in ((params.peak1_freq, params.peak1_gain_db, params.peak1_q),
                              (params.peak2_freq, params.peak2_gain_db, params.peak2_q)):
            if gain:
                plugins.append(PeakFilter(cutoff_frequency_hz=freq, gain_db=gain, q=q))
        if params.notch_hum_freq:
            # notch estreito no fundamental + 2 harmônicos
            for mult in (1, 2, 3):
                plugins.append(PeakFilter(cutoff_frequency_hz=params.notch_hum_freq * mult,
                                          gain_db=-24.0, q=30.0))
        if not plugins:
            return buf
        out = Pedalboard(plugins)(buf.data, buf.sample_rate)
        return AudioBuffer(out, buf.sample_rate)
