-- Teste das regras da leitura (004 e 005): leituras e fotos no Storage. Roda depois do rls.sql
-- (João com o caixa ...01 reaberto, Maria com o ...02). Saída sem erro = tudo certo.
\set ON_ERROR_STOP 1
set role authenticated;

-- João: foto e leitura da comanda 3557.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update comandas
   set foto_path = '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.jpg', area_origem = 'escrito'
 where id = '20000000-0000-0000-0000-000000000001';
update caixas set promo_desconto = 1000 where id = '10000000-0000-0000-0000-000000000001';
insert into storage.objects (bucket_id, name)
values ('comandas', '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.jpg');
insert into leituras (id, caixa_id, comanda_id, foto_path, leitura, resultado)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.jpg', '{}', '{"estado": "verde"}');
-- Reenvio pela fila (upsert).
insert into leituras (id, caixa_id, comanda_id, foto_path, leitura, corrigido)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001', 'x', '{}', true)
on conflict (id) do update set corrigido = excluded.corrigido;
do $$ begin
  if not (select corrigido from leituras) then raise exception 'reenvio da leitura'; end if;
  -- A comanda que saiu de novo continua com a foto do mesmo papel (outro id no caminho).
  update comandas set foto_path = '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001.jpg'
   where id = '20000000-0000-0000-0000-000000000002';
  begin
    insert into storage.objects (bucket_id, name)
    values ('comandas', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000009.jpg');
    raise exception 'João enviou foto no caixa da Maria';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('comandas', 'qualquer/x.jpg');
    raise exception 'aceitou pasta que não é caixa';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Maria não vê nem grava nada do João.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from leituras) <> 0 then raise exception 'Maria vê leitura do João'; end if;
  if (select count(*) from storage.objects) <> 0 then raise exception 'Maria vê foto do João'; end if;
  begin
    insert into leituras (id, caixa_id, foto_path, leitura) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'x', '{}');
    raise exception 'Maria gravou leitura no caixa do João';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Luan vê tudo e confirma o acerto: o João não envia mais foto nem leitura e não apaga.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if (select count(*) from leituras) <> 1 then raise exception 'Luan não vê a leitura'; end if;
  if (select count(*) from storage.objects) <> 1 then raise exception 'Luan não vê a foto'; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('comandas', '10000000-0000-0000-0000-000000000001/foto.png');
    raise exception 'equipe enviou foto com caminho fora do padrão';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into acertos (caixa_id, dinheiro_contado, pago_ao_motoboy, pago_do_caixa_dele, retirado_caixa_empresa, vai_para_empresa)
values ('10000000-0000-0000-0000-000000000001', 19300, 4700, 4700, 0, 14600);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare n int;
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('comandas', '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000002.jpg');
    raise exception 'João enviou foto depois do acerto';
  exception when insufficient_privilege then null;
  end;
  update leituras set corrigido = false;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'João mexeu na leitura depois do acerto'; end if;
  delete from storage.objects;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'João apagou foto'; end if;
end $$;

-- Só o admin apaga foto.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
delete from storage.objects;

reset role;
select 'RLS leitura ok' as resultado;
