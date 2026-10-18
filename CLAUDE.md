# Acerto dos motoboys

Sistema para a pizzaria onde trabalho como motoboy, construído aos poucos. O MVP local (só o meu caixa) já roda. Agora: v1 com nuvem, painel do Luan e acerto mais fácil. Depois: leitura da comanda por foto, uma fase de transição que só vale enquanto o pedido é escrito à mão.

## Docs
- `docs/SPEC-v1.md`: o que construir agora.
- `docs/SPEC-leitura.md`: leitura da comanda por foto (regras R19 a R29, testes L1 a L14). Começa depois da etapa 4 da v1 (Supabase).
- `docs/SPEC-mvp-acerto.md`: o MVP já feito, base da v1 (regras R1 a R13, testes T1 a T9).
- `docs/requisitos.md`: levantamento completo da operação. Só contexto: não implementar nada fora da spec.
- `supabase/001_schema.sql`: tabelas, regras de acesso (RLS) e realtime.
- `supabase/002_v1_app.sql`: complemento do app (hora da entrega, nome da expedição para o motoboy, área sugerida, ordem de chegada). Rodar depois do 001.
- `supabase/003_v1_avisos.sql`: correções dos avisos do Supabase (search_path, EXECUTE das funções, políticas mais leves). Rodar depois do 002.
- `supabase/004_leitura.sql`: leitura por foto (promoção da noite, foto e origem da área na comanda, tabela `leituras`, bucket `comandas`). Rodar depois do 003.
- `supabase/005_leitura_ajustes.sql`: ajustes do 004 (caminho da foto, leitura obrigatória). Rodar depois do 004.
- `supabase/006_pix_da_equipe.sql`: só a equipe marca o Pix "caiu". Rodar depois do 005.
- `supabase/007_leitura_provedor.sql`: provedor e tokens de cada leitura. Rodar depois do 006.
- `supabase/teste/`: teste das regras de acesso num Postgres local.
- `supabase/functions/_shared/cardapio-mel.json`: cardápio, regras e glossário. Fonte única para a Edge Function e para o front.
- `supabase/functions/_shared/` (`prompt.ts`, `schema.ts`, `ia/`) e `ler-comanda/`: prompt, schema, adaptadores dos provedores e Edge Function da leitura. Depois de mudar um exemplo, `npm run exemplos`.
- `scripts/comparar-modelos.ts`: compara modelos com as fotos da noite de teste (`npm run comparar -- <pasta>`).

## Stack
Vite + React + TypeScript, PWA offline. Supabase (Postgres, Auth, Realtime, Storage, Edge Functions). Local-first: IndexedDB (Dexie) com fila de sincronização, atrás de `src/data/repo.ts`. Testes com Vitest. Deploy na Vercel. No front só a anon key; a service role nunca. A Edge Function `ler-comanda` chama a IA configurada nos secrets (`IA_PROVEDOR`: Gemini por padrão, ou Anthropic); `GEMINI_API_KEY` e `ANTHROPIC_API_KEY` ficam só nos secrets do Supabase, nunca no front.

## Convenções
- Dinheiro sempre em centavos (inteiro). Exibir como `R$ 1.234,56`.
- Regras e contas só em `src/domain/`, em funções puras e testadas. Telas não fazem conta.
- Interface em português do Brasil, mobile-first, botões de 48px, uso com uma mão, tema escuro.
- Sem `alert`/`confirm`: desfazer ou confirmação com dois toques.
- Papéis: `motoboy`, `expedicao` (Luan), `admin`.
- Backups `.json` e `.env` ficam fora do repositório (`.gitignore`).
- Respostas e resumos curtos.

## Glossário
- **comanda**: pedido em papel, identificado pelos 4 últimos dígitos do telefone do cliente.
- **caixa**: o caixa de um motoboy numa noite; também o troco inicial (R$ 80) que ele leva.
- **acerto**: fechamento do caixa do motoboy com o Luan no fim da noite.
- **liquidação**: o Luan paga o motoboy primeiro com o caixa inicial dele; o que passar sai do caixa da empresa e fica registrado.
- **diária**: R$ 30 por noite trabalhada.
- **taxa**: valor da entrega por cidade ou área; o motoboy recebe a mesma taxa que o cliente paga.
- **Pix antecipado**: o cliente pagou antes; não passa pela mão do motoboy.
- **troco por Pix**: o cliente pagou em dinheiro a mais e a pizzaria devolveu a diferença por Pix.
- **papel conferido**: a comanda de papel foi entregue ao Luan no acerto.
- **leitura**: o que a IA transcreveu da foto da comanda. Só transcreve, nunca calcula.
- **conferência**: a conta itens pelo cardápio + taxa = total lido, feita no domínio. Dá verde, amarelo ou vermelho.
- **área sugerida**: a área que o app pré-seleciona (escrita na comanda, pelo valor ou padrão Aragarças). O motoboy sempre confirma com um toque.
- **promoção da noite**: o asterisco na comanda. Desconto em reais nas pizzas tradicionais, que muda toda noite.
