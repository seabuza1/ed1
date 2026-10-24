# SPEC: leitura da comanda por foto

**Fase de transição.** Vale só enquanto o pedido é escrito à mão. Sai quando o pedido nascer digitado no sistema (fase 2 dos requisitos).

Parte da v1 (`docs/SPEC-v1.md`) e precisa do Supabase dela (etapa 4). Esta spec descreve só o que muda.

## Objetivo

O motoboy fotografa a comanda ao pegar a entrega. O app preenche código, total e pagamento e sugere a área. A conta pelo cardápio diz se a leitura confere, e o motoboy confirma com um toque. A porta, o acerto e o painel não mudam.

Com letra de mão não existe leitura 100% certa. A segurança vem de três coisas juntas: a leitura, a conferência pelo cardápio e o toque do motoboy.

## O que entra

1. Cardápio, regras e glossário em `supabase/functions/_shared/cardapio-mel.json`. É a fonte única: a Edge Function manda para a IA e o front importa para a conta.
2. Domínio `src/domain/leitura.ts`, com os testes L1 a L14.
3. Edge Function `ler-comanda`: recebe a foto, faz duas leituras com a IA configurada (Gemini 3.1 Pro por padrão) e devolve as duas.
4. Botão de foto, tela "Lendo" e tela de confirmação.
5. Fila offline das fotos e leitura posterior.
6. Fotos no Storage e tabela `leituras` para medir: `supabase/004_leitura.sql` (o 002 e o 003 já eram da v1), `005_leitura_ajustes.sql`, `007_leitura_provedor.sql`, `008_leitura_limite.sql`, `009_leitura_limite_trava.sql` e `011_acerto_e_leitura.sql`.
7. Foto da comanda no painel do Luan.
8. Script `scripts/comparar-modelos.ts` para comparar modelos com as fotos da noite de teste.

Fica de fora: QR code (fase 2), câmera própria com moldura, recorte por campo, leitura do relatório da maquininha e da folha de expedição.

## Regras

- **R19 Transcrição.** A IA só transcreve. Não corrige, não deduz e não calcula. Trecho ilegível vira `[?]` e entra em `ilegiveis`. Valores vêm como texto, do jeito que estão escritos, e o domínio converte.
- **R20 Cardápio como dicionário.** O item que a IA casa com o cardápio vem com `casou_pelo_cardapio: true`. Se a palavra lida cabe em sabores de faixas com preços diferentes (lista `ambiguidades` do JSON, como "frango" e "lombo"), a IA devolve as opções e o item fica sem preço até o motoboy escolher.
- **R21 Preço dos itens.** Pizza: preço da faixa no tamanho. Meio a meio: o maior preço entre os sabores (requisitos R37). Bebida, borda e adicional saem do cardápio. Combo: preço do combo.
- **R22 Área sugerida, nesta ordem:**
  1. Local escrito na comanda, pelo glossário ("Arag." = Aragarças) → origem `escrito`.
  2. Sem local: total lido − itens = taxa de exatamente uma área ativa da tabela `areas` → origem `valor`.
  3. Senão, Aragarças → origem `padrao`.

  A área é sempre só sugestão: o motoboy toca nela para confirmar. Um 3 lido como 8 transforma 113 (Aragarças) em 118 (Pontal), e a conta fecha errada (teste L3).
- **R23 Promoção da noite** (requisitos R35). Asterisco = desconto em reais nas pizzas cuja faixa cobrada é `tradicional`. Vai de R$ 3 a R$ 23 e muda toda noite.
  - Se a faixa cobrada não for tradicional (como no meio a meio premium/tradicional da 3557), não tem desconto.
  - O valor da noite fica em `caixas.promo_desconto`.
  - Ainda sem valor, se a comanda tem asterisco e pizza tradicional e esperado − lido fica entre 3 e 23, ela fica amarela com "Promoção de R$ X hoje?". Confirmando, o valor é gravado no caixa e passa a valer para as próximas comandas.
  - Por enquanto o desconto vale uma vez por pizza tradicional (ver Pendências).
