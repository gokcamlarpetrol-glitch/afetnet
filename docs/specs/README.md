# Tier 1 Implementation Specs — v1.6.4 Ship-Blocker Sprint

Bu dizin, **ULTRA PLAN v1.7 FAZ 1** kapsamında düzeltilecek 10 ship-blocker bug için detaylı implementation spec'leri içerir. 5 elite `feature-dev:code-architect` agent paralel (read-only) review ile üretildi.

## Spec listesi

| # | Bug | Risk | Effort | Spec |
|---|---|---|---|---|
| 1 | E2EE label change | Hukuki (KVKK Madde 4 + tüketici) | S (1 gün) | ✅ **YAPILDI** (commit 834675e) |
| 2 | Cross-account state isolation | Hukuki KRİTİK (KVKK 4/6) | M (3 gün) | ✅ **YAPILDI** (commit 6901b4b) |
| 3 | KVKK PII pending invite | Hukuki KRİTİK (KVKK 7/8) | M (3-4 gün) | ✅ **YAPILDI** phase 1 (commit 386b862) |
| 4 | Swift killed-app SOS restoration | Hayati | L (3-5 gün) | ✅ **YAPILDI** (commit dffc27d) |
| 5 | iOS Critical Alerts entitlement | Hayati | L (Apple onayı 1-4 hafta + 1-2 gün) | ✅ **YAPILDI** phase 1 backend (commit e6cde63) |
| 6 | Background FCM handler | Hayati | M (2-3 gün + EAS rebuild) | ✅ **YAPILDI** (commit 265a604) |
| 7 | EULA bypass via ErrorBoundary | Hukuki (Apple 1.2/5.1.1 + KVKK 7) | M (2 gün) | ✅ **YAPILDI** (commit ff19e1f) |
| 8 | Account deletion v3 family | Hukuki (KVKK 7 right to forget) | L (3-4 gün + backfill) | ✅ **YAPILDI** (commit 13bebb0) |
| 9 | Firestore rate-limit DEAD rule | KVKK orantılılık + DoS | S (1 gün, deploy onay) | ✅ **YAPILDI** (commit 834675e) |
| 10 | NearbySOSListener DEAD CODE | Maintenance hijyen | S (sil) veya L (refactor) | ✅ **YAPILDI** (commit 115c40e — Option A: delete + 50km port) |

**+ Bonus düzeltmeler bu sprint'te yapıldı (commit 834675e)**:
- #14 EEW on-device countdown KALDIR (frekansa dayalı yalancı fizik)
- #18 trapped flag erase fix (SOSAlertListener conditional set)
- #19 Multi-source EEW consensus bucket 0.01° → 0.1°

## Sprint planı — v1.6.4 (TÜMÜ KOD HAZIR — DEPLOY + DEVICE TEST AŞAMASI)

### Hafta 1 — Privacy & Compliance — ✅ KOD HAZIR
1. ✅ **TIER1-02** Cross-account isolation (AuthLifecycle bus) — `6901b4b`
2. ✅ **TIER1-03** KVKK PII pending invite phase 1 (opaque code CF) — `386b862` — *deploy + client phase 2 sonraki sprint*
3. ✅ **TIER1-07** EULA bypass fix — `ff19e1f`
4. ✅ **TIER1-06** Background FCM handler — `265a604` — *EAS rebuild gerek*
5. ⏸ **TIER1-05** Apple başvuru — *USER ACTION: developer.apple.com/contact/request/notifications-critical-alerts*

### Hafta 2 — Native + Receive Path — ✅ KOD HAZIR
6. ✅ **TIER1-04** Swift state restoration — `dffc27d` — *EAS rebuild + 2 cihaz test*
7. ✅ **TIER1-08** Account deletion v3 CF — `13bebb0` — *firebase deploy gerek*
8. ✅ **TIER1-10** NearbySOSListener delete — `115c40e`
9. ⏸ v1.6.4 EAS build + TestFlight beta cohort — *USER ACTION*
10. ⏸ App Store submit — *USER ACTION (gözlem temiz ise)*

### Kalan kullanıcı aksiyonları
- `firebase deploy --only functions:onUserDeletedCleanup,functions:createContactInvite,functions:acceptContactRequest`
- `firebase deploy --only firestore:rules,firestore:indexes`
- (Phase 2, Apple onayı sonrası) `firebase functions:config:set eew.critical_enabled=true` + iOS entitlement
- `npx expo prebuild --clean` (TIER1-06 + TIER1-04 native değişiklikleri için)
- `eas build --profile production --platform ios`
- TestFlight 10-100 tester gözlem 1 hafta
- 2 fiziksel cihaz BLE mesh + killed-app test (TIER1-04)

## Toplam effort

**~14-20 saat solo dev × 10 madde = ~140-200 saat sprint = 2-3 hafta full-time**

(Apple Critical Alerts onayı paralel; gerçek effort 2 hafta dev + 1-4 hafta Apple bekleyiş.)

## Her spec'in yapısı

Her TIER1-XX.md dosyası şu bölümleri içerir:
1. **Root cause** — bug'ın gerçek sebebi (file:line + neden)
2. **Proposed architecture** — fix'in genel yaklaşımı + neden
3. **File-by-file changes** — her dosya için tam değişiklik
4. **Migration / Backward compatibility** — eski clients/data nasıl ele alınır
5. **Acceptance criteria** — bittiğini nasıl anlarız (test scenarios)
6. **Risk + rollback** — ne yanlış gidebilir + nasıl geri alınır
7. **Test plan** — jest unit + manual device

**Tam agent transcript path'leri** her spec'in altında listelendi (`/private/tmp/.../tasks/<agent-id>.output`) — daha derin detay/code snippet için.

## ULTRA PLAN bağlantısı

Bu spec'ler `/docs/ULTRA-PLAN-v1.7-ELITE.md` Faz 1'in concrete implementation karşılığıdır. ULTRA PLAN 12 mimari temayı (T1-T12) gösterir; bu spec'ler T2 (cross-account), T3 (E2EE), T4 (KVKK/rules), T5 (Native iOS BLE), T7 (Notifications), T8 (Account deletion KVKK) temalarının ship-blocker subset'i.

Faz 2 (4-6 hafta, v1.7) ve Faz 3 (8-12 hafta, v2.0) için spec'ler sonraki sprint'lerde üretilir.

---

**Belge versiyonu:** 1.0
**Yazım tarihi:** 2026-05-23 (oturum sonu)
**Spec dispatch:** 4× feature-dev:code-architect (read-only, paralel)
**Toplam spec satır sayısı:** ~1500 satır condensed (full transcripts ~25000 satır)
