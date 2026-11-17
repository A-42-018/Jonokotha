#!/usr/bin/env bash
# Reviewed migration flow from a laptop: lint, dry-run, typed confirmation, apply.
#   SUPABASE_ACCESS_TOKEN=... SUPABASE_DB_PASSWORD=... scripts/migrate-env.sh <staging|production> <project-ref>
# Never run without reading the dry-run. See docs/aibc/runbooks/deploy-and-rollback.md. Does not touch anything unless you confirm.
set -euo pipefail
env_name="${1:-}"; ref="${2:-}"
[[ "$env_name" == "staging" || "$env_name" == "production" ]] || { echo "usage: $0 <staging|production> <project-ref>"; exit 2; }
[[ "$ref" =~ ^[a-z0-9]{15,30}$ ]] || { echo "project ref looks wrong"; exit 2; }
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"; : "${SUPABASE_DB_PASSWORD:?set SUPABASE_DB_PASSWORD}"
if [[ "$env_name" == "production" && -n "${SUPABASE_STAGING_REF:-}" && "$ref" == "$SUPABASE_STAGING_REF" ]]; then echo "refusing: that is the staging project"; exit 2; fi
npm run lint:migrations
npx supabase link --project-ref "$ref"
echo; echo "=== dry run for $env_name ($ref) ==="; npx supabase db push --dry-run
echo; read -r -p "Type the environment name ($env_name) to apply, anything else cancels: " answer
[[ "$answer" == "$env_name" ]] || { echo "cancelled"; exit 1; }
npx supabase db push
echo "applied. Now: smoke test, npm run check:release on the deploy, watch alerts for 30 minutes."
