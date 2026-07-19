"""DeepFilterNet 3 — redução de ruído neural (extra "denoise").

Roda em CPU em tempo real. Modelo carregado sob demanda e processado em chunks
com overlap-add para permitir progresso e cancelamento. Import de torch/df só
acontece dentro de process() (nunca no import do módulo)."""

from __future__ import annotations

import numpy as np
from pydantic import Field

from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams

_DF_STATE: dict = {}
CHUNK_S = 10.0
OVERLAP_S = 0.5


class DenoiseDfn3Params(StageParams):
    mix: float = Field(default=1.0, ge=0.0, le=1.0, description="Mistura seco/processado")


def _get_model():
    if "model" not in _DF_STATE:
        from df.enhance import init_df

        model, df_state, _ = init_df()
        _DF_STATE["model"] = model
        _DF_STATE["df_state"] = df_state
        _DF_STATE["sr"] = df_state.sr()
    return _DF_STATE["model"], _DF_STATE["df_state"], _DF_STATE["sr"]


class DenoiseDfn3Stage(Stage):
    id = "denoise_dfn3"
    name_key = "stages.denoise_dfn3"
    category = "cleanup"
    Params = DenoiseDfn3Params
    requires_extra = "denoise"
    required_sr = 48000

    def process(self, buf: AudioBuffer, params: DenoiseDfn3Params,
                ctx: StageContext) -> AudioBuffer:
        import torch
        from df.enhance import enhance

        model, df_state, sr = _get_model()
        x = buf.data if buf.data.ndim == 1 else buf.data.mean(axis=1)

        chunk = int(CHUNK_S * sr)
        overlap = int(OVERLAP_S * sr)
        out = np.zeros_like(x)
        pos = 0
        total = max(1, len(x))
        while pos < len(x):
            ctx.check_cancelled()
            end = min(pos + chunk, len(x))
            seg = x[max(0, pos - overlap):end]
            tensor = torch.from_numpy(seg.astype(np.float32)).unsqueeze(0)
            enhanced = enhance(model, df_state, tensor).squeeze(0).cpu().numpy()
            head = overlap if pos > 0 else 0
            out[pos:end] = enhanced[head:head + (end - pos)]
            pos = end
            ctx.progress(min(1.0, pos / total))

        if params.mix < 1.0:
            out = params.mix * out + (1.0 - params.mix) * x
        return AudioBuffer(out.astype(np.float32), buf.sample_rate)
