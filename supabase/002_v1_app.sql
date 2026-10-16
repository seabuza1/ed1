-- =====================================================================
-- Acerto dos motoboys · Supabase · v1, complemento do app
-- Rodar uma vez no SQL Editor, depois do 001_schema.sql.
-- =====================================================================

-- Hora em que a comanda foi marcada entregue (ou voltou). O app usa para pôr a lista
-- da maquininha na ordem dos comprovantes.
alter table comandas add column finalizada_em timestamptz;

-- O motoboy vê o nome de quem confirma o acerto ("Confirmado por Luan às 23:48").
-- Só os perfis da expedição e do admin; os dos outros motoboys continuam fechados.
create policy perfis_ler_equipe on perfis for select to authenticated
  using (papel in ('expedicao', 'admin'));

-- Área sugerida no lançamento: a área do último pedido com o mesmo código na pizzaria
-- (o motoboy não lê as comandas dos outros, por isso a função).
create function area_do_codigo(c text) returns uuid
language sql stable security definer set search_path = public as $$
  select area_id from comandas where codigo = c order by criado_em desc limit 1
$$;
revoke all on function area_do_codigo(text) from public, anon;
grant execute on function area_do_codigo(text) to authenticated;

-- Ordem de chegada: o primeiro caixa aberto na data é o 1, o segundo é o 2...
-- (colunas do painel do Luan).
create function definir_ordem_chegada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ordem_chegada is null then
    select coalesce(max(ordem_chegada), 0) + 1 into new.ordem_chegada from caixas where data = new.data;
  end if;
  return new;
end $$;

create trigger caixas_ordem before insert on caixas
  for each row execute function definir_ordem_chegada();
