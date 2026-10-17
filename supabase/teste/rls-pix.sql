-- Teste do 006: só a equipe marca o Pix "caiu". Rodar depois do rls.sql.
\set ON_ERROR_STOP 1
set role authenticated;

-- Maria lança um Pix já marcado e tenta marcar depois: continua sem a marca; o resto muda.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into comandas (id, caixa_id, codigo, total, area_id, taxa, pagamentos, pix_confirmado)
select '20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-000000000002', '4321', 6000, id, taxa,
       '[{"forma": "pix_antecipado", "valor": 6000}]', true
from areas where nome = 'Aragarças';
update comandas set pix_confirmado = true, status = 'entregue' where id = '20000000-0000-0000-0000-0000000000f1';
do $$ begin
  if (select pix_confirmado from comandas where id = '20000000-0000-0000-0000-0000000000f1') then raise exception 'motoboy marcou o próprio Pix'; end if;
  if (select status from comandas where id = '20000000-0000-0000-0000-0000000000f1') <> 'entregue' then raise exception 'a trava do Pix barrou o resto'; end if;
end $$;

-- O Luan marca.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
update comandas set pix_confirmado = true where id = '20000000-0000-0000-0000-0000000000f1';

-- Maria não desmarca.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update comandas set pix_confirmado = false where id = '20000000-0000-0000-0000-0000000000f1';
do $$ begin
  if not (select pix_confirmado from comandas where id = '20000000-0000-0000-0000-0000000000f1') then raise exception 'motoboy desmarcou o Pix'; end if;
end $$;

reset role;
select 'RLS Pix ok' as resultado;
