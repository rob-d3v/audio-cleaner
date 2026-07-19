"""Corte de silêncio nas pontas via VAD (Silero ONNX) com fallback por energia.

O VAD roda numa cópia a 16 kHz; os limites são aplicados no master (48 kHz).
Modelo ONNX (~2 MB) é baixado no primeiro uso para {data_dir}/models/.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import soxr
from pydantic import Field

from app.config import data_dir
from app.pipeline.base import AudioBuffer, Stage, StageContext, StageParams

logger = logging.getLogger(__name__)

SILERO_URL = "https://raw.githubusercontent.com/snakers4/silero-vad/master/src/silero_vad/data/silero_vad.onnx"
VAD_SR = 16000
FRAME = 512  # amostras por janela do Silero em 16 kHz


class TrimSilenceParams(StageParams):
    pad_ms: float = Field(default=150.0, ge=0.0, le=1000.0,
                          description="Respiro mantido antes/depois da fala")
    threshold: float = Field(default=0.5, ge=0.1, le=0.9, description="Sensibilidade do VAD")


def _model_path() -> Path:
    return data_dir() / "models" / "silero_vad.onnx"


def _ensure_model() -> Path | None:
    path = _model_path()
    if path.exists():
        return path
    try:
        import httpx

        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".onnx.tmp")
        with httpx.stream("GET", SILERO_URL, follow_redirects=True, timeout=60) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        tmp.replace(path)
        return path
    except Exception:  # noqa: BLE001 — sem rede cai no fallback por energia
        logger.warning("não foi possível baixar o modelo Silero VAD; usando fallback", exc_info=True)
        return None


def _speech_bounds_vad(mono16k: np.ndarray, threshold: float) -> tuple[int, int] | None:
    import onnxruntime as ort

    model = _ensure_model()
    if model is None:
        return None
    try:
        sess = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
        n_frames = len(mono16k) // FRAME
        if n_frames == 0:
            return None
        state = np.zeros((2, 1, 128), dtype=np.float32)
        sr_in = np.array(VAD_SR, dtype=np.int64)
        probs = np.empty(n_frames, dtype=np.float32)
        for i in range(n_frames):
            chunk = mono16k[i * FRAME:(i + 1) * FRAME].reshape(1, -1)
            out, state = sess.run(None, {"input": chunk, "state": state, "sr": sr_in})
            probs[i] = out[0, 0]
        speech = np.flatnonzero(probs >= threshold)
        if len(speech) == 0:
            return None
        return int(speech[0]) * FRAME, int(speech[-1] + 1) * FRAME
    except Exception:  # noqa: BLE001
        logger.warning("VAD Silero falhou; usando fallback por energia", exc_info=True)
        return None


def _speech_bounds_energy(mono16k: np.ndarray) -> tuple[int, int] | None:
    win = VAD_SR // 20  # 50 ms
    n = len(mono16k) // win
    if n == 0:
        return None
    frames = mono16k[: n * win].reshape(n, win)
    rms_db = 20 * np.log10(np.sqrt((frames**2).mean(axis=1)) + 1e-9)
    floor = np.percentile(rms_db, 10)
    active = np.flatnonzero(rms_db > floor + 12.0)
    if len(active) == 0:
        return None
    return int(active[0]) * win, int(active[-1] + 1) * win


class TrimSilenceStage(Stage):
    id = "trim_silence"
    name_key = "stages.trim_silence"
    category = "utility"
    Params = TrimSilenceParams

    def process(self, buf: AudioBuffer, params: TrimSilenceParams,
                ctx: StageContext) -> AudioBuffer:
        mono = buf.data if buf.data.ndim == 1 else buf.data.mean(axis=1)
        mono16k = soxr.resample(mono, buf.sample_rate, VAD_SR).astype(np.float32)

        bounds = _speech_bounds_vad(mono16k, params.threshold)
        if bounds is None:
            bounds = _speech_bounds_energy(mono16k)
        if bounds is None:
            return buf

        scale = buf.sample_rate / VAD_SR
        pad = int(params.pad_ms * 0.001 * buf.sample_rate)
        start = max(0, int(bounds[0] * scale) - pad)
        end = min(len(buf.data), int(bounds[1] * scale) + pad)
        if end <= start:
            return buf
        return AudioBuffer(buf.data[start:end], buf.sample_rate)
