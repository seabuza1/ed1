---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/telas/Painel.tsx", "src/index.css"]
---

## Scope

Operate mode, web mobile-first: o app do motoboy (Noite, Acerto, Histórico, leitura por foto) e o painel do Luan (Folha, Caixa, Resumo, Ajustes), que o Luan usa no celular. Redesenho do mundo visual: letra, cores, densidade e um detalhe marcante. Telas, ordem, navegação, textos e funcionamento ficam onde estão (pedido do usuário: "mudar onde as coisas ficam" piora). Cor contida (pedido: "cor demais" piora).

## Direction contract

THESIS: A rua à noite. O app fala a língua das placas de estrada (destino, taxa, atenção) e recusa o painel escuro genérico de cartões com acento laranja.
OWN-WORLD: Chão de asfalto (cinza-azulado quase preto), texto em branco de placa, um único acento: o amarelo refletivo, para a ação principal, a aba atual e o que pede atenção. Azul de placa urbana só na área escolhida; verde e vermelho só para feito e perigo. Barlow no texto, Barlow Condensed nos números, códigos e títulos, sempre tabulares. Superfícies por degraus de asfalto, sem bordas de cartão.
STORY: O motoboy lança a comanda escolhendo o destino como numa placa e vê de longe o que está em rota; o Luan lê a folha como a de papel e acha em um toque o Pix e o acerto pendentes.
FIRST VIEWPORT: Noite: faixa de totais no topo; título condensado; botão amarelo "Foto da comanda"; código e total grandes; áreas como placas de destino em grade 2x2 (contorno branco interno, nome e taxa); formas; lista em rota com faixa tracejada amarela à esquerda. Painel: pendências em amarelo, faixa de números, folha em colunas.
FORM: Placa (direção A, primeira da lista ordenada; o usuário não escolheu e ela seguiu como a sorteada). seed: none (unavailable)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

- Tema escuro por padrão (segue o sistema), claro como opção, contraste AA nos dois.
- Botões de 48px, uso com uma mão, nada de alert/confirm.
- Fontes guardadas no app (offline), sem pedido a servidor de fontes.

## Unresolved

- Detector e sorteio da Impeccable não rodaram (programa bloqueado na sessão); revisão final feita em contexto único.

## Built surface

Registrado de `src/index.css` (tokens, fontes Barlow e Barlow Condensed guardadas no app, placas de área, faixa de "em rota", abas), `src/telas/Painel.tsx` (visto do Pix como ícone) e dos ícones em `public/` (placa amarela, renderizados de `public/favicon.svg`). Capturas de 390 e 1440 em `.impeccable/review/` (fora do git).

Revisão final em contexto único (sem subagente), disposição **fix**: os links amarelos viraram neutros, o "✓" virou ícone e a moto em rota ficou neutra (resolvidos). Fica em aberto só o sorteio da direção, que não rodou porque o programa da Impeccable está bloqueado nesta sessão. Documentação em `DESIGN.md` e `.impeccable/design.json`.
