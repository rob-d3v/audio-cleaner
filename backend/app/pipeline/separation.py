"""Separação de fontes (voz/instrumental) via audio-separator — extra "separate".

Usa modelos UVR/MDX-NET rodando em onnxruntime CPU. Os modelos baixam sob
demanda no primeiro uso para ``data_dir()/models`` (via ``model_file_dir``).
O import de ``audio_separator`` só acontece dentro de ``separate_take`` porque o
extra pode não estar instalado — nesse caso levantamos ``ModelNotInstalledError``.

Nada destrutivo: os stems ficam em ``take_dir/stems/{model_slug}/`` a 48 kHz,
ao lado do áudio original, que não é tocado.
"""

from __future__ import annotations

import re
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import soxr

from app.config import data_dir
from app.core.jobs import JobContext
from app.core.library import LibraryStore
from app.errors import ModelNotInstalledError

# modelo vocal/instrumental padrão (MDX-Net, stems Vocals/Instrumental)
DEFAULT_MODEL = "UVR-MDX-NET-Inst_HQ_3.onnx"
_TARGET_SR = 48000


def _slug(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower() or "model"


def models_dir() -> Path:
    d = data_dir() / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write_48k(src: Path, dst: Path) -> None:
    """Lê o stem produzido e grava em 48 kHz PCM_24 (resample se preciso)."""
    data, sr = sf.read(str(src), dtype="float32", always_2d=False)
    if sr != _TARGET_SR:
        data = soxr.resample(data, sr, _TARGET_SR).astype(np.float32)
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(".wav.tmp")
    sf.write(str(tmp), data, _TARGET_SR, subtype="PCM_24")
    tmp.replace(dst)


def _classify(name: str) -> str | None:
    """Mapeia o nome do arquivo de saída para 'vocals' | 'instrumental'."""
    low = name.lower()
    if "vocal" in low:
        return "vocals"
    if "instrument" in low or "inst" in low or "no reverb" in low or "no_reverb" in low:
        return "instrumental"
    return None


def separate_take(
    library: LibraryStore,
    take_id: str,
    ctx: JobContext,
    model: str = DEFAULT_MODEL,
    variant: str = "raw",
) -> dict:
    """Separa o take em vocals + instrumental e persiste os stems a 48 kHz.

    Retorna ``{take_id, model, model_slug, stems:{vocals, instrumental}}`` com
    caminhos relativos ao ``take_dir``.
    """
    try:
        from audio_separator.separator import Separator
    except ImportError as exc:
        raise ModelNotInstalledError(
            detail={"feature": "separate", "extra": "separate"},
            message_key="errors.model_not_installed",
        ) from exc

    library.get_take(take_id)
    src = library.take_audio_path(take_id, variant)
    ctx.progress(0.05, message_key="jobs.separating")

    model_slug = _slug(Path(model).stem)
    tdir = library.take_dir(take_id)
    stems_dir = tdir / "stems" / model_slug
    stems_dir.mkdir(parents=True, exist_ok=True)

    stems: dict[str, str] = {}
    with tempfile.TemporaryDirectory() as tmp:
        separator = Separator(
            model_file_dir=str(models_dir()),
            output_dir=tmp,
            output_format="WAV",
            sample_rate=_TARGET_SR,
        )
        separator.load_model(model_filename=model)
        ctx.check_cancelled()
        ctx.progress(0.3)
        outputs = separator.separate(str(src))
        ctx.progress(0.85)

        for out_name in outputs:
            p = Path(out_name)
            if not p.is_absolute():
                p = Path(tmp) / p.name
            kind = _classify(p.name)
            if kind is None:
                continue
            dst = stems_dir / f"{kind}.wav"
            _write_48k(p, dst)
            stems[kind] = str(dst.relative_to(tdir)).replace("\\", "/")

    ctx.progress(1.0)
    return {"take_id": take_id, "model": model, "model_slug": model_slug, "stems": stems}