- **R24 Conferência.** Esperado = itens − promoção + taxa da área tocada.
  - **Verde:** telefone com 4 dígitos, total e pagamento lidos, as duas leituras iguais nos campos críticos, todos os itens com preço e esperado = lido.
  - **Amarelo:** a conta fecha, mas tem algo para olhar: promoção sugerida, alerta (R26) ou trecho ilegível que não entra na conta.
  - **Vermelho:** esperado ≠ lido, campo crítico ilegível ou divergente, ou item sem preço. Só lança depois de corrigir, ou com dois toques em "Lançar assim". Esse caso fica marcado como `forcado` na leitura.
  - Corrigir um campo recalcula na hora.
- **R25 Dupla leitura.** Duas chamadas em paralelo: uma completa e outra só com os campos críticos (telefone e total dígito por dígito, forma de pagamento, local e asterisco). Se um campo crítico divergir, ele fica vermelho e a tela mostra as duas versões para escolher. A conferência pode usar outro modelo (`IA_MODELO_CONFERENCIA`): modelos diferentes tendem a não errar o mesmo dígito.
- **R26 Alertas (amarelo).** Total abaixo de R$ 20 ou acima de R$ 300. Total terminando em ,99 sem combo casado. O código repetido continua como na R1.
- **R27 Foto e medição.** A foto fica ligada à comanda e o Luan vê no painel. Toda leitura grava em `leituras` o que a IA leu, o que foi lançado, se houve correção, se foi forçada, o provedor, o modelo, os tokens e o tempo.
- **R28 Sem internet.** A foto entra na fila e o motoboy lança à mão como hoje. Quando a leitura chega depois, ela vira conferência: se discordar do que foi lançado, a comanda ganha um aviso na lista. Nada muda sozinho.
- **R29 Pagamento.** "Cartão" → `cartao`. "Dinheiro" → `dinheiro`. "Pix" pede um toque entre `pix_antecipado` e `pix_maquina` (ver Pendências). No pagamento misto, a IA traz o valor de cada parte quando está escrito.

## Saída da IA

A saída vem em JSON validado por um schema, igual para qualquer provedor. O schema fica em `supabase/functions/_shared/schema.ts`: JSON Schema simples (`type`, `properties`, `required`, `enum`, `items`, `additionalProperties`), sem `$ref`. Campo que pode ser nulo usa `anyOf` com `null`, que o Gemini e a Anthropic aceitam. O exemplo completo está em `supabase/functions/_shared/exemplos/3557.json`.

Leitura completa:
```
telefone_final:  string | null       // 4 dígitos como escritos
promocao:        boolean             // asterisco presente
local_escrito:   string | null       // bairro, cidade ou referência como escritos
itens: [{
  lido: string                       // o trecho como escrito
  tipo: "pizza" | "bebida" | "borda" | "adicional" | "combo" | "outro"
  quantidade: number
  tamanho: "B" | "P" | "M" | "G" | null
  sabores: string[]                  // nomes exatos do cardápio
  item: string | null                // nome exato do cardápio (bebida, borda, adicional, combo "01".."04")
  casou_pelo_cardapio: boolean
  opcoes: string[]                   // quando ambíguo: os sabores possíveis
}]
pagamento: [{ forma_escrita: string, forma: "dinheiro" | "cartao" | "pix" | null, valor_escrito: string | null }]
total_escrito:   string | null       // ex.: "113,00"
transcricao:     string[]            // linha por linha
ilegiveis:       string[]
```

Leitura de conferência:
```
telefone_digitos: string[]   // ["3","5","5","7"]
total_digitos:    string[]   // ["1","1","3",",","0","0"]
forma_escrita:    string | null
local_escrito:    string | null
promocao:         boolean
```

## Prompt

Fica em `supabase/functions/_shared/prompt.ts`, igual para todos os provedores. O system leva:
1. As regras:
   > Você está lendo uma comanda de pizzaria escrita à mão. Transcreva exatamente o que está escrito, linha por linha, sem corrigir, deduzir ou completar nada. Marque trechos ilegíveis com [?] e liste-os em "ilegiveis". Transcreva o total e o telefone dígito por dígito. Use o cardápio e o glossário só para identificar itens, e marque casou_pelo_cardapio quando usar. Se uma palavra couber em mais de um sabor, devolva as opções em vez de escolher. Não calcule valores.
2. O glossário.
3. O cardápio: nomes dos sabores por faixa, tamanhos, bebidas, bordas, adicionais e combos. Os ingredientes não vão.
4. Os exemplos de `exemplos/`, cada um com a foto e o JSON esperado. Por enquanto só a 3557. Depois da noite de teste entram de 3 a 5 comandas de cada uma das duas pessoas que escrevem. Depois de mudar um exemplo, `npm run exemplos` gera `exemplos/exemplos.ts`, o módulo que a função publica.

