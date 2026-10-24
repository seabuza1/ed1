-- =====================================================================
-- Acerto dos motoboys · Supabase · ajustes de acesso da revisão.
-- Rodar depois do 009_leitura_limite_trava.sql. Só altera regras e funções (nenhum drop).
-- =====================================================================

-- Conta desativada pelo admin não grava mais nada: nem caixa, nem comanda, leitura ou foto
-- (todas passam por dono_do_caixa), nem consulta a área de outros pedidos.
create or replace function public.dono_do_caixa(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from caixas x join perfis p on p.id = x.motoboy_id
     where x.id = c and x.motoboy_id = auth.uid() and p.ativo)
$$;

alter policy caixas_criar on public.caixas
  with check ((motoboy_id = (select auth.uid()) and (select public.meu_papel()) is not null) or (select public.e_equipe()));
alter policy caixas_motoboy on public.caixas
  using (motoboy_id = (select auth.uid()) and (select public.meu_papel()) is not null and not public.caixa_confirmado(id))
  with check (motoboy_id = (select auth.uid()) and (select public.meu_papel()) is not null);

create or replace function public.area_do_codigo(c text) returns uuid
language sql stable security definer set search_path = public as $$
  select area_id from comandas where codigo = c and meu_papel() is not null order by criado_em desc limit 1
$$;

-- Acerto confirmado não se edita: o app só cria (confirmar) e apaga (reabrir, só o admin).
-- Antes, a expedição podia mudar valores, quem confirmou e até o caixa do acerto.
alter policy acertos_editar on public.acertos
  using ((select public.e_admin())) with check ((select public.e_admin()));

-- R18: áreas e taxas são do admin (a expedição só lê).
alter policy areas_equipe on public.areas
  using ((select public.e_admin())) with check ((select public.e_admin()));
alter policy areas_equipe on public.areas rename to areas_admin;

-- O "caiu" do Pix vale para o valor que o Luan conferiu: se o motoboy muda o valor em Pix
-- antecipado, a marca sai. Mudar o resto (status, outra forma, comprovante) mantém a marca.
create or replace function public.pix_so_da_equipe() returns trigger
language plpgsql set search_path = '' as $$
declare
  pix_antes integer;
  pix_agora integer;
begin
  if (select auth.uid()) is null or (select public.e_equipe()) then return new; end if;
  if tg_op = 'INSERT' then
    new.pix_confirmado := false;
    return new;
  end if;
  select coalesce(sum((p->>'valor')::integer), 0) into pix_antes
    from jsonb_array_elements(old.pagamentos) p where p->>'forma' = 'pix_antecipado';
  select coalesce(sum((p->>'valor')::integer), 0) into pix_agora
    from jsonb_array_elements(new.pagamentos) p where p->>'forma' = 'pix_antecipado';
  new.pix_confirmado := old.pix_confirmado and pix_antes = pix_agora;
  return new;
end $$;

create or replace trigger comandas_pix before insert or update of pix_confirmado, pagamentos on public.comandas
  for each row execute function public.pix_so_da_equipe();

-- Foto só da comanda que já está na nuvem com esse caminho: uma conta não enche o bucket
-- (1 GB no plano grátis) com fotos soltas. O app já sobe a foto depois da comanda.
create policy fotos_da_comanda on storage.objects as restrictive for insert to authenticated
  with check (
    bucket_id <> 'comandas'
    or (select public.e_equipe())
    or exists (select 1 from public.comandas c where c.foto_path = name));

-- O uso da leitura guarda só a última hora de cada conta.
create or replace function public.pode_ler_comanda() returns text
language plpgsql security definer set search_path = '' as $$
declare
  usadas integer;
begin
  if public.meu_papel() is null then return 'inativo'; end if;
  -- Uma chamada por vez para cada conta, até o fim da transação.
  perform pg_advisory_xact_lock(hashtext((select auth.uid())::text));
  delete from public.uso_leitura where usuario = (select auth.uid()) and em <= now() - interval '1 hour';
  select count(*) into usadas from public.uso_leitura where usuario = (select auth.uid());
  if usadas >= 60 then return 'limite'; end if;
  insert into public.uso_leitura (usuario) values ((select auth.uid()));
  return 'ok';
end $$;
