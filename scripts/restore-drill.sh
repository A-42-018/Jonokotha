#!/usr/bin/env bash
# npm run drill:restore — restore drill (backend plan 3.3). Dumps a source database, restores it into a scratch database,
# compares row counts, and prints the elapsed time (recovery time) and the age of the newest row (recovery point).
#
# Source:   SRC_DB_URL (a Supabase connection string from Dashboard > Connect; the direct or session-pooler URL). Default: the local stack.
# Scratch:  a throwaway database created inside the LOCAL Supabase container, dropped afterwards. Production is only ever read.
# Needs:    Docker running and `npx supabase start`. Nothing here writes to the source.
set -euo pipefail
CONTAINER="${DB_CONTAINER:-supabase_db_jonokotha}"
SRC="${SRC_DB_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}"
SCRATCH="restore_drill_$(date +%Y%m%d%H%M%S)"
TABLES=(profiles issues issue_events audit_logs consents notifications ideas questions follows)
dexec() { docker exec -i "$CONTAINER" "$@"; }
q() { dexec psql -U postgres -d "$1" -X -A -t -c "$2"; }

echo "Scratch database: $SCRATCH (local container $CONTAINER)"
start=$(date +%s)
dexec psql -U postgres -X -q -c "create database $SCRATCH"
trap 'dexec psql -U postgres -X -q -c "drop database if exists $SCRATCH" >/dev/null 2>&1 || true' EXIT

# Dump runs inside the container so the pg_dump version matches the server image. Custom format, public + auth schemas.
dexec pg_dump "$SRC" --no-owner --no-privileges --schema=public --schema=auth -Fc -f /tmp/drill.dump
dexec psql -U postgres -d "$SCRATCH" -X -q -c "create extension if not exists vector; create extension if not exists pg_trgm; create extension if not exists pgcrypto; create schema if not exists extensions;" >/dev/null 2>&1 || true
dexec pg_restore -U postgres -d "$SCRATCH" --no-owner --no-privileges /tmp/drill.dump 2>/tmp/drill-restore.err || true
end=$(date +%s)
dexec rm -f /tmp/drill.dump

fail=0
printf '\n%-18s %10s %10s\n' table source restored
for t in "${TABLES[@]}"; do
  a=$(dexec psql "$SRC" -X -A -t -c "select count(*) from public.$t")
  b=$(q "$SCRATCH" "select count(*) from public.$t" 2>/dev/null || echo "missing")
  mark=""; [ "$a" = "$b" ] || { mark="  MISMATCH"; fail=1; }
  printf '%-18s %10s %10s%s\n' "$t" "$a" "$b" "$mark"
done
newest=$(q "$SCRATCH" "select coalesce(extract(epoch from now() - max(created_at))::bigint::text, 'none') from public.audit_logs" 2>/dev/null || echo none)
echo
echo "Recovery time (dump + restore, this machine): $((end - start)) s"
echo "Age of newest restored audit row: ${newest} s (recovery point is this plus the backup interval)"
if [ "$fail" = 0 ]; then echo "Drill result: row counts match"; else echo "Drill result: MISMATCH"; exit 1; fi
