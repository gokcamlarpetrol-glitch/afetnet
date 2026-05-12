# AfetNet Production End-to-End Audit - 2026-05-12

## Scope

First-pass audit only. No application code was changed.

Covered:
- Expo / React Native app startup, navigation, permissions, release config.
- Firebase Auth, Firestore rules, Storage rules, Cloud Functions.
- Family, messaging, SOS, EEW, AI proxy, map/location, settings, notifications.
- CI/CD, deployment scripts, package health, production validation gates.

Used audit lens:
- Release readiness
- Backend/API/Firebase rules
- Privacy/security
- Mobile runtime and native build risk
- QA verification gates

## Verification Run

Passed:
- `npm run typecheck`
- `npm run lint`
- `npm --prefix functions run build`
- `npm run validate:production`
- `npm run verify:release-firebase`
- `npm run healthcheck`
- `npm run test:critical`
- `npm test -- --watchman=false --runInBand --silent`
- `npm test -- --watchman=false --runInBand --silent --detectOpenHandles`

Results:
- Full Jest: 32 suites / 217 tests passed.
- Critical Jest: 11 suites / 53 tests passed.
- Production validator: 0 errors, 1 warning.
- Expo Doctor: 14/17 checks passed, 3 checks failed.

Not run:
- Detox iOS/Android simulator tests.
- Real-device two-account family/messaging/SOS tests.
- EAS cloud build.
- Live Firebase deploy or production data mutation tests.

## P0 Findings

### P0-1: Firestore family relationship can be self-granted, exposing live location/status

Evidence:
- `sharesFamilyWith(targetUid)` grants family access if either `users/{me}/familyMembers/{target}` or `users/{target}/familyMembers/{me}` exists: `firestore.rules:54-61`.
- Any authenticated user can create their own `users/{me}/familyMembers/{otherUid}` document: `firestore.rules:619-626`.
- `locations_current/{userId}` read is allowed to `sharesFamilyWith(userId)`: `firestore.rules:755-758`.
- Client subscribes to every member's `locations_current/{uid}` without checking `approvalState`: `src/core/stores/familyStore.ts:416-424`.
- Add-member flow sets `approvalState: 'pending'`, but still calls `addMember()` immediately: `src/core/screens/family/AddFamilyMemberScreen.tsx:488-496`.
- `addMember()` immediately starts location/status subscriptions: `src/core/stores/familyStore.ts:832-839`.

Impact:
- If User A can discover User B's UID, User A can create `users/A/familyMembers/B` and read `locations_current/B`.
- This bypasses the intended mutual approval/contact request flow.
- This is a live-location privacy issue and a likely KVKK/GDPR blocker.

Minimum fix:
- Make family relationship server-authoritative.
- Do not allow client-created `users/{uid}/familyMembers/*` to grant read access.
- Require an accepted contact request or Cloud Function transaction before creating relationship docs.
- Change `sharesFamilyWith()` to require a server-written accepted relationship, or require both sides with `status == 'accepted'`.
- Gate client location/status subscription on `approvalState === 'mutual'`.

Verification:
- Add Firestore rules emulator tests:
  - User A creates `users/A/familyMembers/B`.
  - Assert User A cannot read `locations_current/B`.
  - Accept request through server function.
  - Assert read becomes allowed only after accepted relationship exists.

## P1 Findings

### P1-1: Storage rules are configured for a different bucket than the app uses

Evidence:
- App/native Firebase config uses `afetnet-4a6b6.firebasestorage.app`.
- `src/lib/firebase.ts:127-133` and `src/core/config/firebase.ts:127-140` hardcode the same bucket.
- Parsed `android/app/google-services.json` and `ios/AfetNetAcilletiim/GoogleService-Info.plist` both report `afetnet-4a6b6.firebasestorage.app`.
- `firebase.json:25-29` deploys `storage.rules` only to `afetnet-4a6b6.appspot.com`.

Impact:
- Profile images, chat media, group-chat voice/image, SOS media, and offline map objects may be governed by stale/default rules or fail with permission errors.
- Previous audit already fixed group-chat Storage rules, but those rules may not be deployed to the bucket the app actually uses.

