<div align="center">

# 🎙️ Audio Cleaner

**Professional recorder + automatic voice cleanup — built to train your voice on [Suno AI](https://suno.com).**

Record with studio quality, treat the audio automatically (think Adobe Podcast / automatic Audacity), organize your songs into projects and albums, and build Suno prompts like a pro — all local, offline, and open source.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](../../LICENSE)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Platform](https://img.shields.io/badge/Windows-WASAPI-0078D6?logo=windows&logoColor=white)

[🇧🇷 Português](../../README.md) · 🇺🇸 English · [🇪🇸 Español](../es/README.md)

</div>

---

## ✨ What it does

| | Feature |
|---|---|
| 🎚️ | **Professional recorder** — uses any WASAPI input device on your PC, records in **WAV 48 kHz / 24-bit mono**, with a real-time level meter (dBFS) and clip detector. |
| 🧼 | **Automatic audio cleanup** — a professional chain: high-pass → noise reduction (AI) → de-reverb → de-esser → EQ → compression → limiter → **LUFS** normalization → silence trimming (VAD). One click and your voice comes out ready. |
| 🔬 | **Smart analysis** — detects background noise, clipping, 50/60 Hz hum, sibilance, reverb, and loudness. Suggests fixes and shows a **before/after**. |
| 🎛️ | **Manual mode** — toggle and tweak every stage, reprocess, and compare **A/B** original vs. treated with waveform and spectrogram. |
| 🎸 | **Voice + guitar** — stem separation to treat vocals and instrument separately. |
| 📼 | **Multiple takes** — record several takes, compare them side by side, and pick the best one. |
| 📚 | **Projects & Albums** — each song is a project: takes, lyrics (with history), prompts, notes, and cover art. Group them into albums. |
| ✍️ | **Prompt Studio (Suno)** — generates both prompts (style and lyrics) from templates, with a **meta-tag** palette (`[Chorus]`, `[Spoken Word]`, SATB choir, extended vowels…) and a warning for placebo tags. |
| 📥 | **Bulk import** — point to a folder and it creates one project per song, converts WMA/M4A/MP3, and links lyrics and assets (`.flp`, Google Docs). |
| 🎯 | **"Suno Voices" preset** — exports in exactly the format Suno expects to train your voice (WAV 48k/24-bit mono, peaks between −12 and −6 dBFS, "best 2 minutes" helper). |
| 🌑 | **Premium interface** — dark, responsive, in Portuguese (and ~190 languages via i18n). |

---

## 🚀 Quick install

> Prerequisites: **Python 3.11**, **Node 20+** with **pnpm**, **[uv](https://docs.astral.sh/uv/)**, and **[ffmpeg](https://ffmpeg.org/)** on your PATH (needed to import `.wma`/`.m4a` and export MP3).

```bash
git clone https://github.com/<your-username>/audio-cleaner.git
cd audio-cleaner

# Backend (Python)
uv sync                       # installs everything (base). Optional extras below.

# Frontend
cd frontend && pnpm install && pnpm run build && cd ..

# Run
uv run run.py                 # opens at http://127.0.0.1:8000
```

During development, run the backend (`uv run run.py`) and Vite (`cd frontend && pnpm run dev`) in separate terminals — Vite proxies `/api` and `/ws` to the backend.

### Optional extras (heavy AI)

```bash
uv sync --extra denoise       # DeepFilterNet3 (neural noise reduction, runs on CPU)
uv sync --extra separate      # UVR (de-reverb + vocal/instrument separation)
uv sync --extra gpu           # GPU acceleration (onnxruntime-gpu)
```

Without any extra, cleanup uses classic DSP + `noisereduce` (lightweight, no model downloads). See the [installation guide](../pt-BR/instalacao.md) for details.

---

## 📖 Guides

> 📌 **Note:** the detailed guides below are currently only available in Portuguese (pt-BR). English translations are planned — contributions are welcome!

- 📘 [Step-by-step installation](../pt-BR/instalacao.md)
- 🎙️ [Recording guide — how to record with mastery for Suno](../pt-BR/guia-de-gravacao.md)
- 🎯 [What Suno expects (format, duration, levels)](../pt-BR/suno-voices.md)
- ✍️ [Prompt Studio — style, lyrics, and meta-tags](../pt-BR/prompt-studio.md)
- 📥 [Bulk-importing your songs](../pt-BR/importacao.md)
- ❓ [FAQ](../pt-BR/faq.md)

---

## 🏗️ Architecture

```
audio-cleaner/
├── backend/app/          FastAPI + services
│   ├── core/             recorder (WASAPI), library (projects/takes/lyrics/prompts),
│   │                     jobs (queue), presets, prompt_studio, capabilities
│   ├── pipeline/         Stage ABC + DSP stages (highpass, denoise, deesser, eq,
│   │                     compressor, limiter, loudness, trim) + ChainRunner
│   ├── importer/         scanner + bulk-import executor
│   ├── analysis/         issue detectors (noise, hum, sibilance, clipping…)
│   ├── export/           WAV/MP3/FLAC export + preset validation
│   └── api/               REST routes + WebSocket (/ws/meter, /ws/jobs)
├── frontend/             React + Vite + Tailwind + shadcn/ui (premium dark)
├── docs/                 guides in pt-BR / en / es
└── data/                 YOUR library (gitignored — never pushed to the repo)
```

- **Professional audio in Python**: `sounddevice` (WASAPI), `soundfile`, `soxr`, `pedalboard`, `pyloudnorm`, `noisereduce`, `silero-vad`; optional `deepfilternet`, `audio-separator`.
- **Your data is yours**: all personal content (recordings, songs, prompts) lives in `data/` (or `%LOCALAPPDATA%/AudioCleaner`), outside version control. Anyone who clones the repository starts with an empty library.

---

## 💛 Support the project

If Audio Cleaner helped you, consider supporting its development. Every contribution helps keep the project alive and free. ☕

<div align="center">

<img src="../assets/qrcode-doacao.png" alt="Donation QR code" width="200"/>

**Scan the QR code to donate** · Thank you! 🙏

</div>

---

## 📄 License

Distributed under the **GPL-3.0** license — see [LICENSE](../../LICENSE).

> The project uses [`pedalboard`](https://github.com/spotify/pedalboard) (Spotify, GPL-3.0), which makes GPL-3.0 the required license for the whole. Optional AI models (DeepFilterNet, UVR models) have their own licenses — check before commercial use.

---

<div align="center">
<sub>Made with 🎶 for music makers. Not affiliated with Suno AI.</sub>
</div>
