"""De-esser multibanda próprio — não existe pronto em lib permissiva.

Crossover Linkwitz-Riley de 4ª ordem isola a banda sibilante (padrão 4.5–9 kHz);
um envelope follower aplica redução de ganho apenas quando a banda ultrapassa o
threshold, e as bandas são recombinadas.
"""

from __future__ import annotations

import numpy as np
from pydantic import Field
from scipy.signal import butter, sosfilt

from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams


class DeesserParams(StageParams):
    f_lo: float = Field(default=4500.0, ge=2000.0, le=8000.0, description="Início da banda (Hz)")
    f_hi: float = Field(default=9000.0, ge=6000.0, le=16000.0, description="Fim da banda (Hz)")
    threshold_db: float = Field(default=-30.0, ge=-60.0, le=0.0)
    ratio: float = Field(default=3.0, ge=1.0, le=10.0)
    max_reduction_db: float = Field(default=8.0, ge=0.0, le=24.0)
    attack_ms: float = Field(default=1.0, ge=0.1, le=20.0)
    release_ms: float = Field(default=60.0, ge=5.0, le=500.0)


def _lr4(cutoff: float, sr: int, btype: str) -> np.ndarray:
    # LR4 = dois Butterworth de 2ª ordem em cascata
    sos = butter(2, cutoff, btype=btype, fs=sr, output="sos")
    return np.vstack([sos, sos])


class DeesserStage(Stage):
    id = "deesser"
    name_key = "stages.deesser"
    category = "cleanup"
    Params = DeesserParams

    def process(self, buf: AudioBuffer, params: DeesserParams, ctx: StageContext) -> AudioBuffer:
        sr = buf.sample_rate
        x = buf.data if buf.data.ndim == 1 else buf.data.mean(axis=1)

        f_hi = min(params.f_hi, sr / 2 * 0.95)
        band = sosfilt(_lr4(params.f_lo, sr, "highpass"), x)
        band = sosfilt(_lr4(f_hi, sr, "lowpass"), band)
        rest = x - band

# envelope em control-rate (blocos de 32 amostras) — loop por amostra seria
        # lento demais para takes de minutos
        block = 32
        n = len(band)
        pad = (-n) % block
        absb = np.abs(np.pad(band, (0, pad))).reshape(-1, block).max(axis=1)
        atk = np.exp(-block / (params.attack_ms * 0.001 * sr))
        rel = np.exp(-block / (params.release_ms * 0.001 * sr))
        env = np.empty_like(absb)
        e = 0.0
        for i in range(len(absb)):
            coef = atk if absb[i] > e else rel
            e = coef * e + (1.0 - coef) * absb[i]
            env[i] = e

        env_db = 20.0 * np.log10(np.maximum(env, 1e-7))
        over = env_db - params.threshold_db
        reduction = np.where(over > 0.0, over * (1.0 - 1.0 / params.ratio), 0.0)
        reduction = np.minimum(reduction, params.max_reduction_db)
        gain = np.repeat(10.0 ** (-reduction / 20.0), block)[:n]

        out = rest + band * gain
        return AudioBuffer(out.astype(np.float32), sr)
