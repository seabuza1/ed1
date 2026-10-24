# Acerto dos motoboys

Nuvem: projeto Supabase `acerto-motoboys` (São Paulo), com 001 a 011 aplicados; as variáveis estão na Vercel. Função `ler-comanda` publicada (falta só o secret `GEMINI_API_KEY`). O plano grátis pausa o projeto depois de uma semana sem uso: o workflow `manter-supabase-ativo.yml` faz uma consulta por dia para isso não acontecer.

App de celular (PWA offline) para o motoboy lançar as comandas da noite e ter a conta do acerto pronta, e painel para o Luan acompanhar a folha da noite e confirmar os acertos. Veja `CLAUDE.md`, `docs/SPEC-v1.md` (o que está sendo feito) e `docs/SPEC-mvp-acerto.md` (a base).

```sh
npm install
npm run dev     # desenvolvimento
npm test        # testes (cálculo T1 a T17, regras, sincronização com a nuvem)
npm run build   # build de produção com service worker (pasta dist)
```

Sem o `.env` do Supabase o app funciona como no MVP: tudo só no aparelho.

## Nuvem (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor, rode `supabase/001_schema.sql`, depois `supabase/002_v1_app.sql` e `supabase/003_v1_avisos.sql` (uma vez cada, nessa ordem).
3. Em Authentication, deixe o login por e-mail e senha. Se a confirmação de e-mail estiver ligada, o cadastro pede para confirmar pelo link; ponha o endereço do app em Authentication → URL Configuration → Site URL.
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings → API). Na Vercel, as mesmas duas variáveis em Settings → Environment Variables, e faça um novo deploy. Só a anon key; a service role nunca vai para o app.
5. Cada um cria a conta pelo app (entra como motoboy). O primeiro admin é definido no SQL Editor, com o `update` do fim do `001_schema.sql`; depois o admin muda os papéis pelo painel, em **Áreas e equipe**.
6. O painel do Luan fica em `/painel`. A expedição abre direto nele. O admin troca pela aba **Painel** do app e volta pelo **Meu caixa**; no computador, o painel abre sozinho (e o app lembra onde ele estava).

### Painel no computador
Menu na lateral (Folha da noite, Resumo da noite, Áreas e equipe), a noite num relance em cima da folha (em rota, entregues, Pix a conferir, acertos pendentes, devolver e receber), setas para a noite anterior e a próxima, e o caixa do motoboy em duas colunas. No celular, o mesmo painel com abas embaixo.

No primeiro login, se o celular tiver noites da versão sem nuvem, o app oferece "Enviar meu histórico para a nuvem".

### Como funciona offline

Toda alteração grava primeiro no IndexedDB do celular e entra numa fila, que sobe quando há internet (indicador "Salvo na nuvem" ou "3 alterações esperando internet"). Cada alteração sobe só com o que mudou, então o motoboy marcando "entregue" não desfaz o "Pix caiu" que o Luan marcou na mesma comanda. O que o Luan muda chega pelo realtime e a cada sincronização. Depois do acerto confirmado, a nuvem recusa mudanças do motoboy naquele caixa, e o app avisa.

### Testes do banco

`supabase/teste/` tem o teste das regras de acesso (um motoboy não vê o caixa do outro, a trava depois do acerto) para rodar num Postgres local. Veja `supabase/teste/README.md`.

## Leitura da comanda por foto

`docs/SPEC-leitura.md`. O motoboy toca em **Foto da comanda**; a Edge Function `ler-comanda` lê a foto com a IA e a tela de confirmação mostra a conta pelo cardápio (verde, amarelo ou vermelho). Sem internet, a foto fica no celular e é lida quando a internet volta, só como conferência.

1. SQL: `supabase/004_leitura.sql` a `011_acerto_e_leitura.sql`, em ordem, depois do 003 (o 006 trava o Pix "caiu" para só a equipe marcar; o 008 limita a 60 leituras por hora por conta; o 010 fecha a escrita da conta desativada e deixa áreas e taxas só com o admin; o 011 confirma o acerto de uma vez e devolve a vaga da IA quando o provedor cai).
2. Chave da IA: no Supabase, **Edge Functions → Secrets**, crie `GEMINI_API_KEY` (Google AI Studio, conta paga). Para trocar de modelo ou de provedor, sem mexer no código: `IA_MODELO` (padrão `gemini-3.1-pro-preview`), `IA_MODELO_CONFERENCIA` e `IA_PROVEDOR=anthropic` com `ANTHROPIC_API_KEY`. Os dois modelos têm que ser do provedor escolhido. As chaves ficam só lá: nunca no app ou no repositório.
3. Função: o workflow `.github/workflows/funcao-ler-comanda.yml` publica `ler-comanda` com a foto de exemplo. Crie um token em supabase.com → Account → Access Tokens e cadastre no GitHub como secret `SUPABASE_ACCESS_TOKEN`; depois, Actions → Função ler-comanda → Run workflow. (Pela CLI: `npx supabase functions deploy ler-comanda --project-ref ueahsvfmbpthujnvmahl`.)
4. Medir: no painel, **Resumo da noite → Leituras por foto** exporta o CSV (com provedor, modelo e tokens).
5. Comparar modelos: `npm run comparar -- <pasta>` com as fotos da noite de teste e um `gabarito.csv`; as chaves vão num `.env` local (veja `.env.example` e a SPEC).

## Estrutura
- `src/domain/`: regras e contas, funções puras com testes (`acerto.ts`, `comanda.ts`, `painel.ts`, `periodo.ts`, `envioHistorico.ts`...).
- `src/data/repo.ts`: interface de dados das telas. `repoLocal.ts` (só o aparelho) ou `nuvem/repoNuvem.ts` (aparelho + fila + Supabase).
- `src/data/sessao.ts`: login; `src/data/painel.ts`: dados do painel do Luan.
- `src/telas/` e `src/ui/`: telas e componentes. Não fazem conta.

## Deploy (Vercel)
Endereço: **https://acerto-motoboy.vercel.app** (projeto `acerto-motoboy`, ligado a este repositório).

Projeto Vite: a Vercel detecta sozinha (build `npm run build`, saída `dist`). A branch de produção é `main`: o que entra na `main` vai para o endereço acima; outras branches geram prévias. `vercel.json` manda `/painel` para o app.

## Instalar no celular (Android, Chrome)
1. Abra o endereço do app no Chrome.
2. Menu ⋮ → **Instalar app** (ou **Adicionar à tela inicial**).
3. Abra uma vez com internet; depois funciona em modo avião.

No iPhone (Safari): Compartilhar → **Adicionar à Tela de Início**.

Exporte o backup no Histórico de vez em quando se quiser uma cópia a mais; os arquivos `acerto-backup-*.json` não vão para o repositório.
