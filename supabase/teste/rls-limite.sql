-- Teste do 008: limite de leituras por conta. Rodar depois do rls.sql.
\set ON_ERROR_STOP 1
set role authenticated;

-- Maria lê até 60 fotos na hora; a 61ª é recusada. Ela não vê nem apaga a contagem.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare r text;
begin
  for i in 1..60 loop
    r := public.pode_ler_comanda();
    if r <> 'ok' then raise exception 'leitura % recusada: %', i, r; end if;
  end loop;
  if public.pode_ler_comanda() <> 'limite' then raise exception 'passou do limite'; end if;
  begin
    perform count(*) from public.uso_leitura;
    raise exception 'motoboy leu a tabela de uso';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Conta desativada não lê; o João segue com o limite dele.
reset role;
update perfis set ativo = false where id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$ begin
  if public.pode_ler_comanda() <> 'inativo' then raise exception 'conta desativada leu'; end if;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if public.pode_ler_comanda() <> 'ok' then raise exception 'limite de uma conta pegou outra'; end if;
end $$;

reset role;
update perfis set ativo = true where id = '00000000-0000-0000-0000-00000000000b';
select 'RLS limite ok' as resultado;
