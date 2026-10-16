-- =====================================================================
-- Acerto dos motoboys · Supabase · v1
-- Rodar uma vez no SQL Editor de um projeto novo.
-- Dinheiro sempre em centavos (inteiro).
-- Papéis: motoboy (vê e edita só os próprios caixas), expedicao (Luan:
-- vê tudo, confirma acertos, marca Pix e papel), admin (tudo).
-- =====================================================================

create type papel as enum ('motoboy', 'expedicao', 'admin');
create type status_comanda as enum ('em_rota', 'entregue', 'voltou');

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table perfis (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text not null,
  papel     papel not null default 'motoboy',
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

create table areas (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique,
  taxa  integer not null check (taxa >= 0),
  ativa boolean not null default true
);

insert into areas (nome, taxa) values
  ('Aragarças', 500),
  ('Pontal do Araguaia', 1000),
  ('Barra do Garças', 1200),
  ('Parque de Exposições', 1500);

-- Um caixa = um motoboy numa noite.
create table caixas (
  id               uuid primary key default gen_random_uuid(),  -- o app gera no aparelho
  motoboy_id       uuid not null references perfis (id),
  data             date not null,
  caixa_inicial    integer not null default 8000 check (caixa_inicial >= 0),
  diaria           integer not null default 3000 check (diaria >= 0),
  ordem_chegada    smallint,
  dinheiro_contado integer check (dinheiro_contado >= 0),
  fechado_em       timestamptz,          -- motoboy terminou de lançar
  obs              text not null default '',
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (motoboy_id, data)
);

-- pagamentos: [{"forma": "dinheiro"|"cartao"|"pix_maquina"|"pix_antecipado", "valor": 1234}]
create function pagamentos_ok(p jsonb, total integer) returns boolean
language plpgsql immutable as $$
declare x jsonb; soma integer := 0;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) = 0 then return false; end if;
  for x in select * from jsonb_array_elements(p) loop
    if coalesce(x->>'forma', '') not in ('dinheiro', 'cartao', 'pix_maquina', 'pix_antecipado') then return false; end if;
    if coalesce(jsonb_typeof(x->'valor'), '') <> 'number' then return false; end if;
    if (x->>'valor')::numeric <= 0 or (x->>'valor')::numeric <> trunc((x->>'valor')::numeric) then return false; end if;
    soma := soma + (x->>'valor')::integer;
  end loop;
  return soma = total;
end $$;

create table comandas (
  id              uuid primary key default gen_random_uuid(),  -- o app gera no aparelho
  caixa_id        uuid not null references caixas (id) on delete cascade,
  codigo          char(4) not null check (codigo ~ '^[0-9]{4}$'),
  total           integer not null check (total > 0),
  area_id         uuid not null references areas (id),
  taxa            integer not null check (taxa >= 0),   -- gravada no lançamento
  status          status_comanda not null default 'em_rota',
  pagamentos      jsonb not null,
  troco           integer not null default 0 check (troco >= 0),
  papel_conferido boolean not null default false,
  pix_confirmado  boolean not null default false,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  check (total >= taxa),
  check (pagamentos_ok(pagamentos, total)),
  check (troco = 0 or pagamentos @> '[{"forma": "dinheiro"}]')
);
create index comandas_caixa_idx on comandas (caixa_id);

-- Acerto confirmado pelo Luan: fotografia dos valores no momento da confirmação.
create table acertos (
  caixa_id               uuid primary key references caixas (id) on delete cascade,
  confirmado_por         uuid not null default auth.uid() references perfis (id),
  confirmado_em          timestamptz not null default now(),
  dinheiro_contado       integer not null check (dinheiro_contado >= 0),
  falta                  integer not null default 0 check (falta >= 0),
  sobra                  integer not null default 0 check (sobra >= 0),
  pago_ao_motoboy        integer not null check (pago_ao_motoboy >= 0),
  pago_do_caixa_dele     integer not null check (pago_do_caixa_dele >= 0),
  retirado_caixa_empresa integer not null default 0 check (retirado_caixa_empresa >= 0),
  vai_para_empresa       integer not null check (vai_para_empresa >= 0),
  completado_do_bolso    integer not null default 0 check (completado_do_bolso >= 0),
  obs                    text not null default '',
  check (pago_ao_motoboy = pago_do_caixa_dele + retirado_caixa_empresa)
);

