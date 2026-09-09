# Pilot Business Onboarding

Step-by-step procedure to onboard the first pilot café.

## Prerequisites

- Docker containers running (`docker compose up -d`)
- Migrations applied (`docker compose exec app npx prisma migrate deploy`)
- Production `.env` configured with real `SESSION_SECRET` and `DATABASE_URL`

## 1. Create Business + Branch + Admin

```bash
npx tsx scripts/business-create.ts \
  --business "İşletme Adı" \
  --branch "Şube Adı" \
  --email "admin@isletme.com" \
  --password "GucluSifre123!"
```

This creates:
- Business record
- First branch with unique slug
- Admin user (role: ADMIN)

Output shows the branch slug — needed for QR and display URLs.

## 2. Create Cashier Account

```bash
npx tsx scripts/business-create.ts \
  --business "İşletme Adı" \
  --branch "Şube Adı" \
  --email "kasiyer@isletme.com" \
  --password "KasiyerSifre123!"
```

Or use the admin panel: `/panel/staff` → Yeni Personel

## 3. Generate QR Code

Branch slug from step 1. Tracking URL format:

```
https://YOUR-DOMAIN/b/BRANCH-SLUG/track
```

Generate QR with any QR tool (e.g., `qrencode` CLI or online generator).

## 4. Set Up Display

See `docs/DISPLAY-SETUP.md` for TV/tablet configuration.

Display URL:

```
https://YOUR-DOMAIN/b/BRANCH-SLUG/display
```

## 5. Print QR Materials

See `docs/QR-PRINT.md` for counter card and table QR formats.

## 6. Verify

- Login as admin → panel loads
- Login as cashier → panel loads
- Create test order → appears in panel
- Open tracking URL → shows order status
- Open display URL → shows ready orders
- Check `/panel/reports` → data appears

## 7. Clean Up Test Data

After verification, delete test orders via `/panel/history` or direct DB cleanup.

## 8. Document Credentials

Store admin and cashier credentials securely (password manager).

Do NOT write credentials in any repository or shared document.