Minimum fix:
- Confirm actual default bucket in Firebase Console / `firebase storage:buckets:list`.
- Update `firebase.json` to deploy Storage rules to `afetnet-4a6b6.firebasestorage.app`, or deploy to both buckets if both exist.
- Re-run upload tests for `profiles`, `chat`, `group-chat`, `voice`, `sos`, and `maps`.

Verification:
- `firebase deploy --only storage`
- Upload/read/delete test for every Storage path under an authenticated test user.

### P1-2: Android target SDK is below current Google Play update requirement

Evidence:
- `app.config.ts:151-152` sets `targetSdkVersion: 34`.
- `android/gradle.properties:67-68` sets `android.targetSdkVersion=34`.
- Expo public config confirms `targetSdkVersion: 34`.
- Android Developers states that starting August 31, 2025, new apps and updates must target Android 15 / API 35 or higher: https://developer.android.com/google/play/requirements/target-sdk

Impact:
- As of 2026-05-12, Android production updates may be blocked in Google Play Console.
- Emergency app permissions that are sensitive on Android 15 should be retested after target bump.

Minimum fix:
- Move Android target SDK to 35.
- Run Android 15 regression focused on background location, foreground services, Bluetooth scan/connect/advertise, notifications, exact alarm behavior, and app startup.
- Produce an EAS Android production build and Play internal test rollout before public release.

### P1-3: Native folders are present, so app.config changes may not sync automatically

Evidence:
- Repo contains `ios/` and `android/`.
- `npx expo-doctor` failed: app config fields may not be synced in a non-CNG project.
- The affected fields include `scheme`, `orientation`, `icon`, `splash`, `plugins`, `ios`, and `android`.

Impact:
- Editing `app.config.ts` can give a false sense of safety; native permission strings, background modes, target SDK, splash/icon, plugins, and entitlements may remain stale in native projects.

Minimum fix:
- Choose source of truth:
  - Bare/native: edit `ios/` and `android/` directly and treat `app.config.ts` as build metadata only.
  - CNG/prebuild: regenerate native projects intentionally and review native diff.
- Add CI check comparing Expo config with native manifests for permissions, target SDK, bundle/package IDs, and background modes.

### P1-4: Backend deployment workflow is stale and does not deploy the actual Firebase backend

Evidence:
- `.github/workflows/deploy-backend.yml:8-33` watches and builds `server/**`.
- No `server/` directory is present.
- Current backend is under `functions/src`.
- `firebase.json:6-19` defines Firebase Functions predeploy, but GitHub workflow does not deploy it.
- `.github/DEPLOYMENT.md:3-12` still documents Render.com / `server/` as backend.

Impact:
- Backend fixes can pass locally but never reach production unless manually deployed.
- Live app behavior can remain stale even after merging backend patches.

Minimum fix:
- Replace Render/server workflow with Firebase Functions deploy workflow.
- Gate deploy on `npm --prefix functions ci`, `npm --prefix functions run build`, rules tests, and explicit environment.
- Keep manual approval for production deploy.

## P2 Findings

### P2-1: Expo SDK package versions are slightly out of sync

Evidence:
- `npx expo-doctor` failed dependency validation.
- Major mismatch: `@types/jest` expected `29.5.14`, found `30.0.0`.
- Patch mismatches: `expo`, `expo-asset`, `expo-crypto`, `expo-file-system`, `expo-image-picker`, `expo-notifications`, `expo-video`, `expo-web-browser`, `jest-expo`.
- Relevant versions are in `package.json:72-112` and `package.json:161-179`.

Impact:
- Usually not a direct runtime blocker, but Expo native modules can fail subtly around notifications, file system, crypto, image picker, video, and web browser.

Minimum fix:
- Run `npx expo install --check`.
- Update in one controlled dependency patch PR.
- Re-run native builds and notification/media flows.

### P2-2: New Architecture dependency risk is present

Evidence:
- `android/gradle.properties:38` enables New Architecture.
- `npx expo-doctor` reports:
  - Untested on New Architecture: `react-native-fs`, `react-native-tcp-socket`, `react-native-webrtc`.
  - Unmaintained: `react-native-fs`, `react-native-quick-sqlite`.
  - No metadata: `afetnet-ble-peripheral`.
- Dependencies are declared in `package.json:124-145`.

Impact:
- Voice call, TCP/mesh, file/offline-map, and SQLite flows are high-risk on release devices.

