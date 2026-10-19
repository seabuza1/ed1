-- =====================================================================
-- Acerto dos motoboys · Supabase · ajustes da leitura. Rodar depois do 004_leitura.sql.
-- Só acrescenta regras (nenhum drop): roda sem confirmar comando destrutivo.
-- =====================================================================

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

-- Caminho válido também para a equipe. Regra restritiva: vale junto com fotos_enviar, que
-- continua igual, e só olha o bucket comandas.
create policy fotos_caminho on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'comandas' or public.caixa_da_foto(name) is not null);

-- O caminho da foto continua {caixa}/{id}.jpg da própria comanda (regra do 004): a comanda
-- que sai de novo ganha id novo e vai sem foto.
