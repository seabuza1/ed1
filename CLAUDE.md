# Acerto dos motoboys

Sistema para a pizzaria onde trabalho como motoboy, construído aos poucos. O MVP local (só o meu caixa) já roda. Agora: v1 com nuvem, painel do Luan e acerto mais fácil.

## Docs
- `docs/SPEC-v1.md`: o que construir agora.
- `docs/SPEC-mvp-acerto.md`: o MVP já feito, base da v1 (regras R1 a R13, testes T1 a T9).
- `docs/requisitos.md`: levantamento completo da operação. Só contexto: não implementar nada fora da spec.
- `supabase/001_schema.sql`: tabelas, regras de acesso (RLS) e realtime.
- `supabase/002_v1_app.sql`: complemento do app (hora da entrega, nome da expedição para o motoboy, área sugerida, ordem de chegada). Rodar depois do 001.
- `supabase/003_v1_avisos.sql`: correções dos avisos do Supabase (search_path, EXECUTE das funções, políticas mais leves). Rodar depois do 002.
- `supabase/teste/`: teste das regras de acesso num Postgres local.

## Stack
Vite + React + TypeScript, PWA offline. Supabase (Postgres, Auth, Realtime). Local-first: IndexedDB (Dexie) com fila de sincronização, atrás de `src/data/repo.ts`. Testes com Vitest. Deploy na Vercel. No front só a anon key; a service role nunca.

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
