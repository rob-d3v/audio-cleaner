# syntax=docker/dockerfile:1

# ---------- Stage 1: build do frontend (React/Vite) ----------
FROM node:22-slim AS frontend
WORKDIR /app/frontend
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# ---------- Stage 2: runtime do backend (FastAPI) ----------
FROM python:3.11-slim AS runtime

# Dependências de sistema:
#  - ffmpeg: decodifica WMA/M4A/MP3 na importação e exporta MP3
#  - libsndfile1: soundfile (WAV/FLAC)
#  - libportaudio2: sounddevice importa PortAudio (sem mic no container, mas o import precisa da lib)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 libportaudio2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    AUDIO_CLEANER_HOST=0.0.0.0 \
    AUDIO_CLEANER_PORT=8000 \
    AUDIO_CLEANER_DATA_DIR=/data

# Instala dependências primeiro (camada cacheável).
# LICENSE entra aqui porque o pyproject referencia license={file="LICENSE"} e o
# hatchling lê o arquivo ao instalar o projeto (segundo uv sync).
COPY pyproject.toml uv.lock README.md LICENSE ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Código do backend + frontend já buildado
COPY backend/ ./backend/
COPY run.py ./
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

VOLUME ["/data", "/models"]
EXPOSE 8000

# run.py insere backend/ no sys.path e sobe o uvicorn
CMD ["uv", "run", "--no-dev", "python", "run.py"]
