"""Base do pipeline: Stage, ChainSpec, ChainRunner e hash de cadeia."""

from __future__ import annotations

import hashlib
import json
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import soxr
from pydantic import BaseModel, Field


@dataclass
class AudioBuffer:
    """Áudio em float32. Mono: shape (n,). Multi: (n, ch)."""

    data: np.ndarray
    sample_rate: int

    def __post_init__(self) -> None:
        if self.data.dtype != np.float32:
            self.data = self.data.astype(np.float32)

    @property
    def duration_s(self) -> float:
        return len(self.data) / self.sample_rate

    @property
    def channels(self) -> int:
        return 1 if self.data.ndim == 1 else self.data.shape[1]

    def resampled(self, target_sr: int) -> AudioBuffer:
        if target_sr == self.sample_rate:
            return self
        out = soxr.resample(self.data, self.sample_rate, target_sr)
        return AudioBuffer(out.astype(np.float32), target_sr)


class StageParams(BaseModel):
    """Base para parâmetros de estágio — subclasses viram JSON Schema na API."""


class JobCancelled(Exception):
    pass


@dataclass
class StageContext:
    """Contexto passado a cada estágio durante o processamento."""

    progress: Callable[[float], None] = lambda _f: None
    is_cancelled: Callable[[], bool] = lambda: False
    model_manager: Any = None
    work_dir: Path | None = None

    def check_cancelled(self) -> None:
        if self.is_cancelled():
            raise JobCancelled()


class Stage(ABC):
    """Um estágio da cadeia de processamento."""

    id: str
    name_key: str
    category: str  # "cleanup" | "dynamics" | "tone" | "utility"
    Params: type[StageParams] = StageParams
    requires_extra: str | None = None
    required_sr: int | None = None

    def available(self, capabilities: dict[str, bool] | None = None) -> bool:
        if self.requires_extra is None:
            return True
        return bool(capabilities and capabilities.get(self.requires_extra))

    @abstractmethod
    def process(self, buf: AudioBuffer, params: StageParams, ctx: StageContext) -> AudioBuffer: ...


class ChainStageSpec(BaseModel):
    id: str
    enabled: bool = True
    params: dict[str, Any] = Field(default_factory=dict)


class ChainSpec(BaseModel):
    stages: list[ChainStageSpec]


def chain_hash(chain: ChainSpec) -> str:
    """Hash canônico da cadeia — endereça variantes processadas em disco."""
    canonical = json.dumps(chain.model_dump(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()[:12]


class ChainRunner:
    """Executa a cadeia sequencialmente, com resample automático e progresso."""

    def __init__(self, registry: dict[str, Stage]):
        self.registry = registry

    def run(self, buf: AudioBuffer, chain: ChainSpec, ctx: StageContext) -> AudioBuffer:
        active = [s for s in chain.stages if s.enabled]
        n = len(active)
        original_sr = buf.sample_rate
        for i, spec in enumerate(active):
            ctx.check_cancelled()
            stage = self.registry.get(spec.id)
            if stage is None:
                raise KeyError(f"estágio desconhecido: {spec.id}")
            params = stage.Params.model_validate(spec.params)
            if stage.required_sr and buf.sample_rate != stage.required_sr:
                buf = buf.resampled(stage.required_sr)

            base = i / n
            stage_ctx = StageContext(
                progress=lambda f, _b=base, _n=n: ctx.progress(_b + f / _n),
                is_cancelled=ctx.is_cancelled,
                model_manager=ctx.model_manager,
                work_dir=ctx.work_dir,
            )
            buf = stage.process(buf, params, stage_ctx)
            ctx.progress((i + 1) / n)
        if buf.sample_rate != original_sr:
            buf = buf.resampled(original_sr)
        # saída sempre finita e dentro de [-1, 1] com margem de segurança
        np.nan_to_num(buf.data, copy=False, nan=0.0, posinf=1.0, neginf=-1.0)
        return buf
