# 📥 Importação em massa

Se você já tem uma pasta cheia de músicas — takes soltos, letras em `.txt`, links de Google Docs, projetos de FL Studio — o importador do Audio Cleaner varre tudo de uma vez e cria um projeto por música, sem você precisar arrastar arquivo por arquivo.

---

## 1. Preparando a pasta

A estrutura esperada é **uma subpasta por música**, dentro de uma pasta raiz:

```
Minhas Músicas/
├── 01 - Nome da Faixa/
│   ├── voz_take1.wav
│   ├── voz_take2.wav
│   ├── letra.txt
│   ├── capa.jpg
│   └── projeto.flp
├── @Ideia Nova/
│   └── esboço.mp3
├── #Pronta Pra Suno/
│   ├── final.wav
│   └── letra.txt
└── -----Rascunho Antigo/
    └── voz.wav
```

Se a **própria pasta raiz** já tiver arquivos de áudio soltos (sem subpasta), o importador também reconhece isso como "uma música avulsa" — não precisa forçar tudo em subpastas se você só tem uma música pra importar.

A varredura é **somente leitura, com profundidade de 2 níveis** (raiz → subpastas) e não segue atalhos/symlinks. Nomes com acentos e caracteres especiais são suportados normalmente.

---

## 2. O que é detectado automaticamente

| Tipo | Extensões | Comportamento |
|---|---|---|
| **Áudio** | `.mp3` `.wav` `.wma` `.m4a` `.flac` `.ogg` `.aac` | Cada arquivo vira um *take* dentro do projeto. `.wav`/`.flac` são tratados como sem perda; os demais são marcados para transcodificação. |
| **Letra** | `.txt` | Vira o texto de letra do projeto (com prévia dos primeiros ~120 caracteres na tela de revisão). Se houver mais de um `.txt` na pasta, o app avisa e sugere o maior arquivo como principal. |
| **Link do Google Docs** | `.gdoc` | O app lê o arquivo `.gdoc` (JSON) e extrai a URL do documento — vira um **link**, nunca é copiado nem baixado. |
| **Projeto de produção** | `.flp` `.als` `.ptx` `.band` `.mmp` | Detectado e listado como asset — vira uma **referência** (caminho do arquivo), nunca copiado para dentro do projeto. |
| **Capa** | `.jpg` `.jpeg` `.png` | Se algum arquivo de imagem tiver "capa", "cover", "folder" ou "front" no nome, ele é priorizado; senão, escolhe a maior imagem da pasta. |

---

## 3. Marcadores de status no nome da pasta

O importador interpreta símbolos no nome da pasta/música para sugerir o status inicial do projeto e limpar o nome final:

| Marcador | Exemplo de pasta | Status sugerido |
|---|---|---|
| `@` (prefixo) | `@Nome da Música` | Em progresso |
| `#` (prefixo) | `#Nome da Música` | Pronto |
| `%` (prefixo) | `%Nome da Música` | Quase |
| `(quase)` (sufixo) | `Nome da Música (quase)` | Quase |
| `-----` (prefixo) | `-----Rascunho Antigo` | Ideia / rascunho |
| Prefixo numérico | `03 - Nome da Música` | Sem mudar status — define a posição da faixa (`track_hint = 3`) dentro de um álbum |

O nome final sugerido já sai **limpo** desses símbolos (ex.: `@Nome da Música` vira só `Nome da Música` com status "em progresso"). Esse mapeamento marcador → status é só o **padrão** — você pode editar cada item individualmente na tela de revisão do wizard antes de confirmar, ou ajustar o mapeamento global nas Configurações.

---

## 4. O wizard de 3 passos

1. **Escolher a pasta e escanear** — aponte para a pasta raiz. O app varre e monta um preview de tudo que encontrou: quantas pastas viraram "músicas", quais arquivos foram reconhecidos em cada uma, e se o `ffmpeg` está disponível (necessário para alguns formatos — veja abaixo).
2. **Revisar cada item** — para cada música detectada, você pode: ajustar o nome sugerido, trocar o status, marcar quais arquivos de áudio entram como takes (ou excluir algum), escolher qual `.txt` vira a letra principal (se houver mais de um) e confirmar a capa sugerida.
3. **Confirmar e importar** — a importação roda como um **job em segundo plano**, com barra de progresso. Falhas em arquivos individuais (um áudio corrompido, por exemplo) não interrompem o processo — esse item específico é listado como "pulado" com o motivo, e o restante da importação continua normalmente.

---

## 5. A pasta de origem nunca é modificada

O importador **só lê e copia** — em nenhum momento ele apaga, move ou altera qualquer arquivo na pasta original. Especificamente:

- **Áudio**: decodificado e gravado como uma cópia nova (`raw.wav`, 48 kHz) dentro da biblioteca do projeto; o arquivo original também pode ser copiado junto (preservado como backup) — a pasta de origem permanece intacta.
- **Letra**: o texto é lido e salvo dentro do projeto; o `.txt` original na pasta de origem não é tocado.
- **Capa**: os bytes da imagem são copiados para dentro do projeto.
- **`.flp`, `.als`, `.gdoc` e afins**: **nunca são copiados** — ficam apenas referenciados (link/caminho), então seus projetos de produção pesados continuam exatamente onde estavam.

Isso significa que você pode importar a mesma pasta de origem quantas vezes quiser, com segurança — nada nela é destruído no processo.

---

## 6. `ffmpeg` é necessário para alguns formatos

| Formato | Precisa de `ffmpeg`? |
|---|---|
| `.wav` `.flac` `.ogg` | Não — decodificados diretamente |
| `.wma` `.m4a` `.mp3` `.aac` | **Sim** |

Se o `ffmpeg` não estiver instalado/no `PATH`, a tela de revisão já avisa antes de você confirmar a importação, e qualquer arquivo desses formatos que precisar dele é marcado como "pulado" (com o motivo `needs_ffmpeg`) em vez de travar o restante da importação. Veja como instalar em [Instalação](instalacao.md#instalando-no-windows).

---

## Próximos passos

- 🎯 [Preset "Suno Voices" — formato ideal pro Suno](suno-voices.md)
- ✍️ [Prompt Studio — monte os prompts das músicas importadas](prompt-studio.md)
- ❓ [Dúvidas comuns](faq.md)
