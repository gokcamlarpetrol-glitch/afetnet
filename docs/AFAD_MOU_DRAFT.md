# AFAD ile Mutabakat Memorandumu (MoU) — Taslak

> **Hazirlandi:** 2026-05-11
> **Sprint:** v2 Sprint 7
> **Hedef:** AfetNet ile T.C. AFAD (Afet ve Acil Durum Yonetimi Baskanligi)
> arasinda gonullu veri paylasimi ve teknik isbirligi mutabakati.
> **Dil:** Resmi belge Turkce. Bu taslak resmiyete yakin ama hukukcu reviewi ile sonuclanmalidir.

---

## 1. Taraflar

**Taraf A:** T.C. Cumhurbaskanligi Afet ve Acil Durum Yonetimi Baskanligi (AFAD)
Adres: Universiteler Mah., 1601. Cad. No:11, 06800 Cankaya / ANKARA
Iletisim: kanunlar@afad.gov.tr | +90 312 258 2300

**Taraf B:** AfetNet (gercek kisi: Gokhan Camci, T.C. ___________)
Adres: ___________
Iletisim: gokcamlarpetrol@gmail.com | +90 ___________

---

## 2. Amac

Bu mutabakatin amaci, T.C. Anayasasi'nin 56. ve 58. maddelerinin emrettigi can
guvenligi hakkini korumaya katki sunmak uzere AFAD'in resmi deprem verisini
asagidaki kapsamda AfetNet sivil mobil uygulamasi araciligi ile vatandaslara
ulastirmak ve karsiliginda AfetNet'in topladigi anonim toplumsal kullanim
istatistiklerini AFAD'a raporlamaktir.

## 3. AfetNet'in Mevcut Durumu (Beyan)

