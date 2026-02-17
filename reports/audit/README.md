# AfetNet Reliability Audit Tracker

Last update: 2026-02-14
Scope owner: Codex + Product Owner

## Phase Status

| Phase | Name | Status | Output |
|---|---|---|---|
| 0 | Baseline Snapshot | Completed | `reports/audit/00-baseline.md` |
| 1 | System Map (Route + Feature Flow) | Completed (initial) | `reports/audit/01-system-map.md`, `reports/audit/01-feature-flow-matrix.csv` |
| 2 | Risk Prioritization (P0/P1/P2) | Completed (initial) | `reports/audit/02-risk-priority.md` |
| 3 | Line-by-Line Static Review | In Progress | `reports/audit/03-initial-findings.md` |
| 4 | Firebase/Rules Audit | Completed (initial) | `reports/audit/04-firebase-rules-path-audit.md` |
| 5 | Offline/Online Resilience Audit | Completed (initial static) | `reports/audit/05-resilience-test-log.md` |
| 6 | End-to-End Scenario Matrix | Completed (initial) | `reports/audit/06-e2e-scenario-matrix.md` |
| 7 | Fix Sprint 1 (P0/P1) | In Progress | `reports/audit/07-fix-log-p0-p1.md` |
| 8 | Fix Sprint 2 (Refactor/Cleanup) | In Progress | `reports/audit/08-refactor-log.md` |
| 9 | Regression Test Hardening | Completed (initial plan) | `reports/audit/09-regression-plan.md` |
| 10 | Runtime Stability (Perf/Battery/Leaks) | Completed (initial static) | `reports/audit/10-runtime-stability.md` |
| 11 | Release Gate | Completed (initial) | `reports/audit/11-release-gate.md` |
| 12 | TestFlight Validation | Prepared (runbook ready) | `reports/audit/12-testflight-validation.md` |
| 13 | Paranoid Re-run | Prepared (runbook ready) | `reports/audit/13-paranoid-regression.md` |
| 14 | Production Readiness Deep Check | Completed | `reports/audit/14-production-readiness-deep-check-2026-02-14.md` |
| 15 | Cleanup + Hardening Pass | In Progress | `reports/audit/15-cleanup-hardening-pass-2026-02-14.md` |

## Immediate Notes

- Repository is heavily dirty (`202` changed/untracked entries at snapshot time), so each fix is tracked by exact file path and command-level verification.
- Static health commands currently pass in local context:
  - `npm run -s typecheck`
  - `npm run -s healthcheck`
  - `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts src/core/services/__tests__/EEWService.test.ts`
  - `npm test -- --watchman=false src/core/services/__tests__/MessagingReliability.test.ts`