A parte fixa (system e exemplos) vem sempre primeiro e idêntica em toda chamada; a foto da comanda vem por último. Assim o cache do provedor funciona: no Gemini é automático, mas só a partir de um prefixo de uns 4.096 tokens (com só a 3557 pode não chegar; `tokens_cache` mostra); na Anthropic, usar `cache_control` no system e nos exemplos.

## Edge Function `ler-comanda`

- `POST { imagem: string }` (JPEG em base64) → `{ leitura, conferencia, provedor, modelo, ms, tokens }` ou `{ erro }`. `tokens` soma as duas chamadas: `{ entrada, cache, saida }` (com modelos diferentes, o custo por comanda sai aproximado).
- Exige usuário logado (verificação de JWT padrão) com perfil ativo e no máximo 60 leituras por hora por conta (`reservar_leitura`, no 011; antes `pode_ler_comanda`, do 008 e 009): conta nova nasce ativa, e o limite segura o gasto de quem não é da pizzaria até o admin desativar. Quando o provedor cai ou está mal configurado (nada foi cobrado), a função devolve a vaga (`devolver_leitura`).
- Faz as duas chamadas em paralelo, com timeout de 30 s contado da chegada do pedido. Se uma falha, a outra é cancelada; se o app desiste (Digitar, outra foto), a função para também. Em qualquer erro, devolve `{ erro }` e o front volta para o lançamento manual.
- Erro que não é da foto devolve 503 e a foto fica na fila: provedor ocupado ou fora do ar (408, 429, 5xx, falha de rede) ou configuração (secret faltando, chave recusada, modelo que não existe). A fila espera 2, 4, 8... até 60 min entre as tentativas e desiste na 8ª; as outras fotos seguem. Sem resposta da função (sem internet, rede caiu), a fila para e tenta na próxima sincronização, sem contar. Foto de caixa com acerto confirmado não vai mais para a IA. A IA não ter lido a foto (resposta fora do formato, recusa, tempo esgotado) conta como uma das 3 tentativas.
- Recusa imagem acima de 2 MB.
- Nenhuma chave vai para o front nem para os logs.

### Provedor configurável

Cada provedor é um adaptador em `supabase/functions/_shared/ia/` com a mesma interface:
```ts
ler(imagemBase64: string, modo: 'completa' | 'conferencia', modelo: string)
  → Promise<{ json: unknown, tokens: { entrada: number, cache: number, saida: number }, ms: number }>
```
- `google.ts` (padrão), `anthropic.ts` e `compativel.ts` (formato Chat Completions do OpenAI: o Qwen da Alibaba e qualquer servidor compatível), só com `fetch` (sem SDK), para rodar na função e no script de comparação. `ler.ts` escolhe o adaptador pelos secrets e faz a leitura dupla. Trocar de modelo ou provedor é só mudar os secrets; os dois modelos têm que ser do provedor escolhido (`gemini-...`, `claude-...` ou `qwen...`), senão a função responde que a leitura não está configurada.
- O resultado passa pela mesma validação do schema antes de voltar ao front.

Secrets:

| Secret | Padrão | Uso |
|---|---|---|
| `IA_PROVEDOR` | `google` | `google`, `anthropic`, `qwen` ou `compativel` |
| `IA_MODELO` | `gemini-3.1-pro-preview` (`claude-sonnet-5-5` na Anthropic, `qwen3-vl-plus` no Qwen; obrigatório no compatível) | modelo da leitura completa |
| `IA_MODELO_CONFERENCIA` | igual a `IA_MODELO` | modelo da leitura de conferência (R25), do mesmo provedor |
| `GEMINI_API_KEY` | | chave do Google AI Studio |
| `ANTHROPIC_API_KEY` | | só se usar a Anthropic |
| `DASHSCOPE_API_KEY` | | só se usar o Qwen (Alibaba Model Studio, Singapura) |
| `COMPATIVEL_URL` | | só no compatível: o endereço da API, `https://.../v1` |
| `COMPATIVEL_API_KEY` | | só no compatível |
| `COMPATIVEL_EXTRA` | | só no compatível, opcional: parâmetros a mais no corpo, em JSON (ex.: `{"reasoning":{"max_tokens":1500}}`) |

