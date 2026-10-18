-- =====================================================================
-- Acerto dos motoboys · Supabase · leitura da comanda por foto (docs/SPEC-leitura.md)
-- Rodar uma vez no SQL Editor, depois do 003_v1_avisos.sql. Fase de transição: vale
-- enquanto o pedido é escrito à mão. Dinheiro sempre em centavos (inteiro).
-- Rode antes de publicar o app que lê comanda: ele já manda as colunas novas.
-- =====================================================================

-- Promoção da noite (R23): desconto por pizza tradicional, definido a cada noite.
alter table public.caixas add column promo_desconto integer check (promo_desconto >= 0);

-- Foto e de onde veio a área da comanda. A foto fica sempre em {caixa_id}/{id}.jpg.
alter table public.comandas add column foto_path text
  check (foto_path is null or foto_path = caixa_id::text || '/' || id::text || '.jpg');
alter table public.comandas add column area_origem text
  check (area_origem in ('escrito', 'valor', 'padrao', 'manual'));

-- Cada leitura feita, para medir acerto e erro (R27). Uma por comanda: o id é o da comanda.
create table public.leituras (
  id            uuid primary key,  -- o app gera no aparelho
  caixa_id      uuid not null references public.caixas (id) on delete cascade,
  comanda_id    uuid references public.comandas (id) on delete set null,
  foto_path     text not null,
  leitura       jsonb,             -- leitura completa da IA
  conferencia   jsonb,             -- segunda leitura (campos críticos)
  resultado     jsonb,             -- antes das correções: estado, motivos, área sugerida e origem
  lancado       jsonb,             -- o que foi lançado de fato, o estado final e o tempo
  corrigido     boolean not null default false,
  forcado       boolean not null default false,   -- "Lançar assim" no vermelho
  escritor      text,              -- quem escreveu a comanda, se souber
  modelo        text,
  ms            integer,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index leituras_caixa_idx on public.leituras (caixa_id);
create index leituras_comanda_idx on public.leituras (comanda_id);
create trigger leituras_tocar before update on public.leituras
  for each row execute function public.tocar_atualizado();

alter table public.leituras enable row level security;

-- Mesmas regras de comandas (o app reenvia com upsert, então precisa de update também).
create policy leituras_ler on public.leituras for select to authenticated
  using (public.dono_do_caixa(caixa_id) or (select public.e_equipe()));
create policy leituras_criar on public.leituras for insert to authenticated
  with check ((public.dono_do_caixa(caixa_id) and not public.caixa_confirmado(caixa_id)) or (select public.e_equipe()));
create policy leituras_editar on public.leituras for update to authenticated
  using ((public.dono_do_caixa(caixa_id) and not public.caixa_confirmado(caixa_id)) or (select public.e_equipe()))
  with check ((public.dono_do_caixa(caixa_id) and not public.caixa_confirmado(caixa_id)) or (select public.e_equipe()));
create policy leituras_apagar on public.leituras for delete to authenticated
  using ((select public.e_admin()));

revoke all on public.leituras from anon;
grant select, insert, update, delete on public.leituras to authenticated;

-- ---------------------------------------------------------------------
-- Storage: fotos das comandas, bucket privado. Caminho: {caixa_id}/{id}.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comandas', 'comandas', false, 2097152, array['image/jpeg']);

-- O caixa pelo caminho, sem quebrar quando a pasta não é um uuid.
create function public.caixa_da_foto(nome text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(nome, '/', 1)::uuid;
exception when others then
  return null;
end $$;
revoke execute on function public.caixa_da_foto(text) from public, anon;
grant execute on function public.caixa_da_foto(text) to authenticated;

-- Lê o dono do caixa ou a equipe. Envia o dono enquanto o acerto não foi confirmado, ou a
-- equipe. Apaga só o admin.
create policy fotos_ler on storage.objects for select to authenticated
  using (bucket_id = 'comandas' and (public.dono_do_caixa(public.caixa_da_foto(name)) or (select public.e_equipe())));
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comandas' and (
    (public.dono_do_caixa(public.caixa_da_foto(name)) and not public.caixa_confirmado(public.caixa_da_foto(name)))
    or (select public.e_equipe())));
create policy fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'comandas' and (select public.e_admin()));
