# 🎙️ Guia de gravação — gravando com maestria para o Suno

Este é o guia prático para colocar sua voz no papel (ou melhor, no WAV) do jeito que o Suno AI precisa para treinar uma persona vocal fiel. Nada de teoria complicada: prepare o espaço, siga o roteiro, grave alguns takes a mais do que acha necessário, e escolha o melhor depois.

> Quer entender **por que** essas regras existem (o que o Suno faz com o áudio, formatos, limites)? Veja [O que o Suno espera do seu áudio](suno-voices.md). Este guia aqui é o **como fazer na prática**.

---

## 1. Preparação

### Sua voz

- Beba água antes de gravar. Evite laticínios e bebidas geladas pouco antes (engrossam a voz).
- Faça um aquecimento vocal de verdade (veja o roteiro abaixo) — não pule direto para a "tomada boa". Voz fria soa tensa e o Suno vai aprender essa tensão.
- Grave num horário em que sua voz esteja descansada. Depois de gritar num show ou de uma gripe não é o momento.

### A sala

- Escolha o cômodo mais "morto" acusticamente que você tiver: quarto com cortinas grossas, roupeiro cheio, tapete no chão. Superfícies duras e paralelas (paredes nuas, vidro) geram reflexões que sujam a gravação.
- Se não tem tratamento acústico, cobertores pendurados nas paredes atrás do microfone e atrás de você já ajudam bastante.
- Silêncio é inegociável: desligue ventilador, ar-condicionado, notificações do celular. Ruído de fundo constante (mesmo baixo) atrapalha o treinamento — o alvo é manter o sinal bem acima do ruído da sala.
- **Grave sempre na mesma sala, com o mesmo microfone, do início ao fim.** O Suno aprende a "assinatura acústica" do ambiente junto com a voz — misturar salas/mics deixa o resultado inconsistente.

### O microfone

| Item | Recomendação |
|---|---|
| Tipo | Condensador (mais sensível e detalhado que dinâmico para captar nuances vocais) |
| Distância | 15–30 cm da boca |
| Ângulo | Levemente **fora do eixo** (off-axis) — não fale direto contra a cápsula |
| Acessório | Pop filter sempre entre você e o mic |
| Monitoramento | Fones de ouvido (não monitores de mesa — evita realimentação e vazamento no mic) |

**Por que off-axis?** Falar/cantar ligeiramente de lado (em vez de soprar direto na cápsula) reduz plosivas (aqueles estouros de "p" e "b") e sibilância excessiva, sem precisar exagerar no processamento depois.

O pop filter faz o mesmo trabalho de outra forma: quebra o fluxo de ar das plosivas antes que ele chegue ao diafragma do microfone. Use os dois juntos — não é redundância, é reforço.

---

## 2. Níveis: o que o medidor está te dizendo

O Audio Cleaner mostra um medidor de nível em dBFS (decibéis relativos ao full scale digital) em tempo real enquanto você grava.

- **Alvo: picos entre −12 e −6 dBFS.** É a faixa que dá headroom suficiente para o processamento (seu e do Suno) sem risco de estourar.
- **Nunca ultrapasse −6 dBFS** nos picos — acima disso o risco de clipping (distorção digital, irreversível) sobe rápido.
- **Evite ficar abaixo de −24 dBFS** — sinal fraco demais fica perto do chão de ruído da sala/interface, e amplificar depois só amplifica o ruído junto.

Pense assim: **-12 a -6 dBFS é a "zona verde"**. Se o medidor pisca vermelho ou satura, seu gain está alto demais — abaixe no microfone/interface, não corrija depois digitalmente. Se as barras mal se movem mesmo cantando forte, o gain está baixo demais — suba.

> 💡 Ajuste o ganho de entrada **antes** de gravar a tomada de verdade: cante o trecho mais forte do que você vai gravar, olhando o medidor, até achar o gain ideal. Só então comece a gravação real.

---

## 3. O roteiro — siga na ordem

Este roteiro serve tanto para treinar uma persona vocal no Suno quanto, de forma mais curta, para o perfil de voz do "Suno Voices". Grave cada bloco como um take separado — fica mais fácil escolher os melhores trechos depois.

### Passo 1 — Aquecimento vocal (não grave este, é só pra você)

