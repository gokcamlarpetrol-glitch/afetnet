# Phase 11 - Release Gate Criteria

Aşağıdaki koşullar sağlanmadan “yayına hazır” kararı verilmez.

## Hard Gates (Mandatory)

1. P0 bug count = 0.
2. `npm run -s typecheck` pass.
3. Critical E2E matrix (Phase 6 P0 cases) pass rate = 100%.
4. No new uncategorized TestFlight crash in validation window.
5. Firebase rules hardening changes (if any) canary tested.

## Soft Gates (Strongly Recommended)

1. P1 bug count minimized; açık P1 için mitigasyon dokümante.
2. Runtime log noise and permission-denied storms reduced.
3. Navigation type drift addressed or explicitly accepted with action date.

## Evidence Required

1. Scenario execution logs and screenshots/videos.
2. Error ID to stack correlation report.
3. Updated risk register (`reports/audit/02-risk-priority.md`).
4. Final fix log (`reports/audit/07-fix-log-p0-p1.md`).

## Stop-Ship Conditions

1. SOS trigger/ACK/cancel flow has any non-deterministic failure.
2. Family status/location not visible cross-device in production-like test.
3. Direct messaging loses messages or splits identity threads.
