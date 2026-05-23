# TIER1 #2 — Cross-account state isolation

> **Risk**: HUKUKİ (KVKK Madde 4-6 — cross-user PII leak)
> **Effort**: M (3 days + device test)
> **Faz**: v1.6.4 Hafta 1

## Root cause (5 leak points)

1. **`@afetnet:apple_name_latest`** global MMKV key — User A's Apple display name leaks to User B when B's UID-scoped key is missing. `IdentityService.getCachedAppleName()` line 169 falls back to `storedLatest` unconditionally.
2. **`EmergencyHealthSharingService.isEnabled`** — singleton in-memory flag never reset across signout/signin. User A's opt-in persists for User B's first SOS.
3. **`FCMTokenService.cleanup()`** — never called from `AuthService.signOut()`. Stale tokens at `push_tokens/{userA.uid}` deliver A's notifications to B's device.
4. **`SessionSecurityService.loadConfig()`** — runs at init before auth ready → keys scoped to `:anonymous` → shared bucket across users.
5. **No central lifecycle bus** — each service has its own `cleanup()`; new services often forgotten in `signOut()`.

## Proposed architecture — `AuthLifecycle` event bus

`src/core/auth/AuthLifecycle.ts` (NEW): services register `onLogin(uid)` + `onLogout(uid)`. `AuthService.signOut()` emits logout BEFORE Firebase signOut. `authStore.onAuthStateChanged` (user!=null) emits login.

## File-by-file changes

| File | Change |
|---|---|
| `src/core/auth/AuthLifecycle.ts` (NEW) | Event bus singleton with `register()` / `emitLogin()` / `emitLogout()` (LIFO logout order, Promise.race 5s per handler) |
| `IdentityService.ts:169` | Remove `storedLatest` fallback — read ONLY UID-scoped key |
| `IdentityService.ts` (end) | Register: `onLogin → initialize`, `onLogout → clearIdentity` |
| `EmergencyHealthSharingService.ts` | Add `reset()`: clear interval + isEnabled + rescuerAllowlist. Register: `onLogin → reset+initialize`, `onLogout → stopBroadcast+reset`. Add UID guard to `handleReceivedPacket` (drop if no auth) |
| `FCMTokenService.ts` (end) | Register: `onLogin → initialize`, `onLogout → cleanup` (already exists at line 578) |
| `SessionSecurityService.ts:68` | `getStorageKeys(uid?)` accepts explicit UID. `initialize(uid)` signature change. Register with bus instead of init.ts Phase B |
| `authStore.ts:231-244` | After successful login + identity sync: `await authLifecycle.emitLogin(uid)` |
| `AuthService.signOut()` line 531 | Before Firebase signOut: `await authLifecycle.emitLogout(uid)` |
| `init.ts shutdownApp()` line 1094 | Before service teardown: `await authLifecycle.emitLogout(shutdownUid)` |
| `PresenceService.ts` (end) | Register: `onLogin → initialize`, `onLogout → cleanup` |

## Storage key migration

`@afetnet:apple_name_latest` retained as write-cache (Apple sends fullName only on first auth) but NEVER read. Migration: when UID-scoped key found AND `_latest` matches, delete `_latest`. Users with `_latest` only fall back to Firebase Auth user.displayName.

## Acceptance criteria

- Sign-in A (Apple, name="Ayşe Kaya") → sign-out → sign-in B (Google) → assert: `identityService.getDisplayName() !== 'Ayşe Kaya'`, `users/{B}` displayName != Ayşe Kaya
- B's `health_sharing_enabled` defaults to false on first read (not A's value)
- `push_tokens/{A}` deleted on A's signout; new `push_tokens/{B}` on B's signin
- `SessionSecurityService` config loaded from `:${uidB}` scope (not `:anonymous`)

## Risk + rollback

**Risk**: `emitLogout` hang if handler stalls (5s timeout per handler via Promise.race). EULA `eulaAccepted` global is INTENDED (App Store only requires first-time user).

**Rollback**: Remove bus registrations; restore manual `cleanup()` calls in `signOut()`. Partial-rollback safe (additive pattern).

## Test plan

Jest: AuthLifecycle.test.ts (handler order, throw isolation). IdentityService.test.ts (no `_latest` fallback). Manual device: A signin → B signin → assert no A state visible in all screens.

---
**Full agent spec transcript** (longer detail, code snippets):
`/private/tmp/claude-501/-Users-gokhancamci-AfetNet1/2f07cb9d-2dd6-461a-b5e8-f5f32d21b2ba/tasks/a4c4fd4af37b180cd.output`
