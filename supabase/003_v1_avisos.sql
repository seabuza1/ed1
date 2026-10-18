-- =====================================================================
-- Acerto dos motoboys · Supabase · v1, avisos do Supabase (Database Advisors)
-- Rodar uma vez no SQL Editor, depois do 002_v1_app.sql. Não muda nenhuma regra
-- de acesso: só fecha o que não precisa ficar aberto e deixa as políticas mais leves.
-- =====================================================================

-- search_path fixo nas funções que não tinham (usam só nomes do pg_catalog).
alter function public.tocar_atualizado() set search_path = '';
alter function public.pagamentos_ok(jsonb, integer) set search_path = '';

-- Funções das regras de acesso: só para quem está logado. O anon herdava o EXECUTE
-- pelo PUBLIC; as políticas são todas "to authenticated".
revoke execute on function public.meu_papel() from public, anon;
revoke execute on function public.e_equipe() from public, anon;
revoke execute on function public.e_admin() from public, anon;
revoke execute on function public.dono_do_caixa(uuid) from public, anon;
revoke execute on function public.caixa_confirmado(uuid) from public, anon;
grant execute on function public.meu_papel() to authenticated;
grant execute on function public.e_equipe() to authenticated;
grant execute on function public.e_admin() to authenticated;
grant execute on function public.dono_do_caixa(uuid) to authenticated;
grant execute on function public.caixa_confirmado(uuid) to authenticated;

-- Funções de gatilho: o Postgres não confere o EXECUTE quando o gatilho dispara,
-- então ninguém precisa poder chamá-las direto.
revoke execute on function public.definir_ordem_chegada() from public, anon, authenticated;
revoke execute on function public.novo_usuario() from public, anon, authenticated;

-- Mesmas políticas, com auth.uid() e e_equipe() calculados uma vez por consulta
-- (e não a cada linha).
alter policy perfis_ler on public.perfis
  using (id = (select auth.uid()) or (select public.e_equipe()));
alter policy caixas_ler on public.caixas
  using (motoboy_id = (select auth.uid()) or (select public.e_equipe()));
alter policy caixas_criar on public.caixas
  with check (motoboy_id = (select auth.uid()) or (select public.e_equipe()));
alter policy caixas_motoboy on public.caixas
  using (motoboy_id = (select auth.uid()) and not public.caixa_confirmado(id))
  with check (motoboy_id = (select auth.uid()));
alter policy acertos_criar on public.acertos
  with check ((select public.e_equipe()) and confirmado_por = (select auth.uid()));
