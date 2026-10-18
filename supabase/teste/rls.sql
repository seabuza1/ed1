-- Teste das regras de acesso (rodar num banco com stub-supabase.sql, 001 e 002).
-- Cada bloco levanta erro se a regra falhar. Saída sem erro = tudo certo.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'joao@teste', '{"nome": "João"}'),
  ('00000000-0000-0000-0000-00000000000b', 'maria@teste', '{"nome": "Maria"}'),
  ('00000000-0000-0000-0000-00000000000c', 'luan@teste', '{"nome": "Luan"}'),
  ('00000000-0000-0000-0000-00000000000d', 'felipe@teste', '{}');
update perfis set papel = 'expedicao' where id = '00000000-0000-0000-0000-00000000000c';
update perfis set papel = 'admin' where id = '00000000-0000-0000-0000-00000000000d';

do $$ begin
  if (select nome from perfis where id = '00000000-0000-0000-0000-00000000000a') <> 'João' then raise exception 'nome do cadastro'; end if;
  if (select nome from perfis where id = '00000000-0000-0000-0000-00000000000d') <> 'felipe' then raise exception 'nome pelo e-mail'; end if;
  if (select papel from perfis where id = '00000000-0000-0000-0000-00000000000a') <> 'motoboy' then raise exception 'conta nova vira motoboy'; end if;
end $$;

set role authenticated;

-- João abre o caixa e lança duas comandas.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into caixas (id, motoboy_id, data) values ('10000000-0000-0000-0000-000000000001', auth.uid(), '2026-10-16');
insert into comandas (id, caixa_id, codigo, total, area_id, taxa, pagamentos, finalizada_em)
select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '3557', 11300, id, taxa,
       '[{"forma": "dinheiro", "valor": 11300}]', now()
from areas where nome = 'Barra do Garças';
insert into comandas (id, caixa_id, codigo, total, area_id, taxa, pagamentos)
select '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '0017', 6000, id, taxa,
       '[{"forma": "pix_antecipado", "valor": 6000}]'
from areas where nome = 'Aragarças';

do $$ begin
  begin
    insert into comandas (caixa_id, codigo, total, area_id, taxa, pagamentos)
    select '10000000-0000-0000-0000-000000000001', '1234', 5000, id, taxa, '[{"forma": "dinheiro", "valor": 4500}]'
    from areas where nome = 'Pontal do Araguaia';
    raise exception 'aceitou pagamentos que não somam o total';
  exception when check_violation then null;
  end;
end $$;

-- Maria abre o dela e não vê nada do João.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into caixas (id, motoboy_id, data) values ('10000000-0000-0000-0000-000000000002', auth.uid(), '2026-10-16');
do $$
declare n int;
begin
  if (select count(*) from caixas) <> 1 then raise exception 'Maria vê caixa de outro'; end if;
  if (select count(*) from comandas) <> 0 then raise exception 'Maria vê comanda de outro'; end if;
  if exists (select 1 from perfis where id = '00000000-0000-0000-0000-00000000000a') then raise exception 'Maria vê o perfil do João'; end if;
  if (select nome from perfis where id = '00000000-0000-0000-0000-00000000000c') <> 'Luan' then raise exception 'Maria não vê o nome do Luan'; end if;
  update comandas set status = 'voltou' where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Maria mexeu na comanda do João'; end if;
  begin
    insert into caixas (motoboy_id, data) values ('00000000-0000-0000-0000-00000000000a', '2026-10-17');
    raise exception 'Maria criou caixa em nome do João';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into comandas (caixa_id, codigo, total, area_id, taxa, pagamentos)
    select '10000000-0000-0000-0000-000000000001', '9999', 5000, id, taxa, '[{"forma": "dinheiro", "valor": 5000}]'
    from areas limit 1;
    raise exception 'Maria lançou no caixa do João';
  exception when insufficient_privilege then null;
  end;
  -- área sugerida pelo histórico da pizzaria
  if area_do_codigo('3557') <> (select id from areas where nome = 'Barra do Garças') then raise exception 'area_do_codigo'; end if;
end $$;

-- Luan vê tudo, marca o Pix e o papel e confirma o acerto do João.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if (select count(*) from caixas) <> 2 then raise exception 'Luan não vê todos os caixas'; end if;
  if (select string_agg(ordem_chegada::text, ',' order by ordem_chegada) from caixas) <> '1,2' then raise exception 'ordem de chegada'; end if;
end $$;
update comandas set pix_confirmado = true where id = '20000000-0000-0000-0000-000000000002';
update comandas set papel_conferido = true where caixa_id = '10000000-0000-0000-0000-000000000001';
update caixas set dinheiro_contado = 19300, fechado_em = now() where id = '10000000-0000-0000-0000-000000000001';
insert into acertos (caixa_id, dinheiro_contado, pago_ao_motoboy, pago_do_caixa_dele, retirado_caixa_empresa, vai_para_empresa)
values ('10000000-0000-0000-0000-000000000001', 19300, 4700, 4700, 0, 14600);
do $$
declare n int;
begin
  delete from acertos where caixa_id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Luan reabriu (só o admin pode)'; end if;
end $$;

-- João vê o acerto e o Pix confirmado, mas não edita mais nada.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  if (select confirmado_por from acertos) <> '00000000-0000-0000-0000-00000000000c' then raise exception 'João não vê o acerto'; end if;
  if not (select pix_confirmado from comandas where codigo = '0017') then raise exception 'João não vê o Pix confirmado'; end if;
  update caixas set dinheiro_contado = 1 where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'João editou o caixa confirmado'; end if;
  update comandas set status = 'voltou' where caixa_id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'João editou comanda do caixa confirmado'; end if;
  delete from comandas where caixa_id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'João apagou comanda do caixa confirmado'; end if;
  begin
    insert into comandas (caixa_id, codigo, total, area_id, taxa, pagamentos)
    select '10000000-0000-0000-0000-000000000001', '1111', 5000, id, taxa, '[{"forma": "dinheiro", "valor": 5000}]'
    from areas limit 1;
    raise exception 'João lançou no caixa confirmado';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Admin reabre (apaga o acerto) e o João volta a editar.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
delete from acertos where caixa_id = '10000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  update comandas set status = 'entregue' where id = '20000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'João não editou depois de reaberto'; end if;
end $$;

reset role;
select 'RLS ok' as resultado;
