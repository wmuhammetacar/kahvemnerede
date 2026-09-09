# Health Check Procedure

Run before pilot opening and periodically during operation.

## Automated Check

```bash
curl -s http://localhost:3080/api/health
```

Expected: `{"status":"ok","db":"ok"}`

## Manual Checklist

### App Status
```bash
docker compose ps
# app: healthy
# postgres: healthy
```

### Database Connection
```bash
docker exec kahvemnerede-postgres-1 pg_isready -U kahvem -d kahvemnerede
# Accepting connections
```

### Migration Status
```bash
DATABASE_URL="postgresql://kahvem:PASSWORD@localhost:5440/kahvemnerede?schema=public" \
  npx prisma migrate status
# Database schema is up to date!
```

### Disk Space
```bash
df -h /var/lib/docker
# Ensure > 1GB free
```

### Login Test
```bash
curl -s -X POST http://localhost:3080/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3080" \
  -H "Sec-Fetch-Site: same-origin" \
  -d '{"email":"ADMIN_EMAIL","password":"ADMIN_PASSWORD"}'
# Should return user object with session cookie
```

## What to Check If Health Fails

| Symptom | Action |
|---------|--------|
| App unhealthy | `docker compose restart app` |
| Postgres unhealthy | `docker compose restart postgres` |
| Migration pending | `docker compose exec app npx prisma migrate deploy` |
| Disk full | Clean old backups, docker images |
| Login fails | Check SESSION_SECRET, check user exists |
