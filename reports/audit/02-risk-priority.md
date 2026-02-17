# Phase 2 - Risk Prioritization (Initial)

## Severity Model

- `P0`: Life-critical or data-loss/security-risk behavior (SOS, family status/location, core messaging integrity)
- `P1`: High-impact reliability/consistency defects
- `P2`: Maintainability/type safety/UX debt (non-blocking but accumulative risk)

## P0 - Immediate Fix/Test Gate

1. Identity resolution consistency in message transport
   - References:
     - `src/core/services/HybridMessageService.ts:426`
     - `src/core/screens/messages/ConversationScreen.tsx:399`
     - `src/core/services/ContactService.ts:722`
   - Risk: messages written/read with different IDs -> invisible or split threads.

2. Family status/location cross-path sync (UID + device legacy)
   - References:
     - `src/core/stores/familyStore.ts:96`
     - `src/core/stores/familyStore.ts:203`
     - `src/core/stores/familyStore.ts:319`
   - Risk: family may not see live status/location in crisis.

3. SOS end-to-end deterministic delivery verification
   - References:
     - `src/core/services/sos/UnifiedSOSController.ts:130`
     - `src/core/services/sos/SOSChannelRouter.ts:45`
     - `src/core/services/sos/SOSAlertListener.ts:86`
   - Risk: delayed/missed SOS during network transitions.

## P1 - High Impact

1. Navigation type drift and weak compile-time route safety
   - `src/core/types/navigation.ts:14` vs actual stack in `src/core/navigation/MainNavigator.tsx:92`.
2. Direct route calls with runtime casting:
   - `src/core/screens/family/FamilyScreen.tsx:285`.
3. Legacy ID usage in map/family actions (partially fixed)
   - `src/core/screens/map/DisasterMapScreen.tsx:1347`.

## P2 - Engineering Debt / Hardening

1. Broad `any` usage across service layer (notifications/firebase/EEW).
2. Multiple lint suppression patterns for `no-explicit-any`.
3. Outdated/dead comments and TODOs in cryptography or infra notes.

## Current Sprint Decisions

1. Keep P0 focus on messaging-family-SOS paths before broader refactor.
2. Freeze large architecture rewrites until deterministic test matrix is ready.
3. Prefer surgical changes with verification after each patch (typecheck + targeted scenario).
