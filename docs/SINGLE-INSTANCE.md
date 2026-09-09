# Single Instance Lock

## Why

The real-time EventBus (SSE push) is **process-local**. It runs in a single Node.js process and is not shared across instances.

If multiple app replicas are running:
- SSE events only reach clients connected to the same instance
- Some customers won't get real-time notifications
- Display may miss ready events

## Rule

```
APP REPLICAS = 1
```

Do NOT run multiple instances of the application behind a load balancer.

Do NOT use Kubernetes replicas > 1.

Do NOT use PM2 cluster mode.

## Docker Compose

The `docker-compose.yml` runs a single `app` container. This is correct for pilot.

## Scaling

If scaling is needed in the future:
1. Add Redis for event bus
2. Or use a message queue (e.g., Redis Pub/Sub, NATS)
3. This is NOT included in v1.0.0-pilot

## Verification

```bash
docker compose ps | grep app
# Should show exactly ONE app container
```
