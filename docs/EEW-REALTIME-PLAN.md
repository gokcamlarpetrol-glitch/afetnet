# AfetNet — Gerçek-Zamanlı Erken Deprem Uyarısı (EEW) — Mimari & Yol Haritası

> **Karar:** 2026-05-21. Güncelleme, gerçek-zamanlı (saniye-içi) EEW hazır
> olmadan yayımlanmayacak. Bu belge o sistemin dürüst, profesyonel mühendislik
> planıdır — pazarlama değil, mühendislik.

---

## 0. Dürüst kapsam

**Hedef:** Deprem başladıktan **4-10 saniye içinde** uyarı üretmek; sarsıntı
uzak şehirlere varmadan bildirim göndermek. Dünya standardı (Japonya JMA,
İsviçre SED, Tayvan CWA) bu performanstadır: ilk uyarı origin'den 4-9 sn sonra.

**Mevcut mimariyle imkânsız.** "Son depremler" katalog polling'i depremi
1-3 dk sonra görür. Tamamen yeni bir gerçek-zamanlı sismik işleme katmanı gerekir.

**Kör bölge:** Episantr ±~30 km'de avans ~0 sn — bu fizik, hiçbir sistem
çözemez. Fayda mesafeyle artar (100 km → ~15-25 sn, 200 km → ~40-60 sn).

---

## 1. Araç seçimi — kendi sismolojimizi YAZMIYORUZ

Sıfırdan sismik algılama yazmak hayati bir üründe sorumsuzluktur. Profesyonel yol:

**SeisComP + SED-EEW modülleri** — gerçek ulusal sismik servislerin (Tayvan CWA,
İsviçre, GFZ) işlettiği açık-kaynak yazılım.
- **VS (Virtual Seismologist)** — nokta-kaynak hızlı magnitüd kestirimi.
- **FinDer (scfinder)** — güçlü-hareket örüntüsünden fay kırığı kestirimi.
- **sceewenv / sceewlog** — EEW envelope üretimi + uyarı çıktısı.
- Kanıtlanmış performans: ilk uyarı origin'den **4-6 sn**, medyan 7-9 sn.

**Lisans uyarısı (iş kararı — senin):** SeisComP ve SED-EEW katkıları
**AGPL-3.0**. Kendi sunucumuzda servis olarak çalıştırıp yalnızca *uyarı
çıktısını* tüketmek (kullanıcıya SeisComP arayüzü açmadan) genelde uygundur,
ama AGPL'in ağ-kullanım maddesi inceliklidir — yayın öncesi hukuki onay al.

---

## 2. Mimari

```
[Sismik istasyonlar — KOERI/AFAD ağı, fay hatlarına yakın]
            │  gerçek-zamanlı dalga akışı (SeedLink protokolü, miniSEED)
            ▼
[Daima-açık sunucu — GCP Compute Engine VM]
   ├── SeisComP çekirdek (messaging bus + DB)
   ├── scautopick → P-dalgası tetik (STA/LTA)
   ├── scautoloc → çoklu-istasyon konum kestirimi
   ├── VS + FinDer → magnitüd + fay kestirimi
   └── sceewlog → EEW uyarısı (origin'den ~5-9 sn sonra)
            │  köprü script (uyarı → HTTPS POST)
            ▼
[eewWebhook  — Cloud Function, ZATEN HAZIR]
            ▼
[sendEEWPushWithRetry → FCM/APNs → kullanıcı cihazları]
            ▼
[İstemci: kişisel avans süresi hesabı + geri sayım ekranı]
```

Mevcut `eewWebhook` endpoint'i bu zincirin son halkası olarak hazır bekliyor —
backend tarafında yeniden yazılacak çok az şey var. İş, sol taraftaki
gerçek-zamanlı algılama katmanında.

---

## 3. Feasibility kapıları — İNŞAYA BAŞLAMADAN doğrulanmalı

Bunlar geçilmeden kod yazmak para ve zaman çöplüğüdür.

| # | Kapı | Nasıl doğrulanır | Risk |
|---|---|---|---|
| **G1** | Düşük-gecikmeli gerçek-zamanlı SeedLink akışı erişilebilir mi? | Aday sunuculara (KOERI EIDA, GEOFON, ORFEUS) SeedLink istemcisiyle bağlan, gecikmeyi ölç | Public arşiv akışı 30-60 sn gecikebilir → EEW için yetersiz |
| **G2** | Türkiye fay hatlarına (KAF, DAF) yakın istasyonlar bu akışta var mı, yoğunluk yeterli mi | Akıştaki istasyon listesini fay haritasıyla karşılaştır | Seyrek kapsama → büyük kör bölge |
| **G3** | Gecikme yetersizse: KOERI/AFAD'dan düşük-gecikmeli feed talebi | Resmî başvuru | Kurum yanıtı kestirilemez |

