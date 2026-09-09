#!/bin/bash
# Daily production backup script
# Usage: ./scripts/backup-prod.sh
# Cron: 0 3 * * * /home/macar/PROJELER/kahvemnerede/scripts/backup-prod.sh

set -euo pipefail

BACKUP_DIR="/home/macar/PROJELER/kahvemnerede/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/kahvem-$TIMESTAMP.sql.gz"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Dump and compress
docker exec kahvemnerede-postgres-1 pg_dump -U kahvem -d kahvemnerede | gzip > "$BACKUP_FILE"

# Verify
if [ -s "$BACKUP_FILE" ]; then
  echo "[$(date)] Backup OK: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  echo "[$(date)] BACKUP FAILED: empty file" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Prune old backups
find "$BACKUP_DIR" -name "kahvem-*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null
echo "[$(date)] Pruned backups older than $RETENTION_DAYS days"
