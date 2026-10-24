-- Teste do 011: confirmação do acerto de uma vez e vaga da leitura devolvida. Rodar depois do
-- rls-revisao.sql (Maria com o caixa ...02 aberto e uma comanda).
\set ON_ERROR_STOP 1
set role authenticated;

-- Maria não confirma o próprio acerto.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    perform public.confirmar_acerto('10000000-0000-0000-0000-000000000002', 1, now(), 8000, 3000, 0, 0, 0, 0, 0, 0, 0, 0);
    raise exception 'motoboy confirmou o acerto';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Luan: com o que ele viu desatualizado, 'mudou'; com o certo, 'ok', e o caixa fecha.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$
declare
  qtd integer;
  ultima timestamptz;
  cx record;
  r text;
begin
  select count(*), date_trunc('milliseconds', max(atualizado_em)) into qtd, ultima
    from comandas where caixa_id = '10000000-0000-0000-0000-000000000002';
  select caixa_inicial, diaria into cx from caixas where id = '10000000-0000-0000-0000-000000000002';
  r := public.confirmar_acerto('10000000-0000-0000-0000-000000000002', qtd - 1, ultima, cx.caixa_inicial, cx.diaria,
                               0, 0, 0, 0, 0, 0, 0, 0);
  if r <> 'mudou' then raise exception 'comanda a menos: esperava mudou, veio %', r; end if;
  r := public.confirmar_acerto('10000000-0000-0000-0000-000000000002', qtd, ultima - interval '1 second', cx.caixa_inicial,
                               cx.diaria, 0, 0, 0, 0, 0, 0, 0, 0);
  if r <> 'mudou' then raise exception 'comanda alterada: esperava mudou, veio %', r; end if;
  r := public.confirmar_acerto('10000000-0000-0000-0000-000000000002', qtd, ultima, cx.caixa_inicial + 100, cx.diaria,
                               0, 0, 0, 0, 0, 0, 0, 0);
  if r <> 'mudou' then raise exception 'caixa alterado: esperava mudou, veio %', r; end if;
  if exists (select 1 from acertos where caixa_id = '10000000-0000-0000-0000-000000000002') then
    raise exception 'gravou acerto com o caixa mudado';
  end if;
  r := public.confirmar_acerto('10000000-0000-0000-0000-000000000002', qtd, ultima, cx.caixa_inicial, cx.diaria,
                               19300, 0, 0, 4700, 4700, 0, 14600, 0);
  if r <> 'ok' then raise exception 'esperava ok, veio %', r; end if;
  if (select confirmado_por from acertos where caixa_id = '10000000-0000-0000-0000-000000000002')
     <> '00000000-0000-0000-0000-00000000000c' then raise exception 'confirmado_por'; end if;
  if (select fechado_em from caixas where id = '10000000-0000-0000-0000-000000000002') is null then
    raise exception 'não fechou o caixa';
  end if;
  r := public.confirmar_acerto('10000000-0000-0000-0000-000000000002', qtd, ultima, cx.caixa_inicial, cx.diaria,
                               0, 0, 0, 0, 0, 0, 0, 0);
  if r <> 'já confirmado' then raise exception 'confirmou duas vezes: %', r; end if;
end $$;

-- A escrita do motoboy que passou pela regra de acesso antes da confirmação (aqui, sem a regra:
-- o dono da tabela) é recusada pelo gatilho depois dela.
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    update comandas set status = 'voltou' where id = '20000000-0000-0000-0000-0000000000f1';
    raise exception 'motoboy mudou comanda de caixa confirmado';
  exception when insufficient_privilege then null;
  end;
  begin
    update caixas set obs = 'x' where id = '10000000-0000-0000-0000-000000000002';
    raise exception 'motoboy mudou caixa confirmado';
  exception when insufficient_privilege then null;
  end;
end $$;
-- A equipe continua marcando papel e Pix depois do acerto.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
update comandas set papel_conferido = true where id = '20000000-0000-0000-0000-0000000000f1';

-- Vaga da leitura: reservada conta no limite; devolvida, não conta. A vaga de outra conta não sai.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  r jsonb;
  antes integer;
begin
  r := public.reservar_leitura();
  if r->>'estado' <> 'ok' or r->>'vaga' is null then raise exception 'reservar_leitura: %', r; end if;
  reset role;
  select count(*) into antes from public.uso_leitura where usuario = '00000000-0000-0000-0000-00000000000a';
  set role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  perform public.devolver_leitura((r->>'vaga')::uuid);
  reset role;
  if (select count(*) from public.uso_leitura where usuario = '00000000-0000-0000-0000-00000000000a') <> antes then
    raise exception 'outra conta devolveu a vaga';
  end if;
  set role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  perform public.devolver_leitura((r->>'vaga')::uuid);
  reset role;
  if (select count(*) from public.uso_leitura where usuario = '00000000-0000-0000-0000-00000000000a') <> antes - 1 then
    raise exception 'a vaga não foi devolvida';
  end if;
end $$;

reset role;
select 'RLS acerto ok' as resultado;