| Madde | Deger |
|---|---|
| Yayinlanma tarihi | 2026 Nisan |
| Platform | iOS App Store, Google Play Store |
| Indirme sayisi (taslak tarihinde) | <doldurun> |
| Aktif kullanici (gunluk) | <doldurun> |
| Cografi kapsam | T.C. siniri icindeki tum vatandaslar |
| Acik kaynak durumu | Hayir (sahibi: Gokhan Camci) |
| Yasal yapi | Sahsi |
| KVKK Madde 6 uyumlu | Evet — saglik verisi acik riza ile (Mayis 2026'dan itibaren) |
| Reklam icermesi | Hayir |
| Veri merkezi | Google Firebase europe-west1 (Belcika) |

## 4. AfetNet'in Sunmayi Taahhut Ettigi Hizmetler

### 4.1 Vatandasa
- AFAD'in deprem verisini iOS ve Android kanalindan **5-60 sn icinde** vatandasa erken uyari olarak ulastirmak.
- AFAD'in resmi toplanma alani verisini (ulasildiginda) harita uzerinde gostermek.
- Acil durum SOS sinyallerini, kullanicinin acik rizasi ile, kurtarma ekiplerine iletmek (BLE Mesh + cloud).
- Resmi AFAD duyurularini kullanicinin abone oldugu illerde gostermek.

### 4.2 AFAD'a (anonim, topluma yararli)
- **Crowdsourced deprem sinyali heatmap** — kullanicilarin cihazindaki ivmeolcer (P-dalga tespit) verisi anonim olarak (lat/lng `0.01` cozunurlukte) AFAD endpointine raporlanir.
- **Kurtarma koordinasyon istatigi** — SOS olaylarinin il/ilce dagilim raporu (kullanici kimligi yok).
- **Toplanma alani gercek-zamanli doluluk** — kullanicilarin AfetNet'te "buradayim" check-in raporu ile yogunluk haritasi (opt-in).
- Bu veriler AFAD'in cibanibi mevcut sistemini olusturmaz; ek bir gozlem katmani olarak sunulur.

## 5. AFAD'in Sunmayi Talep Edilen Hizmetler

### 5.1 Veri Paylasimi (mevcut kamu API'leri uzerinden)
- AFAD'in mevcut public earthquake API (`https://deprem.afad.gov.tr/...`) hizini koruma garantisi (rate limit yumusatma).
- AFAD'in toplanma alani CSV/JSON verisinin guncel olmasinin saglanmasi.
- AFAD duyuru RSS/JSON beslemesi (mevcut ise).

### 5.2 Teknik Isbirligi
- AFAD'in DEPREMAFAD WebSocket API'sine pilot erisim (gelistirici tokeni).
- AFAD-onayli mobil bildirim seslerinin (alarm) lisanslanmasi.
- AFAD logosunun "AfetNet AFAD verilerini kullanir" beyaninda kullanim izni.

### 5.3 Kurumsal Destek
- Apple ve Google'a yapilan **Critical Alerts** (DND bypass) yetki basvurularinda referans mektubu.
- AFAD'a ulasan AfetNet kullanicisi geri bildirimlerinin AfetNet'e iletilmesi.

## 6. Veri Mahremiyeti ve KVKK Uyumlulugu

### 6.1 AfetNet'ten AFAD'a Veri Akisi
- **Anonimlik:** Hicbir veride kullanici Firebase UID'si, telefon numarasi, isim, e-posta veya cihaz tanitisis bulunmaz.
- **K-anonymity:** Cografi veri en az `k=10` kullanici icin agrega edilmis sekilde gonderilir (bir kullaniciyi izole edebilecek granulariteden kacinilir).
- **Saklama:** AfetNet veriyi raporladiktan sonra silebilir/saklamayi durdurabilir; bu mutabakatin sona ermesi durumunda akis kesilir.
- **Hukumet talep yolu:** Sahsi kullanici verisi icin AFAD'in mahkeme karari/yasal talep yolu kullanilmasi gerekir.

### 6.2 AFAD'in Veri Sahipligi
- AFAD'in mevcut/yeni verisi T.C. mulkudur. AfetNet bu veriyi sadece kullanicilarina goruntulemek/iletmek icin kullanir; uzerinde IP/telif hakki iddia etmez.

## 7. Sure ve Fesih

- **Yururluk:** Imza tarihinden itibaren 2 (iki) yil.
- **Otomatik yenileme:** Taraflardan biri 60 gun once yazili bildirim yapmazsa yenilenir.
- **Fesih:** Herhangi bir tarafin 30 gun yazili bildirim ile feshetme hakki vardir.
- **Olaganustu fesih:** Yasal yukumluluk ihlali, KVKK kuralina aykiri davranis, ulkenin can guvenligini riske atan herhangi bir ihmal durumunda derhal fesh.

## 8. Yukumluluk Sinirlamasi

- AfetNet bir **sivil yardim** araclidir; resmi acil durum yanit sistemi degildir. AFAD'in resmi cevrimleri her zaman onceliklidir.
- AfetNet, AFAD verisinde bulabilecek hata, gecikme veya yanlislik nedeniyle olusan zararlardan AFAD'i sorumlu tutmaz.
- AFAD, AfetNet'in vatandaslara sundugu hizmetin kalitesinden sorumlu degildir.

## 9. Mali Hukumler

- Bu mutabakat **karsiliksiz** (donanm/lisans transferi yoktur).
- AfetNet'in kullandigi AFAD API'leri AFAD'in mevcut public hizmetidir; ucret talep edilmez.
- AfetNet, AFAD'a yapilan veri raporlamasini gonullu olarak ucretsiz sunar.

## 10. Iletisim ve Imza

**Imza tarafi A (AFAD):**
- Ad / Soyad: ___________________________
- Gorev: ___________________________
- Tarih: ___________________________
- Imza:

**Imza tarafi B (AfetNet / Gokhan Camci):**
- Ad / Soyad: Gokhan Camci
- T.C. Kimlik: ___________________________
- Tarih: ___________________________
- Imza:

---

## ADIM ADIM BASVURU PLANI (Gokhan Camci icin)

### Adim 1 — Hukukcu Review (~1 hafta, $500-1500 TL)
Bu taslagi bir afet hukuku/kamu hukuku konusunda deneyimli avukata gosterip:
- Sahsi yapi yerine `Limited Sirket` ya da `Dernek` kurmak gerekli mi? — Genelde **GEREKLI**
- KVKK Madde 8-9 (kamu kurumlari ile veri paylasimi) acisindan basvuru sablonu
- Sahsi sorumluluk sinirlamasi (LLC kurmadan once AFAD'a soz vermek riskli)

### Adim 2 — Kurumsal Yapi (sirket kur — onerilen: Limited Sti.)
- Ticaret Sicili kaydi (Ankara/Istanbul) — $50-200 TL harc
- Vergi numarasi
- Banka hesabi
- KVKK VERBİS kaydi

### Adim 3 — AFAD'a Basvuru Mektubu (resmi yazısma)
- AFAD Genel Yazi Isleri Daire Baskanligi'na yazili dilek
- Dilek ekinde: bu MoU taslagi + sirket evrak + kullanici sayilari
- Beklenen yanit suresi: **30-90 gun**

### Adim 4 — Yuz Yuze Toplanti (Ankara, AFAD merkez)
- Karsi taraftan deprem ve bildirim daireleri yetkilileri ile
- Demo: AfetNet uygulamasini canli gosterim
- AFAD'in oneriyi degerlendirme suresi

### Adim 5 — Imza
- Cumhurbaskanligi/AFAD Baskaninin onayi (statu degil prosedur)
- Resmi imza toreni
- Basın duyurusu

---

## RISKLER (BU MOU IMZALANMAZSA NE OLUR)

| Risk | Olasilik | Etki |
|---|---|---|
| MoU reddedilir | %30 | AfetNet AFAD verisini **mevcut public API**'ler uzerinden ucretsiz kullanmaya devam eder. Hicbir sey kaybolmaz. |
| AFAD cevap vermez | %50 | Sessizce devam edilir; basvuru 6 ay sonra hatirlanir. |
| AFAD karsi tarafi degisir | %10 | Yeni baskan ile yeniden gorulme |
| AfetNet'in pazarlama avantaji | YOK kabul edilirse | "AFAD'in resmi partneri" demek REDDEDILIR ama "AFAD verisinden derlenmistir" diyebiliriz |

## ASIL HEDEF

Bu MoU'nun AfetNet icin asil degeri **pazarlama + yasal koruma** degil — AFAD'in resmi destegi ile **Critical Alerts entitlement** ve **App Store Editor's Choice** basvurularinda ek kanit toplamaktir.

MoU olmadan da AfetNet halen calismalidir.

---

**Hazirlayan:** AfetNet Elite Team — Sprint 7
**Tarih:** 2026-05-11
