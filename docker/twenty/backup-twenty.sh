#!/usr/bin/env bash
# docker/twenty/backup-twenty.sh
#
# Dumps the running Twenty CRM's Postgres database to a gzipped SQL file
# under docker/twenty/backups/ (git-ignored, matched by the repo's existing
# .gitignore) and prunes anything older than RETENTION_DAYS. Path-relative
# to this script's own location (same pattern as scripts/start.mjs), so the
# identical file runs unmodified both locally (`pnpm twenty:backup`) and on
# the production VPS (scheduled via cron — see docker/twenty/PRODUCTION.md).
#
# Restoring a dump: see the "Restore from a backup" section in
# docker/twenty/PRODUCTION.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
BACKUP_DIR="$SCRIPT_DIR/backups"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/twenty-db-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U postgres -d default | gzip > "$FILE"

find "$BACKUP_DIR" -name 'twenty-db-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "$(date -Iseconds) backup ok: $FILE ($(du -h "$FILE" | cut -f1))" >> "$BACKUP_DIR/backup.log"
