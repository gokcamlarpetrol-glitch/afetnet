# Phase 9 - Regression Test Hardening Plan (Initial)

## Objective

Prevent recurrence of identity-routing, messaging, family sync, and SOS regressions.

## Mandatory Regression Gates per Patch

1. Static gate:
   - `npm run -s typecheck`
2. Health gate:
   - `npm run -s healthcheck`
3. Critical smoke (manual/device):
   - QR add -> DM -> family status -> family location -> SOS trigger/ack/cancel

## Test Buckets

### Bucket A: Identity Resolution

1. UID recipient
2. AFN/public code recipient
3. deviceId fallback recipient
4. Same person opened with mixed aliases must keep one thread for all metadata actions (pin/mute/read/search/delete)
5. QR scan should trigger exactly one add/navigate action per scan window (cooldown lock), no duplicate alert burst
6. Family group channel should converge to single cloud group (no self-only duplicate groups after restart/race)

Expected:

- Single conversation thread per real person.
- Pin/mute/read/search/delete behave consistently regardless of which alias opened the thread.

### Bucket B: Delivery Integrity

1. text/image/voice/location send
2. online -> offline -> online transition
3. app restart with pending queue
4. image/voice upload + backup path should work in Hermes/TestFlight runtime (no `atob/btoa` dependency crash)

Expected:

- no duplicate storms
- no silent message drop

### Bucket C: Family Safety

1. Add/remove member
2. Status fan-out
3. Location update view in map/card
4. Quick message chips
5. Family member with local `family-*` record id only (no uid/deviceId) should fail-fast with clear alert, never open/send DM to invalid target
6. Family map/list "Mesaj" action should always open canonical UID/deviceId conversation for the same person (no duplicate threads)
7. Add-member flow must reject self identity (QR/manual) across all aliases (`uid/public code/deviceId`)
8. Legacy cached family records with invalid timestamps/IDs should normalize on app start (no absurd day counters; invalid fields sanitized)
9. New member should render `lastSeen` as unknown until first genuine status/location update (no synthetic "just now")
10. Family group with peers lacking UID should stay mesh-fallback without creating isolated self-only cloud group

### Bucket D: SOS

1. trigger countdown
2. force activate
3. ack receive
4. cancel propagation
5. mixed-identity path (`senderUid` + `senderDeviceId`) ACK/message routing
6. nearby listener foreground receive (timestamp-window query)

## Exit Criteria

1. All bucket smoke cases pass on at least 2 devices.
2. No new `ErrorBoundary` crash IDs during test run.

## Current Execution Notes

1. Command:
   - `npm test -- --watchman=false --runTestsByPath src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/EEWService.test.ts --runInBand`
2. Result:
   - 2/2 suites passed, 20/20 tests passed.
3. Observations:
   - Jest reported open-handle warning at process end.
   - EEW test logs show dynamic import warning path in Node/Jest runtime, but assertions pass.
