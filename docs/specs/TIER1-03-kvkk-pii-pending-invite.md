# TIER1 #3 — KVKK PII disclosure on pending family invite

> **Risk**: HUKUKİ KRİTİK (KVKK Madde 4/7/8 — pre-consent PII disclosure, stalker vektörü)
> **Effort**: M (3-4 days)
> **Faz**: v1.6.4 Hafta 1

## Root cause (2 leak points)

1. **`FirebaseFamilyOperations.ts:380-394`** — `setDoc(users/{B}/familyMembers/{A}, {adderUid: A, adderName: A.displayName, ...})` recipient B onay vermeden ÖNCE A'nın UID + displayName + photoURL'i B'nin namespace'ine yazılır. B okur → A'nın PII'sini onaysız görür.
2. **`ContactRequestService.ts:231-242`** — `setDoc(users/{B}/contactRequests/{A}, {fromUserId, fromName, fromPhotoURL, fromQrId})` aynı pattern, daha fazla PII.

Firestore rules (lines 882, 961) izin veriyor (`isOwner(userId)`) → B kendi namespace'ini okuyabilir. KVKK Madde 8 explicit consent ihlal.

## Proposed architecture — opaque invite + CF acceptance

**1. New collection `contact_requests/{recipientUid}/incoming/{opaqueCode}`** — client writes ONLY:
```ts
{ opaqueInviteCode: string(48), requestedAt: number, expiresAt: number(now+7d) }
```
No PII. Rule: `keys().hasOnly([...])` enforces no other fields.

**2. Server-side `invite_lookup/{opaqueCode}`** — admin-only. CF writes `{senderUid, recipientUid, familyId, createdAt}`. Rule: `allow read,write: if false`.

**3. New CF `acceptContactRequest({inviteCode})`** callable — when B taps "Kabul Et":
- Validate `recipientUid == request.auth.uid` + `expiresAt > now`
- Atomic batch: write both `users/{A}/familyMembers/{B}` + `users/{B}/familyMembers/{A}` (with A's PII — FIRST TIME B sees it) + `families/{familyId}/members/{B}` + `consent_log/{uuid}` audit entry
- Delete `contact_requests/.../{code}` + `invite_lookup/{code}`
- Send "accepted" push to A
- Return `{success, senderName, senderUid}` — B's client now sees A's PII

## File-by-file changes

| File | Change |
|---|---|
| `functions/src/contact-requests.ts` (NEW) | `acceptContactRequest` + `createContactInvite` callable CFs (admin SDK batch writes) |
| `src/core/services/ContactRequestServiceV2.ts` (NEW) | `sendPendingInvite(recipientUid, familyId)` → calls createContactInvite CF; `acceptInvite(code)` → calls acceptContactRequest CF; `subscribeToIncomingInvites` (no PII visible) |
| `src/core/screens/family/AddFamilyMemberScreen.tsx:542-577` | Replace `contactRequestService.sendContactRequest()` with `ContactRequestServiceV2.sendPendingInvite()` |
| `FirebaseFamilyOperations.ts:364-398` | Pending branch: write ONLY `users/{myUid}/familyMembers/{memberUid}` (own namespace). REMOVE cross-namespace write to `users/{memberUid}/familyMembers/{myUid}` |
| `firestore.rules` (NEW collections) | `contact_requests/.../incoming/{code}` (sender create with opaque-only fields, recipient read+delete). `invite_lookup/{code}` (CF-only). `consent_log/{id}` (read by participants, write CF-only) |
| `firestore.rules` `isPendingFamilyLinkWrite` | Remove `request.auth.uid == otherUid` path (cross-namespace ban) — only own namespace |
| `functions/src/index.ts` | Register new contact-requests exports |

## Migration

One-time CF `pii-pending-cleanup` (admin-triggered):
- Strip `adderUid`/`adderName`/`adderPhotoURL` from existing `users/*/familyMembers/*` where `approvalState='pending'`
- Tombstone existing `users/*/contactRequests/*` to `status='legacy_pending_pii_redacted'` (PII fields stripped)

## Backward compatibility

Old client versions: still write `contactRequests` (rule unchanged for now). Phase 2 tightening (next forced-update release) blocks fromName/fromPhotoURL. New `contact_requests` collection additive — old clients ignore.

## Acceptance criteria

- A scans B's QR, taps "Üyeyi Ekle"
- Assert before B accepts: `users/{B}/familyMembers/{A}` DOES NOT exist (new rule blocks)
- Assert: `contact_requests/{B}/incoming/{code}` exists with ONLY `{opaqueCode, requestedAt, expiresAt}`
- B taps "Kabul Et" → CF commits batch
- Assert after CF: `users/{B}/familyMembers/{A}` exists with `adderName` (first time B sees A's PII)
- `consent_log` has entry with `consentedBy: B`, `senderUid: A`
- Emulator test: B reads `users/{B}/familyMembers/{A}` with B credentials → PERMISSION_DENIED when only pending

## Risk + rollback

**Risk**: CF cold-start 1-3s → B sees spinner during accept. CF down → show alert, do NOT fall back to client write (would re-leak PII).

**Rollback**: New CF additive — disable export removes the new path. Old `contactRequests` path still works. Rule tightening revertible by reverting `isPendingFamilyLinkWrite`.

---
**Full agent spec transcript**: `/private/tmp/.../tasks/a71c1fa2eec4da97c.output`
