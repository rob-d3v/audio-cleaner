# 🎯 Suno "Voices" — o que o Suno espera do seu áudio

O **Voices** é o recurso de treino de voz do Suno AI (disponível a partir do modelo **v5.5**) que cria uma persona vocal a partir das suas próprias gravações. Esta página explica exatamente o que o Suno espera do arquivo que você envia, como o preset **"Suno Voices"** do Audio Cleaner te entrega isso automaticamente, e o passo a passo para subir seu perfil de voz no site.

> Ainda não gravou nada? Comece pelo [Guia de gravação](guia-de-gravacao.md) — ele tem o roteiro completo, passo a passo, para gravar o material ideal.

---

## 1. O que o Suno espera exatamente

| Requisito | Especificação |
|---|---|
| **Duração do upload** | Entre **15 segundos e 4 minutos** |
| **O que o Suno realmente usa** | Os **melhores 2 minutos** do material enviado — o resto é descartado na hora do treino |
| **Duração recomendada para gravar** | **3 a 5 minutos** de material limpo e variado (dá margem para o Suno escolher os melhores 2 min) |
| **Conteúdo do áudio** | **Acapella seco** — sem reverb, sem compressão pesada, sem música de fundo |
| **Consistência** | **Mesmo microfone + mesma sala** em todas as tomadas |
| **Formato-alvo do arquivo** | **WAV, 48 kHz, 16 ou 24-bit, MONO, seco** |
| **Níveis** | Picos entre **−12 e −6 dBFS** (nunca acima de −6; evite abaixo de −24 dBFS) |
| **Plano exigido** | **Pro ou Premier** |
| **Modelo** | **v5.5** |
| **Verificação** | Leitura em voz alta de uma frase apresentada pelo Suno, no momento do treino |

### Por que "acapella seco" importa tanto

Reverb, compressão pesada e música de fundo são informações que o Suno **não consegue separar** da sua voz durante o treino — ele aprende esses artefatos junto com o timbre, e o resultado final carrega esse "resíduo" em toda música gerada depois. Quanto mais seco (sem efeitos) e mais limpo (sem ruído/vazamento de outros sons) o material de entrada, mais fiel fica a persona vocal.

### Por que os "melhores 2 minutos" mudam a estratégia

Como o Suno seleciona automaticamente os 2 minutos de maior qualidade do que você enviar, **não adianta mandar só o mínimo**. Gravar 3–5 minutos variados (vogais, escalas, trechos de música, dinâmica — veja o [roteiro completo](guia-de-gravacao.md)) dá ao algoritmo de seleção mais material bom para escolher, em vez de forçá-lo a aproveitar trechos medianos.

---

## 2. Usando o preset "Suno Voices" no Audio Cleaner

O Audio Cleaner vem com um preset pronto chamado **"Suno Voices"**, pensado exatamente para essas exigências. Ao processar e exportar um take com esse preset, o app:

1. Aplica a cadeia de limpeza recomendada para voz de treino: passa-altas → redução de ruído (IA) → de-esser → compressão leve → limiter → normalização de loudness, com um **teto de pico em −6 dBFS** já embutido para nunca ultrapassar o limite.
2. Corta silêncio nas pontas (trim), mantendo uma pequena folga (padding) para não cortar respiração/ataque da fala.
3. Exporta em **WAV, 48 kHz, 24-bit, mono** — exatamente o formato-alvo do Suno.
4. **Valida automaticamente os picos** do arquivo exportado contra a faixa −12 a −6 dBFS. Se o áudio final ficar fora dessa faixa (muito baixo ou muito alto), o app avisa com um warning — a exportação não é bloqueada, mas você sabe que precisa regravar ou reajustar o ganho de entrada.
5. Avisa se a duração final passar de **4 minutos** (o teto de upload do Suno).

### Como usar

1. Grave seus takes seguindo o [roteiro de gravação](guia-de-gravacao.md).
2. No projeto, selecione o take (ou takes) que quer usar.
3. Escolha o preset **"Suno Voices"** na etapa de processamento/exportação.
4. Revise o resultado no comparador A/B (original × tratado) — forma de onda e espectrograma ajudam a confirmar que não sobrou ruído nem reverb perceptível.
5. Exporte. O arquivo final já sai pronto para upload.

### O ajudante de "melhores 2 minutos"

Como o Suno usa só os 2 minutos de maior qualidade do arquivo, o app te ajuda a **selecionar manualmente a janela de 2 minutos** mais forte do seu material antes de exportar — útil se você gravou os 3–5 minutos recomendados e quer garantir que o corte final capture exatamente os trechos mais limpos e variados (evitando, por exemplo, deixar a "sobra" incluir um trecho com tosse ou hesitação).

---

## 3. Passo a passo: subindo sua voz no Suno

1. **Confirme os requisitos de conta**: você precisa estar num plano **Pro ou Premier** do Suno, usando o modelo **v5.5**. Planos gratuitos/Standard não têm acesso ao Voices.
2. Acesse a seção de treino de voz (**Voices**) no site do Suno.
3. Faça o **upload do seu arquivo** exportado pelo Audio Cleaner (WAV 48 kHz/24-bit mono, seco, picos −12 a −6 dBFS, entre 15s e 4min de duração).
4. O Suno processa o áudio e seleciona automaticamente os melhores 2 minutos.
5. **Verificação por voz**: o Suno apresenta uma frase na tela e pede para você lê-la em voz alta, gravando ali mesmo (ou seguindo o fluxo indicado pela plataforma) — é uma checagem de que a voz treinada é realmente sua. Se você já gravou a [frase falada do roteiro](guia-de-gravacao.md#passo-6--frase-falada-verificação-do-suno) com boa qualidade, você já sabe como sua voz soa limpa nesse tipo de leitura.
6. Aguarde o treino da persona finalizar. A partir daí, sua voz treinada fica disponível para gerar músicas no Suno.

---

## Próximos passos

- ✍️ [Prompt Studio — monte prompts de estilo e letra como um profissional](prompt-studio.md)
- 📥 [Importar suas músicas em massa](importacao.md)
- ❓ [Dúvidas comuns](faq.md)
