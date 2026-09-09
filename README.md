# Kahvem Nerede

**Version: 1.0.0-pilot** — Release Frozen

Sipariş takip ve bildirim sistemi — kahve dükkanları için real-time order lifecycle yönetimi.

## Özellikler

- **Sipariş Yönetimi**: Oluştur → Beklemede → Hazır → Teslim Al → İptal
- **Müşteri Takimi**: Sipariş numarasıyla real-time durum takibi (SSE + polling fallback)
- **Ekran Modu**: Hazır siparişler için canlı ekran display (SSE)
- **Çoklu Şube**: İşletme başına birden fazla şube desteği
- **Rol Yönetimi**: ADMIN / CASHIER rolleri, zorunlu şifre değiştirme
- **Raporlama**: Günlük/haftalık/aylık satış istatistikleri, CSV dışa aktarma
- **Logo Yönetimi**: Güvenli raster/veter logo yükleme
- **Rate Limiting**: Brute-force koruması, branded error mesajları
- **CSRF Koruması**: Same-origin + Same-site validasyonları

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Runtime | Next.js 16.3.4, Node.js |
| Database | PostgreSQL 16, Prisma 6.19.3 |
| Auth | Argon2id, opaque session tokens |
| Real-time | Server-Sent Events (SSE) |
| Testing | Vitest (unit), Playwright (e2e) |
| Deployment | Docker multi-stage, standalone |

## Hızlı Başlangıç

### Docker (Önerilen)

```bash
# Gerekli ortam değişkenlerini ayarlayın
export SESSION_SECRET="<32+ karakter güçlü gizli anahtar>"
export POSTGRES_PASSWORD="<güçlü veritabanı şifresi>"

# Başlat
docker compose up -d

# Veritabanı migrasyonu
docker compose exec app npx prisma migrate deploy

# İşletme oluşturun
npx tsx scripts/business-create.ts \
  --business "İsmim" \
  --branch "Şubem" \
  --email admin@example.com \
  --password "GucluSifre123"

# Erişim: http://localhost:3080
```

### Geliştirme Ortamı

```bash
pnpm install
pnpm dev
# http://localhost:3000
```

## Ortam Değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `DATABASE_URL` | Evet | PostgreSQL bağlantı dizesi |
| `SESSION_SECRET` | Evet | 32+ karakter oturum gizli anahtarı (production'da zorunlu) |
| `NEXT_PUBLIC_APP_URL` | Evet | Uygulamanın erişilebilir URL'i |
| `APP_ORIGIN` | Hayır | Same-origin check (varsayılan: NEXT_PUBLIC_APP_URL) |
| `POSTGRES_PASSWORD` | Hayır | Docker compose için veritabanı şifresi |

## Mimari

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # Login, logout, me, change-password
│   │   ├── orders/        # Sipariş CRUD (ready/complete/cancel)
│   │   ├── history/       # Sipariş geçmişi (admin all-branches)
│   │   ├── reports/       # İstatistikler + CSV export
│   │   ├── events/        # SSE polling endpoint
│   │   ├── admin/         # Branch CRUD, logo upload
│   │   ├── b/[slug]/      # Public tracking + display SSE
│   │   └── health/        # Healthcheck
│   ├── panel/             # Admin/Cashier paneli
│   ├── display/           # Ekran modu
│   └── login/             # Giriş sayfası
├── lib/
│   ├── auth.ts            # Session yönetimi, Argon2
│   ├── prisma.ts          # Prisma client singleton
│   ├── security.ts        # Rate limiting, CSRF, bounds
│   ├── events.ts          # EventBus + display connection limiter
│   ├── branch.ts          # Branch slug lookup
│   └── reports.ts         # Report queries, CSV builder
├── components/            # React components (OrdersTable, BranchStatus, etc.)
└── proxy.ts               # Middleware (auth, CSRF, origin check)
```

## Güvenlik

- Argon2id password hashing
- Opaque session tokens (hash-only storage)
- Rate limiting (login: 5/60s/global, tracking: 15/60s/branch)
- Same-origin + Same-site CSRF protection
- Display SSE connection limit (20/branch)
- Session secret validation (production: ≥32 chars, non-weak)
- Branded error responses (no user enumeration)

## Production Deployment

```bash
# 1. Güçlü secret'lar üretin
export SESSION_SECRET=$(openssl rand -base64 48)
export POSTGRES_PASSWORD=$(openssl rand -base64 32)

# 2. Docker Compose ile başlat
docker compose up -d

# 3. Veritabanını migrasyon et
docker compose exec app npx prisma migrate deploy

# 4. İlk işletmeyi oluştur
npx tsx scripts/business-create.ts \
  --business "İşletmem" \
  --branch "Merkez" \
  --email admin@isletme.com \
  --password "$(openssl rand -base64 16)"

# 5. Sağlık kontrolü
curl http://localhost:3080/api/health
```

## Test

```bash
pnpm test          # Unit tests (110)
pnpm test:e2e      # E2E tests (10)
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
```

## Pilot Dokümantasyon

Pilot deployment için gerekli tüm dokümanlar `docs/` klasöründe:

| Doküman | İçerik |
|---------|--------|
| `PILOT-ONBOARDING.md` | İşletme/şube/kasiyer oluşturma adımları |
| `CASHIER-GUIDE.md` | Kasiyer kullanım rehberi (tek sayfa) |
| `CUSTOMER-INSTRUCTION.md` | QR çıktısı için müşteri talimatı |
| `ADMIN-GUIDE.md` | Admin operasyon rehberi |
| `QR-PRINT.md` | QR kodu baskı formatları |
| `DISPLAY-SETUP.md` | Ekran cihazı kurulumu |
| `BACKUP-PROCEDURE.md` | Yedekleme prosedürü |
| `HEALTH-CHECK.md` | Sağlık kontrol rehberi |
| `ROLLBACK.md` | Geri dönüş prosedürü |
| `SINGLE-INSTANCE.md` | Tek instance kilidi |
| `PILOT-ISSUES.md` | Pilot sorun kayıtları |
| `PILOT-OBSERVATION.md` | Gözlem kontrol listesi |

## Lisans

Proprietary — internal use only.
