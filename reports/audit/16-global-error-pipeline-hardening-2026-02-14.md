# Phase 16 - Global Error Pipeline Hardening

Date: 2026-02-14  
Scope: Crash/exception interception stability, duplicate global-hook prevention, startup determinism

## Objective

Eliminate competing global error-handler overrides that could cause unstable crash behavior, noisy false-fatal paths, and hard-to-debug runtime outcomes in TestFlight.

## Findings

Before this pass, global exception wiring had overlap:

1. `FirebaseCrashlyticsService` initialized its own global handlers (`ErrorUtils`, `onunhandledrejection`).
2. `GlobalErrorHandlerService` also defines global handlers.
3. A legacy `src/core/utils/globalErrorHandler.ts` carried a separate full implementation.

This architecture creates non-deterministic handler order and potential override conflicts.

## Changes Applied

1. **Crashlytics responsibility narrowed to telemetry only**
   - File: `src/core/services/FirebaseCrashlyticsService.ts`
   - Removed internal global-hook installation path.
   - `initialize()` now loads stored reports and starts telemetry without mutating global error hooks.

2. **Single global hook owner established**
   - File: `src/core/init.ts`
   - Added deterministic startup call:
     - `globalErrorHandlerService.initialize()`
   - Initialization order now:
     1. Crashlytics telemetry init
     2. Global error hook init
     3. Remaining service bootstrap

3. **Legacy duplicate implementation neutralized**
   - File: `src/core/utils/globalErrorHandler.ts`
   - Replaced with a compatibility adapter that delegates to `globalErrorHandlerService`.
   - Prevents accidental reintroduction of second global handler path while preserving backward API surface (`initialize`, `reportError`, `wrapAsync`, `getStats`).

4. **Regression guard added**
   - File: `src/core/services/__tests__/FirebaseCrashlyticsService.test.ts`
   - New test verifies `FirebaseCrashlyticsService.initialize()` does **not** replace:
     - `global.ErrorUtils` handler chain
     - `global.onunhandledrejection`

## Verification

- `npm run -s typecheck` -> **PASS**
- `npx jest src/core/services/__tests__/FirebaseCrashlyticsService.test.ts --watchman=false --runInBand` -> **PASS**
- `npm run -s test:critical` -> **PASS** (22/22)
- `npm run -s pre-submit` -> **PASS** (`Errors: 0`, `Warnings: 0`)
- `node scripts/user-scenario-tests.mjs` -> **PASS** (7/7)
- `RUN_JEST_ADVISORY=true node scripts/comprehensive-apple-user-test.mjs` -> **PASS** (`Failures: 0`, `Warnings: 0`)

## Risk Status After This Pass

- Global error interception now has one owner -> lower risk of handler conflicts.
- Crash telemetry remains active -> no visibility regression.
- Legacy import path is compatibility-safe -> lower maintenance risk.

## Remaining Production Caveat

Automated checks are green, but real two-device runtime validation (online/offline transitions, background/foreground, BLE range changes) remains mandatory before App Store submission for life-critical confidence.
