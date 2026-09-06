#!/usr/bin/env bash
# docker/twenty/pull-backup.sh
#
# Pulls the newest production Twenty CRM backup from the VPS down to this
# machine, so a VPS-level failure (not just a bad DB write) doesn't take
# the only copy of the backup with it. Complements
# docker/twenty/backup-twenty.sh, which creates the backup on the VPS
# itself but never leaves it there.
#
# Run on a schedule (see PRODUCTION.md) after the VPS's own cron job
# (03:00 UTC) has had time to finish.

set -euo pipefail

VPS_HOST="deploy@157.245.247.246"
VPS_SSH_KEY="$HOME/.ssh/id_ed25519"
LOCAL_DEST="$HOME/twenty-backups"
RETENTION_DAYS=30

mkdir -p "$LOCAL_DEST"

LATEST=$(ssh -i "$VPS_SSH_KEY" "$VPS_HOST" \
  "ls -1t /opt/twenty/backups/twenty-db-*.sql.gz 2>/dev/null | head -1")

if [[ -z "$LATEST" ]]; then
  echo "$(date -Iseconds) pull-backup: no backup file found on VPS" >> "$LOCAL_DEST/pull-backup.log"
  exit 1
fi

FILENAME="$(basename "$LATEST")"
DEST="$LOCAL_DEST/$FILENAME"

if [[ -f "$DEST" ]]; then
  echo "$(date -Iseconds) pull-backup: $FILENAME already present locally, skipping" >> "$LOCAL_DEST/pull-backup.log"
  exit 0
fi

scp -i "$VPS_SSH_KEY" "$VPS_HOST:$LATEST" "$DEST"

find "$LOCAL_DEST" -name 'twenty-db-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "$(date -Iseconds) pull-backup ok: $FILENAME ($(du -h "$DEST" | cut -f1))" >> "$LOCAL_DEST/pull-backup.log"
