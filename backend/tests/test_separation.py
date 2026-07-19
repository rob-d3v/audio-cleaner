"""Teste pesado da separação de fontes (voz/instrumental) — pulado no CI.

Só roda com o extra 'separate' instalado. Usa uma mistura sintética curta; os
modelos baixam na primeira execução (lento), por isso o marcador `heavy`.
"""

from __future__ import annotations

import importlib.util

import numpy as np
import pytest
import soundfile as sf

pytestmark = pytest.mark.heavy

_HAS_SEP = importlib.util.find_spec("audio_separator") is not None


class _Ctx:
    """JobContext mínimo para o teste."""

    def progress(self, *_a, **_k) -> None:
        pass

    def check_cancelled(self) -> None:
        pass


@pytest.mark.skipif(not _HAS_SEP, reason="extra 'separate' não instalado")
def test_separate_take_creates_two_stems(library):
    from app.models import Take
    from app.pipeline.separation import separate_take

    pid = library.create_project("Sep Test").id
    take_id, tdir = library.create_take(pid)
    sr = 48000
    t = np.arange(int(5 * sr)) / sr
    voice = 0.3 * np.sin(2 * np.pi * 220 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 3 * t))
    guitar = 0.2 * np.sin(2 * np.pi * 440 * t)
    mix = (voice + guitar).astype(np.float32)
    sf.write(tdir / "raw.wav", mix, sr, subtype="PCM_24")
    library.save_take(Take(id=take_id, project_id=pid, duration_s=5.0, sample_rate=sr))

    result = separate_take(library, take_id, _Ctx())

    assert set(result["stems"]) == {"vocals", "instrumental"}
    for rel in result["stems"].values():
        p = tdir / rel
        assert p.exists()
        _data, out_sr = sf.read(str(p))
        assert out_sr == 48000
