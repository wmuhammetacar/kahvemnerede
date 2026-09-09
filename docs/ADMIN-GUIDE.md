# Admin Operasyon Rehberi

## Personel Yönetimi

**Yeni personel ekle:**
`/panel/staff` → "Yeni Personel" → E-posta, şifre, rol seç → Kaydet

**Personel devre dışı bırak:**
`/panel/staff` → ilgili kişi → "Devre Dışı" yap

**Şifre sıfırla:**
`/panel/staff` → ilgili kişi → "Şifre Değiştir"

## Şube

**Şube bilgileri:**
`/panel/branches` → şube adı, saat dilimi görüntüle

**Yeni şube:**
`/panel/branches` → "Yeni Şube" → Ad, slug, saat dilimi

## QR Kodu

Takip URL'i: `https:// domaine/b/BRANCH-SLUG/track`

Bu URL'i herhangi bir QR oluşturucu ile QR'a dönüştürün.
Karşılama kartı veya masa için ayrı QR'lar oluşturun.

## Display (Ekran)

Display URL: `https://domain/b/BRANCH-SLUG/display`

Bu URL'i kafedeki TV/tablet tarayıcısında açın.
Tam ekran yapın. Detaylı bilgi: `docs/DISPLAY-SETUP.md`

## Geçmiş

`/panel/history` → Tarih filtresi, şube filtresi, sipariş ara
Geçmiş siparişleri görüntüle, tarih bazlı filtrele

## Raporlar

`/panel/reports` → Günlük/haftalık/aylık istatistikler
- Toplam sipariş
- Ortalama hazırlama süresi
- Saatlik yoğunluk grafiği
- Şube karşılaştırma (çoklu şube)

## CSV Dışa Aktarma

`/panel/reports` → "CSV İndir" butonu
Seçilen tarih aralığı ve şube filtresine göre CSV dosyası indirilir.

## Branding (Marka)

`/panel/settings` → Logo, renk, hazır mesajı ayarla
Logo: PNG/JPEG, maks 2MB
