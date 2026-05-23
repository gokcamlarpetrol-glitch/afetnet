# TIER1 #6 — Background FCM handler (data-only push delivery)

> **Risk**: HAYATİ (killed app data-only push sessizce düşer → SOS unutulur)
> **Effort**: M (2-3 days + EAS rebuild + device test)
> **Faz**: v1.6.4 Hafta 1

## Root cause

`index.ts:83-85` notes: `@react-native-firebase/messaging` NOT INSTALLED. App killed → FCM data-only push silently dropped:

- **iOS**: APNs delivers, but expo-notifications does NOT register Notification Service Extension. Data-only push (no `notification` key, `content-available:1` only) → iOS best-effort wake-up, throttled/suppressed silently.
- **Android**: FCM delivers high-priority data-only as wake-up, but requires registered `FirebaseMessagingService`. expo-notifications has one for DISPLAY notifications, not data-only headless processing.

Current backend (`functions/src/sos.ts:127-142`) sends Expo push WITH `notification` block → banner shows even on killed app. BUT: if user doesn't tap, app never processes the SOS data → no SOS screen on relaunch, no mesh rebroadcast.

`@react-native-firebase/messaging.setBackgroundMessageHandler()` runs HEADLESS JS — only reliable way for data-only on killed Android.

## Installation plan

```bash
cd /Users/gokhancamci/AfetNet1
npx expo install @react-native-firebase/messaging
```
- `@react-native-firebase/app@^23.8.5` already installed (peer satisfied)
- License: Apache-2.0 (ticari OK)
- After install: `npx expo prebuild --clean` (regenerate native with new config plugin)

EAS Build: `useFrameworks: "static"` (app.config.ts:155) compatible. APNs capability already enabled.

## iOS setup

Config plugin auto-injects `FirebaseApp.configure()` in AppDelegate.
APNs auth key required in Firebase Console (Project Settings → Cloud Messaging → iOS).
GoogleService-Info.plist already at `ios/AfetNetAcilletiim/` ✓

NSE (Notification Service Extension) — defer to follow-up sprint. Background handler in main target is sufficient for SOS data processing guarantee.

## Android setup

Config plugin auto-adds `FirebaseMessagingService` to AndroidManifest.xml:
```xml
<service android:name="io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService" android:exported="false">
  <intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT"/></intent-filter>
</service>
```
`google-services.json` already at `android/app/` ✓

## JS background handler

`index.ts` — MUST be before `registerRootComponent`, at module top level:

```typescript
try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage: {
    data?: Record<string, string>;
    notification?: { title?: string; body?: string };
    messageId?: string;
  }) => {
    const data = remoteMessage?.data ?? {};
    const type = (data.type ?? '').toLowerCase();
    const messageId = remoteMessage.messageId ?? data.signalId ?? '';

    if (['sos','sos_family','family_sos','sos_proximity'].includes(type)) {
      const { scheduleNotificationAsync } = require('expo-notifications');
      await scheduleNotificationAsync({
        content: {
          title: `SOS: ${data.senderName ?? data.from ?? 'Bilinmeyen'}`,
          body: data.message ?? 'Acil yardım gerekiyor!',
          data: { type, signalId: data.signalId ?? messageId, ...data },
          sound: 'emergency-alert.wav',
          priority: 'max',
        },
        trigger: null,
      }).catch(() => {});
    } else if (['eew','earthquake'].includes(type)) {
      // schedule EEW local notif
    }
    // chat/message/family/news: no action (display notification yeterli)
  });
} catch { /* messaging unavailable — graceful skip */ }
```

## Routing matrix

| `data.type` | Action |
|---|---|
| `sos`, `sos_family`, `family_sos`, `sos_proximity`, `nearby_sos` | Schedule local notif IMMEDIATE, emergency-alert.wav, priority:max |
| `eew`, `earthquake` | Schedule EEW notif with magnitude+location |
| `message`, `chat`, `family`, `news` | No action (display notif sufficient, user tap → app handles) |

Conservative: headless context can't write Firestore (no auth), can't mutate React stores. ONLY safe action = schedule local notification.

## Payload contract

`functions/src/utils.ts` (NEW type + helper):
```typescript
export interface AfetNetFCMDataPayload {
  type: 'sos'|'sos_family'|'family_sos'|'eew'|'earthquake'|'message'|'family'|'news'|...;
  signalId?: string; senderName?: string; from?: string; senderUid?: string;
  message?: string; latitude?: string; longitude?: string;
  magnitude?: string; location?: string; depth?: string;
  timestamp?: string; trapped?: string;
}
export function buildFcmDataPayload(type, fields): Record<string,string>;
```

## File-by-file changes

| File | Change |
|---|---|
| `index.ts` (after line 46, before line 88) | Add `setBackgroundMessageHandler` block (try-catch wrapped) |
| `package.json` | Auto-modify: `@react-native-firebase/messaging` added |
| `app.config.ts` plugins array | Add `["@react-native-firebase/messaging", { ios: { backgroundFetch: true } }]` |
| `functions/src/utils.ts` | Add `AfetNetFCMDataPayload` type + `buildFcmDataPayload` helper |
| `android/app/src/main/AndroidManifest.xml` | Auto-modify (prebuild): FirebaseMessagingService entry |
| `ios/AfetNetAcilletiim/AppDelegate.swift` | Auto-modify (prebuild): FirebaseApp.configure() |

## Test plan

Physical device + Firebase Admin SDK script:
1. Build via EAS (`eas build --profile development`)
2. Get native FCM token from device logs (`Native device token retrieved:`)
3. Open app, kill via app switcher
4. Run admin script sending data-only `{type:'sos_family', message:..., signalId:...}`
5. **iOS**: lock screen SOS banner + `emergency-alert.wav` within 5s
6. **Android**: same, with Doze mode test (device active)
7. Don't tap; wait 30s; open app manually → verify background handler log
8. Edge: airplane mode + restore; token rotation; rapid multiple SOSes

## Acceptance criteria

- Data-only push on killed iOS → local notif visible
- Data-only push on killed Android → local notif visible (even with Doze)
- App opens → background handler log present
- Display push WITH `notification` block still works via expo path (no regression)
- No crash on simulator (try/catch handles missing messaging module)

## Risk + rollback

**Risk**: EAS rebuild mandatory — new TestFlight submission cycle. OTA can't deploy native changes. Static frameworks (`useFrameworks: "static"`) + Firebase pods historically picky; monitor CocoaPods install for duplicate symbol warnings. Triple notification path (foreground expo, killed-app FCM bg, tap-from-killed) — test all three.

**Rollback**: Remove `setBackgroundMessageHandler` block from index.ts (try/catch means removing is safe). Remove plugin from app.config.ts. `npx expo prebuild --clean`. `eas build`. Optionally `npm uninstall @react-native-firebase/messaging`. Does NOT break `@react-native-firebase/app` or other Firebase features.

---
**Full agent spec transcript**: `/private/tmp/.../tasks/af106334c3d84946c.output`
