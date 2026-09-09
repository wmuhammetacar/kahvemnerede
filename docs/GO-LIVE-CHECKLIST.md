# Go-Live Checklist

Real cafe pilot deployment checklist.

## Pre-Deployment (Remote)

- [x] Demo data cleaned from production DB
- [x] Real business created via CLI
- [x] Real admin account created
- [x] Real cashier account created
- [x] Production backup taken
- [x] Backup stored in persistent location (`backups/`)
- [x] Full smoke test passed (admin + cashier + track + ready + complete + history + reports)
- [x] Migration up-to-date
- [x] Health endpoint OK
- [x] Lint/typecheck/unit tests pass

## On-Site Deployment

- [ ] Domain DNS configured (A record pointing to server IP)
- [ ] HTTPS certificate installed (Let's Encrypt or provider)
- [ ] HTTP → HTTPS redirect working
- [ ] `NEXT_PUBLIC_APP_URL` set to `https://REAL-DOMAIN`
- [ ] `APP_ORIGIN` set to `https://REAL-DOMAIN`
- [ ] App accessible via `https://REAL-DOMAIN`
- [ ] Login page accessible via HTTPS

## Physical Setup

- [ ] Cashier device (PC/tablet) set up at counter
- [ ] Cashier browser opens `/panel` on startup
- [ ] Display device (TV/tablet) set up
- [ ] Display browser opens `/b/SLUG/display` in fullscreen
- [ ] Display screen sleep disabled
- [ ] Counter QR card printed and placed
- [ ] Table QR(s) printed and placed (if applicable)

## QR Verification

- [ ] Counter QR scanned with real phone
- [ ] Phone opens tracking page (no certificate warning)
- [ ] Tracking page shows order number input
- [ ] No redirect loops or 404s

## Live Smoke Test

- [ ] Cashier creates order 9999 via `Number + ENTER`
- [ ] Customer scans QR → enters 9999 → sees WAITING
- [ ] Cashier clicks HAZIR → customer sees READY (no refresh)
- [ ] Display shows 9999
- [ ] Cashier clicks TESLİM EDİLDİ → customer sees completion
- [ ] Display removes 9999
- [ ] History shows 9999
- [ ] Reports show test order

## Staff Training

- [ ] Cashier shown the 5-step flow (number → ENTER → HAZIR → TESLİM → GERİ AL)
- [ ] Cashier understands GERİ AL (8-second window)
- [ ] Admin shown panel navigation
- [ ] Admin knows how to add staff
- [ ] Admin knows how to view reports

## Backup

- [ ] Initial production backup taken
- [ ] Daily backup cron configured
- [ ] Backup location is persistent (not ephemeral)
- [ ] Restore procedure tested

## Monitoring

- [ ] Health check endpoint bookmarked
- [ ] Docker container status check procedure known
- [ ] Disk space monitoring in place

## Rollback

- [ ] Previous Docker image identified
- [ ] Rollback procedure documented (`docs/ROLLBACK.md`)
- [ ] Backup available for restore

## Post-Launch

- [ ] First 10 real orders observed
- [ ] No P0/P1 issues
- [ ] Pilot issues logged in `docs/PILOT-ISSUES.md`
- [ ] Cashier workflow smooth
- [ ] Customer QR experience smooth
- [ ] Display showing correctly
