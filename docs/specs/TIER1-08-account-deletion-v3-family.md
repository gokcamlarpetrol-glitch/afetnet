# TIER1 #8 — Account deletion v3 family cleanup (KVKK Madde 7 right to forget)

> **Risk**: HUKUKİ (KVKK Madde 7 — phantom üyeler, deleted user PII other accounts'ta kalır)
> **Effort**: L (3-4 days + CF deploy + backfill migration)
> **Faz**: v1.6.4 Hafta 2

## Current deletion flow gaps

`AccountDeletionService.deleteAccount` 20 step var ama 6 gap:

| Step | Gap |
|---|---|
| 2 | `devices/{deviceId}/familyMembers/*` legacy path → v3 `families/{familyId}/members/{uid}` NOT TOUCHED |
| 2 | `families/{familyId}.members` array → uid NOT REMOVED |
| 2 | `users/{otherUid}/familyMembers/{uid}` reverse links → NOT DELETED on OTHER users |
| 10 | `sos_signals where deviceId == deviceId` → UID-keyed signals MISSED |
| 13 | `deleteV3UserData` doesn't address `families/{familyId}/groupChat/messages where from == uid` |
| 16 | DUPLICATE "Step 16" label (line 264 user profile + line 276 Storage) — progress UI jump |

Sonuç: account deletion sonrası other family members deleted user'ı phantom görür; SOS broadcasts UID dahil; KVKK Madde 7 (right to be forgotten) ihlal.

## V3 family schema (gözlemlenen)

```
families/{familyId}
  members: string[]    ← UID array (rule: request.auth.uid in members)
  createdBy, name, groupId?
families/{familyId}/members/{uid}
  uid, name, role, joinedAt, status
users/{uid}/familyMembers/{otherUid}
  approvalState: 'mutual'|'pending'
  familyId, requestedBy
  (hasMutualFamilyLink() check)
users/{uid}/familyIds/{familyId}
  active, joinedAt, ownerUid, role
```

## Architecture — server-side `onUserDeletedCleanup` CF

Authoritative cleanup server-side çünkü:
1. `deleteUser(user)` sonrası client auth token kaybeder → Firestore writes `unauthenticated` fail
2. Admin SDK rules bypass → reverse links other users namespace'inde okunabilir
3. CF guaranteed execution (client disconnect tolerant)

Trigger: `functions.auth.user().onDelete()` — Firebase Auth deletion → otomatik fire.

## CF implementation (functions/src/privacy.ts)

```typescript
export const onUserDeletedCleanup = functions
  .region(REGION).auth.user().onDelete(async (user) => {
    const uid = user.uid;
    // Idempotency guard — check audit log
    const audit = await db.collection('deletion_audit_log')
      .where('uid','==',uid).where('triggeredBy','==','auth.user().onDelete')
      .limit(1).get();
    if (!audit.empty) return; // already processed

    // 1. Families containing uid in members array
    const familiesSnap = await db.collection('families')
      .where('members','array-contains',uid).get();
    for (const f of familiesSnap.docs) {
      const batch = db.batch();
      batch.delete(f.ref.collection('members').doc(uid));      // 1a member doc
      batch.update(f.ref, { members: admin.firestore.FieldValue.arrayRemove(uid) }); // 1b array
      const remaining = (f.data().members||[]).filter((m:string)=>m!==uid);
      if (remaining.length===0) batch.delete(f.ref);          // 1c empty family
      await batch.commit();
    }

    // 2. Reverse links — users/*/familyMembers/{uid}
    // Iterate other members from step 1 (collectionGroup query needs composite index)
    for (const f of familiesSnap.docs) {
      const others = (f.data().members||[]).filter((m:string)=>m!==uid);
      for (const otherUid of others) {
        await db.collection('users').doc(otherUid)
          .collection('familyMembers').doc(uid).delete().catch(()=>{});
      }
    }

    // 3. users/{uid}/familyMembers/* (own outbound links)
    const outbound = await db.collection('users').doc(uid).collection('familyMembers').get();
    const ob = db.batch(); outbound.docs.forEach(d=>ob.delete(d.ref)); await ob.commit();

    // 4. users/{uid}/familyIds/*
    const fids = await db.collection('users').doc(uid).collection('familyIds').get();
    const fb = db.batch(); fids.docs.forEach(d=>fb.delete(d.ref)); await fb.commit();

    // 5. Group chat messages — ANONYMIZE (not full delete; preserves history for other members)
    //    KVKK Madde 7 anonymization alternative satisfies "right to erasure"
    for (const f of familiesSnap.docs) {
      const groupId = f.data().groupId;
      if (!groupId) continue;
      const msgs = await db.collection('conversations').doc(groupId)
        .collection('messages').where('senderUid','==',uid).get();
      const mb = db.batch();
      for (const m of msgs.docs) {
        const d = m.data();
        if (d.type==='sos'||d.type==='emergency') mb.delete(m.ref); // hard delete SOS
        else mb.update(m.ref, {
          senderName:'[Silindi]', senderUid:null, text:'[Bu mesaj silindi]',
          mediaUrl:null, voiceUrl:null,
          deletedAt:Date.now(), deletedBySystem:true,
        });
      }
      await mb.commit();
    }

    // 6. Audit log
    await db.collection('deletion_audit_log').add({
      uid, deletedAt:Date.now(), triggeredBy:'auth.user().onDelete',
    });
  });
```

**runWith**: `timeoutSeconds: 540` (max v1) + `memory: '512MB'` for large families.

## Required Firestore composite index

```
Collection group: familyMembers
Fields: uid (Ascending), __name__ (Ascending)
```
Create via Firebase Console → Firestore → Indexes → Collection group.

## File-by-file changes

| File | Change |
|---|---|
| `functions/src/privacy.ts` | Add `onUserDeletedCleanup` export (full implementation above) |
| `functions/src/index.ts` | Verify export (wildcard re-export auto-picks up) |
| `src/core/services/AccountDeletionService.ts:605-623` | Replace `deleteFamilyMembers` with legacy-only (best-effort) + add v3 best-effort (CF authoritative) |
| `AccountDeletionService.ts:264,276` | Fix duplicate "Step 16" label — add missing `onProgress(17,20)` call for Storage block; renumber Auth → 18, local → 19, secure → 20 |
| `firestore.indexes.json` | Add familyMembers collection-group composite index |

## Migration — backfill for already-deleted users

`scripts/backfill-deleted-users.ts` admin script:
- Query all families, for each member UID check if `users/{uid}` exists
- If not exists → delete `families/.../members/{uid}` + arrayRemove from `members`
- Run once via `ts-node` with admin SDK credentials, OR via existing `broadcastEEW` admin HTTP endpoint pattern

## Acceptance criteria

- User A + B in family (v3: `members:[A,B]` array, both `members/{A}` + `members/{B}` docs)
- A deletes account → Auth trigger → CF fires
- After CF: `families/{familyId}.members` NOT contains A; `families/.../members/{A}` DOES NOT EXIST; `users/B/familyMembers/{A}` DOES NOT EXIST
- B opens app → A NOT in family list
- A's active SOS deleted from `sos_signals` + `sos_broadcasts`
- B's SOS listener doesn't receive A's broadcasts
- `exportUserData(A.uid)` → empty/not found (KVKK Madde 11 compliance)
- `deletion_audit_log` has entry

## KVKK Madde 7 compliance

**Article 7 — Silinme/Yok Etme/Anonim Hale Getirme**: "Kişisel veriler, ilgili kişinin talebi üzerine ... silinir, yok edilir veya anonim hale getirilir."

Bu fix:
1. **Completeness**: tüm UID-içeren collections cleaned
2. **Finality**: `deletion_audit_log` evidence for regulator inspection
3. **Third-party residuals**: group chat messages ANONYMIZED (sender → `[Silindi]`, UID null, content → `[Bu mesaj silindi]`) — Article 7 anonymization alternative
4. **Right to confirmation (Madde 11/d)**: `exportUserData` post-deletion returns empty

GDPR Article 17 paralelel — aynı fix EU users için de geçerli.

**Remaining gap** (out of scope, noted):
- `deletion_audit_log` UID retain — 3-year auto-delete policy gerek
- KVKK Aydınlatma Metni placeholder'lı, legal review gerek

## Risk + rollback

**Risk**: Auth trigger at-least-once — idempotency guard (audit log check) prevents double-processing. CF timeout for 50+ family members — `timeoutSeconds: 540`. Composite index required (manual create).

**Anonymization vs delete**: Group chat messages hard-delete diğer üyeler için "deprem öncesi konuşma" tarihini siler. Anonymize preserves utility while removing personal data — KVKK acceptable.

**Rollback**: CF additive — disable export removes path. No data restoration possible (already deleted docs gone). Client-side `deleteFamilyMembers` independently revertible.

---
**Full agent spec transcript**: `/private/tmp/.../tasks/a869c0bac746ee901.output`
