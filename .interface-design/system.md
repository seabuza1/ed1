# Design System

Fonte dos valores: `src/index.css`. Produto e pessoas: `PRODUCT.md`.

## Direction

**Personality:** Utility & Function. A folha de papel do Luan, passada a limpo: direta, densa onde é lista, com o número que importa na frente.

**Foundation:** neutro frio (cinza quase preto no escuro), com o laranja-tomate da marca.

**Depth:** mudança de superfície, sem sombras e sem bordas nos cartões. `--fundo` → `--superficie` (cartões e colunas) → `--campo` (o que é tocável dentro de um cartão: campos, papéis e Pix a conferir).

**Uso:** celular, à noite, uma mão. Tema escuro por padrão (segue o sistema), claro como opção.

## Tokens

### Cor (papéis, não matizes)
- `--marca`: ação principal, seleção, aba atual, foco. Claro `#b83d0c` (4,5:1 ou mais em branco, fundo, campo e realce), escuro `#ff8a5c`.
- `--alerta` / `--alerta-suave`: só o que pede ação agora (pendências do topo do painel, "conferir" do Pix, "Pendente", aviso de comanda em rota). Nunca contorno de item de lista.
- `--ok` / `--ok-suave`: feito (entregue, Pix caiu, papel conferido, confirmado).
- `--info`: troco por Pix e maquininha. `--perigo`: excluir, sair, "Lançar assim".
- Texto em quatro níveis: `--texto`, `--texto-2`, `--discreto`, e o riscado de "voltou".

### Espaço
Base 4px. Usados: 8 (dentro de grupos), 10–12 (respiro de cartão e coluna), 16 (entre blocos e margem da tela).

### Raio
12px em botões e itens tocáveis; 14px (`--raio`) em cartões e colunas; 999px em pílulas de status.

### Tipografia
- Inter (guardada no app, funciona offline), 17px na raiz, 1.4 de entrelinha.
- Números, códigos e dinheiro em mono tabular (`.num`, `.codigo`, `.valor`): é dado, não enfeite.
- Hierarquia por peso e cor antes do tamanho: código 600–700 em `--texto`, forma de pagamento em `--discreto`.
- Títulos com `text-wrap: balance`; parágrafos com `pretty`.

## Patterns

### Botão
- 48px de altura (56px no primário de largura toda), 0 16px, raio 12, peso 600.
- Primário: fundo `--marca`. Secundário: `--tonal`. Perigo: contorno `--perigo`. Link: texto `--marca`.
- Toque: opacidade 0,75. Foco: contorno 2px `--marca`.

### Item tocável de lista (papel, Pix, maquininha)
- Linha com fundo `--campo`, sem borda, mínimo 52–60px, caixinha de 24px à esquerda.
- Feito: fundo some (transparente) e a caixinha fica `--ok`. A cor de pendente fica na contagem, não no item.

### Topo do painel
- Pendências primeiro, uma por linha no celular: "3 Pix a conferir ›", "3 acertos pendentes ›" (`--alerta-suave`). O toque leva à coluna (PIX ou primeiro acerto pendente), marca a coluna por 1,2s e põe o foco nela.
- Depois quatro números numa faixa só, sem R$, como no rodapé da folha: Em rota, Entregues, Devolvem, Recebem.

### Folha
- Uma coluna por motoboy na ordem de chegada, PIX por último (como no papel).
- No celular: duas colunas e um pedaço da terceira, rolando para o lado com encaixe. No computador: todas lado a lado.
- A coluna inteira abre o caixa; o código com foto (32px) abre a foto.

### Confirmação e desfazer
- Nada de `alert`/`confirm`: Desfazer por 5s ou dois toques (`BotaoConfirmar`).

## Motion
- Só o que diz que algo mudou: aviso subindo (150ms), marca da coluna de destino (1,2s, ease-out).
- Com movimento reduzido: sem deslocamento, só opacidade.

## Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Profundidade por superfície, sem bordas nos cartões | Tela pequena e escura: borda em tudo vira grade e pesa. | 2026-10-24 |
| Amarelo só no que pede ação | Seis contornos amarelos no acerto escondiam o que importava. | 2026-10-24 |
| Atalhos do topo levam à coluna | O Luan usa o painel no celular, onde a PIX fica fora da tela. | 2026-10-24 |
| Laranja do tema claro `#b83d0c` | O `#d9480f` dava 3,7–4,3:1 em texto pequeno. | 2026-10-24 |
| Mono só para números e códigos | As colunas de valores precisam bater; texto corrido fica na Inter. | 2026-10-24 |
