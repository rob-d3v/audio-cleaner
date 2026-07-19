<div align="center">

# 🎙️ Audio Cleaner

**Gravador profissional + limpeza automática de voz — feito para treinar sua voz no [Suno AI](https://suno.com).**

Grave com qualidade de estúdio, trate o áudio automaticamente (estilo Adobe Podcast / Audacity automático), organize suas músicas em projetos e álbuns e monte prompts de Suno como um profissional — tudo local, offline e open source.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Platform](https://img.shields.io/badge/Windows-WASAPI-0078D6?logo=windows&logoColor=white)

🇧🇷 Português · [🇺🇸 English](docs/en/README.md) · [🇪🇸 Español](docs/es/README.md)

</div>

---

## ✨ O que ele faz

| | Recurso |
|---|---|
| 🎚️ | **Gravador profissional** — usa qualquer microfone WASAPI do seu PC, grava em **WAV 48 kHz / 24-bit mono**, com medidor de nível (dBFS) em tempo real e detector de clipping. |
| 🧼 | **Limpeza automática de áudio** — cadeia profissional: passa-altas → redução de ruído (IA) → de-reverb → de-esser → EQ → compressão → limiter → normalização **LUFS** → corte de silêncio (VAD). Um clique e sua voz sai pronta. |
| 🔬 | **Análise inteligente** — detecta ruído de fundo, clipping, hum de 50/60 Hz, sibilância, reverb e loudness. Sugere correções e mostra **antes/depois**. |
| 🎛️ | **Modo manual** — ajuste cada estágio (liga/desliga + parâmetros), reprocessa e compara **A/B** original × tratado com forma de onda e espectrograma. |
| 🎸 | **Voz + violão** — separação de stems para tratar voz e instrumento em separado. |
| 📼 | **Múltiplos takes** — grave várias tomadas, compare lado a lado e escolha a melhor. |
| 📚 | **Projetos & Álbuns** — cada música é um projeto: takes, letra (com histórico), prompts, notas e capa. Agrupe em álbuns. |
| ✍️ | **Prompt Studio (Suno)** — gera os dois prompts (estilo e letra) a partir de templates, com paleta de **meta-tags** (`[Chorus]`, `[Spoken Word]`, coro SATB, vogais estendidas…) e aviso de tags-placebo. |
| 📥 | **Importação em massa** — aponte para uma pasta e ele cria um projeto por música, converte WMA/M4A/MP3 e vincula letras e assets (`.flp`, Google Docs). |
| 🎯 | **Preset "Suno Voices"** — exporta exatamente no formato que o Suno espera para treinar sua voz (WAV 48k/24-bit mono, picos entre −12 e −6 dBFS, ajudante de "melhores 2 minutos"). |
| 🌑 | **Interface premium** — dark, responsiva, em português (e ~190 idiomas via i18n). |

---

## 🚀 Instalação rápida

> Pré-requisitos: **Python 3.11**, **Node 20+** com **pnpm**, **[uv](https://docs.astral.sh/uv/)** e **[ffmpeg](https://ffmpeg.org/)** no PATH (necessário para importar `.wma`/`.m4a` e exportar MP3).

```bash
git clone https://github.com/<seu-usuario>/audio-cleaner.git
cd audio-cleaner

# Backend (Python)
uv sync                       # instala tudo (base). Extras opcionais abaixo.

# Frontend
cd frontend && pnpm install && pnpm run build && cd ..

# Rodar
uv run run.py                 # abre em http://127.0.0.1:8000
```

Durante o desenvolvimento, rode o backend (`uv run run.py`) e o Vite (`cd frontend && pnpm run dev`) em terminais separados — o Vite faz proxy de `/api` e `/ws` para o backend.

### Extras opcionais (IA pesada)

```bash
uv sync --extra denoise       # DeepFilterNet3 (redução de ruído neural, roda em CPU)
uv sync --extra separate      # UVR (de-reverb + separação voz/instrumento)
uv sync --extra gpu           # aceleração por GPU (onnxruntime-gpu)
```

Sem nenhum extra, a limpeza usa DSP clássico + `noisereduce` (leve, sem download de modelos). Veja o [guia de instalação](docs/pt-BR/instalacao.md) para detalhes.

### 🐳 Docker Compose

```bash
docker compose up -d          # builda e sobe em http://127.0.0.1:8000
```

Sua biblioteca fica persistida em `./data` (volume) e os modelos em `./models`. Para importar músicas, descomente e ajuste o volume de origem em [`docker-compose.yml`](docker-compose.yml).

> ⚠️ **Gravação ao vivo pelo microfone não funciona dentro do container** — o áudio WASAPI é do host Windows e o Docker Linux não o expõe. No container funcionam **importação, tratamento, análise, Prompt Studio e exportação**; para **gravar**, rode nativo (`uv run run.py`).

---

## 📖 Guias

- 📘 [Instalação passo a passo](docs/pt-BR/instalacao.md)
- 🎙️ [Guia de gravação — como gravar com maestria para o Suno](docs/pt-BR/guia-de-gravacao.md)
- 🎯 [O que o Suno espera (formato, duração, níveis)](docs/pt-BR/suno-voices.md)
- ✍️ [Prompt Studio — estilo, letra e meta-tags](docs/pt-BR/prompt-studio.md)
- 📥 [Importar suas músicas em massa](docs/pt-BR/importacao.md)
- ❓ [FAQ](docs/pt-BR/faq.md)

---

## 🏗️ Arquitetura

```
audio-cleaner/
├── backend/app/          FastAPI + serviços
│   ├── core/             recorder (WASAPI), library (projetos/takes/letras/prompts),
│   │                     jobs (fila), presets, prompt_studio, capabilities
│   ├── pipeline/         Stage ABC + estágios DSP (highpass, denoise, deesser, eq,
│   │                     compressor, limiter, loudness, trim) + ChainRunner
│   ├── importer/         scanner + executor da importação em massa
│   ├── analysis/         detectores de problemas (ruído, hum, sibilância, clipping…)
│   ├── export/           exportação WAV/MP3/FLAC + validação de preset
│   └── api/              rotas REST + WebSocket (/ws/meter, /ws/jobs)
├── frontend/             React + Vite + Tailwind + shadcn/ui (dark premium)
├── docs/                 guias em pt-BR / en / es
└── data/                 SUA biblioteca (gitignored — nunca vai para o repositório)
```

- **Áudio profissional em Python**: `sounddevice` (WASAPI), `soundfile`, `soxr`, `pedalboard`, `pyloudnorm`, `noisereduce`, `silero-vad`; opcionais `deepfilternet`, `audio-separator`.
- **Seus dados são seus**: todo conteúdo pessoal (gravações, músicas, prompts) fica em `data/` (ou `%LOCALAPPDATA%/AudioCleaner`), fora do controle de versão. Quem clona o repositório começa com a biblioteca vazia.

---

## 💛 Apoie o projeto

Se o Audio Cleaner te ajudou, considere apoiar o desenvolvimento. Toda contribuição ajuda a manter o projeto vivo e gratuito. ☕

<div align="center">

<img src="docs/assets/qrcode-doacao.png" alt="QR Code para doação" width="200"/>

**Escaneie o QR Code para doar** · Obrigado! 🙏

</div>

---

## 📄 Licença

Distribuído sob a licença **GPL-3.0** — veja [LICENSE](LICENSE).

> O projeto usa [`pedalboard`](https://github.com/spotify/pedalboard) (Spotify, GPL-3.0), o que torna a GPL-3.0 a licença obrigatória para o conjunto. Modelos de IA opcionais (DeepFilterNet, modelos UVR) têm suas próprias licenças — verifique antes de uso comercial.

---

<div align="center">
<sub>Feito com 🎶 para quem faz música. Não afiliado ao Suno AI.</sub>
</div>
