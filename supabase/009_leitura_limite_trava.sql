-- =====================================================================
-- Acerto dos motoboys · Supabase · trava no limite de leituras (ajuste do 008).
-- Rodar depois do 008_leitura_limite.sql. Sem a trava, chamadas ao mesmo tempo da mesma conta
-- viam a mesma contagem e passavam juntas do limite de 60 por hora.
-- =====================================================================

create or replace function public.pode_ler_comanda() returns text
language plpgsql security definer set search_path = '' as $$
declare
  usadas integer;
begin
  if public.meu_papel() is null then return 'inativo'; end if;
  -- Uma chamada por vez para cada conta, até o fim da transação.
  perform pg_advisory_xact_lock(hashtext((select auth.uid())::text));
  select count(*) into usadas from public.uso_leitura
   where usuario = (select auth.uid()) and em > now() - interval '1 hour';
  if usadas >= 60 then return 'limite'; end if;
  insert into public.uso_leitura (usuario) values ((select auth.uid()));
  return 'ok';
end $$;
