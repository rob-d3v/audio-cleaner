"""Detecção de capacidades: extras instalados, GPU, ffmpeg."""

from __future__ import annotations

import importlib.util
import shutil
from functools import lru_cache
from typing import Any


@lru_cache
def get_capabilities() -> dict[str, Any]:
    caps: dict[str, Any] = {
        "denoise": importlib.util.find_spec("df") is not None,
        "quality": importlib.util.find_spec("clearvoice") is not None,
        "separate": importlib.util.find_spec("audio_separator") is not None,
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "gpu": {"torch_cuda": False, "ort_providers": []},
    }
    try:
        import onnxruntime

        caps["gpu"]["ort_providers"] = onnxruntime.get_available_providers()
    except ImportError:
        pass
    if caps["denoise"]:
        try:
            import torch

            caps["gpu"]["torch_cuda"] = torch.cuda.is_available()
        except ImportError:
            pass
    return caps


def refresh_capabilities() -> dict[str, Any]:
    get_capabilities.cache_clear()
    return get_capabilities()
