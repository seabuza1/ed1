---
name: Meu acerto
description: Comandas e acerto do motoboy da Mel Pizzaria, no visual da rua à noite.
colors:
  asfalto: "#111316"
  asfalto-alto: "#1a1d21"
  asfalto-fundo: "#0c0d10"
  asfalto-tonal: "#262a2f"
  linha-asfalto: "#2c3137"
  branco-placa: "#f3f5f6"
  branco-placa-2: "#d3d8dc"
  cinza-poste: "#9ba4ac"
  amarelo-refletivo: "#ffcc00"
  amarelo-faixa: "#ffd23f"
  amarelo-faixa-suave: "#2b2407"
  azul-placa: "#1f5fae"
  placa-apagada: "#151c26"
  verde-siga: "#3fd17a"
  azul-info: "#7fb0ff"
  vermelho-pare: "#ff6b6b"
  concreto: "#eef0f2"
  ocre-dia: "#6f5200"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.4
  numero-grande:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "1.7rem"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tnum"
  numero:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    letterSpacing: "0.01em"
    fontFeature: "tnum"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  botao: "10px"
  cartao: "12px"
  pilula: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.amarelo-refletivo}"
    textColor: "{colors.asfalto}"
    rounded: "{rounded.botao}"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.asfalto-tonal}"
    textColor: "{colors.branco-placa}"
    rounded: "{rounded.botao}"
    height: "48px"
  placa-area:
    backgroundColor: "{colors.placa-apagada}"
    textColor: "{colors.branco-placa}"
    rounded: "{rounded.botao}"
    height: "56px"
  placa-area-escolhida:
    backgroundColor: "{colors.azul-placa}"
    textColor: "#ffffff"
    rounded: "{rounded.botao}"
    height: "56px"
  input:
    backgroundColor: "{colors.asfalto-fundo}"
    textColor: "{colors.branco-placa}"
    rounded: "{rounded.botao}"
    height: "52px"
  pendencia:
    backgroundColor: "{colors.amarelo-faixa-suave}"
    textColor: "{colors.amarelo-faixa}"
    rounded: "{rounded.botao}"
    height: "48px"
  cartao:
    backgroundColor: "{colors.asfalto-alto}"
    rounded: "{rounded.cartao}"
    padding: "16px"
---

# Design System: Meu acerto

Fonte dos valores: `src/index.css`. Produto e pessoas: `PRODUCT.md`. Direção: `.impeccable/surfaces/src-app-tsx.md`.

## Overview

**Creative North Star: "A rua à noite"**

O app do motoboy e o painel do Luan falam a língua das placas de estrada: destino, taxa e atenção. O chão é asfalto escuro, o texto é o branco das placas e há um único acento, o amarelo refletivo, que se vê de longe na rua, com uma mão e com pressa. As áreas de entrega são placas de destino com a taxa no lugar da distância; só a escolhida acende em azul. O resto é estrutura quieta: degraus de asfalto em vez de bordas, números grandes e estreitos que batem em coluna, e nada encostado num canto com sobra do outro lado.

O escuro vem da cena, não da moda: o motoboy usa o app na rua sob luz de poste e o Luan no balcão, entre o WhatsApp e o forno. O tema claro ("placa de dia") existe para o sol e segue as mesmas regras, com o amarelo escurecido para ocre quando vira texto. Os usuários pediram para não ter cor demais e não mudar as coisas de lugar: o mundo entra por letra, cor, densidade e a placa, nunca pela organização das telas.

**Key Characteristics:**
- Um só acento: amarelo refletivo para a ação principal, a aba atual, o que está em rota e o que pede atenção.
- Áreas como placas de destino, com moldura e a taxa.
- Barlow no texto, Barlow Condensed nos números, códigos e títulos, sempre tabular.
- Profundidade por degraus de asfalto; bordas só nos frisos das placas e nas linhas da folha.
- Botões de 48px (56px na ação principal), uso com uma mão.
- Linha cheia: o que fica sozinho numa linha ocupa a largura toda, com o conteúdo no centro.

## Colors

Asfalto e branco de placa com um amarelo só; azul, verde e vermelho só quando significam algo.

