-- =====================================================================
-- Acerto dos motoboys · Supabase · confirmação do acerto sem corrida e vaga da leitura devolvida.
-- Rodar depois do 010_revisao_acesso.sql e antes de publicar o app e a função que usam estas
-- funções. Só acrescenta (nenhum drop).
-- =====================================================================

-- ---------------------------------------------------------------------
-- R15: confirmar o acerto de uma vez. O painel manda o que viu (quantas comandas e a última
-- alteração delas, caixa e diária); se o motoboy mudou algo nesse meio tempo, devolve 'mudou' e o
-- Luan confere de novo. O caixa fica travado até o fim: a escrita do motoboy espera e, depois, é
-- recusada (gatilho abaixo).
-- ---------------------------------------------------------------------
create or replace function public.confirmar_acerto(
  p_caixa uuid,
  p_comandas integer,
  p_ultima_alteracao timestamptz,
  p_caixa_inicial integer,
  p_diaria integer,
  p_dinheiro_contado integer,
  p_falta integer,
  p_sobra integer,
  p_pago_ao_motoboy integer,
  p_pago_do_caixa_dele integer,
  p_retirado_caixa_empresa integer,
  p_vai_para_empresa integer,
  p_completado_do_bolso integer
) returns text
language plpgsql set search_path = '' as $$
declare
  cx record;
  qtd integer;
  ultima timestamptz;
begin
  if not (select public.e_equipe()) then raise exception 'só a equipe confirma o acerto' using errcode = '42501'; end if;
  select x.caixa_inicial, x.diaria into cx from public.caixas x where x.id = p_caixa for update;
  if not found then return 'sem caixa'; end if;
  if exists (select 1 from public.acertos a where a.caixa_id = p_caixa) then return 'já confirmado'; end if;
  -- O app guarda a hora em milissegundos; o banco, em microssegundos.
  select count(*), date_trunc('milliseconds', max(m.atualizado_em)) into qtd, ultima
    from public.comandas m where m.caixa_id = p_caixa;
  if qtd <> p_comandas or ultima is distinct from p_ultima_alteracao
     or cx.caixa_inicial <> p_caixa_inicial or cx.diaria <> p_diaria then
    return 'mudou';
  end if;
  insert into public.acertos (caixa_id, dinheiro_contado, falta, sobra, pago_ao_motoboy, pago_do_caixa_dele,
                              retirado_caixa_empresa, vai_para_empresa, completado_do_bolso)
  values (p_caixa, p_dinheiro_contado, p_falta, p_sobra, p_pago_ao_motoboy, p_pago_do_caixa_dele,
          p_retirado_caixa_empresa, p_vai_para_empresa, p_completado_do_bolso);
  update public.caixas x set fechado_em = now() where x.id = p_caixa and x.fechado_em is null;
  return 'ok';
end $$;
revoke execute on function public.confirmar_acerto(uuid, integer, timestamptz, integer, integer, integer, integer,
  integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.confirmar_acerto(uuid, integer, timestamptz, integer, integer, integer, integer,
  integer, integer, integer, integer, integer, integer) to authenticated;

-- A escrita do motoboy espera a confirmação em andamento e, se ela terminou, é recusada. A regra de
-- acesso olha o acerto no começo do comando; aqui a consulta é nova, depois da espera.
create or replace function public.motoboy_sem_acerto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  linha jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  caixa uuid;
begin
  if (select auth.uid()) is null or (select public.e_equipe()) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  caixa := (case when tg_table_name = 'caixas' then linha->>'id' else linha->>'caixa_id' end)::uuid;
  if tg_table_name <> 'caixas' then
    perform 1 from public.caixas x where x.id = caixa for share;
  end if;
  if exists (select 1 from public.acertos a where a.caixa_id = caixa) then
    raise exception 'acerto já confirmado' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.motoboy_sem_acerto() from public, anon, authenticated;

create or replace trigger comandas_sem_acerto before insert or update or delete on public.comandas
  for each row execute function public.motoboy_sem_acerto();
create or replace trigger caixas_sem_acerto before update on public.caixas
  for each row execute function public.motoboy_sem_acerto();

-- ---------------------------------------------------------------------
-- Vaga da leitura: a função ler-comanda reserva uma das 60 por hora antes de chamar a IA e devolve
-- quando o provedor caiu ou está mal configurado (nada foi cobrado). Só quem reservou sabe o id da
-- vaga; o app não recebe, então o motoboy não devolve uma leitura que a IA fez.
-- ---------------------------------------------------------------------
alter table public.uso_leitura add column if not exists id uuid not null default gen_random_uuid();

create or replace function public.reservar_leitura() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  usadas integer;
  vaga uuid;
begin
  if public.meu_papel() is null then return jsonb_build_object('estado', 'inativo'); end if;
  perform pg_advisory_xact_lock(hashtext((select auth.uid())::text));
  delete from public.uso_leitura where usuario = (select auth.uid()) and em <= now() - interval '1 hour';
  select count(*) into usadas from public.uso_leitura where usuario = (select auth.uid());
  if usadas >= 60 then return jsonb_build_object('estado', 'limite'); end if;
  insert into public.uso_leitura (usuario) values ((select auth.uid())) returning id into vaga;
  return jsonb_build_object('estado', 'ok', 'vaga', vaga);
end $$;
revoke execute on function public.reservar_leitura() from public, anon;
grant execute on function public.reservar_leitura() to authenticated;

create or replace function public.devolver_leitura(p_vaga uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.uso_leitura
   where id = p_vaga and usuario = (select auth.uid()) and em > now() - interval '10 minutes'
$$;
revoke execute on function public.devolver_leitura(uuid) from public, anon;
grant execute on function public.devolver_leitura(uuid) to authenticated;
