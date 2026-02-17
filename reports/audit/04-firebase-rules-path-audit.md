# Phase 4 - Firebase Rules/Path Audit (Initial)

## Scope

Audited rules file and message/family/status/location operations for path and authorization consistency.

Primary references:

- `firestore.rules`
- `src/core/services/firebase/FirebaseMessageOperations.ts`
- `src/core/services/FirebaseDataService.ts`
- `src/core/services/firebase/FirebaseFamilyOperations.ts`

## Good Controls Observed

1. Conversation message anti-spoofing:
   - Rule requires `senderUid == request.auth.uid`
   - `firestore.rules:782`
2. Conversation read/write participant gating:
   - `firestore.rules:763`, `firestore.rules:787`
3. Device ownership binding via `ownerUid`:
   - `firestore.rules:158`, `firestore.rules:163`

## Critical/High Findings

1. **Inbox metadata write rule is over-broad**
   - Rule: `user_inbox/{userId}/threads/{threadId}` allows create/update by any authenticated user.
   - `firestore.rules:724`
   - Risk: inbox poisoning/spam metadata writes by unrelated users.
   - Recommendation:
     - Require one of:
       1. `request.auth.uid == userId`, or
       2. writer is conversation participant and payload conversation matches.

2. **Family mapping write rule is over-broad**
   - Rule: `users/{userId}/familyMembers/{otherUid}` allows create by any authenticated user.
   - `firestore.rules:542`
   - Risk: unauthorized relationship injection.
   - Recommendation:
     - Restrict create to `isOwner(userId)` OR reciprocal validated write transaction shape.

3. **Privacy exposure: status and location are globally readable by authenticated users**
   - `users/{userId}/status/*` read: `firestore.rules:522`
   - `users/{userId}/status_updates/*` read: `firestore.rules:531`
   - `locations_current/{userId}` read: `firestore.rules:654`
   - Risk: any signed-in user can read sensitive presence/location.
   - Recommendation:
     - Restrict read to owner + family relationship (`sharesFamilyWith`).

## Consistency Findings

1. Messaging facade had success masking bug (fixed this cycle):
   - `src/core/services/FirebaseDataService.ts:327`
   - Now returns success only if V3 or legacy write path actually succeeds.

2. Dual-path architecture (UID + legacy device) is still active.
   - This is acceptable for migration, but must remain explicit and monitored.

## Rule Change Safety Note

Rules hardening must be rolled out with client compatibility tests:

1. DM send/receive
2. Family add/remove reciprocal links
3. Status fan-out
4. Location read by family
5. Group chat subscribe/read

Do not tighten rules without staged canary validation, or live traffic may fail with permission-denied.
