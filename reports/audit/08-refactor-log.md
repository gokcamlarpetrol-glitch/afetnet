# Phase 8 - Refactor/Cleanup Log

## Current Cycle Entries

1. Removed unnecessary navigation type coercion in family SOS navigation.
   - File: `src/core/screens/family/FamilyScreen.tsx`
   - Change: removed `as never` casts in `navigation.navigate('SOSConversation', params)`.
   - Rationale: avoids masking type issues and reduces maintenance confusion.

2. Expanded central navigation type model to match real stack routes.
   - File: `src/core/types/navigation.ts`
   - Change: `MainStackParamList` and `OnboardingStackParamList` updated to current route surface.
   - Rationale: reduces drift between navigator config and typed route contracts.

3. Family realtime merge logic moved to alias-aware helper.
   - File: `src/core/stores/familyStore.ts`
   - Change: introduced `getMemberIdentityAliases` + `mergeFamilyMembersByIdentity` and replaced inline map-based merge.
   - Rationale: removes duplicate-prone ad-hoc merge logic and keeps identity matching centralized.

4. Messages screen dead telemetry code removed.
   - File: `src/core/screens/messages/MessagesScreen.tsx`
   - Change: removed unused mesh telemetry state/memo (`isMeshConnected`, `networkStats`, peer-hop counters) from render path.
   - Rationale: lowers cognitive load and avoids maintaining UI state that is no longer used.

5. Identity QR parser converted to layered, defensive parse pipeline.
   - File: `src/core/services/IdentityService.ts`
   - Change: structured-object parser + deep-link extraction + plain-code fallbacks consolidated in one function.
   - Rationale: replaces brittle single-path JSON parse with maintainable guard-based parsing flow.
