# Phase 15 - Cleanup + Hardening Pass

Date: 2026-02-14  
Scope: Family add-member identity hygiene, family group chat maintainability, alias-routing type safety

## Summary

This pass focused on two priorities:

1. Reduce maintainability risk in a large critical screen (`FamilyGroupChatScreen`).
2. Tighten identity normalization in add-member and alias-routing paths to prevent edge-case regressions.

## Changes Applied

1. **Family group chat style extraction**
   - Files:
     - `src/core/screens/family/FamilyGroupChatScreen.tsx`
     - `src/core/screens/family/FamilyGroupChatScreen.styles.ts` (new)
   - Change:
     - Moved inline screen styles to dedicated style module.
     - Removed local `StyleSheet.create` block from screen logic file.
   - Impact:
     - Better separation of concerns and lower cognitive load in core group-chat logic.
     - Reduced primary screen file size from `1459` to `1286` lines.

2. **Add-family identifier normalization hardening**
   - File:
     - `src/core/screens/family/AddFamilyMemberScreen.tsx`
   - Change:
     - Added normalized ID comparison (`AFN-*` forced to uppercase for comparisons).
     - Duplicate checks now compare all member aliases (`id`, `uid`, `deviceId`) in normalized form.
     - QR/manual flows now use normalized identifiers consistently before duplicate/self checks.
   - Impact:
     - Prevents case/alias drift causing duplicate member insertion.
     - Reduces false negatives in self-add prevention checks.

3. **Alias-routing type safety cleanup (`any` removal in critical helper paths)**
   - Files:
     - `src/core/stores/messageStore.ts`
     - `src/core/services/HybridMessageService.ts`
   - Change:
     - Replaced dynamic `any` scans over family members with typed identity helpers (`id/uid/deviceId`).
     - Centralized family-member alias lookup in local helpers.
   - Impact:
     - Safer refactors in message-routing logic.
     - Lower chance of silent runtime issues from loosely typed identity matching.

4. **Family realtime listener target canonicalization**
   - File:
     - `src/core/stores/familyStore.ts`
   - Change:
     - Added canonical realtime target builder (`uid/device`) with guardrails:
       - skips non-routable generated local IDs (`family-*`)
       - maps UID-shaped aliases to `users/{uid}` listeners
       - deduplicates target subscriptions per member
     - Hardened location payload parsing from `unknown` and narrowed status updates to typed family statuses.
   - Impact:
     - Reduces noisy/invalid Firestore subscriptions and prevents listener churn from bad local IDs.
     - Improves long-term stability in mixed legacy/UID member datasets.

5. **Family map check-in target hardening**
   - File:
     - `src/core/components/family/FamilyMapView.tsx`
   - Change:
     - Check-in action now resolves target as `uid -> deviceId -> routable id`, instead of `uid || id`.
   - Impact:
     - Prevents check-in requests from being routed to weak/local-only IDs when a stronger routable alias exists.

6. **Direct-message recipient fail-safe (no accidental broadcast fallback)**
   - File:
     - `src/core/services/HybridMessageService.ts`
   - Change:
     - Added non-routable recipient guard (`family-*`, `group:*`, self literals).
     - If a direct recipient cannot be resolved, send path now throws a user-facing validation error instead of silently degrading to broadcast.
   - Impact:
     - Prevents private messages from leaking into broadcast path during identity drift edge cases.
     - Makes delivery failures explicit and recoverable in UI.

7. **Family group mesh sender alias hardening**
   - Files:
     - `src/core/screens/family/FamilyGroupChatScreen.tsx`
     - `src/core/services/GroupChatService.ts`
   - Change:
     - Group mesh payload now carries sender alias metadata (`senderUid`, `senderPublicCode`, `fromDeviceId`).
     - Receiver parser now extracts these aliases and validates sender via alias-aware allow-list with active-group participant fallback.
     - Mesh-merged message sender identity now normalizes to strongest available alias for consistent self/incoming rendering.
   - Impact:
     - Reduces legitimate family-group message drops when sender uses UID/device/public code variants.
     - Improves offline group-chat continuity in mixed identity datasets.

8. **Error screen restart hardening**
   - File:
     - `src/core/components/ErrorBoundary.tsx`
   - Change:
     - `Yeniden Başlat` now attempts native runtime reload via `expo-updates` when available.
     - Falls back to `DevSettings.reload()` and finally boundary reset.
   - Impact:
     - Better recovery path in TestFlight/runtime crash fallback screen.
     - Reduces user lock-in on repeated boundary recoveries.

9. **QR add-member fallback parsing hardening**
   - File:
     - `src/core/screens/family/AddFamilyMemberScreen.tsx`
   - Change:
     - Added raw JSON fallback parser for legacy/debug QR payloads when primary parser returns null.
   - Impact:
     - Improves add-member success rate for non-standard but valid QR payload variants.

## Verification

- `npm run -s typecheck` -> **PASS**
- `npm run -s lint` -> **PASS**
- `npm run -s test:critical` -> **PASS**
- `npm run -s pre-submit` -> **PASS** (`Errors: 0`, `Warnings: 0`)
- `node scripts/user-scenario-tests.mjs` -> **PASS** (`7/7` scenarios)
- `RUN_JEST_ADVISORY=true node scripts/comprehensive-apple-user-test.mjs` -> **PASS** (`Failures: 0`, `Warnings: 0`)

## Residual Risk

Automated gates are green, but final confidence for offline mesh and cross-device family sync still requires physical two-device runtime validation (network transitions + background/foreground lifecycle).
