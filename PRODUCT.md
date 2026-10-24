# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Motoboy (hoje, só o Felipe):** lança as comandas da noite no próprio celular, no balcão da Mel Pizzaria e na porta do cliente, quase sempre com uma mão e à noite. No fim da noite faz o acerto com o Luan. Os outros motoboys (João, Goes, Vitor, Arthur) entram depois; os celulares deles são variados.
- **Luan (expedição):** despacha as entregas e faz o acerto de cada motoboy no fim da noite. Usa o painel **no celular**, entre o WhatsApp da pizzaria e o balcão. Gosta de tudo direto e intuitivo.
- **Admin:** o Felipe, que mexe em áreas, taxas e papéis da equipe.

## Product Purpose

Trocar a folha de expedição e a conta de cabeça do acerto por um app: o motoboy lança cada comanda (à mão ou por foto), o Luan vê a folha da noite em tempo real, marca o Pix que caiu e confirma o acerto com os valores certos. Sucesso é o acerto da noite fechar rápido e sem diferença de dinheiro.

## Positioning

Feito para a operação real da Mel Pizzaria: comanda de papel identificada pelos 4 últimos dígitos do telefone, taxa por cidade (Aragarças, Pontal do Araguaia, Barra do Garças), caixa inicial de R$ 80, diária de R$ 30, Pix antecipado e troco por Pix. A folha do painel tem o formato da folha de papel que o Luan já usa.

## Operating Context

- Funciona de quarta a domingo, a partir das 19h, com cerca de 100 entregas por noite.
- O motoboy usa o app em pé, no balcão ou na rua, às vezes sem internet: tudo grava no aparelho e sobe depois.
- O Luan alterna entre o celular do WhatsApp, o balcão e o painel; olha o painel em intervalos curtos.
- A comanda de papel continua existindo e volta para o Luan no acerto (papel conferido).

## Capabilities and Constraints

- PWA (Vite + React), local-first com IndexedDB e fila de sincronização; Supabase na nuvem; deploy na Vercel.
- Dinheiro sempre em centavos e exibido como `R$ 1.234,56`. Regras e contas só no domínio (`src/domain/`); telas não fazem conta.
- Interface em português do Brasil, mobile-first, botões de 48px, uso com uma mão.
- Sem `alert`/`confirm`: desfazer ou confirmação com dois toques.
- Papéis: `motoboy`, `expedicao` (Luan), `admin`.
- Leitura da comanda por foto com IA (só transcreve); a conta é refeita pelo cardápio no domínio.

## Brand Commitments

- Nome no app: "Meu acerto". A pizzaria é a Mel Pizzaria.
- Tema escuro por padrão (segue o sistema, com opção manual de claro).
- Vocabulário da casa: comanda, caixa, acerto, liquidação, diária, taxa, Pix antecipado, troco por Pix, papel conferido, Pix "caiu".

## Evidence on Hand

- Foto real da comanda 3557 em `supabase/functions/_shared/exemplos/3557.jpg`.
- Cardápio em `supabase/functions/_shared/cardapio-mel.json`.
- Levantamento da operação em `docs/requisitos.md`. Não há logo próprio nem fotos da pizzaria no projeto.

## Product Principles

1. O dinheiro tem que bater: cada valor na tela vem do domínio e é o mesmo no celular e no painel.
2. Um toque para o caso comum (tocar na forma lança, "Bateu" no acerto); o raro fica em "Mais opções".
3. Nada se perde: sem internet continua funcionando, e todo passo destrutivo tem Desfazer.
4. Direto para o Luan: o número que importa primeiro, o resto depois.

## Accessibility & Inclusion

Uso à noite, em pé e com uma mão: alvos de 48px, contraste alto no tema escuro, números grandes e tabulares, nada que dependa só de cor.
