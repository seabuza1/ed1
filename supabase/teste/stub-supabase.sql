-- Só para testar o SQL num Postgres comum (fora do Supabase): o mínimo que o Supabase já tem.
create schema auth;
create table auth.users (
  id                 uuid primary key,
  email              text,
  raw_user_meta_data jsonb not null default '{}'
);
-- Como no Supabase: o "sub" do JWT (PostgREST põe em request.jwt.claims).
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create publication supabase_realtime;
-- Storage (para as regras das fotos do 004): só as colunas que as políticas usam.
create schema storage;
create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid default auth.uid()
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select on storage.buckets to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
