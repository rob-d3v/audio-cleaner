"""De-reverb — remove reverberação/eco (extra "separate").

Prefere o modelo UVR **UVR-DeEcho-DeReverb** (via audio-separator, onnxruntime
CPU), devolvendo a saída seca ("no reverb"). Se o extra não estiver instalado ou
o modelo falhar por qualquer motivo, cai num supressor de cauda de reverb por
*spectral gating* (DSP barato e documentado) — assim o estágio nunca derruba a
cadeia. `mix` (0..1) mistura seco (processado) com o sinal original.

O import de ``audio_separator`` acontece só dentro de ``process()`` (o extra pode
faltar); o módulo em si importa sem dependências pesadas, então o registro sempre
o encontra e a via DSP garante funcionamento mesmo sem o modelo.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import soxr
from pydantic import Field
from scipy.signal import istft, stft

from app.pipeline.base import AudioBuffer, JobCancelled, Stage, StageContext, StageParams

DEREVERB_MODEL = "UVR-DeEcho-DeReverb.pth"  # VR arch, stems: 'no reverb' / 'reverb'

_N_FFT = 2048
_HOP = _N_FFT // 4
_DSP_ALPHA = 0.5   # vazamento do integrador da estimativa de reverb
_DSP_BETA = 1.6    # agressividade da subtração espectral
_DSP_FLOOR = 0.1   # piso de ganho (~-20 dB) para não zerar bins


class DereverbUvrParams(StageParams):
    mix: float = Field(default=1.0, ge=0.0, le=1.0, description="Mistura seco/úmido")


class DereverbUvrStage(Stage):
    id = "dereverb_uvr"
    name_key = "stages.dereverb_uvr"
    category = "cleanup"
    Params = DereverbUvrParams
    requires_extra = "separate"
    required_sr = 48000

    def process(self, buf: AudioBuffer, params: DereverbUvrParams,
                ctx: StageContext) -> AudioBuffer:
        x = buf.data if buf.data.ndim == 1 else buf.data.mean(axis=1)
        x = np.asarray(x, dtype=np.float32)

        dry = self._uvr(x, buf.sample_rate, ctx)
        if dry is None:
            dry = self._dsp(x, buf.sample_rate, ctx)
        ctx.progress(1.0)

        n = min(len(dry), len(x))
        dry = dry[:n]
        if params.mix < 1.0:
            out = params.mix * dry + (1.0 - params.mix) * x[:n]
        else:
            out = dry
        return AudioBuffer(out.astype(np.float32), buf.sample_rate)

    # ------------------------------------------------------------ modelo UVR

    def _uvr(self, x: np.ndarray, sr: int, ctx: StageContext) -> np.ndarray | None:
        """Roda o modelo UVR de-reverb; devolve o sinal seco ou None se indisponível."""
        try:
            from audio_separator.separator import Separator
        except ImportError:
            return None

        from app.config import data_dir

        try:
            models = data_dir() / "models"
            models.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory() as tmp:
                in_path = Path(tmp) / "in.wav"
                sf.write(str(in_path), x, sr, subtype="PCM_24")
                separator = Separator(
                    model_file_dir=str(models),
                    output_dir=tmp,
                    output_format="WAV",
                    sample_rate=sr,
                )
                separator.load_model(model_filename=DEREVERB_MODEL)
                ctx.check_cancelled()
                ctx.progress(0.4)
                outputs = separator.separate(str(in_path))
                dry_path = self._pick_dry(outputs, tmp)
                if dry_path is None:
                    return None
                data, dsr = sf.read(str(dry_path), dtype="float32", always_2d=False)
                if data.ndim > 1:
                    data = data.mean(axis=1)
                if dsr != sr:
                    data = soxr.resample(data, dsr, sr)
                return np.asarray(data, dtype=np.float32)
        except JobCancelled:
            raise
        except Exception:  # noqa: BLE001 — falha do modelo → cai no fallback DSP
            return None

    @staticmethod
    def _pick_dry(outputs: list[str], tmp: str) -> Path | None:
        for out_name in outputs:
            p = Path(out_name)
            if not p.is_absolute():
                p = Path(tmp) / p.name
            low = p.name.lower()
            if "no reverb" in low or "no_reverb" in low or "noreverb" in low:
                return p
        return None

    # ----------------------------------------------------------- fallback DSP

    def _dsp(self, x: np.ndarray, sr: int, ctx: StageContext) -> np.ndarray:
        """Supressor de cauda de reverb por spectral gating (fallback barato).

        Estima a energia reverberante como um integrador com vazamento das
        magnitudes passadas e aplica um ganho tipo-Wiener contra ela: ataques
        (magnitude >> estimativa) passam; caudas sustentadas são atenuadas.
        """
        _f, _t, z = stft(x, fs=sr, nperseg=_N_FFT, noverlap=_N_FFT - _HOP,
                         boundary="zeros")
        mag = np.abs(z)
        phase = np.angle(z)
        gains = np.ones_like(mag)
        r = np.zeros(mag.shape[0], dtype=np.float64)
        for ti in range(mag.shape[1]):
            if ti % 256 == 0:
                ctx.check_cancelled()
            m = mag[:, ti].astype(np.float64)
            g = m**2 / (m**2 + (_DSP_BETA * r) ** 2 + 1e-12)
            gains[:, ti] = np.clip(g, _DSP_FLOOR, 1.0)
            r = _DSP_ALPHA * r + (1.0 - _DSP_ALPHA) * m
        z_clean = (mag * gains) * np.exp(1j * phase)
        _tt, y = istft(z_clean, fs=sr, nperseg=_N_FFT, noverlap=_N_FFT - _HOP,
                       boundary=True)
        y = np.asarray(y, dtype=np.float32)
        if len(y) < len(x):
            y = np.pad(y, (0, len(x) - len(y)))
        return y[:len(x)]
