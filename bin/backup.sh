#!/usr/bin/env bash
# Snapshot the local Supabase stack:
#   - Postgres dump (custom format) covering all schemas, including auth and
#     storage metadata. Restores via `pg_restore`.
#   - Tarball of the storage bucket directory (the actual evidence files).
#
# Output:   backups/YYYYMMDD-HHMMSS/db.dump  +  storage.tar.gz
# Restore:  see RESTORE.md (printed at the end of this script too).
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

c_grn='\033[0;32m'; c_yel='\033[0;33m'; c_red='\033[0;31m'; c_rst='\033[0m'
say()  { printf "${c_grn}==>${c_rst} %s\n" "$*"; }
warn() { printf "${c_yel}WARN:${c_rst} %s\n" "$*"; }
die()  { printf "${c_red}ERROR:${c_rst} %s\n" "$*" >&2; exit 1; }

PROJECT_NAME="$(basename "$PROJECT_DIR")"
DB_CTR="supabase_db_${PROJECT_NAME}"
ST_CTR="supabase_storage_${PROJECT_NAME}"

if ! docker info >/dev/null 2>&1; then
  die "Docker isn't running. Start the app first."
fi
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CTR}$"; then
  die "Supabase isn't running ($DB_CTR not found). Start the app first."
fi

TS="$(date +%Y%m%d-%H%M%S)"
OUT="backups/${TS}"
mkdir -p "$OUT"

say "Dumping Postgres → ${OUT}/db.dump"
docker exec "$DB_CTR" pg_dump -U postgres -d postgres -Fc -f /tmp/db.dump
docker cp "${DB_CTR}:/tmp/db.dump" "${OUT}/db.dump"
docker exec "$DB_CTR" rm /tmp/db.dump

say "Archiving storage objects → ${OUT}/storage.tar.gz"
# /mnt is the bucket root inside the storage container (FILE_STORAGE_BACKEND_PATH).
docker exec "$ST_CTR" sh -c 'tar -czf /tmp/storage.tar.gz -C /mnt .'
docker cp "${ST_CTR}:/tmp/storage.tar.gz" "${OUT}/storage.tar.gz"
docker exec "$ST_CTR" rm /tmp/storage.tar.gz

# Capture the migration set we were on, so a future restore can pin to it.
cp -R supabase/migrations "${OUT}/migrations" 2>/dev/null || true

cat > "${OUT}/RESTORE.md" <<'EOF'
# Restore from this backup

This backup was taken with bin/backup.sh. To restore onto a fresh local
Supabase stack:

```bash
# 1. Reset the stack (DESTRUCTIVE — wipes current data)
supabase db reset

# 2. Restore the Postgres dump (skips schema we already have via migrations)
docker cp db.dump supabase_db_<project>:/tmp/db.dump
docker exec supabase_db_<project> pg_restore \
  -U postgres -d postgres --clean --if-exists --no-owner /tmp/db.dump

# 3. Restore the storage objects
docker cp storage.tar.gz supabase_storage_<project>:/tmp/storage.tar.gz
docker exec supabase_storage_<project> sh -c \
  'rm -rf /mnt/* && tar -xzf /tmp/storage.tar.gz -C /mnt'
```

`<project>` is the directory name (e.g. `Compliance-Evidence-Mapper`).
EOF

say "Backup complete:"
ls -lh "$OUT"
echo
echo "Restore notes: ${OUT}/RESTORE.md"

# Keep the window open if launched from Finder/.app
if [[ -t 0 ]]; then
  echo
  echo "Press any key to close."
  read -n 1 -s -r
fi
