# Phase 12 - TestFlight Validation Runbook

## Purpose

Validate critical flows on distribution build (not only dev environment).

## Build Under Test

1. TestFlight build number:
2. Commit SHA:
3. Date:

## Required Devices

1. iPhone A (primary account)
2. iPhone/Android B (secondary account)
3. Optional C (group relay)

## Mandatory Validation Pack

1. Family add (QR + manual)
2. DM text + image + voice + location
3. Family group chat text + media
4. Family status updates
5. Family location map tracking
6. SOS trigger/ack/cancel
   - Variant A: same-family UID-linked users
   - Variant B: mixed alias case (`uid` + legacy `deviceId`) if available
   - Expected: SOS conversation opens, ACK appears on sender, cancel propagates.

## Evidence Collection

1. Screen recording per scenario
2. Timestamped logs
3. Any `err_<ts>_<fingerprint>` IDs
4. Error card `Kaynak` (source component) and `Ekran` (active route) values
5. Pass/fail table

## Exit Rule

All P0 scenarios must pass without crash.  
Any single P0 fail blocks release.
