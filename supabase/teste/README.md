# Testes do banco

Para conferir o SQL sem mexer no projeto do Supabase, num Postgres comum (16 ou mais novo).

## Regras de acesso (RLS)

```sh
sh supabase/teste/rodar.sh
```

Cria o banco `acerto_teste` com `stub-supabase.sql` (o mínimo do Supabase: `auth.users`,
`auth.uid()`, papéis `anon` e `authenticated`), roda `001_schema.sql` a `011_acerto_e_leitura.sql`,
`rls.sql`, `rls-leitura.sql`, `rls-pix.sql`, `rls-limite.sql`, `rls-revisao.sql` e `rls-acerto.sql`. Termina com `RLS ok`, `RLS leitura ok`, `RLS Pix ok`, `RLS limite ok`, `RLS revisão ok` e `RLS acerto ok`, ou para no primeiro erro (e sai com código de erro). Confere, com duas contas de
motoboy, a do Luan e a do admin:

- um motoboy não vê nem altera o caixa do outro;
- depois do acerto confirmado, o motoboy não edita o caixa nem as comandas;
- só o admin reabre (apaga o acerto);
- pagamentos que não somam o total são recusados;
- ordem de chegada e área sugerida (`area_do_codigo`);
- leitura por foto: leituras e fotos só do dono do caixa ou da equipe, nada depois do acerto, caminho da foto
  `{caixa}/{comanda}.jpg` e só o admin apaga foto;
- só a equipe marca ou desmarca o Pix "caiu";
- até 60 leituras da IA por hora por conta, e conta desativada não lê;
- conta desativada não grava caixa, comanda nem foto; foto só de comanda que está na nuvem;
- o "caiu" sai quando o motoboy muda o valor em Pix antecipado;
- ninguém se promove, a expedição não edita acerto nem áreas (só o admin), o motoboy não apaga leitura;
- o acerto só é confirmado com o caixa como o Luan viu (`confirmar_acerto`), e a escrita do motoboy depois da
  confirmação é recusada mesmo se começou antes;
- a vaga da leitura reservada volta com `devolver_leitura`, só para quem reservou.

## App contra o banco (supabase-js + PostgREST)

`src/data/nuvem/remotoSupabase.integracao.test.ts` roda o código do app contra um banco de
verdade servido pelo [PostgREST](https://postgrest.org) (sem login e sem realtime do
Supabase). Num banco novo com o stub e o 001 a 011 (na ordem do `rodar.sh`), crie o papel `authenticator` (`grant anon,
authenticated to authenticator`), os usuários `...0a` (João), `...0b` (Maria) e `...0c`
(Luan, papel `expedicao`), suba o PostgREST com um `jwt-secret` e rode:

```sh
PGRST_URL=http://localhost:3001 PGRST_JWT_SECRET=<o jwt-secret> npx vitest run src/data/nuvem/remotoSupabase.integracao.test.ts
```

Sem essas variáveis o teste é pulado.
