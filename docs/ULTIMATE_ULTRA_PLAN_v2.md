# AfetNet — ULTIMATE ULTRA PLAN v2

> **Kaynak:** 48 elite uzman + Team Lead final review + 5 perspektifli iç münazara (CTO + Staff Engineer + CISO + Head of QA + CPO).
> **Onay:** CTO ✓ · CDO ✓ · CISO ✓ (3 koşullu).
> **Hedef:** Kahramanmaraş ölçeği depremde hayat kurtaran, dünya standardında uygulama.
> **Süre:** 53 hafta (1 yıl + 1 hafta buffer).
> **Mod:** Tek-dev (gokhancamci) + 2 freelance (backend + QA) + designer one-time + avukat retainer.

---

## ⚡ HOT-FİX — BU GECE (8 saat)

**Neden gece?** KVKK Madde 6 ihlali yayında — 1-2M TL ceza riski + Apple/Play yayından kaldırma riski.

1. **`healthProfileStore.ts`** — `cloudSyncConsent` + `backendShareConsent` opt-in flag'leri (default `false`). Açık rıza olmadan Firebase ve `BackendEmergencyService`'e gönderim DURDURULUR.
2. **`privacy-policy.html`** — "hiçbir sağlık verisi yüklemez" yanıltıcı cümle düzelt. Mesh broadcast şifreleme durumu netleştir. KVKK Madde 6 bölümü ekle.
3. **`AssemblyPointMarkers.tsx`** — "AFAD Onaylı" → "AFAD Listesi" (yanıltıcı pazarlama).

---

## 📅 SPRINT PLAN (53 Hafta)

### SPRINT 1A — Hafta 1 (5 iş günü)
- Apple Sign-In nonce + Apple guideline 4.8
- VERBİS kayıt başvuru + aydınlatma metni
- Sentry + Crashlytics GERÇEK kurulum + Source Maps upload
- ASO update (Türkiye + Suriyeli AR keyword research + 6 screenshot rebuild)
- Apple Critical Alerts entitlement başvuru (4-12 hafta paralel onay)
- GitHub Actions CI/CD baseline (tsc/eslint/jest + Detox gate)
- Detox E2E top 5 happy path (SOS, EEW, Login, Mesaj online, Mesaj offline)
- Firestore emulator + staging Cloud Run
- TS strict baseline (yeni dosyalar %100, mevcut kademeli)
- Lisans audit + LGPL risk assessment

