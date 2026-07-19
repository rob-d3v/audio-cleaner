<div align="center">

# 🎙️ Audio Cleaner

**Grabadora profesional + limpieza automática de voz — hecha para entrenar tu voz en [Suno AI](https://suno.com).**

Graba con calidad de estudio, trata el audio automáticamente (al estilo Adobe Podcast / Audacity automático), organiza tus canciones en proyectos y álbumes, y arma prompts de Suno como un profesional — todo local, sin conexión y de código abierto.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](../../LICENSE)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Platform](https://img.shields.io/badge/Windows-WASAPI-0078D6?logo=windows&logoColor=white)

[🇧🇷 Português](../../README.md) · [🇺🇸 English](../en/README.md) · 🇪🇸 Español

</div>

---

## ✨ Qué hace

| | Función |
|---|---|
| 🎚️ | **Grabadora profesional** — usa cualquier micrófono WASAPI de tu PC, graba en **WAV 48 kHz / 24-bit mono**, con medidor de nivel (dBFS) en tiempo real y detector de clipping. |
| 🧼 | **Limpieza automática de audio** — cadena profesional: paso alto → reducción de ruido (IA) → de-reverb → de-esser → EQ → compresión → limitador → normalización **LUFS** → recorte de silencio (VAD). Un clic y tu voz queda lista. |
| 🔬 | **Análisis inteligente** — detecta ruido de fondo, clipping, zumbido de 50/60 Hz, sibilancia, reverberación y sonoridad. Sugiere correcciones y muestra un **antes/después**. |
| 🎛️ | **Modo manual** — activa/desactiva y ajusta cada etapa, reprocesa y compara **A/B** el original frente al tratado, con forma de onda y espectrograma. |
| 🎸 | **Voz + guitarra** — separación de pistas (stems) para tratar voz e instrumento por separado. |
| 📼 | **Múltiples tomas** — graba varias tomas, compáralas lado a lado y elige la mejor. |
| 📚 | **Proyectos y álbumes** — cada canción es un proyecto: tomas, letra (con historial), prompts, notas y portada. Agrúpalos en álbumes. |
| ✍️ | **Prompt Studio (Suno)** — genera los dos prompts (estilo y letra) a partir de plantillas, con una paleta de **meta-tags** (`[Chorus]`, `[Spoken Word]`, coro SATB, vocales extendidas…) y aviso de tags-placebo. |
| 📥 | **Importación masiva** — apunta a una carpeta y crea un proyecto por canción, convierte WMA/M4A/MP3 y enlaza letras y assets (`.flp`, Google Docs). |
| 🎯 | **Preset "Suno Voices"** — exporta exactamente en el formato que Suno espera para entrenar tu voz (WAV 48k/24-bit mono, picos entre −12 y −6 dBFS, ayudante de "mejores 2 minutos"). |
| 🌑 | **Interfaz premium** — oscura, responsiva, en portugués (y ~190 idiomas vía i18n). |

---

## 🚀 Instalación rápida

> Requisitos previos: **Python 3.11**, **Node 20+** con **pnpm**, **[uv](https://docs.astral.sh/uv/)** y **[ffmpeg](https://ffmpeg.org/)** en el PATH (necesario para importar `.wma`/`.m4a` y exportar MP3).

```bash
git clone https://github.com/<tu-usuario>/audio-cleaner.git
cd audio-cleaner

# Backend (Python)
uv sync                       # instala todo (base). Extras opcionales abajo.

# Frontend
cd frontend && pnpm install && pnpm run build && cd ..

# Ejecutar
uv run run.py                 # se abre en http://127.0.0.1:8000
```

Durante el desarrollo, ejecuta el backend (`uv run run.py`) y Vite (`cd frontend && pnpm run dev`) en terminales separadas — Vite hace proxy de `/api` y `/ws` hacia el backend.

### Extras opcionales (IA pesada)

```bash
uv sync --extra denoise       # DeepFilterNet3 (reducción de ruido neuronal, corre en CPU)
uv sync --extra separate      # UVR (de-reverb + separación voz/instrumento)
uv sync --extra gpu           # aceleración por GPU (onnxruntime-gpu)
```

Sin ningún extra, la limpieza usa DSP clásico + `noisereduce` (liviano, sin descargar modelos). Consulta la [guía de instalación](../pt-BR/instalacao.md) para más detalles.

---

## 📖 Guías

> 📌 **Nota:** las guías detalladas a continuación están disponibles por ahora solo en portugués (pt-BR). Las traducciones al español están planeadas — ¡las contribuciones son bienvenidas!

- 📘 [Instalación paso a paso](../pt-BR/instalacao.md)
- 🎙️ [Guía de grabación — cómo grabar con maestría para Suno](../pt-BR/guia-de-gravacao.md)
- 🎯 [Qué espera Suno (formato, duración, niveles)](../pt-BR/suno-voices.md)
- ✍️ [Prompt Studio — estilo, letra y meta-tags](../pt-BR/prompt-studio.md)
- 📥 [Importar tus canciones en masa](../pt-BR/importacao.md)
- ❓ [Preguntas frecuentes](../pt-BR/faq.md)

---

## 🏗️ Arquitectura

```
audio-cleaner/
├── backend/app/          FastAPI + servicios
│   ├── core/             recorder (WASAPI), library (proyectos/tomas/letras/prompts),
│   │                     jobs (cola), presets, prompt_studio, capabilities
│   ├── pipeline/         Stage ABC + etapas DSP (highpass, denoise, deesser, eq,
│   │                     compressor, limiter, loudness, trim) + ChainRunner
│   ├── importer/         scanner + ejecutor de importación masiva
│   ├── analysis/         detectores de problemas (ruido, zumbido, sibilancia, clipping…)
│   ├── export/           exportación WAV/MP3/FLAC + validación de preset
│   └── api/               rutas REST + WebSocket (/ws/meter, /ws/jobs)
├── frontend/             React + Vite + Tailwind + shadcn/ui (oscuro premium)
├── docs/                 guías en pt-BR / en / es
└── data/                 TU biblioteca (ignorada por git — nunca se sube al repositorio)
```

- **Audio profesional en Python**: `sounddevice` (WASAPI), `soundfile`, `soxr`, `pedalboard`, `pyloudnorm`, `noisereduce`, `silero-vad`; opcionales `deepfilternet`, `audio-separator`.
- **Tus datos son tuyos**: todo el contenido personal (grabaciones, canciones, prompts) vive en `data/` (o `%LOCALAPPDATA%/AudioCleaner`), fuera del control de versiones. Quien clona el repositorio empieza con la biblioteca vacía.

---

## 💛 Apoya el proyecto

Si Audio Cleaner te ayudó, considera apoyar su desarrollo. Cada contribución ayuda a mantener el proyecto vivo y gratuito. ☕

<div align="center">

<img src="../assets/qrcode-doacao.png" alt="Código QR para donar" width="200"/>

**Escanea el código QR para donar** · ¡Gracias! 🙏

</div>

---

## 📄 Licencia

Distribuido bajo la licencia **GPL-3.0** — consulta [LICENSE](../../LICENSE).

> El proyecto usa [`pedalboard`](https://github.com/spotify/pedalboard) (Spotify, GPL-3.0), lo que hace que GPL-3.0 sea la licencia obligatoria para el conjunto. Los modelos de IA opcionales (DeepFilterNet, modelos UVR) tienen sus propias licencias — verifícalas antes de un uso comercial.

---

<div align="center">
<sub>Hecho con 🎶 para quienes hacen música. No afiliado a Suno AI.</sub>
</div>
