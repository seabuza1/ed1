-- Teste do 010: conta desativada, acerto que não se edita, áreas do admin, Pix que muda de valor,
-- foto sem comanda e as regras de privilégio. Rodar depois do rls-limite.sql (João com o caixa ...01
-- confirmado, Maria com o ...02 e a 4321 em Pix antecipado já marcada pelo Luan).
\set ON_ERROR_STOP 1
set role authenticated;

-- Maria: muda só o status, a marca do Pix fica; muda o valor em Pix antecipado, a marca sai.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update comandas set status = 'em_rota' where id = '20000000-0000-0000-0000-0000000000f1';
do $$ begin
  if not (select pix_confirmado from comandas where id = '20000000-0000-0000-0000-0000000000f1') then raise exception 'a marca saiu sem o Pix mudar'; end if;
end $$;
update comandas set pagamentos = '[{"forma": "pix_antecipado", "valor": 2000}, {"forma": "dinheiro", "valor": 4000}]'
 where id = '20000000-0000-0000-0000-0000000000f1';
do $$ begin
  if (select pix_confirmado from comandas where id = '20000000-0000-0000-0000-0000000000f1') then raise exception 'a marca ficou com outro valor'; end if;
end $$;

-- Maria não se promove, não mexe em áreas e não apaga leitura.
do $$
declare n int;
begin
  update perfis set papel = 'admin' where id = (select auth.uid());
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'motoboy se promoveu'; end if;
  update areas set taxa = 9999;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'motoboy mudou a taxa'; end if;
  -- Foto solta no próprio caixa, sem comanda com esse caminho: recusada.
  begin
    insert into storage.objects (bucket_id, name)
    values ('comandas', '10000000-0000-0000-0000-000000000002/' || gen_random_uuid() || '.jpg');
    raise exception 'aceitou foto sem comanda';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Com a comanda na nuvem, a foto dela entra.
update comandas set foto_path = '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-0000000000f1.jpg'
 where id = '20000000-0000-0000-0000-0000000000f1';
insert into storage.objects (bucket_id, name)
values ('comandas', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-0000000000f1.jpg');
insert into leituras (id, caixa_id, comanda_id, foto_path, leitura)
values ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-0000000000f1.jpg', '{}');
do $$
declare n int;
begin
  delete from leituras;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'motoboy apagou leitura'; end if;
end $$;

-- Luan (expedição): não edita o acerto confirmado nem as áreas.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$
declare n int;
begin
  update acertos set pago_ao_motoboy = 99999, pago_do_caixa_dele = 99999;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'expedição editou o acerto'; end if;
  update acertos set caixa_id = '10000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'expedição mudou o caixa do acerto'; end if;
  update areas set taxa = 1500 where nome = 'Barra do Garças';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'expedição mudou a taxa'; end if;
  begin
    insert into areas (nome, taxa) values ('Nova', 1000);
    raise exception 'expedição criou área';
  exception when insufficient_privilege then null;
  end;
end $$;

-- O admin muda a taxa.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
update areas set taxa = taxa where nome = 'Barra do Garças';
do $$
declare n int;
begin
  update areas set taxa = taxa where nome = 'Barra do Garças';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'admin não mudou a taxa'; end if;
end $$;

-- Maria desativada: não abre caixa, não lança, não edita, não envia foto e não consulta a área.
reset role;
update perfis set ativo = false where id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare n int;
begin
  begin
    insert into caixas (motoboy_id, data) values ((select auth.uid()), '2026-10-20');
    raise exception 'conta desativada abriu caixa';
  exception when insufficient_privilege then null;
  end;
  update caixas set obs = 'x' where id = '10000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'conta desativada editou o caixa'; end if;
  begin
    insert into comandas (caixa_id, codigo, total, area_id, taxa, pagamentos)
    select '10000000-0000-0000-0000-000000000002', '9999', 900000, id, 800000, '[{"forma": "dinheiro", "valor": 900000}]'
    from areas limit 1;
    raise exception 'conta desativada lançou comanda';
  exception when insufficient_privilege then null;
  end;
  update comandas set status = 'voltou' where caixa_id = '10000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'conta desativada editou comanda'; end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('comandas', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-0000000000f1.jpg');
    raise exception 'conta desativada enviou foto';
  exception when insufficient_privilege then null;
  end;
  if area_do_codigo('3557') is not null then raise exception 'conta desativada consultou a área'; end if;
end $$;

reset role;
update perfis set ativo = true where id = '00000000-0000-0000-0000-00000000000b';
select 'RLS revisão ok' as resultado;
