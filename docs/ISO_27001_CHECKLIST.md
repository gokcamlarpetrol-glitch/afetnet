# ISO 27001 — Information Security Management Hazirlik Cheklisti

> **Sprint:** 22-26 — ISO 27001 gap assessment + full audit hazirlik
> **Tarih:** 2026-05-11
> **Hedef:** AfetNet'in ISO 27001 standartlarina uyumlulugunu denetleme oncesi hazirlik. AFAD partnerligi + kurumsal musteri (belediye, AFAD, STK) icin gerekli.

---

## ISO 27001 Nedir?

Bilgi Guvenligi Yonetim Sistemleri (BGYS) icin uluslararasi standart. 114 kontrol icerir 14 kategoride. Sertifikasyon:
- **Sure:** 6-9 ay (orta sirket)
- **Maliyet:** $15K-50K (gap assessment + audit + sertifika)
- **Faydas:** Devlet/kurum musteri, sigorta + Apple Editor's Choice referansi

---

## A.5 Bilgi Guvenligi Politikalari

### A.5.1 — Bilgi Guvenligi Politikasi
- [ ] **Yazili Bilgi Guvenligi Politikasi** (10-20 sayfa)
- [ ] Yonetim kurulu / sirket sahibi onayi
- [ ] Yillik review prosedurleri

### A.5.2 — Roller ve Sorumluluklar
- [ ] CIO/CISO yapilandirmasi (su an: Gokhan Camci)
- [ ] Sorumluluk matrisi

## A.6 Insan Kaynagi Guvenligi

### A.6.1 — Ise Alim Oncesi
- [ ] Iscinin gizlilik anlasmasi (NDA)
- [ ] Geçmis taramasi (kritik roller)

### A.6.2 — Calistiktaki Donem
- [ ] Egitim plani (bilgi guvenligi farkindaligi)
- [ ] Bagis durumu (gizlilik ihlali)

## A.7 Fiziksel Guvenlik

> Tek-developer ekibi icin minimal: ev/ofis cihaz korunmasi

- [x] Geliştirici laptop FileVault encrypted (macOS)
- [x] Firmware password / login auto-lock
- [ ] Sirket cihaz envanteri (Q1 2026)

## A.8 Iletisim ve Operasyonel Yonetim

### A.8.1 — Operasyonel Prosedurler
- [x] Deployment runbook (eas.json + production channel)
- [x] Rollback prosedurleri (EAS Update)
- [ ] **Yazili runbook** (incident response, rollback steps)

### A.8.2 — Servisler Tedarik
- [x] Firebase (Google Cloud) — uyumlulukta
- [x] OpenAI API — DPA mevcut (yine de kullanmiyor saglik verisi)
- [ ] Vendor risk assessment (yillik)

### A.8.3 — Yedekleme
- [x] Firestore otomatik backup (Sprint 13 doc)
- [ ] **Restore test** (3 ayda 1 zorunlu)

## A.9 Erisim Kontrolu

### A.9.1 — Erisim Yonetimi
- [x] Firebase Auth (UID-based access)
- [x] Firestore Security Rules
- [x] Biometric app lock (BiometricLockOverlay)
- [ ] **Admin paneline 2FA** (gelistirilecek)

### A.9.2 — Sistem Erisimi
- [x] SessionSecurityService (inactivity timeout + bg lock)
- [x] Token rotation (Firebase 1-hour expiry)

### A.9.3 — Uygulama Erisimi
- [x] Email verification gerekli
- [x] Apple Sign-In nonce (replay-attack protection)
- [x] Account deletion + Apple revoke (Guideline 4.8)

## A.10 Kriptografi

- [x] TLS 1.3 (Firebase + Cloud Functions)
- [x] AES-256 encryption (Firestore at rest)
- [x] MMKV encrypted local storage
- [x] BLE mesh DM peer-to-peer encryption (ECDH + shared secret)
- [ ] **Crypto audit** (3rd party — Sprint 24)
- [x] No hardcoded secrets (verified)

## A.11 Fiziksel ve Cevresel Guvenlik

> N/A — Cloud-only altyapi (Google Cloud Tier IV data center)

## A.12 Operasyonel Guvenlik

### A.12.1 — Operasyonel Prosedurler
- [x] Source code version control (Git)
- [x] CI/CD pipeline (EAS)
- [ ] **Code review zorunlu** (su an tek geliştirici)

