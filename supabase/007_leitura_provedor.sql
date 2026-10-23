-- =====================================================================
-- Acerto dos motoboys · Supabase · provedor e tokens de cada leitura (R27).
-- Rodar depois do 006_pix_da_equipe.sql e antes de publicar o app que grava provedor e tokens
-- (sem estas colunas, a nuvem recusa as leituras novas). Para medir custo e comparar modelos.
-- =====================================================================

-- Tokens somando as duas chamadas (completa e conferência). Entrada sem o que veio do
-- cache; saída com o raciocínio do modelo.
alter table public.leituras
  add column provedor       text,
  add column tokens_entrada integer check (tokens_entrada >= 0),
  add column tokens_cache   integer check (tokens_cache >= 0),
  add column tokens_saida   integer check (tokens_saida >= 0);
