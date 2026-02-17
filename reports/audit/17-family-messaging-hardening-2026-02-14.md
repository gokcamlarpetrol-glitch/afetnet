# Phase 17 - Family + Messaging Hardening

Date: 2026-02-14  
Scope: Family status broadcast resilience, map URL fallback safety, iOS share-sheet failure safety

## Objective

Reduce user-facing failures/crash-like flows in Family and Messaging screens under partial identity/network/runtime failures.

## Changes Applied

1. **Family status update no longer hard-fails when deviceId provider fails**
   - File: `src/core/screens/family/FamilyScreen.tsx`
   - Previous behavior:
     - If `getDeviceId()` failed, flow threw and status update aborted entirely.
   - New behavior:
     - Resolve sender route with fallback chain:
       - `bleMeshService.getMyDeviceId()`
       - `getDeviceIdFromLib()`
       - `identityService.getUid()`
       - `identity.uid/cloudUid/deviceId/id`
     - Abort only if all identity sources are missing.
   - Impact:
     - Status update can continue over cloud even when physical device ID is temporarily unavailable.

2. **Family status payload/path stability improved**
   - File: `src/core/screens/family/FamilyScreen.tsx`
   - `statusMessage.deviceId` now uses resolved sender route ID.
   - Mesh broadcast `from` now uses resolved sender route ID.
   - Firestore fan-out payload and document IDs now use resolved sender route ID.
   - Own-device `devices/{id}` write now guarded to avoid invalid/empty path usage.

3. **Unhandled URL fallback rejections prevented (Conversation + Family Group Chat)**
   - Files:
     - `src/core/screens/messages/ConversationScreen.tsx`
     - `src/core/screens/family/FamilyGroupChatScreen.tsx`
   - Added second-stage `.catch(...)` logging in map URL fallback chain.
   - Impact:
     - Prevents silent unhandled promise rejections when both primary and fallback URL open attempts fail.

4. **iOS share action-sheet async callback hardened**
   - File: `src/core/screens/family/FamilyScreen.tsx`
   - Wrapped async ActionSheet callback in `try/catch`; fallback copies share payload on failure.
   - Impact:
     - Prevents async callback failures from surfacing as unhandled runtime errors.

5. **Message options modal typing cleanup**
   - File: `src/core/screens/messages/ConversationScreen.tsx`
   - Removed loose `any` cast for message metadata in modal adapter (`isEdited/isDeleted`).
   - Impact:
     - Better type safety in a hot UI path.

## Verification

- `npm run -s typecheck` -> **PASS**
- `npm run -s test:critical` -> **PASS** (22/22)
- `npm run -s pre-submit` -> **PASS** (`Errors: 0`, `Warnings: 0`)
- `node scripts/user-scenario-tests.mjs` -> **PASS** (7/7)
- `RUN_JEST_ADVISORY=true node scripts/comprehensive-apple-user-test.mjs` -> **PASS** (`Failures: 0`, `Warnings: 0`)

## Result

Family/Messaging critical flows are now more tolerant to temporary identity-provider failures and external URL open failures, reducing crash-like behavior and improving life-critical usability continuity.
