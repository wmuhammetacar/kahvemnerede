# Pilot Issues Log

Pilot sırasında karşılaşılan sorunları bu dosyaya kaydedin.

## Format

Her sorun için:

```
### [TARİH] [ŞUBE] [KISA BAŞLIK]

- **Severity:** P0/P1/P2/P3
- **Issue:** Sorunun kısa açıklaması
- **Reproduction:** Sorunu nasıl tekrarlayabiliriz
- **Impact:** Kullanıcıya etkisi
- **Status:** Open / Investigating / Fixed / Won't Fix
- **Notes:** Ek notlar
```

## Severity Tanımları

- **P0** — Sistem durdu. Hiçbir sipariş alınamıyor.
- **P1** — Ana akış ciddi bozuldu. Sipariş eklenemiyor veya HAZIR/TESLİM edilemiyor.
- **P2** — Operasyonel sıkıntı. Akış çalışıyor ama zorlaştırıyor.
- **P3** — Polish / öneri. Kullanımı iyileştirir ama acil değil.

## Kayıt Kuralları

- Her pilot gününde en az bir gözlem notu ekleyin
- P0/P1 hemen kaydedin
- P2/P3 gün sonunda toplu ekleyebilirsiniz
- Feature isteklerini bu dosyaya yazmayın — ayrı bir listede toplayın

## Örnek

```
### 2026-09-10 Merkez Şube Kasiyer akışı yavaş

- **Severity:** P2
- **Issue:** Kasiyer her siparişte ENTER yerine mouse ile EKLE butonuna tıklıyor
- **Reproduction:** Kasiyer electron cursor kullanıyor
- **Impact:** Sipariş başına 2-3 saniye kayıp
- **Status:** Open
- **Notes:** Kasiyere klavye kullanımı gösterilebilir
```
