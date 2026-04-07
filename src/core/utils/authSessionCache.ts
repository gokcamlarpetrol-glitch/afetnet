import { DirectStorage } from './storage';

const AUTH_CACHE_KEY = 'afetnet_auth_cached';
const AUTH_CACHE_UID_KEY = 'afetnet_auth_cached_uid';
const IDENTITY_CACHE_KEY = '@afetnet:identity_cache_v4';
const EXPLICIT_SIGN_OUT_KEY = 'afetnet_explicit_signout_pending';

const normalizeUid = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function hasCachedAuthenticatedSession(): boolean {
  try {
    return DirectStorage.getBoolean(AUTH_CACHE_KEY) || false;
  } catch {
    return false;
  }
}

export function readCachedAuthUid(): string | null {
  try {
    const cachedUid = normalizeUid(DirectStorage.getString(AUTH_CACHE_UID_KEY));
    if (cachedUid) {
      return cachedUid;
    }
  } catch {
    // best effort
  }

  try {
    const rawIdentity = DirectStorage.getString(IDENTITY_CACHE_KEY);
    if (!rawIdentity) return null;
    const parsed = JSON.parse(rawIdentity) as { uid?: unknown } | null;
    return normalizeUid(parsed?.uid);
  } catch {
    return null;
  }
}

export function setCachedAuthenticatedSession(authenticated: boolean, uid?: string | null): void {
  // CRITICAL FIX: Write-verify pattern. If this write fails silently, next cold start
  // won't have cached auth → shows login screen even though user is authenticated.
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      DirectStorage.setBoolean(AUTH_CACHE_KEY, authenticated);
      // Verify write
      const readBack = DirectStorage.getBoolean(AUTH_CACHE_KEY);
      if (readBack !== authenticated) {
        console.error(`[AuthSessionCache] Write-verify MISMATCH (attempt ${attempt}/${MAX_RETRIES}): wrote=${authenticated}, read=${readBack}`);
        continue;
      }
      const normalizedUid = normalizeUid(uid);
      if (authenticated && normalizedUid) {
        DirectStorage.setString(AUTH_CACHE_UID_KEY, normalizedUid);
      } else if (!authenticated) {
        DirectStorage.delete(AUTH_CACHE_UID_KEY);
      }
      return; // Success
    } catch (e) {
      console.error(`[AuthSessionCache] setCachedAuthenticatedSession FAILED (attempt ${attempt}/${MAX_RETRIES}):`, e);
    }
  }
  console.error(`[AuthSessionCache] CRITICAL: setCachedAuthenticatedSession FAILED after ${MAX_RETRIES} retries`);
}

export function isExplicitSignOutPending(): boolean {
  try {
    return DirectStorage.getBoolean(EXPLICIT_SIGN_OUT_KEY) || false;
  } catch {
    return false;
  }
}

export function setExplicitSignOutPending(pending: boolean): void {
  try {
    if (pending) {
      DirectStorage.setBoolean(EXPLICIT_SIGN_OUT_KEY, true);
    } else {
      DirectStorage.delete(EXPLICIT_SIGN_OUT_KEY);
    }
  } catch {
    // non-blocking
  }
}
