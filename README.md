# Acerto dos motoboys

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
2. No SQL Editor, rode `supabase/001_schema.sql` e depois `supabase/002_v1_app.sql` (uma vez cada).
3. Em Authentication, deixe o login por e-mail e senha. Se a confirmação de e-mail estiver ligada, o cadastro pede para confirmar pelo link; ponha o endereço do app em Authentication → URL Configuration → Site URL.
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings → API). Na Vercel, as mesmas duas variáveis em Settings → Environment Variables, e faça um novo deploy. Só a anon key; a service role nunca vai para o app.
5. Cada um cria a conta pelo app (entra como motoboy). Depois defina os papéis no SQL Editor, com os `update` do fim do `001_schema.sql` (admin e expedição).
6. O painel do Luan fica em `/painel`. A conta da expedição abre direto nele; o admin chega pelo Histórico → Ajustes → Painel da expedição.

No primeiro login, se o celular tiver noites da versão sem nuvem, o app oferece "Enviar meu histórico para a nuvem".

### Como funciona offline

Toda alteração grava primeiro no IndexedDB do celular e entra numa fila, que sobe quando há internet (indicador "Salvo na nuvem" ou "3 alterações esperando internet"). Cada alteração sobe só com o que mudou, então o motoboy marcando "entregue" não desfaz o "Pix caiu" que o Luan marcou na mesma comanda. O que o Luan muda chega pelo realtime e a cada sincronização. Depois do acerto confirmado, a nuvem recusa mudanças do motoboy naquele caixa, e o app avisa.

### Testes do banco

`supabase/teste/` tem o teste das regras de acesso (um motoboy não vê o caixa do outro, a trava depois do acerto) para rodar num Postgres local. Veja `supabase/teste/README.md`.

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
