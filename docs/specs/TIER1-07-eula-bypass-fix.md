# TIER1 #7 — EULA bypass via ErrorBoundary fallback={null}

> **Risk**: HUKUKİ (Apple Guideline 1.2 / 5.1.1 + KVKK Madde 7)
> **Effort**: M (2 days)
> **Faz**: v1.6.4 Hafta 1

## Root cause (3 trigger paths)

1. **Primary**: `App.tsx:467-471` `<ErrorBoundary fallback={null}><EULAModal /></ErrorBoundary>`. Modal crash → boundary renders null → user bypasses EULA, accesses app without ToS/KVKK consent.
2. **Crash trigger A**: `EULAModal.tsx:62` `BlurView` can throw on certain Android OEM ROMs.
3. **Crash trigger B**: `settingsStore` hydration failure → useSettingsStore throws → render crash → caught → null fallback.

## Defense-in-depth architecture (2 layers)

**Layer 1 — Visible blocking fallback**: Replace `fallback={null}` with `<EULAFallbackScreen />` — renders "Yeniden Başlat" button, NOT null. User cannot bypass via crash.

**Layer 2 — Navigation gate**: `MainNavigator` returns spinner if `!eulaAccepted` (Zustand + sync MMKV double-check). Backstop — even if Layer 1 fails, navigator never renders Main content without acceptance.

Both independent. Layer 2 closes the Zustand hydration race window via `getEulaAcceptedSync()` reading MMKV directly.

## File-by-file changes

| File | Change |
|---|---|
| `src/core/App.tsx:467-471` | `fallback={null}` → `fallback={<EULAFallbackScreen />}` |
| `src/core/App.tsx` (new component) | `EULAFallbackScreen` — non-dismissible View with "Yeniden Başlat" (`expo-updates.reloadAsync`) + support email link. Zero deps on Zustand/BlurView |
| `src/core/navigation/MainNavigator.tsx` (top of function) | Read `eulaAccepted` via Zustand + `getEulaAcceptedSync()` (sync MMKV read of `afetnet-settings` Zustand persist + legacy `AFETNET_EULA_ACCEPTED`). If both false → render ActivityIndicator gate |

## Backward compatibility

Existing accepted users: `getEulaAcceptedSync()` returns true from MMKV → gate skipped, no UX change.
New users: gate shows spinner; `EULAModal` (in App.tsx) overlays; on accept → Zustand updates → spinner disappears → app loads.
`isBootStorageReady` guard preserved (EULA modal doesn't render until MMKV ready).

## Acceptance criteria

- Mock `EULAModal` to throw → `EULAFallbackScreen` visible (not null) → app content NOT accessible → "Yeniden Başlat" triggers reloadAsync
- Direct set `eulaAccepted = false` in Zustand mid-session → MainNavigator shows spinner immediately
- Corrupt `afetnet-settings` MMKV JSON → `getEulaAcceptedSync()` returns false (catch) → gate active → EULA rendered → accept works
- Returning user with valid `eulaAccepted = true` → gate skipped, no spinner, app loads <500ms

## Risk + rollback

**Risk**: MMKV unavailable (AsyncStorage fallback) → `DirectStorage.getString` throws → gate activates spuriously. `try/catch` defaults to `false` (safe — blocks rather than bypass).

**Rollback**: Revert App.tsx fallback to null + remove MainNavigator gate (2 file changes). Layer 1 + Layer 2 independently rollback-able.

## Test plan

Jest: `EULAFallbackScreen.test.tsx` (no nav links, restart button works). `MainNavigator.eulaGate.test.tsx` (spinner when both false, content when either true). `App.eulaError.test.tsx` (mock throw, assert fallback renders).

Manual device: fresh install + BlurView crash mock → assert blocking + restart works.

---
**Full agent spec transcript**: `/private/tmp/.../tasks/a4c4fd4af37b180cd.output`