### Qwen e servidor compatível (`compativel.ts`)

- `POST <endereço>/chat/completions`, com `Authorization: Bearer`. O Qwen usa `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`; o compatível, o `COMPATIVEL_URL` (só `https`).
- Exemplos como conversa (foto e instrução, depois a resposta certa) e a foto da vez por último, em `data:image/jpeg;base64`.
- JSON por `response_format: { type: "json_object" }`, com o esquema no prompt de sistema: com foto, o Qwen não aceita `json_schema`. No Qwen, `enable_thinking: false` (com raciocínio, não devolve JSON de foto).
- O `COMPATIVEL_EXTRA` vai no corpo como veio. Serve para o que cada servidor chama de outro jeito; na flatt, o `qwen3.8-27b` raciocina até estourar a saída numa foto difícil (e a flatt responde 400) sem `{"reasoning":{"max_tokens":1500}}`.
- Tokens: `prompt_tokens` menos `cached_tokens` é a entrada; `completion_tokens` é a saída.
- Erros: chave inválida 401, sem saldo 402, entrada barrada pela moderação ou foto ruim 422; `finish_reason` `length` é resposta cortada e `content_filter` é recusa.

### Gemini (`google.ts`)

API Interactions:
- `POST https://generativelanguage.googleapis.com/v1beta/interactions`, com o header `x-goog-api-key`.
- Corpo:
  - `model`: o do secret;
  - `system_instruction`: o prompt fixo (texto);
  - `input`: uma lista de conteúdos com os exemplos (texto, foto e a resposta certa de cada um) e, por último, o texto do modo e `{ "type": "image", "mime_type": "image/jpeg", "data": "<base64>", "resolution": "high" }`;
  - `generation_config: { "thinking_level": "low" }` (no 3.1 Pro não existe `minimal`); sem `temperature`, o Google recomenda manter o padrão nos modelos Gemini 3;
  - `response_format: { "type": "text", "mime_type": "application/json", "schema": <schema do modo> }`;
  - `store: false`, para o Google não guardar a interação.
- A resposta vale só com `status: "completed"`. O texto fica em `steps`: os passos `model_output` do fim, conteúdo `text` (os passos `thought` ficam de fora). Os tokens vêm em `usage` (`total_input_tokens`, `total_cached_tokens`, `total_output_tokens`, `total_thought_tokens`); a entrada sem cache é `total_input_tokens − total_cached_tokens`, e o raciocínio conta como saída.
- Conta paga: o 3.1 Pro não tem nível grátis. Usar só conta paga, onde o Google não usa os dados para treinar.

### Anthropic (`anthropic.ts`)

- Messages API com saída estruturada (`output_config.format`, schema do modo), esforço baixo e `cache_control` na parte fixa. Não usa tool use forçado: o Sonnet 5.5 e o Opus 5.5 recusam `tool_choice` forçado, e a saída estruturada vale para todos os modelos.

## Front

- **Botão "Foto"** grande na tela Noite, acima do formulário. Usar `<input type="file" accept="image/*" capture="environment">`.
- **Antes de enviar:**
  - redimensionar para no máximo 1600 px no lado maior, em JPEG com qualidade 0,8;
  - medir a nitidez (variância do Laplaciano num canvas, em tons de cinza). Abaixo do limite, mostrar "Foto tremida, tire de novo". O limite é calibrado com as fotos da noite de teste.
- **"Lendo…":** mostra a foto, com o link "Digitar" para voltar ao manual a qualquer momento.
- **Cancelar:** em "Lendo…", na foto tremida e na confirmação, "Cancelar" para a leitura e descarta a foto sem lançar nada, com "Lançamento cancelado · Desfazer" (o Desfazer volta à tela com as correções; a leitura que não tinha terminado recomeça). No manual com algo preenchido, o "Recolher" vira "Cancelar".
- **Tela de confirmação:**
  - foto no topo, que amplia com um toque;
  - itens com preço, taxa, esperado × lido e o estado;
  - chips de área com a sugestão em destaque e a origem escrita embaixo ("escrito na comanda", "pelo valor" ou "padrão");
  - forma de pagamento já marcada;
  - código e total editáveis;
  - quando a área veio "pelo valor", os dígitos do total que se confundem (3/8, 1/7, 5/6, 0/6) aparecem sublinhados.
  - **Verde ou amarelo:** tocar na área lança, como o toque na forma da v1, com "3557 lançada · Desfazer". Embaixo das áreas, o botão "Lançar · Barra do Garças" faz o mesmo com a área sugerida (ou a escolhida): o toque continua um só, mas fica à vista.
  - **Vermelho:** o campo com problema aparece em vermelho e a tela oferece "Lançar assim" com dois toques.
