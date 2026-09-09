# Backup Procedure

## Initial Backup (Before Pilot)

```bash
# From host machine
docker exec kahvemnerede-postgres-1 pg_dump -U kahvem -d kahvemnerede > backup-pilot-$(date +%Y%m%d).sql

# Verify
ls -la backup-pilot-*.sql
wc -l backup-pilot-*.sql
```

## Daily Backup Plan

**Procedure:**
```bash
# Daily backup (run via cron or manual)
docker exec kahvemnerede-postgres-1 pg_dump -U kahvem -d kahvemnerede | gzip > /backups/kahvem-$(date +%Y%m%d).sql.gz
```

**Retention:** 7 days rolling. Delete backups older than 7 days.

**Storage location:** `/backups/` directory on the host machine (or mounted volume).

**Cron example (daily at 3 AM):**
```
0 3 * * * docker exec kahvemnerede-postgres-1 pg_dump -U kahvem -d kahvemnerede | gzip > /backups/kahvem-$(date +\%Y\%m\%d).sql.gz
```

## Restore Procedure

```bash
# Decompress if gzipped
gunzip backup-file.sql.gz

# Restore
docker exec -i kahvemnerede-postgres-1 psql -U kahvem -d kahvemnerede < backup-file.sql
```

## Important Notes

- Backup does NOT include uploaded logos (stored in `UPLOAD_DIR`)
- Logo files should be backed up separately if needed
- Never commit backup files to the repository
- Test restore on a non-production database before relying on backups
