# 📘 Instalação

Guia completo para colocar o Audio Cleaner rodando no seu PC — do zero até o primeiro `http://127.0.0.1:8000`.

> O Audio Cleaner roda 100% local. Nada do que você grava ou processa sai do seu computador (veja a [FAQ](faq.md) para detalhes).

---

## 1. Pré-requisitos

| Ferramenta | Versão | Para que serve |
|---|---|---|
| **Python** | 3.11 (não use 3.12+) | Roda o backend FastAPI |
| **[uv](https://docs.astral.sh/uv/)** | mais recente | Gerenciador de pacotes/ambiente Python do projeto |
| **Node.js** | 20+ | Roda o build do frontend (Vite/React) |
| **pnpm** | mais recente | Gerenciador de pacotes do frontend |
| **ffmpeg** | qualquer recente, no `PATH` | Importar `.wma`/`.m4a`/`.mp3`/`.aac` e exportar `.mp3` |

O projeto trava a versão do Python em `>=3.11,<3.12` (ver `pyproject.toml`) porque algumas dependências de áudio ainda não têm wheels estáveis para 3.12 em todas as plataformas.

### Instalando no Windows

```powershell
# Python 3.11
winget install Python.Python.3.11

# uv (gerenciador de pacotes Python)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Node.js LTS
winget install OpenJS.NodeJS.LTS

# pnpm (via corepack, já vem com o Node)
corepack enable
corepack prepare pnpm@latest --activate

# ffmpeg
winget install Gyan.FFmpeg
```

> Depois de instalar o `ffmpeg` via `winget`, **feche e reabra o terminal** para o `PATH` ser recarregado. Confirme com:
>
> ```powershell
> ffmpeg -version
> ```
>
> Se o comando não for reconhecido, adicione manualmente a pasta `bin` do ffmpeg (ex.: `C:\ffmpeg\bin`) às variáveis de ambiente do Windows (`PATH`) e reinicie o terminal.

---

## 2. Clonar e instalar

```bash
git clone https://github.com/<seu-usuario>/audio-cleaner.git
cd audio-cleaner

# Backend — instala as dependências base do Python
uv sync

# Frontend — instala e builda a interface
cd frontend
pnpm install
pnpm run build
cd ..
```

`uv sync` cria um ambiente virtual isolado em `.venv/` dentro do projeto e instala exatamente as versões travadas em `uv.lock`. Você não precisa ativar o venv manualmente — use sempre `uv run <comando>`.

---

## 3. Extras opcionais (IA pesada)

Sem nenhum extra, a limpeza de áudio já funciona com DSP clássico (passa-altas, EQ, compressor, limiter, normalização LUFS) + `noisereduce` — leve, sem baixar modelo nenhum. Os extras abaixo adicionam qualidade de ponta via modelos de IA, mas baixam pacotes e pesos maiores.

| Extra | Comando | O que instala | Tamanho aproximado |
|---|---|---|---|
| **denoise** | `uv sync --extra denoise` | DeepFilterNet3 (redução de ruído neural) + PyTorch (build CPU) | ~250–400 MB (torch CPU + pesos do modelo) |
| **separate** | `uv sync --extra separate` | `audio-separator` (UVR) para de-reverb e separação voz/instrumento | ~500 MB–1 GB (os modelos UVR são baixados na primeira execução) |
| **gpu** | `uv sync --extra gpu` | `onnxruntime-gpu` para acelerar inferência via GPU (NVIDIA/CUDA) | ~150–250 MB |
| **quality** | `uv sync --extra quality` | `clearvoice`, alternativa de qualidade para tratamento de voz | variável |

> ⚠️ **`quality` e `separate` são incompatíveis entre si** (pins de dependência conflitantes em `rotary-embedding-torch`). O `pyproject.toml` marca esse conflito explicitamente — instale **um ou outro**, nunca os dois no mesmo ambiente.

O extra `gpu` só traz ganho real se você tiver uma GPU NVIDIA com drivers CUDA instalados. Sem GPU, o app continua funcionando normalmente em CPU — só mais devagar no processamento com IA pesada.

Você pode conferir quais capacidades estão ativas no seu ambiente (ffmpeg, denoise, separate, GPU) na tela **Configurações** do app, ou diretamente em `GET /api/system/capabilities`.

---

## 4. Rodando o app

### Modo produção (uso normal)

```bash
uv run run.py
```

Abre o backend em `http://127.0.0.1:8000`, já servindo o frontend buildado (`frontend/dist/`). É esse o comando do dia a dia depois que tudo está instalado.

### Modo desenvolvimento (contribuindo com código)

Rode backend e frontend em terminais separados:

```bash
# Terminal 1 — backend com reload automático
uv run run.py

# Terminal 2 — Vite com hot reload
cd frontend
pnpm run dev
```

O Vite abre normalmente em `http://127.0.0.1:5173` e faz proxy de `/api` e `/ws` para o backend em `127.0.0.1:8000` — assim você edita o React e vê o resultado na hora, sem perder a conexão com o backend.

### Configuração por variáveis de ambiente

O backend lê configurações com o prefixo `AUDIO_CLEANER_`:

| Variável | Padrão | Efeito |
|---|---|---|
| `AUDIO_CLEANER_HOST` | `127.0.0.1` | Endereço em que o servidor escuta |
| `AUDIO_CLEANER_PORT` | `8000` | Porta do servidor |
| `AUDIO_CLEANER_DATA_DIR` | `%LOCALAPPDATA%\AudioCleaner` | Onde ficam seus projetos, takes e configurações |

---

## 5. Onde ficam seus dados

Por padrão, tudo o que você grava e importa fica em `%LOCALAPPDATA%\AudioCleaner` (fora da pasta do repositório). Se você rodar com um `AUDIO_CLEANER_DATA_DIR` customizado, ou clonar o projeto e rodar a partir dele com uma pasta `data/` local, essa pasta **nunca é versionada** — está no `.gitignore` desde o primeiro commit. Veja mais em [FAQ](faq.md#meus-dados-vão-pro-github).

---

## 6. Solução de problemas

### Meu microfone não aparece na lista de dispositivos

- Confira em **Configurações do Windows → Privacidade e segurança → Microfone** se "Permitir que apps de desktop acessem o microfone" está ativado.
- O Audio Cleaner lista dispositivos via WASAPI/PortAudio (`sounddevice`). Se o mic não aparece em nenhum app, o problema é no driver — reinstale ou reconecte o cabo USB.
- Dispositivos MME/DirectSound também aparecem na lista, mas são marcados como não-preferidos; prefira sempre a entrada sinalizada como **WASAPI**.

### "Dispositivo ocupado" / `DEVICE_BUSY` ao tentar gravar

Isso normalmente significa que outro programa está com acesso **exclusivo** ao microfone — Discord, Zoom, OBS, ou outra instância do próprio Audio Cleaner. Feche o outro app (ou pare a chamada) e tente gravar de novo.

### "ffmpeg ausente" ao importar `.wma`/`.m4a` ou exportar `.mp3`

O backend detecta a ausência do `ffmpeg` no `PATH` e retorna esse aviso em vez de travar. Instale o ffmpeg (seção 1), confirme com `ffmpeg -version` no mesmo terminal onde você roda `uv run run.py`, e reinicie o app.

- Arquivos **`.wav`, `.flac` e `.ogg`** são decodificados diretamente (sem precisar de ffmpeg).
- Arquivos **`.wma`, `.m4a`, `.mp3`, `.aac`** exigem ffmpeg para importar.
- Exportar em **`.mp3`** sempre exige ffmpeg (WAV e FLAC não precisam).

### Taxa de amostragem não suportada pelo dispositivo

O app tenta gravar a 48 kHz; se o seu microfone não suportar essa taxa, ele tenta automaticamente a taxa padrão do dispositivo antes de desistir. Se mesmo assim falhar, tente selecionar outra entrada ou outra taxa nas configurações do driver do microfone no Windows.

### O build do frontend falhou / tela em branco

Confirme que rodou `pnpm install` **dentro de `frontend/`** e que o Node é 20+ (`node -v`). Se você só quer rodar o app sem mexer no frontend, o `frontend/dist/` já vem pronto no repositório em alguns releases — mas para clones frescos do código-fonte, o `pnpm run build` é necessário.

---

## Próximos passos

- 🎙️ [Guia de gravação — como gravar com maestria para o Suno](guia-de-gravacao.md)
- 🎯 [O que o Suno espera do seu áudio](suno-voices.md)
- 📥 [Importar suas músicas em massa](importacao.md)
