# ❓ Perguntas frequentes

## Preciso de internet para usar o Audio Cleaner?

**Não, para o uso normal.** Gravar, limpar áudio, organizar projetos e montar prompts funciona 100% offline com o DSP clássico (passa-altas, EQ, compressor, limiter, normalização LUFS, `noisereduce`).

A internet só entra em dois momentos opcionais:

1. **Baixar modelos de IA opcionais** — os extras `denoise` (DeepFilterNet3) e `separate` (UVR) baixam pesos de modelo na primeira execução.
2. **Subir seu áudio no Suno** — enviar o arquivo treinado ou gerar músicas acontece no site do Suno, que é externo ao app.

---

## Meus dados vão pro GitHub?

**Não.** Tudo que é pessoal — gravações, projetos, letras, prompts, configurações — fica em `data/` (ou em `%LOCALAPPDATA%\AudioCleaner`, fora da pasta do repositório) e está listado no `.gitignore` **desde o primeiro commit**. Quem clona o repositório começa com a biblioteca completamente vazia. Nada do que você grava é versionado ou enviado a lugar nenhum a não ser que você mesmo faça isso manualmente (ex.: subindo no Suno).

---

## Preciso de GPU?

**Não.** O Audio Cleaner roda inteiramente em CPU por padrão — DSP clássico, `noisereduce`, e até o DeepFilterNet3 (extra `denoise`) rodam bem em CPU. O extra `--extra gpu` (via `onnxruntime-gpu`) é totalmente opcional e só acelera a inferência se você tiver uma GPU NVIDIA com CUDA — sem ele, tudo continua funcionando, só um pouco mais devagar nos estágios de IA mais pesados.

---

## Qual microfone eu devo usar?

Qualquer **microfone condensador** (USB ou XLR com interface) funciona bem. O que importa mais do que a marca/modelo é a técnica:

- Distância de **15–30 cm** da boca
- **Pop filter** sempre entre você e o mic
- Levemente **fora do eixo** (off-axis)
- Sala silenciosa e sem reflexões fortes
- **Sempre o mesmo microfone e a mesma sala** entre takes

Veja o [guia de gravação](guia-de-gravacao.md) completo para a técnica passo a passo.

---

## O que é LUFS?

**LUFS** (Loudness Units relative to Full Scale) é uma medida de **loudness percebido** — diferente de dBFS, que mede só o pico instantâneo do sinal. O LUFS considera como o ouvido humano percebe volume ao longo do tempo, seguindo o padrão **ITU-R BS.1770**.

O Audio Cleaner normaliza a loudness do seu áudio para um alvo em LUFS (configurável, padrão de referência **−18 LUFS** para o preset "Suno Voices"), sempre respeitando um teto de pico (true peak) para não estourar — é isso que garante uma voz com volume consistente entre takes diferentes, sem clipping.

---

## Qual a diferença entre os presets?

| Preset | Uso | Formato de saída | Pico | Loudness |
|---|---|---|---|---|
| **Suno Voices** | Treino de voz no Suno | WAV 48 kHz / 24-bit / mono | Validado entre −12 e −6 dBFS | −18 LUFS, teto de pico −6 dB |
| **Generic Clean** | Limpeza geral de voz (podcasts, vídeos, uso fora do Suno) | WAV 48 kHz / 24-bit / mono | Sem faixa obrigatória | −16 LUFS, teto de pico −1 dB |
| **Raw** | Sem processamento nenhum — exporta o take como está | WAV 48 kHz / 24-bit / mono | — | — |

O **Suno Voices** é o único com validação automática de pico e aviso se a duração passar de 4 minutos (o teto de upload do Suno) — os outros dois presets não impõem essas regras porque não são pensados especificamente para o Suno.

---

## Por que o projeto é licenciado como GPL-3.0?

Porque o Audio Cleaner depende do [`pedalboard`](https://github.com/spotify/pedalboard) (biblioteca de áudio da Spotify), que é licenciado sob **GPL-3.0**. Quando um projeto depende de uma biblioteca GPL, o conjunto precisa ser distribuído sob a mesma licença (ou uma compatível) — por isso a GPL-3.0 é obrigatória aqui.

> Os modelos de IA opcionais (DeepFilterNet, modelos UVR) têm **suas próprias licenças**, separadas da licença do código do Audio Cleaner — verifique os termos de cada um antes de usar em contexto comercial.

---

## Arquivos `.flp` e `.gdoc` são copiados na importação?

**Não — apenas linkados/referenciados.** Projetos de produção (`.flp`, `.als`, `.ptx`, `.band`, `.mmp`) e links do Google Docs (`.gdoc`) nunca são copiados para dentro da biblioteca do Audio Cleaner; o app só guarda a referência (caminho do arquivo ou URL extraída). Isso evita duplicar arquivos pesados de DAW e mantém o Google Docs como fonte de verdade da letra, se for esse o seu fluxo. Detalhes em [Importação](importacao.md#2-o-que-é-detectado-automaticamente).

---

## Preciso de `ffmpeg`? Para quê exatamente?

Sim, para dois casos específicos:

- **Importar** arquivos `.wma`, `.m4a`, `.mp3` ou `.aac` (arquivos `.wav`, `.flac` e `.ogg` não precisam — são decodificados diretamente).
- **Exportar** em formato `.mp3` (WAV e FLAC não precisam).

Sem `ffmpeg` no `PATH`, essas operações específicas mostram um aviso claro em vez de travar o app — o resto continua funcionando normalmente. Veja como instalar em [Instalação](instalacao.md#instalando-no-windows).

---

## A pasta original que eu importei é alterada de alguma forma?

**Não, nunca.** O importador é somente-leitura na origem — ele lê e copia, mas nunca apaga, move ou sobrescreve nada na pasta que você apontou. Detalhes em [Importação](importacao.md#5-a-pasta-de-origem-nunca-é-modificada).

---

## Ainda tem dúvida?

Abra uma issue no repositório do projeto no GitHub, ou releia os guias:

- 📘 [Instalação](instalacao.md)
- 🎙️ [Guia de gravação](guia-de-gravacao.md)
- 🎯 [Suno Voices](suno-voices.md)
- ✍️ [Prompt Studio](prompt-studio.md)
- 📥 [Importação](importacao.md)