### SPRINT 1B — Hafta 2-3 (10 iş günü)
- **EEW Countdown UI overlay** (`EEWCountdownAlert.tsx` YENİ — App.tsx global mount)
- `earthquake_alarm.wav` Türkçe profesyonel ses + EEW countdown sayım
- EEW BETA flag ("Erken Uyarı (Beta)")
- SOS app-kill survival — `meshPowerManager.enableEmergencyMode()` `activateSOSInternal()` sonuna
- SOS 6/6 fail UI banner — `SOSFailureBanner` global component
- Onboarding 9 → 3 slayt + sesli yönlendirme
- `AccountDeletionService` E2E doğrulama (19 adım Firestore residue)
- `AIEarthquakePredictionService` → `EarthquakeRiskAnalysisService` rebrand
- "Magnitude" → "yerel sarsıntı şiddeti tahmini" UI (4 servis)
- HealthProfile KVKK consent **tam modal** (Hot-fix flag'lerinin üzerine UI)
- WCAG AA baseline yeni ekranlarda

### SPRINT 1C — Hafta 4 — STABİLİZASYON
- Canary deploy 1% → 10% → 50% → 100% (11 gün, her tier crash-free <%99.95 = rollback)
- Regression hot-fix buffer
- Sentry alarm threshold tuning

### SPRINT 2 — Hafta 5-6 (Auth + Brand)
- `EmailAuthService.login()` unverified signOut bug (logout döngüsü root cause)
- `ensureCachedAuthGuard` race fix
- `delayedReAuthTimers` cleanup
- `AuthSessionCleanupService` MeshStore + Biometric ekleme
- `SessionSecurityService.initialize()` (servis var, devrede değil)
- `BiometricAuthService` LoginScreen entegrasyonu
- Push permission re-prompt (24h sonra)
- Clock skew banner (±5dk)
- In-app feedback widget
- EAS Update kanal politikası
- **Brand rework**: Amber #E57C13 + App icon Seismik-A redesign
- Apple Sign-In tam akış (sign in + revocation)

### SPRINT 3 — Hafta 7-8 (EEW — mesh'e bağlı değil)
- PhaseNet on-device model (TFLite)
- PLUM + Wu-Kanamori algoritma
- Multi-source failover (AFAD + USGS + EMSC + crowdsource)
- EEW Reanimated 3 motion design
- EEW false-positive <0.1% hedef
- **CarPlay sesli EEW alert** (Sprint 22 → 3'e erken — sürüş anında deprem hayat-kritik)

### SPRINT 4 — Hafta 9-10 (Mesajlaşma + Aile)
- Family deep link viral loop (`afetnet://add?uid=X`)
- HybridMessageService split P1 (`OutboxQueue`, `RetryStrategy`)
- Family `statusUpdatedAt` UI gösterimi + 24h stale warning
- FamilyScreen FlatList migration (.map → FlatList)
- Offline message queue ROOT CAUSE (Firestore RN cache yok)
- Mid-conversation crash recovery
- `markAsDelivered`/`markAsRead` race fix
- `SOSStateManager.recoverIncompleteSOS()`
- Family tek-taraflı ekleme → karşılıklı onay (KVKK + stalking riski)

### SPRINT 5 — Hafta 11-14 (4 hafta — KRİTİK!)
- Custom Signal-X3DH + Double Ratchet (tweetnacl + @noble/curves + @noble/hashes — BSD/MIT, AGPL DEĞİL)
- Mesh paket `originLang` tag (multilingual support)
- `afetnet-protocol` README + RFC stub (open source protocol spec)
- E2EE feature flag (1% kullanıcıyla başla)
- Privacy Policy "mesh artık E2EE" update
- Mesh-encryption boundary %95 test coverage
- Safety number verification UI
- Encryption interface (Sprint 18'de Matrix Olm swap mümkün)

### SPRINT 6 — Hafta 15-16 (Critical Alerts onayı geldiyse)
- Apple Critical Alerts entitlement aktive (`aps.sound.critical: 1`)
- Android Notification Channel "Hayat-Güvenliği" max priority + bypassDnd
- EEW notification ses + Critical Alert birleştir
- Notification permission re-prompt iyileştirme

### SPRINT 7 — Hafta 17-18 (Backend + AFAD MOU)
- Cloud Functions v2 migration (selected — SOS coordinator min instances)
- Firestore composite index audit
- AFAD MOU başvuru + hukukçu review ($500-1500 one-time)
- Freelance PR partner ($800-1500/ay)
- AFAD'a anonim aggregate SOS heatmap proposal

### SPRINT 8 — Hafta 19-20 (iPad responsive)
- iPad layout (5 ana ekran)
- Stage Manager test
- Multi-window split view

### SPRINT 9 — Hafta 21-22 (AR RTL + Penetration test)
- AR RTL layout (logical properties `marginStart`/`marginEnd`)
- AR Noto Sans Arabic font
- 4M+ Suriyeli kullanıcı için tam UI
- **Penetration test** (ODTÜ/Boğaziçi akademik partner — $0 akademik, $3-8K profesyonel)
- **Bug bounty HackerOne private launch** (scope: SOS/EEW/Auth bypass = max bounty)

### SPRINT 10-12 — Hafta 23-28 (TS strict tamamla + cleanup)
- HybridMessageService 3375 → 6 modül (P2 split tamamla)
- MeshNetworkService 3072 → 5 modül
- init.ts 1453 → 400 satır + ServiceRegistry
- AuthSession monolith (5 source of truth → 1)
- Zod schema Firestore boundary
- TS strict tüm proje (~%85 hedef)
- Test coverage kritik path %95, genel %55
- Documentation Docusaurus

### SPRINT 13 — Hafta 29-30 (QA + Game Day 1)
- Detox E2E 30 senaryo
- Yük testi (1M kullanıcı simülasyon)
- DR backup restore test
- Game Day 1: simüle Kahramanmaraş senaryosu
- ISO 27001 gap assessment ($3-5K)

### SPRINT 14-15 — Hafta 31-34 (Premium launch + Marketing)
- Premium subscription model (App Store IAP + Play Billing)
- **EEW + SOS + 5 aile = sonsuza dek FREE** (yazılı söz Privacy Policy'de)
- Premium: aile slot 5→25, geo-fence yaklaşım uyarısı, yıllık deprem raporu, AFAD ek katmanlar
- Marketing aktivasyon + PR launch

### SPRINT 16-17 — Hafta 35-38 (Mesh hierarchy v2)
- Backbone Peer + Leaf hiyerarşi (battery-aware backbone election)
- Geographic routing (greedy forwarding lat/lng)
- Reputation score (delivered ACK / received)
- Adaptive TTL (SOS=15, Family=8, General=4)

### SPRINT 18-19 — Hafta 39-42 (Multi-device + libsignal eval)
- Multi-device "primary device" konsept (SOS başlatma yetkisi)
- Encrypted cloud backup (kullanıcı PIN → Argon2id derive key)
- Matrix Olm/Megolm değerlendirme — libsignal swap kararı

### SPRINT 20-21 — Hafta 43-46 (Apple Watch + WearOS)
- watchOS companion (SOS + EEW countdown)
- WearOS companion

### SPRINT 22-26 — Hafta 47-53 (Polish + Yıl 2 hazırlık)
- CarPlay tam + Android Auto
- Sprint 24-26: bağımsız crypto audit ($8-15K), ISO 27001 full audit
- Yıl 1 retrospective + Yıl 2 plan

---

## 🎯 "SIFIR HATA" — 7 OPERATIONAL TANIM

1. Crash-free rate ≥%99.95 (24h rolling)
2. SOS delivery success ≥%99.5 (en az 1 kanal)
3. EEW false-positive <%0.1
4. KVKK %100 compliant
5. Auth logout-loop %0
6. Bug bounty kritik bulgu = 24 saat fix
7. Apple/Play rating ≥4.5/5

→ 7'sinin tümü yeşilse "Sıfır Hata" status. İhlal → otomatik rollback.

---

## 🛡️ RİSK REGISTER (Top 20)

| # | Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|---|
| 1 | App Store/Play KVKK yayından kaldırma | Orta | Kritik | **BU GECE hot-fix** |
| 2 | AFAD/Kandilli API breaking change | Düşük | Orta | Multi-source failover Sprint 3 |
| 3 | KVKK 2.0 regülasyon değişimi | Düşük | Yüksek | Hukukçu retainer |
| 4 | iOS/Android major version breaking | Yüksek | Orta | Beta SDK 6 ay önce test |
| 5 | Firebase/GCP fiyat artışı | Orta | Düşük-Orta | Composite index audit, Supabase fallback |
| 6 | Tek-dev burnout | Yüksek | Kritik | Haftada 1 mecburi kapalı, freelance leverage |
| 7 | Negatif PR (gerçek depremde hata) | Orta | Kritik | Crisis comm plan, "BETA" işaretler |
| 8 | Yanlış SOS yasal | Düşük | Orta | EULA + 5sn pre-alert + biometric confirm |
| 9 | AFAD MOU başarısızlık | Yüksek | Düşük | Bağımsız büyü, MOU bonus |
| 10 | Custom crypto güvenlik açığı | Orta | Kritik | Bağımsız audit Yıl 2 Q1 ($8-15K) |
| 11 | Mesh broadcast spam/abuse | Düşük | Orta | Rate limit + rep system |
| 12 | Firebase Auth UID poisoning | Düşük | Yüksek | Firestore rules audit + App Check |
| 13 | Mesh E2EE yanlış key (MITM) | Orta | Kritik | X3DH prekey rotation 30 gün + safety number UI |
| 14 | Hayriye (55) personası kullanamaz | Yüksek | Yüksek | Onboarding 3 slayt + sesli yönlendirme |
| 15 | EEW false-positive ≥0.5% | Orta | Yüksek | Multi-source consensus, BETA flag |
| 16 | iOS BLE peripheral background limit | Yüksek | Yüksek | Background task 10dk tick + state preservation |
| 17 | App Store Connect ele geçirme | Düşük | Kritik | 2FA + recovery code 1Password |
| 18 | tweetnacl/noble vulnerabilities | Düşük | Yüksek | Dependabot + weekly npm audit |
| 19 | Premium "hayat-güvenliği paywall" yanlış algı | Orta | Yüksek | EEW + SOS sonsuza dek FREE yazılı |
| 20 | Yıl 1 sonu para tükenmesi | Yüksek | Kritik | Premium Sprint 14, AFAD sponsor Yıl 1 Q3 |

---

## 💰 BÜTÇE

| Kalem | Aylık |
|---|---|
| gokhancamci zamanı | Opportunity cost |
| Freelance backend | $2000 |
| Freelance QA | $1200 |
| Firebase | $50-400 (büyüdükçe) |
| Sentry | $0-26 |
| Cloud Run | $30-100 |
| Cloudflare Workers | $5 |
| Apple + Google fees | $10 |
| Designer (one-time S7) | $1400 |
| Avukat retainer | $500 |
| Pen test (akademik) | $0 |
| **Toplam aylık** | **$3500-5500** |

---

## 🌟 3 YIL VİZYON (Tek Cümle)

> **AfetNet, dünya standardında bağımsız crypto-audit'li, AFAD ile veri-paylaşım MOU'lu, 4 dilde (TR/AR/EN/KU) çalışan, ISO 27001 sertifikalı, Apple Watch + CarPlay destekli, %99.99 crash-free, 10M+ aktif kullanıcılı, Türkiye ve civar bölgenin tek hayat-güvenliği işletim sistemidir.**

---

**Son güncelleme:** 2026-05-11
**Sürüm:** v2.0 (Team Lead Synthesized)
**Onay:** 3/3 C-suite koşullu evet (CTO + CDO + CISO)