### Primary
- **Amarelo Refletivo** (#ffcc00): fundo da ação principal ("Foto da comanda", "Lançar · Barra do Garças", "Fechar a noite", "Confirmar acerto"), com texto em asfalto (12,3:1). Igual nos dois temas.
- **Amarelo Faixa** (#ffd23f no escuro; Ocre Dia #6f5200 no claro): o amarelo como texto e marca: aba atual, seleção de chips, foco, faixa tracejada de "em rota", pendências do painel, "Receber".

### Secondary
- **Azul de Placa** (#1f5fae): só a área escolhida, com friso branco e texto branco (6,4:1). Nunca em outro lugar.

### Tertiary
- **Verde Siga** (#3fd17a; #0f6b34 no claro): feito (entregue, Pix caiu, papel conferido, confirmado, "Devolver").
- **Vermelho Pare** (#ff6b6b; #b31b1b no claro): perigo e diferença (excluir, falta, "Lançar assim").
- **Azul Info** (#7fb0ff; #1d4ed8 no claro): maquininha e troco por Pix.

### Neutral
- **Asfalto** (#111316; Concreto #eef0f2 no claro): fundo da tela.
- **Asfalto Alto** (#1a1d21; branco no claro): cartões, formulário, colunas da folha.
- **Asfalto Fundo** (#0c0d10; #e4e7ea no claro): campos de digitar, mais fundos que o cartão.
- **Asfalto Tonal** (#262a2f; #dde1e5 no claro): botões secundários e "Entregue".
- **Linha** (#2c3137; #cfd4d9 no claro): divisórias da lista e da conta.
- **Branco de Placa** (#f3f5f6), **Branco 2** (#d3d8dc), **Cinza de Poste** (#9ba4ac; #555d65 no claro): os três níveis de texto.
- **Placa Apagada** (#151c26; branco no claro): o fundo das placas de área não escolhidas.

### Named Rules
**A Regra do Amarelo Único.** O amarelo é a única cor de acento. Aparece na ação principal, na aba atual, no que está em rota e no que pede atenção; links e dicas ficam neutros.

**A Regra da Placa Acesa.** Azul de placa só na área escolhida. Uma tela com duas placas azuis está errada.

## Typography

**Display Font:** Barlow Condensed (com Barlow e system-ui)
**Body Font:** Barlow (com system-ui)

**Character:** a Barlow vem das placas de estrada; a versão condensada deixa códigos e valores grandes sem ocupar a tela, como o nome de uma cidade numa placa.

### Hierarchy
- **Display** (700, 1.8rem, 1.1): título da tela ("Noite de 24/10", "Folha da noite"), em Barlow Condensed.
- **Número grande** (700, 1.7rem, tabular): código da comanda na lista e no campo (1.75rem com 0.08em de espaço).
- **Número** (600–700, 1.1–1.45rem, tabular): valores, totais do topo (1.25rem), conta do acerto (1.4rem), folha (1.3rem).
- **Title** (700, 1.1rem): título de bloco ("Lançar comanda", "Papéis").
- **Body** (500, 17px, 1.4): texto e botões (600).
- **Label** (700, 0.7–0.8rem, 0.04–0.05em, maiúsculas): "EM ROTA", "DEVOLVER", cabeçalho de tabela.

### Named Rules
**A Regra do Número Estreito.** Todo número de dinheiro, código ou contagem usa Barlow Condensed com `tabular-nums`; texto corrido nunca.

## Layout

Uma coluna no celular (até 560px de largura, 16px de margem), mobile-first. A partir de 900px: o app do motoboy vira duas colunas (lançar | lista; conta e fechar | o que conferir, até 1400px, centralizado) e o painel ganha menu lateral de 248px com a folha em colunas que dividem a largura entre si; as abas de baixo se espalham uma em cada terço. No celular a folha rola para o lado, com duas colunas e um pedaço da terceira à vista. Ritmo de 8px dentro de grupos, 10–12px entre itens e 16px entre blocos. A barra de totais fica presa no topo; as abas, embaixo.

### Named Rules
**A Regra da Linha Cheia.** Nada fica encostado num canto com sobra do outro lado: o que fica sozinho numa linha (link, "Voltar", seletor de data, campo) ocupa a largura toda, com o conteúdo no centro; selos de status dividem a linha entre si; números de faixa ficam centralizados na sua parte; no computador, colunas, blocos e abas dividem a largura.

## Elevation & Depth

Sem sombras. A profundidade vem de degraus de asfalto: fundo → cartão (#1a1d21) → item tocável sobre o cartão volta ao fundo (#111316) → campo de digitar ainda mais fundo (#0c0d10). As únicas linhas são as divisórias da lista e da conta (1px), os traços de 2px da folha (título e rodapé de cada coluna, como na folha de papel) e a moldura das placas.

### Shadow Vocabulary
- **Moldura da placa** (`box-shadow: inset 0 0 0 2px <friso>`): a moldura das placas de área, encostada na borda (sem faixa vazia por dentro); acesa, fica branca com 2.5px.
- **Marca de chegada** (`box-shadow: inset 0 0 0 2px <amarelo>`, sumindo em 1,2s): a coluna onde o atalho do topo levou.

### Named Rules
**A Regra do Degrau.** Cartão não tem borda nem sombra; ele se separa do fundo por um degrau de asfalto.

## Shapes

Cantos de 10px em botões, campos, placas e itens; 12px em cartões e colunas; pílulas inteiras para status ("Pendente", "Confirmado", "Noite aberta"), que se esticam para dividir a linha. A placa tem a moldura clara encostada na borda.

## Components

### Buttons
- **Shape:** 10px.
- **Primary:** amarelo refletivo com texto asfalto, 56px de altura e largura toda, 1.1rem 700. Parada (sem poder agir) fica em asfalto tonal com texto cinza, nunca amarelo apagado.
- **Secondary:** asfalto tonal, texto branco de placa, 48px. "Entregue" na lista é secundário com o visto em verde.
- **Link:** texto branco de placa sublinhado (1.5px, cinza, 4px abaixo); sem cor. Sozinho na linha ("Mais opções", "Voltar"), ocupa a largura toda com o texto no centro.
- **Perigo:** contorno vermelho de 1.5px; armado (segundo toque) fica vermelho cheio.
- **Toque:** opacidade 0,75. **Foco:** contorno 2px amarelo, 2px de folga.

### Chips
- **Style:** contorno de 1.5px na linha, sem fundo, 52px.
- **State:** escolhido fica com contorno amarelo, fundo amarelo-suave e texto amarelo.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** asfalto alto.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Internal Padding:** 16px (colunas da folha 12px por 10px).

### Inputs / Fields
- **Style:** asfalto fundo, sem borda, 10px, 52px; código em Barlow Condensed 1.75rem; reais com "R$" cinza à esquerda e o valor em 1.35rem.
- **Focus:** borda de 1.5px amarela; cursor amarelo.
- **Error:** contorno vermelho de 2px no campo com problema (leitura por foto).

### Navigation
- **Celular:** abas embaixo com ícone e rótulo de 0.78rem; a atual fica amarela, com um traço amarelo de 36×3px em cima.
- **Painel no computador:** menu lateral; a atual com fundo amarelo-suave e texto amarelo.

### Placa de área (assinatura)
Cada área de entrega é uma placa de destino: fundo de placa apagada, moldura de 2px encostada na borda, nome em Barlow 600 e a taxa embaixo em Barlow Condensed. A escolhida acende em azul de placa com moldura branca. A sugerida pela leitura da comanda ganha uma linha tracejada amarela por fora e a origem ("escrito na comanda") embaixo.

### Em rota
A comanda em rota ganha a faixa tracejada amarela da pista na borda esquerda (4px, traços de 16px); a moto ao lado fica neutra.

## Do's and Don'ts

### Do:
- **Do** usar o amarelo refletivo (#ffcc00) só na ação principal da tela, com texto asfalto.
- **Do** mostrar área como placa de destino, com a taxa, e acender só a escolhida em azul (#1f5fae).
- **Do** escrever todo número, código e valor em Barlow Condensed tabular.
- **Do** separar cartões do fundo por degrau de asfalto, sem borda e sem sombra.
- **Do** manter botões de 48px (56px na ação principal) e texto pequeno com 4,5:1 nos dois temas.
- **Do** deixar tudo centralizado ou justificado: o que fica sozinho numa linha ocupa a largura toda (pedido do usuário).

### Don't:
- **Don't** pintar links, dicas ou títulos de amarelo: o amarelo é da ação e da atenção (pedido do usuário: "cor demais" piora).
- **Don't** mudar telas, ordem ou navegação para encaixar o visual (pedido do usuário: "mudar onde as coisas ficam" piora).
- **Don't** usar o azul de placa fora da área escolhida, nem duas placas acesas ao mesmo tempo.
- **Don't** deixar a ação principal amarela pela metade quando parada; use o tonal.
- **Don't** deixar moldura com faixa vazia por dentro nem bloco encostado num canto com sobra do outro lado.
- **Don't** usar caractere (✓, →) como ícone de interface; use os ícones do app. As anotações da folha de papel ("→ 3,00" do troco por Pix, o "•" de papel não conferido) continuam, porque são a notação do Luan.
