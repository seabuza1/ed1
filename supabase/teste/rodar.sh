#!/bin/sh
# Roda o 001 a 006 e os testes de RLS num Postgres local (sem Supabase).
# Uso: sh supabase/teste/rodar.sh   (precisa de psql com acesso de superusuário)
set -e
cd "$(dirname "$0")/.."
PSQL="${PSQL:-sudo -u postgres psql}"
$PSQL -q -c "drop database if exists acerto_teste" -c "create database acerto_teste"
$PSQL -q -v ON_ERROR_STOP=1 -d acerto_teste \
  -f teste/stub-supabase.sql -f 001_schema.sql -f 002_v1_app.sql -f 003_v1_avisos.sql -f 004_leitura.sql -f 005_leitura_ajustes.sql -f 006_pix_da_equipe.sql \
  -f teste/rls.sql -f teste/rls-leitura.sql -f teste/rls-pix.sql 2>&1 | grep -v 'wal_level\|HINT'