- **Lista da noite:** ícone de câmera nas comandas com foto e aviso de "leitura não confere" (R28).
- **Painel do Luan:** tocar no código abre a foto.

## Banco: `004_leitura.sql`, `005_leitura_ajustes.sql`, `007_leitura_provedor.sql`, `008_leitura_limite.sql`, `009_leitura_limite_trava.sql` e `011_acerto_e_leitura.sql`

Rodar nessa ordem, depois do `003_v1_avisos.sql` (o `006_pix_da_equipe.sql` é da v1).

- `caixas.promo_desconto`: em centavos, nulo até ser definido.
- `comandas.foto_path` e `comandas.area_origem` (`escrito`, `valor`, `padrao` ou `manual`).
- Tabela `leituras`, com as mesmas regras de acesso de `comandas`. Inclui `provedor`, `modelo`, `tokens_entrada`, `tokens_cache`, `tokens_saida` e `ms` (as colunas do provedor e dos tokens vêm no 007).
- Bucket privado `comandas`, com caminho `{caixa_id}/{id}.jpg`, só JPEG e até 2 MB.
  - Lê o dono do caixa ou a equipe.
  - Envia o dono do caixa enquanto o acerto não foi confirmado, ou a equipe.
  - Apaga só o admin.
  - Fotos com mais de 30 dias podem ser apagadas (o plano grátis do Supabase tem 1 GB); o que a IA leu continua em `leituras`.
- Tabela `uso_leitura` e função `pode_ler_comanda()` (008; o 009 põe uma trava para chamadas ao mesmo tempo da mesma conta): perfil ativo e até 60 leituras por hora por conta. Ninguém lê a tabela direto. O 011 troca por `reservar_leitura()`, que devolve o id da vaga, e `devolver_leitura(vaga)`, que só quem reservou sabe usar.

## Comparar modelos: `scripts/comparar-modelos.ts`

Roda local, com as chaves num `.env` fora do repositório (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `DASHSCOPE_API_KEY`, `COMPATIVEL_URL` e `COMPATIVEL_API_KEY`; o app só leva as variáveis `VITE_`):

```
npm run comparar -- <pasta> [--modelos google:gemini-3.1-pro-preview,qwen:qwen3-vl-plus,compativel:<modelo>] [--promo 10]
```

- Entrada: uma pasta com as fotos da noite de teste (as do Storage, já reduzidas pelo app) e um `gabarito.csv` com o certo de cada comanda, tirado do que foi lançado e conferido. Separado por `;`: `foto;codigo;total;area;forma` (forma `dinheiro`, `cartao` ou `pix`; misto como `cartao+dinheiro`). Um `areas.csv` (`nome;taxa`) opcional troca as áreas do `001`.
- Roda cada foto em cada modelo de uma lista (padrão: `google:gemini-3.1-pro-preview`, `google:gemini-3.8-flash`, `anthropic:claude-haiku-5-5`, `qwen:qwen3-vl-plus`; o modelo sem chave no `.env` é pulado), usando os mesmos adaptadores, prompt e `leitura.ts`. A foto que é exemplo do prompt fica de fora.
- Saída `comparacao.csv` e um resumo por modelo: verdes certas, **verdes erradas** (meta: zero), amarelas, vermelhas, tempo médio e custo por foto (tokens × preço da tabela no script; modelo fora da tabela sai sem custo).
- Escolher o mais barato com zero verdes erradas e poucas vermelhas, e gravar nos secrets.

## Casos de teste do domínio (R$)

Usam o cardápio real e as áreas do `001`: Aragarças 5, Pontal 10, Barra 12, Parque de Exposições 15.

Comanda base, a 3557 real: G meio a meio Filé Mignon / Calabresa (93) + Refrigerante 2L (15) = itens 108. Tem asterisco, local "hospital da Arag.", total "113,00" e pagamento Cartão.

