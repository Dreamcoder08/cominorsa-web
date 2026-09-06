#!/usr/bin/env bash
# docker/twenty/backup-to-spaces.sh
#
# Uploads the newest local Twenty CRM backup (created by backup-twenty.sh)
# to a DigitalOcean Spaces bucket via s3cmd, so the off-box copy does not
# depend on any single machine being powered on or logged in -- the gap
# `docker/twenty/pull-backup.sh` (laptop pull) has by design. Skips
# already-uploaded files, prunes remote objects older than RETENTION_DAYS.
#
# Requires: s3cmd installed and configured (~/.s3cfg) with a DigitalOcean
# Spaces access key. Run on the VPS, right after backup-twenty.sh, via cron
# (see docker/twenty/PRODUCTION.md).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
BUCKET="s3://cominorsa-backups"
RETENTION_DAYS=30

LATEST=$(ls -1t "$BACKUP_DIR"/twenty-db-*.sql.gz 2>/dev/null | head -1)
if [[ -z "$LATEST" ]]; then
  echo "$(date -Iseconds) backup-to-spaces: no local backup file found" >> "$BACKUP_DIR/backup-to-spaces.log"
  exit 1
fi

FILENAME="$(basename "$LATEST")"

if s3cmd ls "$BUCKET/$FILENAME" | grep -q "$FILENAME"; then
  echo "$(date -Iseconds) backup-to-spaces: $FILENAME already uploaded, skipping" >> "$BACKUP_DIR/backup-to-spaces.log"
  exit 0
fi

s3cmd put "$LATEST" "$BUCKET/$FILENAME"

CUTOFF=$(date -d "-$RETENTION_DAYS days" +%Y-%m-%d)
s3cmd ls "$BUCKET/" | awk -v cutoff="$CUTOFF" '$1 < cutoff {print $4}' | while read -r old_key; do
  [[ -n "$old_key" ]] && s3cmd del "$old_key"
done

echo "$(date -Iseconds) backup-to-spaces ok: $FILENAME uploaded to $BUCKET" >> "$BACKUP_DIR/backup-to-spaces.log"
