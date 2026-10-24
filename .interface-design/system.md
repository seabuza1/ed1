# Design System

O sistema completo, com tokens, regras e componentes, está em `DESIGN.md` (raiz). Os valores ficam em `src/index.css`, e as pessoas e o produto em `PRODUCT.md`. Este arquivo resume as decisões para a interface-design.

## Direction

**Personality:** Utility & Function, no mundo da rua à noite: placas de estrada, asfalto e faixa amarela.

**Foundation:** asfalto quase preto, levemente azulado (claro: concreto). Um único acento, o amarelo refletivo.

**Depth:** degraus de superfície, sem sombras e sem bordas de cartão. `--fundo` #111316 → `--superficie` #1a1d21 (cartões, colunas) → item tocável volta ao `--fundo` → `--campo` #0c0d10 (campos de digitar).

**Uso:** celular, à noite, uma mão. Tema escuro por padrão; claro como "placa de dia".

**Pedidos do usuário:** não pôr cor demais e não mudar as coisas de lugar. O mundo entra por letra, cor, densidade e a placa, nunca pela organização das telas.

## Tokens

### Cor (papéis)
- `--faixa` #ffcc00 com `--sobre-faixa` #111316: fundo da ação principal (nos dois temas).
- `--marca`: o amarelo como texto e marca (aba atual, seleção, foco, em rota, pendências). Escuro #ffd23f; claro #6f5200.
- `--placa` #1f5fae: só a área escolhida. `--placa-apagada` e `--friso`: as placas não escolhidas.
- `--ok`, `--perigo`, `--info`: feito, perigo, maquininha. Nada mais tem cor.
- Texto: `--texto`, `--texto-2`, `--discreto`. Links e dicas ficam neutros (sublinhado).

### Espaço
Base 4px: 8 (dentro de grupos), 10–12 (entre itens), 16 (entre blocos e margem).

### Raio
10px (`--raio-botao`) em botões, campos, placas e itens; 12px (`--raio`) em cartões e colunas; 999px em pílulas.

### Tipografia
- Barlow (500/600/700) no texto; Barlow Condensed (600/700) em `--numeros`: títulos h1, códigos, valores, totais, folha. Sempre `tabular-nums` nos números.
- Fontes guardadas no app (`@fontsource/barlow`, `@fontsource/barlow-condensed`), funcionam offline.

## Patterns

### Botão
- Primário: amarelo refletivo, 56px, largura toda, 1.1rem 700. Parado: tonal com texto cinza.
- Secundário: tonal, 48px. "Entregue" é secundário com o visto verde.
- Link: texto sublinhado, sem cor.

### Placa de área (assinatura)
- Placa apagada com friso interno a 3px; nome em Barlow 600 e taxa em Barlow Condensed.
- Escolhida: azul de placa com friso branco de 5px. Sugerida pela leitura: tracejado amarelo por fora.

### Em rota
- Faixa tracejada amarela (4px, traços de 16px) na borda esquerda da linha; a moto fica neutra.

### Item tocável de lista (papel, Pix, maquininha)
- Fundo `--fundo` sobre o cartão, sem borda, mínimo 52–60px, caixinha de 24px. Feito: fundo transparente e caixinha verde.

### Topo do painel
- Pendências primeiro, uma por linha no celular ("3 Pix a conferir ›"), em amarelo-suave; o toque leva à coluna, marca por 1,2s e põe o foco.
- Depois quatro números numa faixa só, sem R$.

### Folha
- Uma coluna por motoboy na ordem de chegada, PIX por último. Título e rodapé com traço de 2px, como no papel.
- No celular: duas colunas e um pedaço da terceira, rolando para o lado.

### Abas
- Celular: a atual em amarelo com um traço de 36×3px em cima. Computador (painel): menu lateral, a atual com fundo amarelo-suave.

### Confirmação e desfazer
- Nada de `alert`/`confirm`: Desfazer por 5s ou dois toques.

## Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Mundo "A rua à noite" (placas, asfalto, faixa) | Direção A da Impeccable; o usuário não escolheu e ela seguiu como a sorteada. | 2026-10-24 |
| Um único acento amarelo; links neutros | Pedido do usuário: "cor demais" piora. | 2026-10-24 |
| Nada muda de lugar | Pedido do usuário: "mudar onde as coisas ficam" piora. | 2026-10-24 |
| Áreas como placas de destino | A taxa por cidade é o que o motoboy recebe; a placa é o objeto que ele conhece da rua. | 2026-10-24 |
| Barlow / Barlow Condensed | Desenhada a partir das placas de estrada; números grandes e estreitos que cabem em coluna. | 2026-10-24 |
| Amarelo do claro em ocre #6f5200 | Amarelo puro não tem contraste como texto no branco. | 2026-10-24 |
