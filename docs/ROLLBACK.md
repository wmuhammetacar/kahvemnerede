# Rollback Procedure

Pilot release başarısız olursa geri dönüş prosedürü.

## Kurallar

- Database downgrade YAPMA
- Migration'ları geri al
- Mevcut PostgreSQL data KORUNUR
- Önceki application image'e dön

## Adımlar

### 1. Durdur

```bash
docker compose down
```

### 2. Önceki Image'i Kullan

Docker Compose'daki image referansını önceki release'e çevir.

Önceki image ID'sini bul:
```bash
docker images | grep kahvemnerede
```

`docker-compose.yml`'de image'i eski tag/id ile değiştir veya Previous image'ı tekrar build et.

### 3. Restart

```bash
docker compose up -d
```

### 4. Verify

```bash
curl -s http://localhost:3080/api/health
# {"status":"ok","db":"ok"}
```

### 5. Migration Uyumluluğu

Eğer önceki release daha eski migration'lara sahipse:
- Yeni migration'lar geri alınamaz
- Veri kaybı olmadan çalışmalı (forward compatibility)
- Eğer uyumsuzluk varsa, DB backup'tan geri yükle

## Database Backup ile Tam Rollback

Eski image + eski veri gerekirse:

```bash
# 1. Durdur
docker compose down

# 2. DB'yi backup'tan yükle
docker compose up -d postgres
sleep 5
docker exec -i kahvemnerede-postgres-1 psql -U kahvem -d kahvemnerede < backup-before-pilot.sql

# 3. Eski app image ile başlat
docker compose up -d app
```

## Notlar

- Rollback sonrası logo dosyaları korunur (UPLOAD_DIR volume'da)
- Session'lar sıfırlanır (SESSION_SECRET değişmediyse korunur)
- Sipariş verileri korunur (aynı DB)
