#!/usr/bin/env bash
# npm run backup:local — free backup that needs no GitHub Actions and no paid plan (backend plan 3.3).
# Dumps the linked Supabase project (schema, then data incl. auth users) with the Supabase CLI you are already logged in with,
# encrypts it with AES-256 using a passphrase file, deletes the plain files, keeps the newest 30 encrypted backups.
#
#   Backups:     ~/jonokotha-backups/jonokotha-YYYYMMDD-HHMMSS.tar.enc   (override with BACKUP_DIR)
#   Passphrase:  ~/.jonokotha-backup-passphrase (created with mode 600 on first run, never printed).
#                COPY IT TO YOUR PASSWORD MANAGER NOW: without it a backup cannot be opened, and if this Mac is lost the file is lost too.
#   Restore:     scripts/backup-local.sh --decrypt <file> <outdir>
# What it does not cover: Storage objects (photos), Auth settings, Edge config. Keep a copy of the backup folder off this Mac
# (external disk, or a cloud drive: the files are encrypted).
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-$HOME/jonokotha-backups}"
PASSFILE="${BACKUP_PASSFILE:-$HOME/.jonokotha-backup-passphrase}"

if [ "${1:-}" = "--decrypt" ]; then
  [ $# -eq 3 ] || { echo "usage: $0 --decrypt <file.tar.enc> <outdir>"; exit 2; }
  mkdir -p "$3"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$PASSFILE" -in "$2" | tar -x -C "$3"
  echo "Decrypted to $3 (plain data inside: delete it when finished)."; exit 0
fi

mkdir -p "$DIR"; chmod 700 "$DIR"
if [ ! -f "$PASSFILE" ]; then
  ( umask 077; openssl rand -hex 32 > "$PASSFILE" )
  echo "Created $PASSFILE. Copy its content into your password manager now (run: cat $PASSFILE)."
fi

stamp="$(date +%Y%m%d-%H%M%S)"; work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
npx supabase db dump --remote -f "$work/schema.sql" >/dev/null
npx supabase db dump --remote --data-only --use-copy -f "$work/data.sql" >/dev/null 2>"$work/data.err" || { cat "$work/data.err"; exit 1; }
rm -f "$work/data.err"
[ -s "$work/schema.sql" ] && [ -s "$work/data.sql" ] || { echo "empty dump, aborting"; exit 1; }
tar -c -C "$work" schema.sql data.sql | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$PASSFILE" -out "$DIR/jonokotha-$stamp.tar.enc"
chmod 600 "$DIR/jonokotha-$stamp.tar.enc"
ls -1t "$DIR"/jonokotha-*.tar.enc | tail -n +31 | xargs -I{} rm -f {}
echo "Backup written: $DIR/jonokotha-$stamp.tar.enc ($(du -h "$DIR/jonokotha-$stamp.tar.enc" | cut -f1)); kept: $(ls -1 "$DIR"/jonokotha-*.tar.enc | wc -l | tr -d ' ')"