> **Dürüst düzeltme:** Daha önce "AFAD anlaşması gerekmez" dedim. Veri *açık* —
> bu doğru. Ama *EEW'ye yetecek kadar düşük-gecikmeli* olup olmadığı ayrı bir
> sorudur. Public akış yeterince hızlıysa anlaşma gerekmez; değilse düşük-gecikmeli
> feed için kuruma başvuru gerekir. G1 bunu kesinleştirecek.

---

## 4. Yol haritası — dürüst takvim

| Faz | İş | Süre (dürüst aralık) | Kim |
|---|---|---|---|
| **0 — Feasibility** | G1/G2/G3 doğrula; SeedLink probu; istasyon/gecikme ölç | 1-2 hafta | Ben (probe script) + sen (kurum teması) |
| **1 — Altyapı + ingest** | GCP VM, SeisComP kurulum, akış ingest, olay algıla/konumla (henüz EEW değil) | 3-5 hafta | Ben (kod/config) + sen (VM provizyon, maliyet) |
| **2 — EEW modülleri** | VS + FinDer aç, istasyon binding, eşik kalibrasyonu | 3-5 hafta | Ben + sismoloji danışmanı (önerilir) |
| **3 — Zincir + istemci** | sceewlog → eewWebhook köprüsü; istemci geri-sayım UI | 2-4 hafta | Ben |
| **4 — Gölge-mod doğrulama** | Canlıya KAPALI çalıştır, gerçek depremlerde avans + yanlış-alarm ölç | 4-8 hafta (takvime bağlı) | Ben (analiz) + zaman |

**Toplam dürüst tahmin: güvenilir bir sisteme 4-6 ay.** Faz 4 sıkıştırılamaz —
bir EEW sistemine ancak haftalarca gerçek depremde gözlemledikten sonra
güvenilir denir. Yanlış-alarm veren bir EEW, dürüst bir bildirimden tehlikelidir.

---

## 5. Senin kararların (mühendislik değil, iş/altyapı)

1. **Sunucu maliyeti:** Daima-açık GCP VM ≈ **aylık $50-150** (kalıcı gider).
   SeisComP Cloud Run'da çalışmaz — gerçek, durumlu (stateful) bir VM gerekir.
2. **AGPL lisans onayı:** SeisComP/SED-EEW AGPL-3.0 — hukuki onay.
3. **Kurum teması:** G1 başarısız olursa KOERI/AFAD'a düşük-gecikmeli feed
   başvurusu. Paralelde Katman-3 (AFAD'ın resmî uyarısını dağıtmak) da
   görüşülebilir — en otoriter sonuç.
4. **Sismoloji danışmanı:** Faz 2/4 doğrulaması uzmanlık ister. Mühendisliği
   ben yaparım; sismolojik kalibrasyon/doğrulama için KOERI/AFAD'dan ya da
   bir üniversiteden biriyle görüşmek şiddetle önerilir.

---

## 6. Bu süre boyunca ne olacak

- **Backend AFAD fix ZATEN CANLI** (2026-05-21 deploy) — sunucu tarafı, app
  güncellemesi gerektirmez. Katalog-polling bildirimi şimdiden düzeldi.
- **Bildirim sistemi denetimi** paralel yürür (envanter çıkarıldı) — EEW ile
  aynı sürümde gider.
- **Dürüst UX:** Gerçek-zamanlı EEW yayına girene kadar uygulama içinde özellik
  "Deprem Bildirimi" olarak adlandırılmalı — "erken uyarı" yanlış güven verir.

---

## 7. Riskler — dürüst

- **G1 başarısızlığı:** Public feed yeterince hızlı değilse proje kurum
  başvurusuna bağımlı hale gelir (kestirilemez takvim).
- **Yanlış alarm:** Dünya standardı sistemlerin en zor problemi. Kalibrasyon +
  uzun gölge-mod şart.
- **Uzmanlık:** Bu iş normalde sismologlar tarafından yapılır. Mühendislik
  bizde; sismolojik doğrulama dış destek ister.
- **Sürdürülebilirlik:** Daima-açık sunucu = kalıcı gider + bakım yükü.

---

*Sonraki adım: Faz 0. Aday SeedLink sunucularına bağlanıp gecikme/istasyon
ölçen bir probe script'i yazılacak (Python + ObsPy) — feasibility kapısı G1.*

*EEW Gerçek-Zamanlı Plan · AfetNet · 2026-05-21*