| Teste | Entrada | Esperado |
|---|---|---|
| L1 | 3557 como lida | área Aragarças (escrito), esperado 113, **verde** |
| L2 | 3557 sem local | Aragarças (valor), **verde** |
| L3 | 3557 sem local, total "118,00" | sugere Pontal (valor) e fecha em 118, **verde**: mostra por que a área precisa de toque. Tocando Aragarças: esperado 113 ≠ 118, **vermelho** |
| L4 | 3557, motoboy toca Barra | esperado 120 ≠ 113, **vermelho** |
| L5 | 3557 sem local, total "110" | nenhuma área (diferença 2) → Aragarças (padrão), **vermelho** |
| L6 | 3557 sem local, total "123" | Parque de Exposições (valor), **verde** |
| L7 | G Calabresa + Refrigerante 2L, asterisco, "Arag.", total "83", sem promoção definida | esperado 93, **amarelo** "Promoção de R$ 10 hoje?". Confirmando: `promo_desconto` = 1000, **verde** |
| L8 | Promoção 10 definida. G Portuguesa, asterisco, "Arag.", total "68" | 73 − 10 + 5 = 68, **verde** |
| L9 | Promoção 10 definida. 3557 | faixa cobrada premium, sem desconto: esperado 113, **verde** |
| L10 | "G frango", "Arag.", total "78" | opções de 73, 86 e 93: item sem preço, **vermelho**, com as 4 opções listadas |
| L11 | 3557 com as leituras divergindo no total ("113,00" × "118,00") | **vermelho** no total, mostrando as duas |
| L12 | Conversão do valor lido | "113" → 11300; "113,00" → 11300; "R$ 113,50" → 11350; "1.130,00" → 113000; "11a,00" → nulo |
| L13 | Combo 01, "Arag.", total "154,99" | 149,99 + 5 = 154,99, **verde** |
| L14 | Refrigerante 1L, "Arag.", total "15,00" | 10 + 5 = 15 fecha, mas fica **amarelo** pelo alerta de valor abaixo de R$ 20 |

Os valores esperados foram conferidos por um cálculo à parte.

## Ordem de construção

1. `leitura.ts` com L1 a L14 passando, local e sem rede.
2. Rodar `004_leitura.sql`, `005_leitura_ajustes.sql`, `007_leitura_provedor.sql`, `008_leitura_limite.sql`, `009_leitura_limite_trava.sql` e `011_acerto_e_leitura.sql`.
3. Edge Function com o adaptador `google.ts` e os secrets. Testar com `exemplos/3557.jpg`: tem que dar verde em Aragarças.
4. Botão de foto, "Lendo" e tela de confirmação.
5. Fila offline e leitura posterior (R28).
6. Foto no painel do Luan.
7. Exportar `leituras` em CSV para medir.
8. Adaptador `anthropic.ts` e `scripts/comparar-modelos.ts`, rodados com as fotos da noite de teste.

## Pronto quando

- L1 a L14 passam, e T1 a T17 continuam passando.
- A foto da 3557 lida pela função dá verde em Aragarças.
- Em modo avião, a foto entra na fila e o lançamento manual funciona.
- Nenhuma chave de API aparece no bundle do front.
- Trocar `IA_PROVEDOR` e `IA_MODELO` muda o modelo sem mexer no código.
- Uma noite real foi medida: quantas comandas ficaram verdes, quantas verdes estavam erradas (meta: zero) e o tempo e o custo por comanda.

## Pendências

- Como a comanda diferencia Pix já pago de Pix na hora? Até saber, "Pix" pede um toque (R29).
- O desconto da promoção vale por pizza tradicional? Vale no meio a meio de duas tradicionais?
- Exemplos de 3 a 5 comandas de cada uma das duas pessoas que escrevem, depois da noite de teste.
- O `gemini-3.1-pro-preview` é versão de testes do Google e pode ser desligado com aviso prévio (o `gemini-3-pro-preview` foi desligado em março de 2026). Por isso o modelo fica num secret.

## Documentação

- Gemini, API Interactions: https://ai.google.dev/api/interactions-api
- Gemini, imagens: https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini, resolução da imagem: https://ai.google.dev/gemini-api/docs/media-resolution
- Gemini, saída estruturada: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini, raciocínio: https://ai.google.dev/gemini-api/docs/thinking
- Gemini, modelos que serão desligados: https://ai.google.dev/gemini-api/docs/deprecations
- Anthropic, visão: https://platform.claude.com/docs/en/build-with-claude/vision
- Anthropic, saída estruturada: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