Minimum fix:
- Real-device smoke test every native module path.
- Decide whether to keep New Architecture on for this release.
- If keeping it, add device-lab regression for voice call, BLE mesh, offline maps, media attachment, and background tasks.

### P2-3: Cloud Functions package includes React Native / Expo dependencies and generated native folders

Evidence:
- `functions/package.json:23-25` depends on `expo`, `react`, and `react-native`.
- `functions/android` and `functions/ios` exist even though this is Firebase Functions.
- `firebase.json:11-16` ignores only `node_modules`, `.git`, and Firebase logs for Functions deploy.

Impact:
- Deploy installs unnecessary mobile dependencies.
- Functions package is harder to reason about and slower to deploy.
- Accidental native files inside backend folder increase maintenance noise.

Minimum fix:
- Remove `expo`, `react`, and `react-native` from `functions/package.json` unless a backend source file imports them.
- Remove or ignore `functions/android` and `functions/ios`.
- Add a CI guard: Functions source must not contain native mobile folders.

### P2-4: EEW backend still uses one HTTP source

Evidence:
- `functions/src/utils.ts:92-95` uses HTTPS for AFAD/USGS/EMSC but HTTP for Kandilli.
- Client-side Kandilli providers already use HTTPS variants.

Impact:
- Server-side earthquake source can be MITM'd or intermittently blocked on stricter networks.

Minimum fix:
- Switch Functions Kandilli source to HTTPS.
- Keep fallback source diversity and source verification before user-facing alerts.

### P2-5: Production validator warning: beta/placeholder copy remains

Evidence:
- `npm run validate:production` warning points to `src/core/components/EEWCountdownAlert.tsx`.
- The UI renders `ERKEN UYARI (BETA)` at `src/core/components/EEWCountdownAlert.tsx:185`.
- `src/core/stores/riskStore.ts:153-157` includes "yakinda eklenecek" placeholder text.

Impact:
- Store review or user trust issue for a live emergency app.

Minimum fix:
- Replace beta/coming-soon copy with accurate capability wording.
- If a feature is not fully available, hide it or label its limitation explicitly without marketing promises.

## Flow Assessment

### Auth / Onboarding
- Auth startup has substantial hardening around cached sessions, storage readiness, and fallback login.
- Tests pass around onboarding/auth persistence.
- Remaining risk is mostly native Google/Apple sign-in real-device validation, not TypeScript/runtime unit coverage.

### Messaging
- V3 conversation messaging has server-side inbox sync and push dedupe.
- Tests cover message store, hybrid delivery, notification tap routing, and group sender UID compatibility.
- Remaining risk: two-device cloud+mesh reconciliation under weak network needs real-device validation.

### Family / Location
- Core P0 is relationship authorization. UI intends pending/mutual approval, but Firestore rules grant read from self-created mapping.
- This should be fixed before any further feature polish.

### SOS
- SOS routing has good retry/dedupe logic and tests.
- Privacy and medical data exposure still depends on correct family relationship enforcement.
- Real locked-screen push, notification tap, and background delivery still need device validation.

### EEW / Earthquake
- Multi-source client/backend architecture exists.
- Server polling/build compiles.
- Risks: target SDK/background behavior, one HTTP backend source, and beta copy.

### AI
- Client uses backend proxy first and avoids direct bundled OpenAI key.
- Proxy has auth and per-UID rate limiting.
- Remaining risk: verify deployed Function environment has `OPENAI_API_KEY` and watch cost/rate-limit logs.

### CI / Release
- App gates are good locally.
- Backend deploy automation is stale.
- Expo Doctor currently fails, so release gates should include it or explicitly document accepted exceptions.

## Recommended Fix Order

1. Fix P0 Firestore family authorization and add emulator rules tests.
2. Fix Storage bucket deploy target and validate media uploads against the real bucket.
3. Upgrade Android target SDK to 35 and run Android 15 device regression.
4. Resolve non-CNG native config drift by choosing a single source of truth.
5. Replace stale Render/server deploy workflow with Firebase Functions deploy workflow.
6. Run Expo dependency patch alignment.
7. Clean Functions package/native-folder contamination.
8. Run two-device manual matrix: auth restore, family approval, live location, direct DM, group chat, media, SOS, push tap, EEW alert.

## Release Gate

Do not ship a new production build until P0-1 and P1-1 are fixed and verified. If Android distribution matters, P1-2 is also a release blocker.
