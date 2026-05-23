# TIER1 #10 — NearbySOSListener DEAD CODE decision

> **Risk**: MAINTENANCE / KOD HİJYENİ (492 satır ASLA çalışmıyor)
> **Effort**: S (delete) veya L (refactor)
> **Faz**: v1.6.4 Hafta 2 (sil) veya v1.7 sprint 2 (refactor)

## Root cause

`firestore.rules:1386-1389`:
```
match /sos_broadcasts/{broadcastId} {
  allow read: if isAuthenticated() && resource.data.senderUid == request.auth.uid;
```
Read ONLY for sender. `NearbySOSListener.ts:93-99` query `where('timestamp', '>', ...)` — receiver fetches OTHER users' docs → ALL `permission-denied`.

`NearbySOSListener.ts:185-198` silently swallows permission-denied (DEV-only log, no retry). Listener dies, never re-armed. **492 lines run only in dev console as noise.**

Rule comment at 1386-1388 documents intent: "Global broadcast docs are private. Cloud Functions perform geo-distance checks and fan out via sos_alerts/{uid}/items."

## Decision: **Option A — DELETE**

**Why**: SOSAlertListener V3 path (`sos_alerts/{myUid}/items`, populated by `onSOSBroadcast` CF) IS the production receive channel. NearbySOSListener was an alternative architecture superseded before rules finalized. Keeping = false signal to future maintainers (the bug we're fixing).

The only valuable piece (`resolveReceiverLocation` + `haversineDistanceKm` client-side filter) gets ported into `SOSAlertListener.processSOSAlert` as a 50km guard for `type:'sos_proximity'` alerts.

## File-by-file changes

| File | Change |
|---|---|
| `src/core/services/sos/NearbySOSListener.ts` | DELETE entire file |
| `src/core/init.ts:822-825, 849-852` | Remove `startNearbySOSListener` import + call (Phase G init + retry) |
| `src/core/init.ts` (log) | Change `'✅ SOS Alert Listeners (family + nearby)'` → `'✅ SOSAlertListener (family + proximity fan-out)'` |
| `src/core/stores/familyStore.ts:1183` | Remove `stopNearbySOSListener` cleanup call |
| `SOSAlertListener.ts` (port functions) | Move `resolveReceiverLocation` + `haversineDistanceKm` from NearbySOSListener BEFORE deletion |
| `SOSAlertListener.processSOSAlert` (line 79) | After self-ID check: if `alertData.type === 'sos_proximity'` AND coords exist → `haversineDistanceKm(receiver, alert) > 50` → return (drop) |
| `docs/architecture/SOS-RECEIVE-PATHS.md` (NEW) | Document the ONE receive path (CF fan-out → sos_alerts/{uid}/items → SOSAlertListener V3) to prevent future "I'll add a Firestore listener for sos_broadcasts" mistakes |

## Acceptance criteria

- `npx tsc --noEmit` zero errors after deletion
- Grep `NearbySOSListener` in `src/` returns zero results
- Grep `startNearbySOSListener` / `stopNearbySOSListener` / `clearNearbySOSDedup` returns zero results
- Functional: A broadcasts SOS, B (within 50km) receives full-screen alert within 15s (CF cold-start bound)
- Functional: C (>50km from sender) does NOT receive alert (client-side haversine filter blocks)
- Cancellation: A cancels → B's alert dismisses (existing path unaffected)

## Risk + rollback

**Risk**: CF fan-out latency (2-8s cold start). This is current production reality regardless of NearbySOSListener (listener never worked). Family SOS path unaffected.

**Rollback**: Restore NearbySOSListener.ts + 2 init.ts imports from git. No functionality regression (listener was dead). 5-minute rollback.

## Documentation deliverable

`docs/architecture/SOS-RECEIVE-PATHS.md` — single source of truth for "how SOS reaches a phone":
- Send: SOSChannelRouter.broadcastToNearbyUsers → sos_broadcasts/{id} (sender-only read)
- CF fan-out: onSOSBroadcast → geo-filter → sos_alerts/{recipientUid}/items/{signalId}
- CF push: onSOSAlertV3 → FCM
- Client receive: SOSAlertListener V3 listens sos_alerts/{myUid}/items → SOS_FULLSCREEN_ALERT emit
- **DO NOT** subscribe to sos_broadcasts client-side — rule will never permit it, failure silent in prod

---
**Full agent spec transcript**: `/private/tmp/.../tasks/a71c1fa2eec4da97c.output`