- Health report flags external/env readiness gaps (`reports/e2e-report.md`).
- Current cycle focus fix: UID/publicCode/deviceId self-identity normalization in messaging path (service + store + conversation filters).
- Current cycle focus fix: family group `group:<id>` mesh routing compatibility + fallback send hardening.
- Current cycle focus fix: family location/time rendering normalization (`seconds/ms/ISO` drift removed in marker/card/status writes).
- Current cycle focus fix: group Firestore write contract alignment with rules (`senderUid == auth.uid`).
- Current cycle focus fix: crash diagnostics bootstrapped at app init (global handlers + fingerprinted error IDs).
- Current cycle focus fix: DM cloud recipient alias resolution (`public/device/qr -> uid`) before conversation writes.
- Current cycle focus fix: family group media moved to cloud-first persistence with mesh fallback.
- Current cycle focus fix: crash reports now capture active route name for direct screen-level triage.
- Current cycle focus fix: SOS payloads now propagate `senderUid`, and SOS conversation/ACK flows are UID-first with alias fallback.
- Current cycle focus fix: SOS ACK path/listener now supports multi-target identity aliases (`uid + deviceId`) for mixed migration states.
- Current cycle focus fix: nearby SOS foreground listener no longer depends on a composite `status+timestamp` index shape.
- Current cycle focus fix: SOS + DisasterMap routes now use typed `MainStackParamList` bindings (reduced `ParamListBase` exposure in critical flows).
- Current cycle focus fix: Family and direct-message entry points now reject non-routable local `family-*` IDs and use UID/deviceId-first target resolution.
- Current cycle focus fix: new-message flow now resolves existing conversations by alias set (uid/deviceId/public code) to prevent duplicate person threads.
- Current cycle focus fix: `messageStore` conversation operations (`add/read/delete/pin/mute/search/forward`) are now alias-aware and canonicalized.
- Current cycle focus fix: Messages list in-app search now reads per-conversation content through alias-safe store API to avoid false negatives.
- Current cycle focus fix: Add-family flow now blocks self-add (QR/manual) and preserves UID/device separation for safer family routing.
- Current cycle focus fix: family member cache/realtime records are normalized at load time to suppress stale timestamp and malformed-ID drift from legacy data.
- Current cycle focus fix: new-message QR scan flow now includes cooldown lock to prevent repeated add/navigate storms from a single frame.
- Current cycle focus fix: newly added family members now start with unknown freshness (`lastSeen` not synthetic) until real telemetry arrives.
- Current cycle focus fix: family group cloud-thread convergence now prevents early self-only duplicate group creation during startup races.
- Current cycle focus fix: critical media/voice/group-mesh base64 paths migrated off `atob/btoa` to `Buffer` for Hermes/TestFlight runtime stability.
- Current cycle focus fix: family/direct conversation voice backup calls are now rejection-safe and family group record lifecycle cleanup was hardened.
- Current cycle focus fix: blocked-user filtering in message ingestion is now alias-aware (UID/device/public-code bypass closed).
- Current cycle focus fix: direct conversation "Engelle" flow now blocks full peer alias set and removes canonical thread target.
- Current cycle focus fix: add-family QR scanner reset/latch behavior hardened to prevent stuck scan state after duplicate/invalid attempts.
- Current cycle focus fix: group realtime subscriptions now handle async unmount race safely (late listener cancellation).
- Current cycle focus fix: group mesh payload + family-group parser now preserve media/location metadata in offline path.
- Current cycle focus fix: direct conversation render path now applies alias-aware blocked filtering across merged mesh/store sources.
- Current cycle focus fix: new-message QR flow now blocks self-scan and supports URI-decoded payload fallback.
- Current cycle focus fix: Family screen location tracking lifecycle now uses a single consumer ID and alias-aware family update matching (prevents duplicate tracking sessions and stale teardown).
- Current cycle focus fix: Family map online pulse now depends on normalized recent `lastSeen` instead of status-only heuristic.
- Current cycle focus fix: Messages list/search now ignore non-routable legacy conversation IDs to avoid broken thread navigation.
- Current cycle focus fix: Conversation reply mode now carries `replyTo/replyPreview` metadata in outbound direct messages.
- Current cycle focus fix: Identity QR parser now tolerates code-only v3 payloads and deep-link/query wrapped payload formats.
- Current cycle focus fix: family cloud/local merge now deduplicates members by alias set (`uid/id/deviceId`) to prevent split records.
- Current cycle focus fix: Hybrid cloud fallback target and reply metadata propagation hardened for DM reliability.
- Current cycle focus fix: family remote status/location updates are now remote-source aware (write-back loop suppression) and tracking sync uses canonical member IDs even when updates arrive as UID/device aliases.
- Current cycle focus fix: group chat/service auth-race paths are now guarded to avoid pre-auth subscription lock and startup crashes.
- Current cycle focus fix: QR contact import now validates UID strictly before cloud routing/contact-request operations.
- Current cycle focus fix: family tracking no longer synthesizes `lastSeen=Date.now()` for unknown members (presence freshness now trustworthy).
- Current cycle focus fix: family group sender filtering now expands alias IDs to resolved UIDs to avoid dropping legitimate mesh messages.
- Current cycle focus fix: group-creation flow now resolves and enforces canonical participant UIDs, preventing cloud membership mismatch.
- Current cycle focus fix: family-group fallback messaging now uses direct mesh group broadcast instead of DM `broadcast` routing.
- Current cycle focus fix: family member `lastKnownLocation.timestamp` fallback no longer fabricates fresh `Date.now()` recency.
- Current cycle focus fix: message-store peer canonicalization now rejects non-routable `broadcast/group` IDs to prevent ghost DM threads.
- Current cycle focus fix: family group selection now re-converges deterministically across devices (no first-ID lock), with stale active-group cleanup.
- Current cycle focus fix: group creation now passes concrete `groupId` into family group chat route to preserve post-create context.
- Current cycle focus fix: family location lookup is centralized (`live -> legacy -> lastKnown`) and consumed consistently in map/list/locate actions.
- Current cycle focus fix: group-message `fromDeviceId` now uses mesh device identity first, with regression coverage.
- Current cycle focus fix: family check-in requests now route via canonical UID/device aliases (local `family-*` IDs are excluded from primary routing).
- Current cycle focus fix: release gate is architecture-aligned (`pre-submit` + production validator + `test:critical`) and now blocks real messaging/family/QR regressions.
- Current cycle focus fix: user-scenario and Apple-style test scripts were migrated to current V3 architecture (legacy false-negative checks removed).
- Current cycle focus fix: full Jest suite is green again after migrating stale notification startup safety test from deleted legacy service to active `NotificationService`.
- Current cycle focus fix: `FamilyGroupChatScreen` styles extracted to a dedicated module to reduce screen complexity and improve maintainability.
- Current cycle focus fix: add-family identifier checks now normalize AFN casing and alias comparisons (`id/uid/deviceId`) to prevent duplicate/self-add edge cases.
- Current cycle focus fix: alias lookup typing hardened in `messageStore` and `HybridMessageService` (removed dynamic `any` member scans in critical routing helpers).
- Current cycle focus fix: family realtime listeners now use canonical target resolution and skip non-routable generated local IDs (`family-*`), reducing invalid subscription churn.
- Current cycle focus fix: family map check-in routing now prefers `uid/deviceId` before legacy IDs for more reliable delivery.
- Current cycle focus fix: Hybrid direct-message send path now blocks unresolved/non-routable recipients instead of silently falling back to broadcast.
- Current cycle focus fix: family group mesh sender validation is now alias-aware (`uid/publicCode/deviceId`) with stronger payload metadata.
- Current cycle focus fix: ErrorBoundary "Yeniden Başlat" now uses native app reload when available, with layered fallback.
