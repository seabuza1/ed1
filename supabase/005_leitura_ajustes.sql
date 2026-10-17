-- =====================================================================
-- Acerto dos motoboys · Supabase · ajustes da leitura. Rodar depois do 004_leitura.sql.
-- =====================================================================

-- O caminho da foto não precisa ser {caixa}/{id}.jpg da própria comanda: a que "saiu de
-- novo" ganha id novo e continua com a foto do mesmo papel. A regra recusava essa comanda.
-- (O nome da regra foi gerado pelo Postgres; acha pela definição.)
do $$
declare nome text;
begin
  select conname into nome from pg_constraint
   where conrelid = 'public.comandas'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%foto_path%';
  if nome is not null then execute format('alter table public.comandas drop constraint %I', nome); end if;
end $$;

-- A leitura sempre vem da IA; o tempo não é negativo.
alter table public.leituras alter column leitura set not null;
alter table public.leituras add constraint leituras_ms_check check (ms >= 0);

-- Caixa pelo caminho só quando ele é {uuid}/{uuid}.jpg (como o app gera); senão nulo.
-- Em SQL puro: sem a subtransação por linha do plpgsql com exception.
create or replace function public.caixa_da_foto(nome text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when nome ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    then split_part(nome, '/', 1)::uuid
  end
$$;

-- Caminho válido também para a equipe. (No Supabase, alter policy em storage.objects pede
-- ser dono da tabela; drop e create são permitidos.)
drop policy fotos_enviar on storage.objects;
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comandas' and public.caixa_da_foto(name) is not null and (
    (public.dono_do_caixa(public.caixa_da_foto(name)) and not public.caixa_confirmado(public.caixa_da_foto(name)))
    or (select public.e_equipe())));
