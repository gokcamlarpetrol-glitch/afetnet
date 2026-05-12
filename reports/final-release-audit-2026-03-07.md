# Final Release Audit - 2026-03-07

## Scope

Submission-oncesi son teknik kontrol turu.

- Apple review red maddeleri
- onboarding / permission / terms / login akislari
- online/offline mesajlasma
- online/offline SOS
- bildirim routing
- aile bildirimleri
- deprem / EEW bildirimleri
- veri kaliciligi
- Firebase release config
- iOS release derleme kapilari

## Fixed In This Pass

### Notification and routing

- `FirebaseService` family push varyantlari artik dogru `family` notification akisina map ediliyor.
- `FirebaseService` `sos_family`, `family_sos`, `sos_proximity`, `nearby_sos` varyantlarini dogru `sos_received` akisina map ediyor.
- `FirebaseService` `news` payload icinde `articleId`, `newsUrl`, `imageUrl` alanlarini koruyor.
- `NotificationCenter` haber payload tiplerini genisletiyor ve tap routing'i daha deterministik navigation cozumlemesiyle yapiyor.
- Mesaj bildirimi, grup bildirimi, SOS bildirimi, aile lokasyon bildirimi, deprem/EEW bildirimi ve haber bildirimi icin tap routing test altina alindi.

### Messaging persistence and receipts

- `messageStore` acilis aninda MMKV'den bootstrap oluyor.
- Background/inactive ve shutdown sirasinda mesajlar ve conversation listesi flush ediliyor.
- Mesaj bildirimleri global rate-limit'e takilip kaybolmuyor; `messageId` bazli dedupe korumasi var.
- `sent / delivered / read` durumlari Firestore `readBy` / `deliveredTo` ile uyumlu sekilde yukari tasiniyor.
- Offline direct message, hedef peer gercekte gorunmeden yanlis basarili sayilmiyor.
- Offline direct message max retry sonrasinda yanlis `failed` durumuna dusmuyor; kuyrukta kaliyip retry ediyor.

### Earthquake detail cold-start fix

- `EarthquakeDetail` navigation param tipine `id` eklendi.
- `EarthquakeDetailScreen` artik sadece `eventId` ile acilan bildirim akisini destekliyor.
- Screen once mevcut deprem store icinde eslesme ariyor, sonra AFAD detail fetch'i sadece anlamliysa deniyor.
- `eventId` kaynakli bos ekran icin deterministic loading / error fallback eklendi.

## Files Touched In This Final Pass

- `src/core/services/FirebaseService.ts`
- `src/core/services/notifications/NotificationCenter.ts`
- `src/core/screens/earthquakes/EarthquakeDetailScreen.tsx`
- `src/core/types/navigation.ts`
- `src/core/services/__tests__/FirebaseServiceNotificationMapping.test.ts`
- `src/core/services/__tests__/NotificationCenterTapRouting.test.ts`

## Verification Results

### Passed

- `npm test -- --runInBand src/core/services/__tests__/NotificationCenterTapRouting.test.ts src/core/services/__tests__/FirebaseServiceNotificationMapping.test.ts`
- `npm run -s typecheck`
- `npm run -s lint`
- `npm run -s validate:production`
- `npm run -s pre-submit`
- `npm run -s verify:release-firebase`
- `node fetch_logs.js`

### Production validation summary

- `Errors: 0`
- `Warnings: 0`

### Firebase sanity

- Recent window icinde Firestore / Cloud Functions tarafinda kritik messaging/family/push hatasi gorunmedi.

## iOS Build Note

Kod disi iki yerel ortam notu goruldu:

1. Signing profile eksigi
   - `No profiles for 'com.gokhancamci.afetnetapp' were found`
   - Bu yerel Xcode signing/provisioning ortami ile ilgilidir.

2. Local Xcode platform/runtime problemi
   - `SplashScreen.storyboard: error: iOS 26.0 Platform Not Installed`
   - Ardindan `Expo.modulemap` / `ExpoModulesCore.modulemap` not found zinciri geldi.
   - Bu hata app source mantigindan degil, mevcut makinedeki Xcode platform/runtime kurulumundan kaynaklaniyor.

Bu nedenle son iOS CLI build sonucu bu makinede ortam engeline takildi. Kod seviyesi kapilar temizdir.

## Submission Readiness

Kod, test, lint, production validation ve Firebase release config tarafinda submission blocker gorunmuyor.

Fiziksel cihazda ayrica son kez kontrol edilmesi gereken alanlar:

- online SOS
- offline SOS
- online message
- offline message
- locked-screen push delivery
- push tap -> correct screen
- family location update


## Live TestFlight follow-up - 2026-03-07
- Fixed direct DM send fallback so an already-open conversation can still send through V3 even if recipient UID re-resolution fails temporarily.
- Propagated `conversationId` through direct text/media send paths to prevent pending-clock stalls tied to alias/UID drift.
- Hardened family member location merging so fresher `locations_current` updates are not overwritten by stale family metadata.
- Preserved remote location freshness timestamps in family store updates.
- Hardened SOS sender identity resolution to wait briefly for authenticated UID before falling back to device ID, preventing Firestore SOS rule mismatches on auth-restore races.
- Verification: `npm run -s typecheck`, `npm run -s lint`, targeted messaging/SOS tests, `npm run -s validate:production`, `npm run -s pre-submit`.

## Cold-start / session / messaging hardening - 2026-03-07
- Added `src/core/utils/authSessionCache.ts` to centralize cached auth UID/session reads and explicit sign-out tracking.
- Hardened `authStore` so a cold-start transient/null Firebase auth emission no longer clears local session data or cached auth unless logout is explicit.
- Preserved cached authenticated state after restore grace expiry to stop kill/reopen flows from dropping the user back to onboarding / EULA / login.
- Added cached-UID fallback to user-scoped stores and services that could previously open under `guest` scope during cold start:
  - `src/core/stores/messageStore.ts`
  - `src/core/stores/familyStore.ts`
  - `src/core/stores/contactStore.ts`
  - `src/core/stores/healthProfileStore.ts`
  - `src/core/services/ContactService.ts`
  - `src/core/services/FirebaseDataService.ts`
- Result: persisted messages/conversations/family/contact data now resolve against the last authenticated UID even before Firebase Auth finishes restoring.
- Added tests:
  - `src/core/stores/__tests__/onboardingAuthPersistence.test.ts`
  - `src/core/stores/__tests__/messageStoreBootstrap.test.ts`
- Verification:
  - `npm run -s typecheck`
  - `npm test -- --runInBand src/core/stores/__tests__/onboardingAuthPersistence.test.ts src/core/stores/__tests__/messageStoreBootstrap.test.ts src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/HybridMessageDeliveryMatrix.test.ts src/core/services/__tests__/SOSChannelRouter.test.ts`
  - `npm run -s lint`
  - `npm run -s validate:production`
  - `npm run -s pre-submit`
