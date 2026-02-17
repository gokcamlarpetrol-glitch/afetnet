# Phase 5 - Offline/Online Resilience Audit (Initial Static Pass)

## Scope

Static review of retry/queue/backoff logic for messaging, location sync, and offline sync services.

## Reviewed Components

1. `src/core/services/HybridMessageService.ts`
2. `src/core/services/FamilyTrackingService.ts`
3. `src/core/services/OfflineSyncService.ts`
4. `src/core/services/DeliveryManager.ts`

## Findings

### R-01 (High): Offline queue retry scheduling gap

- Before fix: `OfflineSyncService.startSync()` handled retries per item but did not guarantee a next timed sync cycle for pending failures.
- Risk: queue could remain pending until another trigger event.
- Fix applied:
  - Added exponential backoff next-run scheduling in `OfflineSyncService.startSync()`.
  - Added timer cleanup consistency (`clearTimeout`) in destroy.
- References:
  - `src/core/services/OfflineSyncService.ts:113`
  - `src/core/services/OfflineSyncService.ts:156`
  - `src/core/services/OfflineSyncService.ts:273`

### R-02 (Medium): Success masking in cloud message facade

- Before fix: `FirebaseDataService.saveMessage` could return success even when V3 write failed.
- Fix applied: return true only if at least one write path succeeds (V3 or legacy).
- Reference: `src/core/services/FirebaseDataService.ts:327`

### R-03 (Medium): Broadcast cloud semantics

- `HybridMessageService.attemptSend()` invokes cloud save path for broad message types.
- For broadcast payloads, mesh remains primary delivery channel.
- Risk is currently managed, but should be covered in runtime matrix:
  - A/B offline
  - reconnect replay
  - duplicate suppression
- Reference: `src/core/services/HybridMessageService.ts:925`

## Validation Executed

1. `npm run -s typecheck` after each resilience patch.
2. `npm run -s healthcheck` baseline available.

## Pending Runtime Validation (Device Matrix)

1. airplane mode toggles during send
2. app kill/restart with pending queue
3. message dedup under reconnect storms
4. SOS channel fallback verification under unstable network
