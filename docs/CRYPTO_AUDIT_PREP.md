# AfetNet Cryptography Audit — Hazirlik Dokumani

> **Sprint:** 24 — Bagimsiz crypto audit
> **Hedef:** AfetNet'in kriptografik altyapisi 3. parti uzmana denetlettir.
> **Tahmini Maliyet:** $8K-15K
> **Sure:** 3-6 hafta

---

## Kriptografi Surface Area

### 1. BLE Mesh Encryption

**Konum:** `src/core/services/mesh/MeshCryptoService.ts` (varsa) + `MeshNetworkService` encryption layer

**Mevcut Cozum:**
- Peer-to-peer DM mesajlar: ECDH (Curve25519) shared secret derivation → AES-GCM
- Broadcast (SOS, group): symmetric key (paylasilan oturum anahtari) — TASARIM GEREĞİ saglik amacli SİFRELENMEMİŞ olarak gonderilebilir

**Audit Hedefi:**
- ECDH implementation correctness
- Shared secret cache invalidation (logout sonrasi sızıntı)
- Replay attack korunmasi (nonce / counter)
- Forward secrecy (compromised peer pasif olarak eski mesajlari okur mu?)

### 2. Local Storage Encryption

**Konum:** `src/core/utils/storage.ts` (DirectStorage = MMKV)

**Mevcut Cozum:**
- MMKV encrypted constructor (32-byte AES-256 key)
- Encryption key SecureStore'da saklanir (iOS Keychain / Android Keystore)
- Key backup `keyRefMMKV` flag'i ile (SecureStore unavailable durumlarinda data loss onleme)

**Audit Hedefi:**
- Key derivation security (random + sufficient entropy)
- Key rotation
- Backup mekanizmasi (saldirgan keyRefMMKV uzerinden cikarabilir mi?)

### 3. Firebase Authentication

**Konum:** `src/core/services/AuthService.ts`

**Mevcut Cozum:**
- Apple Sign-In nonce (SHA-256 random)
- Google Sign-In OAuth flow
- Email + password (Firebase managed)
- ID Token 1 saat geçerli + auto-refresh

**Audit Hedefi:**
- Nonce generation entropy (Math.random vs crypto.getRandomValues)
- Token storage at-rest (MMKV encrypted ✓)
- Session hijack koruma

### 4. Network Transport

**Mevcut Cozum:**
- TLS 1.3 (Firebase + Cloud Functions)
- Certificate pinning (mevcut servis)
- HTTPS only (HTTP redirect kapali)

**Audit Hedefi:**
- Cert pinning bypass test (cert rotation prosedurleri)
- TLS downgrade attack koruma
- DNS poisoning karsi koruma

### 5. SOS Signal Integrity

**Konum:** `src/core/services/sos/SOSChannelRouter.ts` + Mesh imzalama

**Mevcut Cozum:**
- BLE broadcast packets imzali (Ed25519 — gerek varsa)
- Firestore yazimlari user UID auth ile guvende
- ACK responses Cloud Function ile dogrulanir

**Audit Hedefi:**
- Sahte SOS injection (BLE'den)
- ACK spoofing (kotu peer fake "delivered" ACK gonderir)

### 6. Health Data Encryption

**Konum:** `src/core/stores/healthProfileStore.ts`

**Mevcut Cozum:**
- KVKK Madde 6 opt-in (default cihazda)
- Firebase'e yedeklendiginde AES-256 at-rest (Firebase managed)
- Backend paylasildiginda HTTPS + Firebase Auth ID Token

**Audit Hedefi:**
- Veri minimizasyon kanitla
- Withdraw consent → server-side actual deletion
- Logs PII redaction (loglardan kullanici saglik bilgisi sızmasin)

---

## Test Vektorleri

### NIST Test Vectors
Audit ekibi standartlara uyumu dogrulayacak:
- AES-GCM: RFC 5288 test vectors
- ECDH: NIST SP 800-56A
- SHA-256: NIST FIPS 180-4

### Bilinen Saldiri Vektorleri
- BREACH / CRIME (TLS compression — kapali olmali)
- POODLE (SSLv3 — kapali)
- BEAST (TLS 1.0 — devre disi)
- Lucky Thirteen (TLS 1.2 mitigation)
- ROBOT (RSA PKCS#1 v1.5 padding)

## Audit Saglayicilari (Onerilen)

### Tier 1 — Premium ($20K+)
- **Trail of Bits** — Cosmic-tier crypto audit (Signal, Apple)
- **NCC Group** — Mobile + crypto expertise
- **Cure53** — Cure53 Apple Pay audit yaptı

### Tier 2 — Mid-tier ($8-15K)
- **Doyensec** — Mobile app specialty
- **Include Security** — RN expertise
- **ISG Cyber Security** (Turkiye) — yerel + ucuz

### Tier 3 — Akademik (~$0-3K)
- **ODTU CENG** — akademik partnership
- **Bogazici BUSEC** — akademik
- **TUBITAK BILGEM** — kamu

## Audit Sirasi

1. **Pre-audit hazirlik** (1 hafta)
   - Bu dokuman + kod tour
   - Threat model dogrulama
   - Test vector hazirligi

2. **Static audit** (1 hafta)
   - Code review ile crypto callsite mapping
   - Best-practice deviation tespiti
   - Bilinen vulnerable pattern arama (hardcoded keys, weak random)

3. **Dynamic audit** (2 hafta)
   - Frida ile runtime intercept
   - BLE packet sniffing (Wireshark + ASR-22)
   - Network MITM dogrulamasi

4. **Reporting** (1 hafta)
   - CVSS skorlu bulgular
   - Remediation plani
   - Validation re-test

## Beklenen Bulgular (Realistic)

### Kritik (CVSS 9-10)
- *Cok dusuk olasilik* — basic crypto best practices uygulu

### Yuksek (CVSS 7-8)
- Olasi: Broadcast SOS imzalanmamis → spoofable
- Olasi: Local storage backup `keyRefMMKV` flag ekstrakt edilebilir

### Orta (CVSS 4-6)
- Olasi: Cert pinning bypass yontemleri
- Olasi: BLE packet replay window

### Dusuk (CVSS 1-3)
- Olasi: TLS cipher suite onerileri
- Olasi: Token refresh window optimizasyonu

## Onlemi Almis Olduklarimiz

- [x] No hardcoded secrets in source code
- [x] Apple Sign-In nonce (SHA-256 random)
- [x] MMKV encrypted at-rest
- [x] TLS 1.3 only
- [x] Certificate pinning
- [x] PII redaction in logs (Sentry beforeSend)
- [x] KVKK Madde 6 acik riza
- [x] Account deletion + Apple revoke
- [x] Biometric app lock (opsiyonel)
- [x] Session timeout + background lock

---

**Hazirlayan:** AfetNet Elite Team — Sprint 24 prep
**Tarih:** 2026-05-11
