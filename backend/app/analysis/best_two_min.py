"""Best-2-min — encontra a melhor janela contígua de ~2 min para o Suno Voices.

O Suno Voices usa os *melhores* 2 minutos de um upload. Este módulo desliza uma
janela de `window_s` sobre o áudio (passo `hop_s`) e pontua cada posição por um
combo ponderado, cada componente normalizado em 0..1:

    score = 0.45·speech_ratio     (fração de frames ativos — VAD por energia)
          + 0.25·snr              (SNR da janela / 40 dB de referência)
          + 0.15·(1 − clip_ratio) (recompensa ausência de clipping)
          + 0.15·dyn_coverage     (espalhamento p90−p10 do RMS / 40 dB)

Fala domina porque o alvo é treinar a voz: silêncio/ruído puro pontua baixo.
A cobertura de faixa dinâmica recompensa variedade (trechos suaves *e* fortes),
que soam mais naturais que um trecho de nível constante.

O VAD por energia combina dois limiares sobre os frames RMS (via
`detectors._rms_frames`): o frame é fala se estiver acima do piso de ruído E
próximo do pico da janela — o teto pelo pico evita contar ruído estacionário de
fundo como fala (uma falha de VAD só com piso relativo, que infla janelas
majoritariamente ruidosas). SNR e clipping vêm direto de `detectors`.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf

from app.analysis import detectors as d

# pesos do combo (somam 1.0) — fala domina para o Suno Voices
_W_SPEECH = 0.45
_W_SNR = 0.25
_W_CLIP = 0.15
_W_DYN = 0.15

_SNR_REF_DB = 40.0  # SNR "excelente" ~40 dB → normaliza para 1.0
_DYN_REF_DB = 40.0  # espalhamento p90−p10 de RMS (dB) → normaliza para 1.0


def _mono(data: np.ndarray) -> np.ndarray:
    return data if data.ndim == 1 else data.mean(axis=1)


def _clip01(v: float) -> float:
    return float(min(1.0, max(0.0, v)))


# limiares do VAD por energia (dB)
_VAD_FLOOR_MARGIN = 10.0  # frame precisa estar este tanto acima do piso
_VAD_PEAK_RANGE = 25.0    # e no máximo este tanto abaixo do pico (corta ruído de fundo)


def _speech_ratio(rms_db: np.ndarray) -> float:
    """VAD por energia robusto: fração de frames acima do piso E perto do pico."""
    floor_db = float(np.percentile(rms_db, 10))
    peak_db = float(np.percentile(rms_db, 95))
    active = (rms_db > floor_db + _VAD_FLOOR_MARGIN) & (rms_db > peak_db - _VAD_PEAK_RANGE)
    return float(active.mean()) if active.size else 0.0


def _score_window(x: np.ndarray, sr: int) -> float:
    """Pontuação 0..1 de uma janela — combo ponderado dos detectores."""
    if len(x) == 0:
        return 0.0
    rms = d._rms_frames(x, sr, ms=50.0)
    rms_db = 20 * np.log10(rms + 1e-9)

    speech = _speech_ratio(rms_db)
    snr = d.noise_floor(x, sr)["snr_db"]
    clip_ratio = d.clipping(x)["ratio"]
    dyn_spread = float(np.percentile(rms_db, 90) - np.percentile(rms_db, 10))

    n_speech = _clip01(speech)
    n_snr = _clip01(snr / _SNR_REF_DB)
    n_clip = _clip01(1.0 - clip_ratio)
    n_dyn = _clip01(dyn_spread / _DYN_REF_DB)

    score = _W_SPEECH * n_speech + _W_SNR * n_snr + _W_CLIP * n_clip + _W_DYN * n_dyn
    return round(float(score), 4)


def best_window(path: str | Path, window_s: float = 120.0, hop_s: float = 5.0) -> dict:
    """Desliza uma janela de `window_s` e devolve a de maior pontuação.

    Retorna ``{start_s, end_s, score, window_s, per_window:[{start_s, score}]}``.
    Se o áudio for mais curto que `window_s`, devolve o arquivo inteiro.
    """
    data, sr = sf.read(str(path), dtype="float32", always_2d=False)
    x = np.asarray(_mono(data), dtype=np.float32)
    total = len(x)
    dur = total / sr if sr else 0.0

    if dur <= window_s or total == 0:
        score = _score_window(x, sr)
        return {
            "start_s": 0.0,
            "end_s": round(dur, 3),
            "score": score,
            "window_s": round(dur, 3),
            "per_window": [{"start_s": 0.0, "score": score}],
        }

    win = int(window_s * sr)
    hop = max(1, int(hop_s * sr))
    last_start = total - win
    starts = list(range(0, last_start + 1, hop))
    if not starts or starts[-1] != last_start:
        starts.append(last_start)  # ancora a última janela no fim do áudio

    per_window: list[dict] = []
    best_start = 0
    best_score = -1.0
    for start in starts:
        score = _score_window(x[start:start + win], sr)
        per_window.append({"start_s": round(start / sr, 3), "score": score})
        if score > best_score:
            best_score = score
            best_start = start

    return {
        "start_s": round(best_start / sr, 3),
        "end_s": round((best_start + win) / sr, 3),
        "score": round(best_score, 4),
        "window_s": float(window_s),
        "per_window": per_window,
    }
