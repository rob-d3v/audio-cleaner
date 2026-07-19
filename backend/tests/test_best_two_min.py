"""Testes do best-2-min: janela deslizante sobre sinal sintético.

Sinal: ruído (ruim) → rajadas tipo-fala (melhor) → silêncio (ruim). A melhor
janela deve centrar na seção do meio; áudio curto devolve o arquivo inteiro.
"""

from __future__ import annotations

import numpy as np
import soundfile as sf

from app.analysis.best_two_min import best_window

SR = 16000  # taxa menor deixa o teste rápido; os detectores independem de SR alto


def _speech_bursts(dur: float, sr: int = SR, amp: float = 0.4, freq: float = 300.0) -> np.ndarray:
    """Rajadas tipo-fala: tom com envelope on/off (0.3 s ligado, 0.2 s desligado)."""
    n = int(dur * sr)
    t = np.arange(n) / sr
    tone = amp * np.sin(2 * np.pi * freq * t)
    env = ((t % 0.5) < 0.3).astype(np.float32)  # ~60% ativo → alta razão de fala
    return (tone * env).astype(np.float32)


def _noise(dur: float, sr: int = SR, amp: float = 0.008, seed: int = 0) -> np.ndarray:
    """Ruído estacionário fraco (~-42 dB): bem abaixo do pico da fala (-11 dB)."""
    rng = np.random.default_rng(seed)
    return (amp * rng.standard_normal(int(dur * sr))).astype(np.float32)


def test_best_window_centers_on_speech(tmp_path):
    sr = SR
    pre = _noise(4.0, seed=1)                       # 0–4 s: ruído fraco (SNR baixo)
    mid = _speech_bursts(4.0)                        # 4–8 s: rajadas tipo-fala (melhor)
    post = np.zeros(int(4.0 * sr), dtype=np.float32)  # 8–12 s: silêncio
    sig = np.concatenate([pre, mid, post])
    path = tmp_path / "clip.wav"
    sf.write(path, sig, sr)

    res = best_window(path, window_s=4.0, hop_s=1.0)

    # a melhor janela deve cobrir a seção de fala (4–8 s)
    assert 3.0 <= res["start_s"] <= 5.0
    assert abs((res["end_s"] - res["start_s"]) - 4.0) < 1e-6

    # a pontuação retornada é o máximo entre todas as janelas avaliadas
    scores = {w["start_s"]: w["score"] for w in res["per_window"]}
    assert res["score"] == max(scores.values())
    # a janela inicial (ruído) pontua abaixo da melhor
    assert scores.get(0.0, 0.0) < res["score"]


def test_short_audio_returns_whole(tmp_path):
    sig = _speech_bursts(3.0)
    path = tmp_path / "short.wav"
    sf.write(path, sig, SR)

    res = best_window(path, window_s=120.0, hop_s=5.0)
    assert res["start_s"] == 0.0
    assert abs(res["end_s"] - 3.0) < 0.05
    assert len(res["per_window"]) == 1