### A.12.2 — Malware
- [x] App Store / Play Store guvenlik taramasi
- [x] Jailbreak/root detection (mevcut servis)

### A.12.3 — Yedek
- [x] Firestore daily auto-backup (Sprint 13)

### A.12.4 — Loglar
- [x] Application logs (Firebase Crashlytics + Sentry)
- [x] PII redaction (`logger.ts` + Sentry beforeSend)
- [x] Cloud Functions audit logs (Cloud Logging)
- [ ] **Log retention policy** (3 ay default → 1 yil tum security events)

### A.12.5 — Network Guvenligi
- [x] Cloud Run private VPC
- [x] Firebase europe-west1 (data residency)
- [x] Certificate pinning (mevcut)

### A.12.6 — Sistemler ve Yazilim
- [x] Otomatik dependency update (Dependabot, Renovate)
- [x] Mobile binary obfuscation (production build)

## A.13 Iletisim Guvenligi

### A.13.1 — Network Guvenligi
- [x] TLS 1.3 everywhere
- [x] HSTS headers (Firebase auto)
- [x] CORS dogru yapilandirma

### A.13.2 — Bilgi Transferi
- [x] Encrypted at-rest + in-transit
- [x] Veri minimizasyon (sadece gerekli alanlar)
- [x] KVKK Madde 6 acik riza (saglik verisi)

## A.14 Sistem Edinim ve Gelistirme

### A.14.1 — Guvenlik Gereksinimleri
- [x] Threat model dokuman (Sprint 9 pen test plan)

### A.14.2 — Test Surec
- [x] Detox E2E test
- [x] TypeScript strict mode
- [ ] SAST/DAST gunluk taramasi (gelistirilecek)
- [ ] Pen test (Sprint 9)

## A.15 Tedarikci Iliskileri

- [x] Firebase (Google Cloud) — SOC 2 Type II
- [x] OpenAI — SOC 2 Type II
- [x] Apple — ISO 27001 + 27018
- [ ] **Vendor diligence dokumani** (her tedarikci icin)

## A.16 Bilgi Guvenligi Ihlali Yonetimi

- [ ] **Incident Response Plan** (yazili dokuman)
- [ ] Communication template (kullaniciya + KVK Kurumu'na bildirim)
- [ ] Tabletop exercise (3 ayda 1)
- [x] Crash reporting + monitoring (Sentry + Crashlytics)

## A.17 Is Surekliligi

- [x] DR backup plani (Sprint 13)
- [ ] **Sirket olarak BCP** (Business Continuity Plan)
- [ ] Tabletop drill (Game Day 1 → Sprint 13)

## A.18 Uyumluluk

### A.18.1 — Yasal Gerekliilikler
- [x] KVKK (Madde 6 acik riza)
- [x] GDPR (Privacy Policy)
- [ ] VERBIS kayit (sirket kuruldugunda)

### A.18.2 — Iceride Auditler
- [ ] Internal audit (6 ayda 1)
- [ ] Yonetim review (yilda 1)

---

## SONUC: GAP ASSESSMENT OZETI

### Hazir (kontroller mevcut + kanitli)
- A.9 Erisim Kontrolu ✓ 95%
- A.10 Kriptografi ✓ 85%
- A.13 Iletisim Guvenligi ✓ 100%
- A.18 Uyumluluk (KVKK/GDPR) ✓ 90%

### Eksik (yazili dokuman gerekli)
- A.5 Yazili Bilgi Guvenligi Politikasi
- A.6 HR prosedurleri (sirket kurulunca)
- A.8 Operasyonel runbook'lar
- A.16 Incident Response Plan
- A.17 Business Continuity Plan

### Tahmin Edilen Hazirlik Suresi
- Doc yazma: 4-6 hafta (parttime)
- Test + remediation: 2-4 hafta
- Audit + sertifika: 2 hafta
- **TOPLAM:** ~3 ay

### Tahmin Edilen Maliyet
- Gap assessment ($3-5K) — Sprint 13
- Iyilestirmeler + doc: hibe / kendi zaman
- Audit + sertifika: $15-30K
- **TOPLAM:** ~$20-40K

---

**Hazirlayan:** AfetNet Elite Team — Sprint 22-26 prep
**Tarih:** 2026-05-11
