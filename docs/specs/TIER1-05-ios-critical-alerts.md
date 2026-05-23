# TIER1 #5 — iOS Critical Alerts entitlement + backend interruption-level

> **Risk**: HAYATİ (Sessiz mod / Focus / DND'de EEW + SOS DUYULMAZ)
> **Effort**: L (Apple onayı 1-4 hafta paralel + 1-2 gün impl)
> **Faz**: v1.6.4 başvuru başlat → onay sonrası entitlement + payload deploy

## Root cause

`ios/AfetNetAcilletiim/AfetNetAcilletiim.entitlements` SADECE `aps-environment` + `applesignin`. `com.apple.developer.usernotifications.critical-alerts` YOK. Apple Developer Portal'da BAŞVURU yapılmamış.

`functions/src/utils.ts:385-387`:
```ts
const iosInterruptionLevel: 'active' | 'time-sensitive' = isEmergencyType ? 'time-sensitive' : 'active';
```
ASLA `'critical'` göndermiyor. `time-sensitive` Focus mode'u bypass eder ama hardware silent switch'i (mute) bypass ETMEZ. EEW alarmı sessiz telefonda DUYULMAZ.

## Apple başvuru süreci

**URL**: `https://developer.apple.com/contact/request/notifications-critical-alerts/`

Form fields:
- App name: AfetNet
- Bundle ID: `com.gokhancamci.afetnetapp`
- Team ID: Apple Developer → Membership
- Notification description: Section 1 (Application Summary) from existing `/docs/CRITICAL_ALERTS_APPLICATION.md` — 250 word limit
- Attachment: full PDF + 60-sec EEW countdown demo video

**Timeline**: 5-10 business days response. If info requested → reply within 3 days with prepared answers (Section 3.3 of CRITICAL_ALERTS_APPLICATION.md).

**Onay kriterleri**: Apple onayı için iki use-case approved:
- **EEW**: ShakeAlert precedent (USGS, California EEW), seismic warning explicit approved use-case
- **Family SOS**: Pre-authorized closed recipient set + explicit consent + life-threat event = medical monitoring precedent

**If denied**: Escalate via Apple DTS ticket citing ShakeAlert precedent + 2023 Kahramanmaraş death toll data + WWDC office hours (June).

## Entitlement file change (POST-APPROVAL ONLY)

`ios/AfetNetAcilletiim/AfetNetAcilletiim.entitlements`:
```xml
<key>com.apple.developer.usernotifications.critical-alerts</key>
<true/>
```

`app.config.ts:252` (ios.entitlements):
```ts
entitlements: {
  "aps-environment": "production",
  "com.apple.developer.usernotifications.critical-alerts": true,
}
```
NOT: `usesAppleSignIn: true` (line 187) zaten applesignin handle ediyor, duplicate yapma.

**ÖNEMLİ**: Apple onayından ÖNCE eklemek Xcode archive FAIL eder (profile mismatch). Önce onay, sonra entitlement, sonra provisioning profile regenerate.

## Provisioning profile regeneration

```bash
eas credentials --platform ios
# veya
eas build --platform ios --clear-credentials
```

EAS not, manual ise: Apple Developer Portal → Profiles → bulundu → sil → recreate (Critical Alerts capability auto-included after approval) → download + install.

Entitlement embedded.mobileprovision'a girer; iOS sadece profile'ı check eder (entitlements file'ı değil).

## Permission request — already correct

`NotificationPermissionHandler.ts:110-114` zaten `allowCriticalAlerts: true` geçiyor. iOS entitlement yokken bunu SİLENT IGNORE eder. Entitlement geldikten sonra aynı kod path Critical Alerts sub-prompt'unu gösterir. **Hiç değişiklik gerekmiyor.**

`isCriticalAlertsEnabled()` line 150 — Settings'te kullanıcı isteğe bağlı toggle UI ekle (post-onay).

## Backend payload change

`functions/src/utils.ts:385-387`:
```ts
const CRITICAL_PUSH_TYPES = new Set(['eew', 'sos', 'sos_family', 'family_sos']);
const iosInterruptionLevel: 'active' | 'time-sensitive' | 'critical' =
    CRITICAL_PUSH_TYPES.has(rawType)
        ? 'critical'
        : (rawType === 'sos_proximity' || rawType === 'nearby_sos')
            ? 'time-sensitive'
            : 'active';
```

Routing rationale:
- `eew`/`sos`/`sos_family`/`family_sos` → **`critical`** (hardware silent bypass — Apple onaylı 2 use-case)
- `sos_proximity`/`nearby_sos` → `time-sensitive` (önemli ama pre-confirmed family değil; critical kullanımı entitlement revoke riski)
- Diğer → `active`

## APNS headers (yeni)

`messaging.send()` çağrısında `apns.headers` ekle:
```ts
apns: {
  headers: {
    'apns-priority': '10',           // critical için zorunlu (5=low device'ı uyandırmaz)
    'apns-push-type': 'alert',       // iOS 13+ visible alert için zorunlu
    ...(safeData?.eventId ? { 'apns-collapse-id': String(safeData.eventId) } : {}),
    ...(rawType === 'eew' && safeData?.eewId ? { 'apns-collapse-id': `eew_${safeData.eewId}` } : {}),
  },
  payload: { aps, ...(safeData || {}) },
}
```

`apns-collapse-id`:
- EEW: `eew_{eewId}` — aftershock zincirinde lock screen'i 10x banner ile doldurmaz
- SOS: `sos_{signalId}` — aynı SOS session için tekrarlar collapse

## Notification Service Extension (opsiyonel, v1.7)

NSE = iOS app extension intercepts notifications before display. Use cases:
- E2EE message decrypt before display
- EEW/SOS locale-based body text
- Map thumbnail attachment

**Sadece Expo push token alanlar için gerekli** (Expo push interruption-level: critical göndermez). Native FCM token (getDevicePushTokenAsync) kullananlar için NSE şart değil. NSE eklemek için Xcode'da New Target → Notification Service Extension → `bestAttemptContent.interruptionLevel = .critical`.

## Per-environment toggle

Backend feature flag:
```bash
firebase functions:config:set eew.critical_enabled="true"
```
`utils.ts` `iosInterruptionLevel='critical'` set etmeden önce flag check. Apple abuse şikayeti gelirse sunucu-side rollback (`false` set) — client release gerek YOK.

## File-by-file changes

| File | Change | Timing |
|---|---|---|
| Apple Developer Portal | Critical Alerts başvuru form submit | NOW (paralel) |
| `ios/.../AfetNetAcilletiim.entitlements` | Add critical-alerts key | POST-APPROVAL only |
| `app.config.ts:252` | Add critical-alerts to ios.entitlements | POST-APPROVAL only |
| Provisioning profile | Regenerate via `eas credentials` | POST-APPROVAL only |
| `functions/src/utils.ts:385-387` | Expand union + CRITICAL_PUSH_TYPES + route | NOW (gated by `eew.critical_enabled` config flag — set false until approval) |
| `functions/src/utils.ts:430-444` | Add `apns.headers` block | NOW |
| `functions/src/sos.ts` + `eew.ts` | Verify `type: 'sos'/'eew'` in data payload | NOW (verify only) |

## Test plan

**Phase 1 (now, before approval)**:
- Log full permissions result in `NotificationPermissionHandler.ts:114`. `iosSettings.criticalAlert` should be `false` on devices without entitlement.
- Test `time-sensitive` end-to-end on real device with Focus Sleep: EEW + SOS should still break through.

**Phase 2 (post-approval)**:
- EAS credentials sync → new TestFlight build
- Real iPhone (not simulator): install
- Settings → Notifications → AfetNet → "Critical Alerts" toggle MUST appear
- Grant permission
- Hardware silent switch ON
- Trigger test EEW via `functions/src/eew.ts eewEmergencyTrigger` admin endpoint
- Expected: alarm sound at full volume despite silent switch

## Acceptance criteria

- Apple başvuru gönderildi (24 saatte teyit email)
- (Post-onay) Hardware silent ON + EEW push → audible alarm
- Focus Sleep mode + EEW push → audible alarm
- Settings → Notifications → AfetNet → "Critical Alerts" toggle visible
- `isCriticalAlertsEnabled()` true after user grants
- Backend logs `interruption-level: critical` for EEW + SOS; `time-sensitive` for proximity; `active` for diğer
- Message/news notifications NOT bypass DND (no regression)

## Risk + rollback

**Risk**: Apple denial probability low for genuine life-safety; mitigation: `time-sensitive` already covers Focus Sleep (most real scenarios). Critical adds only hardware mute bypass.
**Risk**: Entitlement abuse → Apple revoke. `CRITICAL_PUSH_TYPES` single choke point; add server-side invariant test.
**Risk**: Expo push tokens DON'T forward critical level → NSE needed for them OR use native FCM tokens.

**Rollback**: Backend `firebase functions:config:set eew.critical_enabled="false"` + redeploy → downgrade to time-sensitive WITHOUT client release. Client: remove entitlement keys + regenerate profile + new build.

---
**Full agent spec transcript**: `/private/tmp/.../tasks/a869c0bac746ee901.output`