2–3 minutos de aquecimento fora da gravação: lip trills (bibibi com os lábios vibrando), sirenes vocais (deslizar do grave ao agudo em "u" ou "m"), alongamento de pescoço e mandíbula. O objetivo é soltar a voz antes de captar qualquer coisa.

### Passo 2 — Vogais sustentadas

Grave as 5 vogais — **A, E, I, O, U** — sustentando cada uma por 3–5 segundos, em uma nota confortável (nem muito grave, nem muito aguda). Respire, relaxe, e repita cada vogal 2 vezes.

```
A ------ (sustenha)
E ------ (sustenha)
I ------ (sustenha)
O ------ (sustenha)
U ------ (sustenha)
```

Isso dá ao Suno amostras limpas do timbre puro da sua voz, sem a variação de consoantes atrapalhando.

### Passo 3 — Escalas grave → agudo (peito / mix / falsete)

Cante uma escala simples (dó-ré-mi-fá-sol-lá-si-dó, ou só "5 notas subindo e descendo") em três registros diferentes:

1. **Voz de peito** (registro grave/natural, onde você fala)
2. **Voz mista** (mix — a transição, nem peito puro nem falsete puro)
3. **Falsete** (registro leve e aéreo, acima da quebra vocal)

Use uma vogal só (por exemplo "a" ou "u") para não misturar variáveis. Isso ensina ao Suno a extensão real da sua voz.

### Passo 4 — Trechos de música (3 a 4 trechos, 8–16 compassos cada)

Cante de 3 a 4 trechos curtos de música — 8 a 16 compassos cada — variando **tempo** (um mais lento, um mais rápido) e **tom** (mudando a nota inicial). Pode ser um trecho autoral, uma melodia improvisada, ou um vocalize sobre um beat qualquer — o importante é variedade real de andamento e altura, não repetir sempre a mesma frase.

> Se o objetivo é uma **persona cantada**, prefira sempre **cantar** em vez de falar nesses trechos — o Suno aprende melhor a articulação e afinação características da sua voz cantando.

### Passo 5 — Dinâmica suave → forte

Grave uma frase (pode ser uma linha de música ou uma frase qualquer) começando **sussurrada/suave** e crescendo gradualmente até **forte/projetada**, num único take contínuo. Isso mostra ao Suno como sua voz se comporta em diferentes intensidades — importante para músicas com dinâmica (verso baixinho, refrão explosivo).

### Passo 6 — Frase falada (verificação do Suno)

Grave uma frase curta **falada** (não cantada), em tom natural de conversa. É o tipo de amostra que o Suno usa no processo de verificação por voz ao ativar o treino — tenha uma frase de 5–10 segundos gravada limpa e pronta para esse momento. Veja o passo a passo completo em [suno-voices.md](suno-voices.md#3-passo-a-passo-subindo-sua-voz-no-suno).

---

## 4. Grave vários takes — sempre

Não tente acertar tudo na primeira tomada. Grave **2 ou 3 versões de cada passo do roteiro** e escolha depois a que soou mais natural, mais limpa e mais bem afinada. O Audio Cleaner guarda múltiplos takes por projeto lado a lado, com comparação A/B — use isso a seu favor. É normal (e recomendado) descartar metade do que você gravou.

---

## 5. Checklist final antes de enviar

Antes de exportar e subir no Suno, confira:

- [ ] Gravei na **mesma sala e com o mesmo microfone** em todos os takes
- [ ] Distância do mic entre **15–30 cm**, levemente off-axis, com pop filter
- [ ] Picos do medidor entre **−12 e −6 dBFS** (nunca acima de −6, evitando abaixo de −24)
- [ ] Sala silenciosa — sem ruído de fundo perceptível entre as frases
- [ ] Gravei **vogais sustentadas + escalas (peito/mix/falsete) + 3–4 trechos de música + dinâmica suave→forte + frase falada**
- [ ] Gravei mais de um take de cada bloco e escolhi o melhor
- [ ] Áudio final está **seco** — sem reverb, sem compressão pesada, sem música de fundo
- [ ] Rodei o preset **"Suno Voices"** no Audio Cleaner para validar formato e níveis automaticamente

Pronto — seu material está no ponto para treinar uma persona vocal fiel. Próximo passo: [O que o Suno espera do seu áudio](suno-voices.md).
