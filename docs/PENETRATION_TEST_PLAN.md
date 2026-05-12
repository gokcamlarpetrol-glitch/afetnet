# Penetration Test Plan — AfetNet

> **Sprint:** v2 Sprint 9 — Penetration test + Bug bounty HackerOne private launch
> **Tarih:** 2026-05-11
> **Hedef:** AfetNet'i resmi olarak penetrasyon testine sok. SOS/EEW/Auth bypass riskleri kabul edilemez.

---

## Test Kapsami (Scope)

### IN SCOPE (test edilmesi zorunlu)

1. **Mobile App Binary (iOS + Android)**
   - Static analysis (decompile + secret extraction)
   - Runtime analysis (Frida + Objection)
   - Jailbreak/root tespit bypass
   - Certificate pinning bypass
   - Local storage encryption gucu

2. **Firebase Backend**
   - Firestore security rules: tum koleksiyonlar
   - Cloud Functions: input validation, auth check
   - Storage: signed URL replay, public bucket isareti
   - Auth: token replay, password reset abuse

3. **BLE Mesh Network**
   - Packet sniffing (Wireshark + nRF Connect)
   - Packet injection (sahte SOS)
   - Replay attack (eski paket tekrar yayin)
   - Identity spoofing (peer ID hijacking)
   - DoS (advertisement flooding)

4. **Critical Flows**
   - SOS abuse: sahte SOS spam
   - EEW abuse: sahte deprem uyarisi
   - Family stalking: rizasiz uye ekleme
   - Account takeover: password reset, email change
   - Data exfiltration: Firestore rules bypass

### OUT OF SCOPE

- Third party services (Firebase backend, OpenAI, AFAD API)
- Network layer (TLS, DNS — Cloudflare/Google ile yonetilir)
- Physical device security (jailbroken cihazda detection sirasi)

## Test Yontemleri

### 1. Static Analysis

**Tool:** MobSF (Mobile Security Framework), JADX (Android decompiler)

**Iteration:**
1. iOS .ipa + Android .apk decompile
2. Hardcoded secret tara (API key, Firebase config, signing key)
3. SAST: code-level vulnerability scan
4. **Beklenen sonuc:** Sıfır hardcoded secret. Firebase config public OK (security rules ile korunur).

### 2. Runtime Analysis (Dynamic)

**Tool:** Frida, Objection, Burp Suite

**Iteration:**
1. App'i Frida ile hook'la
2. SOS broadcast kanal'i runtime'da intercept et — packet content gor
3. Auth token degeri local storage'tan oku — şifreli mi?
4. **Beklenen sonuc:** Token kullanici-scoped MMKV encryption ile şifreli. SOS payload BLE'de imzali.

### 3. Firebase Rules Penetration

**Tool:** Custom test script (Firebase emulator'a yaz)

**Senaryo:**
- Test user A oluştur
- User B ile login yap → User A'nin Firestore path'lerine yazmaya cails
- Tum koleksiyonlar tek tek dene: users/, conversations/, sos_alerts/, family/, feedback/

**Beklenen sonuc:**
- TUM yazmalar `permission-denied` dondurmeli
- Sadece kendi UID'sine yazma izni olmali

### 4. BLE Mesh Penetration

**Tool:** nRF Connect (mobil), Ubertooth (advanced)

**Senaryo:**
- Test cihaz 1 olarak Android, AfetNet calistir
- Test cihaz 2 olarak nRF Connect calistir
- AfetNet'in BLE GATT servisini tara (service UUID)
- Sahte SOS paketi yayinla
- AfetNet diger kullanicilarinin telefonunda alarmi tetikler mi?

**Beklenen sonuc:**
- Sahte paket reddedilmeli (signature dogrulamasi)
- Reddedilmezse: **CRITICAL** — fix gerekli

### 5. Apple/Google Play Privacy Manifest

**Tool:** Manuel review

**Senaryo:**
- App Store Privacy Manifest'i (iOS 17+) dogru deklare edilmis mi?
- Google Play Data Safety form: gercek veri akisi ile uyumlu mu?

## Test Sirasi (Pilot)

| Faz | Sure | Hedef |
|---|---|---|
| Faz 1 — Static + obvious bug | 3 gun | %80 surface area kapsanir |
| Faz 2 — Runtime + Firebase | 5 gun | Auth + Firestore + Cloud Functions |
| Faz 3 — BLE + crypto | 4 gun | Mesh protokol guvenligi |
| Faz 4 — Critical flow exploit | 3 gun | SOS abuse + EEW abuse senaryolari |
| **TOPLAM** | **15 gun** | |

## Pen Test Saglayicilari (Maliyet karsilastirma)

### Akademik Partner (Onerilen — Cheaper + Real-world)
- **ODTU Bilgisayar Muhendisligi** veya **Bogazici BUSEC**
- Maliyet: **$0** (akademik partnership) - bazan **$500-2000** (rapor + sertifika icin)
- Sure: 1-2 ay (ogrenci tezi gibi)
- Avantaj: AfetNet hayat-guvenligi misyonu ile akademik ilgi cekebilir
- **Iletisim:** ODTU CENG fakulte + Bogazici CMP fakulte

### Profesyonel Firma (Hizli + Pahali)
- **PRODAFT, NetEye, Biznet** (Turkce)
- **HackerOne, Bugcrowd, Synack** (Uluslararasi)
- Maliyet: $3,000 - $15,000
- Sure: 2-3 hafta
- Avantaj: Hizli rapor + AppSec sertifikasi
- ONERIM: AfetNet henuz Series A onceki — akademik partnership ile basla

### Bug Bounty Program (Surekli)
- **HackerOne Private** — Davet uzerine 5-15 hacker
- Bounty maliyeti: $50-500 / bug (severity'e gore)
- Toplam tahmini: $1,000-5,000 ilk yıl
- **AVANTAJ:** Surekli koruma (sadece bir-kez degil)

## Rapor Beklentisi

Pen test sonrasi olusacak rapor icermeli:
1. **Executive Summary** — Ust seviye bulgular
2. **CVSS Skorlu Bulgular** — her bulguya kritiklik
3. **Reproduksiyon Adimlari** — gelistirici nasil tetikleyecek?
4. **Remediation Plani** — ne sırayla fix
5. **Validation** — fix sonrasi yeniden test

## Sonuc Aksiyonu

- **Critical bug** bulunursa: 7 gun icinde fix + emergency App Store update
- **High** bulunursa: 30 gun icinde fix
- **Medium/Low** bulunursa: Sonraki release dahil et

## Tahmini Maliyet

| Adım | Maliyet | Süre |
|---|---|---|
| Akademik pen test | $500-2000 | 1-2 ay |
| Profesyonel pen test | $3000-15000 | 2-3 hafta |
| HackerOne Private | $1000-5000/yıl | Sürekli |
| **MINIMUM ÖNERILEN BÜTÇE** | **$5000-8000** | İlk yıl |

---

**Hazirlayan:** AfetNet Elite Team — Sprint 9 plan
**Tarih:** 2026-05-11
