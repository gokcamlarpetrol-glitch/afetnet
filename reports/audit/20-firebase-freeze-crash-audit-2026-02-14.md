# Firebase + Freeze/Crash Audit (2026-02-14)

## Scope
- Firebase reliability paths: Firestore, Storage, Realtime listeners, initialization and shutdown.
- Freeze/crash risk scan for timers, subscriptions, duplicate listeners and lifecycle leaks.
- Focused on high-impact life-critical flows: family, messaging, group chat media, SOS side effects.

## Critical Findings
1. Storage rules/path mismatch blocked group media uploads.
- Runtime path used by group chat: `group-chat/{groupId}/{ownerUid}/{file}`.
- `storage.rules` had no matching allow rule, causing upload failures for voice/image in family group chat.

2. Timeout helpers leaked timers in high-frequency Firebase operations.
- `withTimeout()` helpers used `Promise.race` without clearing timeout on success.
- Under heavy messaging/location/family traffic this accumulates delayed timers and increases memory/CPU pressure.

3. FirebaseDataService initialization had race and listener-retention risks.
- Multiple concurrent `initialize()` calls were not deduplicated despite `_initPromise` field existing.
- Auth wait path attached an `onAuthStateChanged` listener that was not always unsubscribed on timeout.

4. Shutdown lifecycle left some long-running services active.
- Multi-source EEW callback subscriptions were not tracked/unsubscribed.
- `multiSourceEEWService`, `realTimeEEWConnection`, `backgroundSeismicMonitor`, `hybridMessageService`, `groupChatService` were not fully cleaned up in `shutdownApp`.

## Implemented Fixes
### Storage rules
- Added explicit group chat media rule:
  - `match /group-chat/{groupId}/{userId}/{allPaths=**}`
  - Authenticated read.
  - Owner-only write/delete (`request.auth.uid == userId`) with size and content-type guards.

### Timeout leak hardening
- Updated timeout wrappers to always clear timers in `finally`:
  - `src/core/services/firebase/FirebaseMessageOperations.ts`
  - `src/core/services/firebase/FirebaseFamilyOperations.ts`
  - `src/core/services/firebase/FirebaseLocationOperations.ts`
  - `src/core/services/firebase/FirebaseDeviceOperations.ts`

### FirebaseDataService init hardening
- Enabled true init dedup using `_initPromise` to prevent concurrent init races.
- Auth readiness wait now guarantees cleanup of timeout + auth listener for both success and timeout branches.

### Startup/shutdown lifecycle hardening
- Added tracked unsubscribe handles for Multi-Source EEW event registrations.
- Added `realTimeEEWConnection` module-level reference and explicit stop on shutdown.
- Added missing shutdown stops/cleanup:
  - `multiSourceEEWService.stop()`
  - `backgroundSeismicMonitor.stop()`
  - `realTimeEEWConnection.stop()`
  - `hybridMessageService.destroy()`
  - `groupChatService.destroy()`
- Added unsubscribe cleanup for multi-source event hooks in shutdown.

### Init wait safety
- Added max wait guard in `NotificationService.initialize()` when concurrent init is in progress.

## Validation Results
- `npm run -s typecheck` PASS
- `npm run -s lint` PASS
- `npm run -s test:critical` PASS (22/22)
- `npm run -s pre-submit` PASS
- `node scripts/user-scenario-tests.mjs` PASS (7/7)
- `RUN_JEST_ADVISORY=true node scripts/comprehensive-apple-user-test.mjs` PASS
- `npm test -- --watchman=false --runInBand --silent` PASS (21 suites, 163 tests)
- `npm test -- --watchman=false --runInBand --detectOpenHandles --silent` PASS

## Residual Risks / Next Phase
- Real device two-device validation is still required for final confidence in:
  - Group media transfer latency under weak network.
  - Simultaneous cloud+mesh delivery reconciliation.
  - Background behavior under iOS app suspension constraints.
- Rules deploy must accompany app release so `group-chat/*` permissions are active in production.
