# Phase 6 - End-to-End Scenario Matrix (Initial)

This matrix is the mandatory pre-release execution set for emniyet-kritik flows.

## Test Topology

1. Device A: iOS TestFlight build (online/offline toggled)
2. Device B: iOS/Android second account (online/offline toggled)
3. Optional Device C: third participant for group/SOS relay verification

## P0 Scenario Set

### A. Identity and Pairing

1. QR add with UID payload
   - Steps: A scans B QR -> add family member -> open conversation
   - Expected: no invalid QR error, member saved with UID, conversation opens correctly.

2. QR add with AFN/public code fallback
   - Expected: accepted, no duplicate mismatch, recipient resolution deterministic.

3. Manual add (UID + AFN + public code)
   - Expected: validation and duplicate protection works for all 3 formats.

### B. Direct Messaging

1. Online text DM A -> B
2. Online media DM A -> B (image)
3. Online media DM A -> B (voice)
4. Online location DM A -> B
5. Offline A (mesh only) -> B nearby
6. A online / B reconnect after offline window

Expected for all:

- Message visible in same single thread on both devices.
- No duplicate split threads by alias IDs.
- Read/unread states consistent after conversation open.

### C. Family Module

1. Family status update: A sets `safe` -> B sees real-time update.
2. Family status update: A sets `need-help` -> B gets urgent visual notification.
3. Family status update: A sets `critical` -> B sees critical state and can open SOS conversation path.
4. Location sharing toggle ON/OFF with settings interaction.
5. Family map open -> member marker present -> "Mesaj" action opens correct conversation target.

### D. Group Chat

1. Family group auto-create or resolve existing group.
2. A sends text group message -> B/C receive.
3. A sends image/voice/location group message -> B/C render correctly.
4. Mixed connectivity: one device offline then reconnect.

### E. SOS

1. Trigger SOS from A (countdown path)
2. Force SOS from A (skip countdown)
3. ACK from B
4. Cancel SOS from A
5. Nearby SOS listener receives proximity SOS

Expected:

- Signal appears in intended listeners.
- ACK and cancellation reflected correctly.
- No silent failure after app background/foreground or restart.

## P1 Scenario Set

1. Quick message chips from Family screen to all members.
2. Contact list search + conversation launch from NewMessage screen.
3. Terms/Privacy/About external links.
4. Push/in-app notification tap routing into target screen.

## Pass Criteria

1. P0: 100% pass required.
2. P1: no blocking failures; any failure must have mitigation or fix before release.
3. No uncategorized crash in TestFlight during matrix run.

## Evidence Template (per test case)

1. Build number
2. Device OS/version
3. Network state
4. Steps
5. Result: PASS/FAIL
6. Log/error ID (if fail)
7. Screenshot/video reference
