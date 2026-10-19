# Testes do banco

Para conferir o SQL sem mexer no projeto do Supabase, num Postgres comum (16 ou mais novo).

## Regras de acesso (RLS)

```sh
sh supabase/teste/rodar.sh
```

Cria o banco `acerto_teste` com `stub-supabase.sql` (o mínimo do Supabase: `auth.users`,
`auth.uid()`, papéis `anon` e `authenticated`), roda `001_schema.sql` a `008_leitura_limite.sql`,
`rls.sql`, `rls-leitura.sql`, `rls-pix.sql` e `rls-limite.sql`. Termina com `RLS ok`, `RLS leitura ok`, `RLS Pix ok` e `RLS limite ok`, ou para no primeiro erro. Confere, com duas contas de
motoboy, a do Luan e a do admin:

- um motoboy não vê nem altera o caixa do outro;
- depois do acerto confirmado, o motoboy não edita o caixa nem as comandas;
- só o admin reabre (apaga o acerto);
- pagamentos que não somam o total são recusados;
- ordem de chegada e área sugerida (`area_do_codigo`);
- leitura por foto: leituras e fotos só do dono do caixa ou da equipe, nada depois do acerto, caminho da foto
  `{caixa}/{comanda}.jpg` e só o admin apaga foto;
- só a equipe marca ou desmarca o Pix "caiu";
- até 60 leituras da IA por hora por conta, e conta desativada não lê.

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