-- ---------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------
create function tocar_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

create trigger caixas_tocar   before update on caixas   for each row execute function tocar_atualizado();
create trigger comandas_tocar before update on comandas for each row execute function tocar_atualizado();

-- Cada conta nova vira um perfil de motoboy. O nome vem do cadastro (options.data.nome).
create function novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function novo_usuario();

-- ---------------------------------------------------------------------
-- Funções das regras de acesso (security definer evita recursão no RLS)
-- ---------------------------------------------------------------------
create function meu_papel() returns papel
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid() and ativo
$$;

create function e_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_papel() in ('expedicao', 'admin'), false)
$$;

create function e_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_papel() = 'admin', false)
$$;

create function dono_do_caixa(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from caixas where id = c and motoboy_id = auth.uid())
$$;

create function caixa_confirmado(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from acertos where caixa_id = c)
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table perfis   enable row level security;
alter table areas    enable row level security;
alter table caixas   enable row level security;
alter table comandas enable row level security;
alter table acertos  enable row level security;

create policy perfis_ler   on perfis for select to authenticated using (id = auth.uid() or e_equipe());
create policy perfis_admin on perfis for update to authenticated using (e_admin()) with check (e_admin());

create policy areas_ler     on areas for select to authenticated using (true);
create policy areas_equipe  on areas for all    to authenticated using (e_equipe()) with check (e_equipe());

create policy caixas_ler      on caixas for select to authenticated using (motoboy_id = auth.uid() or e_equipe());
create policy caixas_criar    on caixas for insert to authenticated with check (motoboy_id = auth.uid() or e_equipe());
create policy caixas_motoboy  on caixas for update to authenticated
  using (motoboy_id = auth.uid() and not caixa_confirmado(id)) with check (motoboy_id = auth.uid());
create policy caixas_equipe   on caixas for update to authenticated using (e_equipe()) with check (e_equipe());
create policy caixas_apagar   on caixas for delete to authenticated using (e_admin());

create policy comandas_ler     on comandas for select to authenticated using (dono_do_caixa(caixa_id) or e_equipe());
create policy comandas_criar   on comandas for insert to authenticated
  with check ((dono_do_caixa(caixa_id) and not caixa_confirmado(caixa_id)) or e_equipe());
create policy comandas_editar  on comandas for update to authenticated
  using ((dono_do_caixa(caixa_id) and not caixa_confirmado(caixa_id)) or e_equipe())
  with check ((dono_do_caixa(caixa_id) and not caixa_confirmado(caixa_id)) or e_equipe());
create policy comandas_apagar  on comandas for delete to authenticated
  using ((dono_do_caixa(caixa_id) and not caixa_confirmado(caixa_id)) or e_equipe());

create policy acertos_ler    on acertos for select to authenticated using (dono_do_caixa(caixa_id) or e_equipe());
create policy acertos_criar  on acertos for insert to authenticated with check (e_equipe() and confirmado_por = auth.uid());
create policy acertos_editar on acertos for update to authenticated using (e_equipe()) with check (e_equipe());
create policy acertos_apagar on acertos for delete to authenticated using (e_admin());   -- reabrir

revoke all on perfis, areas, caixas, comandas, acertos from anon;
grant select, insert, update, delete on perfis, areas, caixas, comandas, acertos to authenticated;

-- Painel do Luan e app do motoboy atualizam sozinhos
alter publication supabase_realtime add table caixas, comandas, acertos;

-- ---------------------------------------------------------------------
-- Depois de criar as contas pelo app, definir os papéis:
-- update perfis set papel = 'admin'     where id = (select id from auth.users where email = 'SEU_EMAIL');
-- update perfis set papel = 'expedicao' where id = (select id from auth.users where email = 'EMAIL_DO_LUAN');
-- ---------------------------------------------------------------------
