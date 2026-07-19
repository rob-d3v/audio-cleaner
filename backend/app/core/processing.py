"""Serviço de processamento: roda uma cadeia sobre o áudio bruto de um take,
salva a variante processada (endereçada por chain_hash) e registra no take.json.
"""

from __future__ import annotations

import numpy as np
import soundfile as sf

from app.core.capabilities import get_capabilities
from app.core.jobs import JobContext
from app.core.library import LibraryStore, now_iso
from app.models import ProcessedVariant
from app.pipeline.base import AudioBuffer, ChainRunner, ChainSpec, StageContext, chain_hash
from app.pipeline.registry import get_registry


def _load_wav(path) -> AudioBuffer:
    data, sr = sf.read(path, dtype="float32", always_2d=False)
    return AudioBuffer(np.asarray(data, dtype=np.float32), sr)


def process_take(
    library: LibraryStore,
    take_id: str,
    chain: ChainSpec,
    ctx: JobContext,
    source_variant: str = "raw",
) -> dict:
    """Processa o take e persiste a variante. Retorna {take_id, chain_hash, variant_path}."""
    take = library.get_take(take_id)
    src_path = library.take_audio_path(take_id, source_variant)
    buf = _load_wav(src_path)

    h = chain_hash(chain)
    registry = get_registry()
    runner = ChainRunner(registry)

    stage_ctx = StageContext(
        progress=lambda f: ctx.progress(f, message_key="jobs.processing"),
        is_cancelled=lambda: ctx.cancelled,
    )
    out = runner.run(buf, chain, stage_ctx)

    tdir = library.take_dir(take_id)
    processed_dir = tdir / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    out_path = processed_dir / f"{h}.wav"
    tmp = out_path.with_suffix(".wav.tmp")
    sf.write(tmp, out.data, out.sample_rate, subtype="PCM_24")
    tmp.replace(out_path)

    variant = ProcessedVariant(chain_hash=h, chain=chain.model_dump(), created_at=now_iso())
    existing = [p for p in take.processed if p.chain_hash != h]
    take.processed = [variant, *existing]
    library.save_take(take)

    return {"take_id": take_id, "chain_hash": h, "variant": h,
            "duration_s": round(out.duration_s, 3)}


def stage_capabilities() -> dict[str, bool]:
    caps = get_capabilities()
    return {
        "denoise": bool(caps.get("denoise")),
        "quality": bool(caps.get("quality")),
        "separate": bool(caps.get("separate")),
    }
