"""Inicia o Audio Cleaner em modo dev: `uv run run.py`.

Insere backend/ no sys.path diretamente porque o install editável via .pth
falha em caminhos com acento no Windows (encoding do site module).
"""

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BACKEND))
# subprocesso do reload do uvicorn precisa herdar o path
os.environ["PYTHONPATH"] = str(BACKEND) + os.pathsep + os.environ.get("PYTHONPATH", "")

if __name__ == "__main__":
    import uvicorn

    from app.config import get_settings

    settings = get_settings()
    # reload liga só em dev (AUDIO_CLEANER_RELOAD=1). No container fica desligado.
    reload = os.environ.get("AUDIO_CLEANER_RELOAD", "0") == "1"
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=reload,
        reload_dirs=[str(BACKEND)] if reload else None,
    )
