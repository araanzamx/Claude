#!/usr/bin/env bash
# Corre las pruebas de acceso (supabase/tests) contra un Postgres local.
#
# Con Supabase CLI y Docker puedes usar `supabase test db` en su lugar.
# Este script sirve donde no hay Docker: crea una base temporal, aplica una
# imitación mínima de Supabase, las migraciones y luego las pruebas pgTAP.
#
# Requiere: psql con acceso a un servidor Postgres 15+ con la extensión pgtap.
# Variables opcionales: PGHOST, PGPORT, PGUSER (por defecto el usuario postgres).

set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
base="upper_nannies_pruebas_$$"
export PGUSER="${PGUSER:-postgres}"

limpiar() { dropdb --if-exists "$base" >/dev/null 2>&1 || true; }
trap limpiar EXIT

createdb "$base"
psql -q -v ON_ERROR_STOP=1 -d "$base" -f "$raiz/scripts/supabase-shim.sql" >/dev/null

for migracion in "$raiz"/supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$base" -f "$migracion" >/dev/null
done

fallas=0
for prueba in "$raiz"/supabase/tests/*.sql; do
  echo "== $(basename "$prueba")"
  salida="$(PGOPTIONS='-c search_path=public,extensions' psql -qtAX -v ON_ERROR_STOP=1 -d "$base" -f "$prueba" 2>&1)" || fallas=1
  echo "$salida"
  if grep -qE '^not ok|Looks like you|ERROR' <<<"$salida"; then
    fallas=1
  fi
done

if [[ $fallas -ne 0 ]]; then
  echo "Hay pruebas que fallaron." >&2
  exit 1
fi
echo "Todas las pruebas pasaron."
