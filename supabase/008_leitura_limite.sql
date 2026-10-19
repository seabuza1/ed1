-- =====================================================================
-- Acerto dos motoboys · Supabase · limite de leituras por conta (custo da IA).
-- Rodar depois do 007_leitura_provedor.sql. A Edge Function ler-comanda chama
-- pode_ler_comanda() antes de cada foto: perfil ativo e até 60 leituras por hora por conta.
-- Conta nova nasce ativa: o limite segura o gasto de quem não é da pizzaria até o admin desativar.
-- =====================================================================

create table public.uso_leitura (
  usuario uuid not null references auth.users (id) on delete cascade,
  em      timestamptz not null default now()
);
create index uso_leitura_idx on public.uso_leitura (usuario, em);
-- Sem políticas: ninguém lê nem grava direto, só pela função abaixo.
alter table public.uso_leitura enable row level security;
revoke all on public.uso_leitura from anon, authenticated;

create function public.pode_ler_comanda() returns text
language plpgsql security definer set search_path = '' as $$
declare
  usadas integer;
begin
  if public.meu_papel() is null then return 'inativo'; end if;
  select count(*) into usadas from public.uso_leitura
   where usuario = (select auth.uid()) and em > now() - interval '1 hour';
  if usadas >= 60 then return 'limite'; end if;
  insert into public.uso_leitura (usuario) values ((select auth.uid()));
  return 'ok';
end $$;
revoke execute on function public.pode_ler_comanda() from public, anon;
grant execute on function public.pode_ler_comanda() to authenticated;
