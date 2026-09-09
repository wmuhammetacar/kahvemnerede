# Kahvem Nerede — Production Deployment Guide

## Quick Start

1. Copy `.env.production` to `.env` on the production server
2. Fill in real values (see below)
3. Run `docker compose up -d`
4. Run `docker compose exec app npx prisma migrate deploy`
5. Verify: `curl http://localhost:3080/api/health`

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://kahvem:SECRET@localhost:5440/kahvemnerede?schema=public` |
| `SESSION_SECRET` | Random string, 32+ chars | `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | Public URL (no trailing slash) | `https://takip.yildizkahve.com` |
| `APP_ORIGIN` | Same-origin check (matches URL origin) | `https://takip.yildizkahve.com` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `UPLOAD_DIR` | Logo storage path | `/var/lib/kahvemnerede/uploads` |
| `POSTGRES_PASSWORD` | Docker postgres password | `kahvem_prod` |

## Domain Setup

### 1. DNS Record

```
Type: A
Name: takip (or subdomain you choose)
Value: YOUR_SERVER_IP
TTL: 300
```

For Cloudflare: disable proxy (grey cloud) for SSE compatibility.

### 2. HTTPS (Caddy - Recommended)

```bash
# Install Caddy
sudo apt install -y caddy

# Edit /etc/caddy/Caddyfile
```

```caddyfile
takip.yildizkahve.com {
    reverse_proxy localhost:3080

    # SSE support
    flush_interval -1
    read_timeout 0
    write_timeout 0
}
```

```bash
# Restart Caddy
sudo systemctl restart caddy
```

### 3. HTTPS (Nginx + Certbot)

```bash
# Install
sudo apt install -y nginx certbot python3-certbot-nginx

# Edit /etc/nginx/sites-available/takip.yildizkahve.com
```

```nginx
server {
    listen 80;
    server_name takip.yildizkahve.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name takip.yildizkahve.com;

    ssl_certificate /etc/letsencrypt/live/takip.yildizkahve.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/takip.yildizkahve.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3080;
        proxy_http_version 1.1;

        # SSE support
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/takip.yildizkahve.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d takip.yildizkahve.com
```

## SSE Configuration

The app uses Server-Sent Events (SSE) for real-time updates. Ensure:

1. **No buffering** at proxy level (`proxy_buffering off` for nginx, `flush_interval -1` for Caddy)
2. **Long timeouts** (86400s / 24 hours)
3. **Keep-alive** connections

## Single Instance

This app uses an in-memory EventBus. **Do not run multiple app replicas.**

```yaml
# In docker-compose.yml
deploy:
  replicas: 1  # DO NOT increase
```

## Health Check

```bash
curl https://takip.yildizkahve.com/api/health
# Expected: {"status":"ok","db":"ok"}
```

## Backup

Daily backup cron is installed:
- Time: 03:00 daily
- Location: `/home/macar/PROJELER/kahvemnerede/backups/`
- Retention: 7 days
- Manual: `./scripts/backup-prod.sh`

## Troubleshooting

### Health check fails
- Check container status: `docker ps`
- Check logs: `docker logs kahvemnerede-app-1`
- Verify port: `curl http://localhost:3080/api/health`

### SSE not working
- Check proxy buffering config
- Verify `Connection: keep-alive` header
- Test with: `curl -H "Accept: text/event-stream" https://takip.yildizkahve.com/api/b/BRANCH_SLUG/track -d '{"orderNumber":"TEST"}'`

### Session issues
- Verify `SESSION_SECRET` is set and 32+ chars
- Clear browser cookies and re-login

### Database connection
- Verify `DATABASE_URL` is correct
- Check postgres container: `docker logs kahvemnerede-postgres-1`
- Test connection: `docker exec kahvemnerede-postgres-1 pg_isready -U kahvem`
