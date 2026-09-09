# QR Code Materials

## Counter / Cashier QR

Small card placed next to the cashier terminal.

**Content:**
```
https://YOUR-DOMAIN/b/BRANCH-SLUG/track
```

**Print specs:**
- Size: 8cm × 8cm (credit card size also works)
- Material: laminated card
- Placement: next to payment terminal, facing customer

**Template text below QR:**
```
Siparişinizi takip etmek için QR'ı okutun
```

## Table QR

Larger QR placed on each table.

**Content:**
```
https://YOUR-DOMAIN/b/BRANCH-SLUG/track
```

**Print specs:**
- Size: 10cm × 10cm minimum (larger = easier scanning)
- Material: laminated or framed
- Placement: center of table, upright angle

**Template text below QR:**
```
Siparişinizi takip etmek için QR'ı okutun
Sipariş numaranızı girin ve ekranı açık tutun
```

## QR Generation

Using `qrencode` CLI:
```bash
qrencode -o counter-qr.png -s 10 "https://YOUR-DOMAIN/b/BRANCH-SLUG/track"
qrencode -o table-qr.png -s 10 "https://YOUR-DOMAIN/b/BRANCH-SLUG/track"
```

Or use any online QR generator with the tracking URL.

## No Code Changes

The tracking URL is a public page — no login required. Customer flow:
1. Scan QR
2. Enter order number
3. See status
4. Get notified when ready
