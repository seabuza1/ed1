#!/bin/sh
# Roda o 001 a 011 e os testes de RLS num Postgres local (sem Supabase).
# Uso: sh supabase/teste/rodar.sh   (precisa de psql com acesso de superusuário)
# Sai com erro se algum SQL ou teste falhar.
set -e
cd "$(dirname "$0")/.."
PSQL="${PSQL:-sudo -u postgres psql}"
$PSQL -q -c "drop database if exists acerto_teste" -c "create database acerto_teste"
status=0
saida=$($PSQL -q -v ON_ERROR_STOP=1 -d acerto_teste \
  -f teste/stub-supabase.sql -f 001_schema.sql -f 002_v1_app.sql -f 003_v1_avisos.sql -f 004_leitura.sql -f 005_leitura_ajustes.sql -f 006_pix_da_equipe.sql -f 007_leitura_provedor.sql -f 008_leitura_limite.sql -f 009_leitura_limite_trava.sql -f 010_revisao_acesso.sql -f 011_acerto_e_leitura.sql \
  -f teste/rls.sql -f teste/rls-leitura.sql -f teste/rls-pix.sql -f teste/rls-limite.sql -f teste/rls-revisao.sql -f teste/rls-acerto.sql 2>&1) || status=$?
printf '%s\n' "$saida" | grep -v 'wal_level\|HINT' || true
exit $status
