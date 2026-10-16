# Testes do banco

Para conferir o SQL sem mexer no projeto do Supabase, num Postgres comum (16 ou mais novo).

## Regras de acesso (RLS)

```sh
sh supabase/teste/rodar.sh
```

Cria o banco `acerto_teste` com `stub-supabase.sql` (o mínimo do Supabase: `auth.users`,
`auth.uid()`, papéis `anon` e `authenticated`), roda `001_schema.sql`, `002_v1_app.sql` e
`rls.sql`. Termina com `RLS ok`, ou para no primeiro erro. Confere, com duas contas de
motoboy, a do Luan e a do admin:

- um motoboy não vê nem altera o caixa do outro;
- depois do acerto confirmado, o motoboy não edita o caixa nem as comandas;
- só o admin reabre (apaga o acerto);
- pagamentos que não somam o total são recusados;
- ordem de chegada e área sugerida (`area_do_codigo`).

## App contra o banco (supabase-js + PostgREST)

`src/data/nuvem/remotoSupabase.integracao.test.ts` roda o código do app contra um banco de
verdade servido pelo [PostgREST](https://postgrest.org) (sem login e sem realtime do
Supabase). Num banco novo com stub, 001 e 002, crie o papel `authenticator` (`grant anon,
authenticated to authenticator`), os usuários `...0a` (João), `...0b` (Maria) e `...0c`
(Luan, papel `expedicao`), suba o PostgREST com um `jwt-secret` e rode:

```sh
PGRST_URL=http://localhost:3001 PGRST_JWT_SECRET=<o jwt-secret> npx vitest run src/data/nuvem/remotoSupabase.integracao.test.ts
```

Sem essas variáveis o teste é pulado.
