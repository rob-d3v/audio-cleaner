# ✍️ Prompt Studio — estilo, letra e meta-tags

O Prompt Studio é a área do Audio Cleaner (aba **Modelos**) dedicada a montar os prompts que você cola no Suno. Esta página explica os dois tipos de prompt, como usar os templates do app, a fórmula de style prompt, o catálogo de meta-tags com seu nível de confiabilidade, e os truques que realmente funcionam.

> Tudo aqui é sobre **texto** — o que você escreve para o Suno gerar a música. Para o áudio da sua voz de referência, veja [Suno Voices](suno-voices.md).

---

## 1. Os 2 tipos de prompt

Cada projeto no Audio Cleaner guarda **dois prompts independentes**, cada um com seu próprio histórico de versões:

| Tipo | Campo no Suno | O que descreve |
|---|---|---|
| **Estilo** (`style`) | *Style of Music* | Gênero, humor, instrumentação, produção, BPM — o "som" da música |
| **Letra** (`lyrics_prompt`) | *Lyrics* | A letra em si, com as tags de estrutura (`[Verse]`, `[Chorus]`...) |

Você pode editar os dois livremente, salvar, e voltar no histórico para recuperar uma versão anterior — útil quando uma variante específica gerou um resultado bom no Suno e você quer lembrar exatamente o que escreveu.

---

## 2. Como usar os templates do app

Os templates embutidos do Prompt Studio (**Meta-prompt de Estilo** e **Meta-prompt de Letra**) não geram o prompt final do Suno sozinhos — eles são **meta-prompts**: você preenche algumas variáveis, o app monta um texto estruturado por substituição determinística (sem IA embutida), e você cola esse resultado num assistente de texto (ChatGPT, Claude, etc.) que devolve o prompt final pronto para o Suno, já respeitando os limites de caracteres e sem citar nomes de artistas.

### Template de Estilo

| Variável | Obrigatória | O que é |
|---|---|---|
| `musica` | Sim | A música de referência (só para orientar o estilo — o prompt final não cita nomes) |
| `artista` | Sim | O artista de referência |
| `extras` | Não | Especificações adicionais livres |

### Template de Letra

| Variável | Obrigatória | O que é |
|---|---|---|
| `tema` | Sim | O tema ou ideia da música |
| `artista` | Sim | Referência de estilo lírico/estrutural |
| `extras` | Não | Especificações adicionais livres |

Ao renderizar, campos opcionais vazios somem completamente do texto final (sem vírgulas soltas ou parênteses vazios sobrando) — então pode deixar `extras` em branco sem medo de gerar um prompt malformado.

Você também pode criar seus próprios templates (personalizados, salvos ao lado dos embutidos) e adicionar suas próprias entradas no catálogo de meta-tags — os templates e tags embutidos (builtin) não podem ser sobrescritos nem apagados, só os seus.

---

## 3. A fórmula de style prompt

Quando for escrever o campo de **estilo** diretamente (ou orientar o meta-prompt), siga esta fórmula — ela é a estrutura que o Suno interpreta de forma mais confiável:

```
[Gênero + Subgênero], [Humor/Energia], [3–4 instrumentos], [Estilo vocal], [Produção], [BPM numérico]
```

**Exemplo:**

```
Indie pop, synth-driven, nostalgic and warm, electric guitar, analog synth pads,
tight drums, breathy female vocals, lo-fi tape production, 92 BPM
```

Regras importantes:

- **O primeiro descritor ancora o gênero.** Comece sempre pelo gênero principal — é o termo de maior peso para o modelo.
- **BPM sempre como número** (`92 BPM`, não "andamento médio" ou "moderado").
- **Nunca cite nomes de artistas** — o campo filtra e pode descartar a menção. Em vez de "estilo de [artista]", decomponha em **gênero + era + timbre + produção** (ex.: em vez de citar um artista dos anos 80, escreva "synth-pop dos anos 80, vocais reverberados, bateria eletrônica gated").
- **4 a 8 descritores** é o ponto ideal — nem telegráfico demais, nem sobrecarregado.

---

## 4. Limites por campo

Os limites variam por versão do modelo Suno e o campo **trunca silenciosamente** o que passar — ou seja, o excesso simplesmente desaparece sem aviso. Fique dentro do sweet spot, não do limite técnico.

| Campo | Limite técnico | Ponto ideal (sweet spot) |
|---|---|---|
| **Style** | 1000 caracteres | 4–8 descritores, ~100–200 caracteres |
| **Lyrics** | 5000 caracteres | ~3000 caracteres / 40–60 linhas |
| **Título** | 100 caracteres | — |
| **Exclude Styles** | campo separado do Style | até 5 itens |

> O campo **Exclude Styles** é onde você lista o que **não** quer ouvir (ex.: "autotune, distorção pesada") — mantém o Style principal limpo e focado no que você quer.

---

## 5. Meta-tags: catálogo e confiabilidade

Meta-tags são as instruções entre colchetes que você intercala na letra (uma por linha) para guiar estrutura, performance vocal e efeitos. São **case-insensitive** e podem ser empilhadas.

Nem toda tag funciona igual — o **tier de confiabilidade** abaixo reflete o quanto o Suno de fato obedece cada categoria de tag:

| Tier | Confiabilidade | O que esperar |
|---|---|---|
| **T1** | > 80% | Alta obediência — use sem medo |
| **T2** | 50–80% | Funciona na maioria das vezes, mas não é garantido |
| **T3** | 30–50% | Efeito parcial/inconsistente |
| **T4** | **0% — placebo** | ⚠️ **Não funciona.** Parâmetros numéricos de mix (`[Reverb: 30%]`, `[Bass: 80%]`) são ignorados pelo modelo — não perca tempo com eles |

### Estrutura

| Tag | Tier |
|---|---|
| `[Intro]` | T1 |
| `[Verse]` / `[Verse 1]` / `[Verse 2]` | T1 |
| `[Pre-Chorus]` | T1 |
| `[Chorus]` | T1 |
| `[Post-Chorus]` | T2 |
| `[Hook]` | T1 |
| `[Bridge]` | T1 |
| `[Break]` | T2 |
| `[Build]` | T2 |
| `[Drop]` | T2 |
| `[Outro]` | T1 |
| `[End]` (parada seca) | T1 |
| `[Fade Out]` | T1 |

### Instrumental

| Tag | Tier |
|---|---|
| `[Instrumental]` | T1 |
| `[Instrumental Break]` | T2 |
| `[Guitar Solo]` | T2 |
| `[Piano Solo]` | T2 |

### Vocal

| Tag | Tier |
|---|---|
| `[Whispered]` | T1 |
| `[Belted]` | T1 |
| `[Spoken Word]` | T1 |
| `[Rap]` | T1 |
| `[Male Vocal]` / `[Female Vocal]` | T1 |
| `[Falsetto]` | T2 (reforce também no campo de estilo) |
| `[Harmonies]` | T2 |
| `[Ad-libs]` | T2 |
| `[Choir]` | T2 |
| `[Screamed]` | T2 |
| `[Call and Response]` | T2 |
| `[stadium crowd backing vocals]` | T2 |
| `s a t b` (com espaços) | T3 |

### Dinâmica

| Tag | Tier |
|---|---|
| `[Crescendo]` | T2 |
| `[Key Change]` | T2 |
| `[Silence]` | T2 |

### Efeitos sonoros (SFX)

| Tag | Tier |
|---|---|
| `[Applause]` | T2 |
| `[Cheering]` | T2 |
| `[Sighs]` | T2 |
| ⚠️ `[Reverb: 30%]` | **T4 — placebo, não usar** |
| ⚠️ `[Bass: 80%]` | **T4 — placebo, não usar** |

O catálogo completo (com essas tiers) fica disponível dentro do app, na aba Modelos — você pode inserir qualquer tag direto na letra com um clique, e também cadastrar tags próprias.

---

## 6. Truques que funcionam

### Vogais em CAPS = nota sustentada

Escrever uma vogal em maiúsculas e alongada sinaliza uma nota sustentada/segurada:

```
AAASSIIIM, eu vou te esperar
```

### `s a t b` com espaços = coro SATB

Para pedir uma harmonização em quatro vozes (soprano, contralto, tenor, baixo), escreva as letras **separadas por espaço**, minúsculas:

```
[Chorus]
s a t b
Nunca mais vou parar
```

### `[End]` evita silêncio no final

Adicionar `[End]` (parada seca) ou `[Fade Out]` ao fim da letra evita que o Suno deixe um silêncio estranho depois do último verso — o modelo tende a "auto-completar" esse silêncio quando não há uma tag de encerramento explícita.

### Dueto: rotule cada linha

Para duetos, identifique quem canta cada linha, tag por tag:

```
[Verse 1]
[Male]
Eu caminho sozinho nessa estrada

[Female]
Eu também sinto o mesmo, do meu jeito

[Chorus]
[Both]
Juntos até o fim dessa canção
```

---

## 7. Sliders do Suno

Estes sliders ficam **na interface do próprio Suno** (não no Audio Cleaner) — mas vale saber como ajustá-los depois de colar seu prompt lá:

| Slider | Sweet spot | Observação |
|---|---|---|
| **Weirdness** | 40–60% | Acima de ~81% o resultado tende a ficar "glitchado"/instável |
| **Style Influence** | 50–70% | Controla o quanto o modelo segue literalmente o texto de estilo |

Se você está usando uma **Persona** (voz treinada) ativa, remova do campo de estilo os descritores de gênero vocal (ex.: "vocais femininos graves") — a Persona já define o timbre vocal, e descrições conflitantes competem com ela.

### Presets rápidos de referência

| Preset | Weirdness | Style Influence | Quando usar |
|---|---|---|---|
| **Commercial** | 15% | 75% | Som mais previsível, "rádio-friendly" |
| **Original** | 50% | 60% | Equilíbrio entre fidelidade e criatividade |
| **Experimental** | 70% | 40% | Mais liberdade criativa, resultados menos previsíveis |

---

## Próximos passos

- 🎯 [O que o Suno espera do seu áudio](suno-voices.md)
- 🎙️ [Guia de gravação](guia-de-gravacao.md)
- ❓ [Dúvidas comuns](faq.md)
