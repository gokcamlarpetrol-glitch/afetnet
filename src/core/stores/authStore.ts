/**
 * AUTH STORE - Zorunlu Kimlik Doğrulama
 * Firebase Auth state management with Zustand
 * ELITE: Persistent auth state with listener
 *
 * BOOT STATE MACHINE:
 *   COLD_START → RESTORING → AUTHENTICATED → (App.tsx triggers initializeApp) → READY
 *                          → UNAUTHENTICATED → (show AuthNavigator)
 *                          → ERROR → (show fallback login button)
 *
 * State transitions are logged via `logBootState()` for production diagnostics.
 */

import { create } from 'zustand';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth } from '../../lib/firebase';
import { identityService, UserIdentity } from '../services/IdentityService';
import { AuthService } from '../services/AuthService';
import { createLogger } from '../utils/logger';
import {
    hasCachedAuthenticatedSession,
    isExplicitSignOutPending,
    setCachedAuthenticatedSession,
    setExplicitSignOutPending,
} from '../utils/authSessionCache';

const logger = createLogger('AuthStore');

// ---------------------------------------------------------------------------
// Boot state tracking — deterministic state machine for auth initialization
// ---------------------------------------------------------------------------
type BootState =
    | 'COLD_START'
    | 'RESTORING'
    | 'AUTHENTICATED'
    | 'UNAUTHENTICATED'
    | 'ERROR';

let currentBootState: BootState = 'COLD_START';

function logBootState(from: BootState, to: BootState, reason: string): void {
    currentBootState = to;
    // Log in ALL builds (not just __DEV__) — Crashlytics captures console.log for diagnostics
    logger.info(`Auth boot: ${from} -> ${to} (${reason})`);
}

export function getBootState(): BootState {
    return currentBootState;
}

async function ensurePushTokenRegistration(trigger: string): Promise<void> {
    try {
        const { fcmTokenService } = await import('../services/FCMTokenService');
        const token = await fcmTokenService.initialize({ allowPermissionPrompt: false });
        if (!token) {
            logger.info(`Push token registration deferred (${trigger}) - notification permission not granted`);
            return;
        }
        await fcmTokenService.registerTokenWithServer();
        logger.info(`✅ Push token registration ensured (${trigger})`);
    } catch (error) {
        logger.warn(`Push token registration attempt failed (${trigger}):`, error);
    }
}

interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: UserIdentity | null;
    firebaseUser: User | null;

    // Actions
    initialize: () => Promise<void>;
    setAuthenticated: (authenticated: boolean, user?: UserIdentity | null) => void;
    logout: () => Promise<void>;
    /** Force stop loading and show login screen — used as safety timeout fallback */
    forceUnauthenticated: () => void;
}

// ELITE: Track if already initialized to prevent duplicate listeners
let authListenerInitialized = false;
let unsubscribeAuth: (() => void) | null = null;
let hasAuthenticatedInThisLaunch = false;
let pendingSignOutTimer: ReturnType<typeof setTimeout> | null = null;
let authInitTimeout: ReturnType<typeof setTimeout> | null = null;
const SIGN_OUT_GRACE_MS = 3000;
const INITIAL_RESTORE_GRACE_MS = 8000;

// CRITICAL FIX: Read cached auth state so the app shows Main (not Auth screen)
// while Firebase restores the session. This prevents the flash-to-login bug.
const cachedAuth = hasCachedAuthenticatedSession();
// Log cold start state — this fires at module load time (before any React render)
logger.info(`Auth boot: COLD_START (cachedAuth=${cachedAuth}, explicitSignOut=${isExplicitSignOutPending()})`);

export const useAuthStore = create<AuthState>((set, get) => ({
    isAuthenticated: cachedAuth,
    isLoading: !cachedAuth, // If cached=true, skip loading (show Main immediately)
    user: null,
    firebaseUser: null,

    initialize: async () => {
        // Prevent duplicate initialization
        if (authListenerInitialized) {
            if (__DEV__) {
                logger.debug('Auth listener already initialized');
            }
            return;
        }

        logBootState(currentBootState, 'RESTORING', 'initialize() called');

        try {
            // ELITE: Use getFirebaseAuth() which ensures MMKV persistence
            const auth = getFirebaseAuth();
            if (!auth) {
                logBootState(currentBootState, 'ERROR', 'Firebase auth not initialized');
                // CRITICAL FIX: Do NOT force isAuthenticated=false here. If MMKV cache says
                // the user was authenticated (cachedAuth=true at boot), forcing false causes
                // the "logout on kill" bug. getFirebaseAuth() can transiently return null due
                // to Firebase config loading race, expo-constants timing, or initializeApp
                // error. The user should remain authenticated from cache until an EXPLICIT
                // sign-out occurs. Only clear auth if there was no cached session.
                if (!cachedAuth) {
                    set({ isLoading: false, isAuthenticated: false });
                } else {
                    logger.warn('getFirebaseAuth() returned null but cachedAuth=true — preserving cached auth session');
                    set({ isLoading: false });
                }
                // CRITICAL FIX: Do NOT set authListenerInitialized=true here.
                // If getFirebaseAuth() returns null, we must allow retry on next initialize() call.
                return;
            }

            // CRITICAL FIX: Safety timeout with cached-user fallback.
            // If listener is delayed, prefer current cached auth user over forced logout UI.
            // Promoted to module-level so cleanupAuthListener can clear it.
            if (authInitTimeout) clearTimeout(authInitTimeout);
            authInitTimeout = setTimeout(async () => {
                const state = get();
                if (!state.isLoading) {
                    return;
                }

                const cachedUser = auth.currentUser;
                if (cachedUser) {
                    logBootState(currentBootState, 'AUTHENTICATED', 'timeout fallback — cached Firebase user exists');
                    try {
                        await identityService.syncFromFirebase(cachedUser);
                        const identity = identityService.getIdentity();
                        setCachedAuthenticatedSession(true, cachedUser.uid);
                        setExplicitSignOutPending(false);
                        set({
                            isAuthenticated: true,
                            isLoading: false,
                            user: identity,
                            firebaseUser: cachedUser,
                        });
                        return;
                    } catch (fallbackError) {
                        logger.warn('Cached auth user fallback failed:', fallbackError);
                    }
                }

                // CRITICAL: Only force unauthenticated if MMKV cache also says no auth
                if (!hasCachedAuthenticatedSession()) {
                    logBootState(currentBootState, 'UNAUTHENTICATED', 'timeout: no Firebase user + no MMKV cache');
                    set({ isLoading: false, isAuthenticated: false });
                } else {
                    // MMKV says user was authenticated — keep showing Main, keep trying
                    logBootState(currentBootState, 'AUTHENTICATED', 'timeout: no Firebase user but MMKV cache preserving session');
                    set({ isLoading: false }); // Stop loading spinner but keep isAuthenticated=true from cache
                }
            }, 15000);

            // ELITE: Set up persistent auth state listener
            // CRITICAL FIX: Set flag AFTER onAuthStateChanged succeeds, not before.
            // If getFirebaseAuth() returned null above, the flag stays false so retry is possible.
            authListenerInitialized = true;

            unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
                if (firebaseUser) {
                    if (authInitTimeout) {
                        clearTimeout(authInitTimeout);
                        authInitTimeout = null;
                    }
                    if (pendingSignOutTimer) {
                        clearTimeout(pendingSignOutTimer);
                        pendingSignOutTimer = null;
                    }
                    hasAuthenticatedInThisLaunch = true;
                    // User is signed in
                    try {
                        await identityService.syncFromFirebase(firebaseUser);
                        const identity = identityService.getIdentity();

                        logBootState(currentBootState, 'AUTHENTICATED', `uid=${firebaseUser.uid}`);

                        set({
                            isAuthenticated: true,
                            isLoading: false,
                            user: identity,
                            firebaseUser: firebaseUser,
                        });

                        // CRITICAL: Cache auth state in MMKV for next launch
                        setCachedAuthenticatedSession(true, firebaseUser.uid);
                        setExplicitSignOutPending(false);

                        // CRITICAL: Ensure token exists in push_tokens/fcm_tokens after auth is ready.
                        // This closes auth-race windows where app init requested token before UID was available.
                        void ensurePushTokenRegistration('auth-state-change');

                        if (__DEV__) {
                            logger.info(`User authenticated: ${identity?.uid}`);
                        }
                    } catch (error) {
                        logger.error('Failed to sync identity:', error);
                        // Never force-login-loop on identity sync issues.
                        // Firebase user is still authenticated; keep session alive and retry later.
                        setCachedAuthenticatedSession(true, firebaseUser.uid);
                        setExplicitSignOutPending(false);
                        set({
                            isAuthenticated: true,
                            isLoading: false,
                            user: get().user,
                            firebaseUser,
                        });
                    }
                } else {
                    const isInitialRestorePhase = !hasAuthenticatedInThisLaunch;

                    // Firebase may emit a transient null before persisted auth is restored.
                    // Keep loading state for a grace window instead of forcing login screen.
                    if (isInitialRestorePhase) {
                        if (pendingSignOutTimer) {
                            clearTimeout(pendingSignOutTimer);
                        }
                        pendingSignOutTimer = setTimeout(() => {
                            pendingSignOutTimer = null;
                            void (async () => {
                                const reboundUser = getFirebaseAuth()?.currentUser;
                                if (reboundUser) {
                                    try {
                                        await identityService.syncFromFirebase(reboundUser);
                                        const identity = identityService.getIdentity();
                                        if (authInitTimeout) {
                                            clearTimeout(authInitTimeout);
                                            authInitTimeout = null;
                                        }
                                        // FIX: Persist recovered auth to MMKV + log state transition
                                        logBootState(currentBootState, 'AUTHENTICATED', `initial restore rebound uid=${reboundUser.uid}`);
                                        setCachedAuthenticatedSession(true, reboundUser.uid);
                                        setExplicitSignOutPending(false);
                                        set({
                                            isAuthenticated: true,
                                            isLoading: false,
                                            user: identity,
                                            firebaseUser: reboundUser,
                                        });
                                        return;
                                    } catch (recoverError) {
                                        logger.warn('Auth recovery during initial restore phase failed:', recoverError);
                                    }
                                }

                                if (authInitTimeout) {
                                    clearTimeout(authInitTimeout);
                                    authInitTimeout = null;
                                }
                                if (hasCachedAuthenticatedSession() && !isExplicitSignOutPending()) {
                                    // Verify Firebase Auth actually has a user before preserving
                                    const restoredUser = getFirebaseAuth()?.currentUser;
                                    if (restoredUser) {
                                        logger.warn('Initial auth restore exceeded grace window; Firebase user exists, preserving');
                                        setCachedAuthenticatedSession(true, restoredUser.uid);
                                        set({
                                            isAuthenticated: true,
                                            isLoading: false,
                                            user: get().user,
                                            firebaseUser: restoredUser,
                                        });
                                        return;
                                    }
                                    // CRITICAL FIX: MMKV cache says user was authenticated but Firebase Auth
                                    // couldn't restore the user after the grace window. This happens when:
                                    //   1. MMKV encryption key changed (all Firebase Auth tokens unreadable)
                                    //   2. Firebase Auth persistence adapter returned null for all reads
                                    //   3. Network-dependent token refresh failed on first launch
                                    // Instead of logging the user out (destroying their session), preserve
                                    // the cached auth state so the app remains usable. The user set
                                    // afetnet_auth_cached=true by successfully authenticating previously.
                                    // Clearing their session here forces them through login again for a
                                    // transient persistence issue — which is the exact "logout on kill" bug.
                                    logger.warn('Initial auth restore: no Firebase user after grace window — PRESERVING cached auth (user never explicitly signed out)');
                                    set({
                                        isAuthenticated: true,
                                        isLoading: false,
                                        user: get().user,
                                        firebaseUser: null,
                                    });
                                    // CRITICAL FIX: Schedule a delayed re-auth attempt.
                                    // With firebaseUser=null, all Firestore operations will fail
                                    // (no auth token). Try to recover by forcing Firebase Auth to
                                    // re-read from MMKV persistence after a delay (network may
                                    // have been unavailable during the initial restore window).
                                    setTimeout(async () => {
                                        try {
                                            const delayedAuth = getFirebaseAuth();
                                            const delayedUser = delayedAuth?.currentUser;
                                            if (delayedUser) {
                                                // Force token refresh to ensure we have valid credentials
                                                await delayedUser.getIdToken(true);
                                                await identityService.syncFromFirebase(delayedUser);
                                                const identity = identityService.getIdentity();
                                                setCachedAuthenticatedSession(true, delayedUser.uid);
                                                set({
                                                    isAuthenticated: true,
                                                    isLoading: false,
                                                    user: identity,
                                                    firebaseUser: delayedUser,
                                                });
                                                logger.info(`Delayed re-auth succeeded: uid=${delayedUser.uid}`);
                                            }
                                        } catch (reAuthError) {
                                            logger.warn('Delayed re-auth attempt failed (user stays authenticated from cache):', reAuthError);
                                        }
                                    }, 10_000); // 10s delay — give network time to come online
                                    return;
                                }
                                logBootState(currentBootState, 'UNAUTHENTICATED', 'initial restore: no cache + no Firebase user');
                                set({
                                    isAuthenticated: false,
                                    isLoading: false,
                                    user: null,
                                    firebaseUser: null,
                                });
                            })();
                        }, INITIAL_RESTORE_GRACE_MS);
                        return;
                    }

                    // User is signed out
                    const hadAuthenticatedSession =
                        get().isAuthenticated || !!get().firebaseUser || hasAuthenticatedInThisLaunch;

                    // Guard against transient null emissions while persisted auth is restoring.
                    if (hadAuthenticatedSession) {
                        if (pendingSignOutTimer) {
                            clearTimeout(pendingSignOutTimer);
                        }
                        pendingSignOutTimer = setTimeout(() => {
                            pendingSignOutTimer = null;
                            void (async () => {
                                const reboundUser = getFirebaseAuth()?.currentUser;
                                if (reboundUser) {
                                    try {
                                        await identityService.syncFromFirebase(reboundUser);
                                        const identity = identityService.getIdentity();
                                        if (authInitTimeout) {
                                            clearTimeout(authInitTimeout);
                                            authInitTimeout = null;
                                        }
                                        // FIX: Persist recovered auth to MMKV so next cold start has cached session
                                        setCachedAuthenticatedSession(true, reboundUser.uid);
                                        setExplicitSignOutPending(false);
                                        set({
                                            isAuthenticated: true,
                                            isLoading: false,
                                            user: identity,
                                            firebaseUser: reboundUser,
                                        });
                                        if (__DEV__) {
                                            logger.debug('Auth recovered after transient null state');
                                        }
                                        return;
                                    } catch (recoverError) {
                                        logger.warn('Auth recovery after transient null failed:', recoverError);
                                    }
                                }

                                if (!isExplicitSignOutPending()) {
                                    // Check if this is a real session invalidation (token revoked, account disabled)
                                    // vs a transient null (cold start, network blip).
                                    const finalAuth = getFirebaseAuth()?.currentUser;
                                    if (!finalAuth) {
                                        // CRITICAL FIX: If MMKV cache says user was authenticated and
                                        // there was no explicit sign-out, preserve the session. Without
                                        // this, transient Firebase Auth null emissions (MMKV encryption key
                                        // change, persistence adapter failure, etc.) force the user through
                                        // login again — the "logout on background kill" bug.
                                        // The user will be re-authenticated on next successful Firebase Auth
                                        // restoration, or can be prompted to re-auth if Firestore calls fail.
                                        if (hasCachedAuthenticatedSession()) {
                                            logger.warn('Auth null after recovery but MMKV cache says authenticated — preserving session');
                                            set({
                                                isAuthenticated: true,
                                                isLoading: false,
                                                user: get().user,
                                                firebaseUser: null,
                                            });
                                            // CRITICAL FIX: Delayed re-auth — without firebaseUser,
                                            // Firestore operations will fail. Retry after network stabilizes.
                                            setTimeout(async () => {
                                                try {
                                                    const retryAuth = getFirebaseAuth();
                                                    const retryUser = retryAuth?.currentUser;
                                                    if (retryUser) {
                                                        await retryUser.getIdToken(true);
                                                        await identityService.syncFromFirebase(retryUser);
                                                        const identity = identityService.getIdentity();
                                                        setCachedAuthenticatedSession(true, retryUser.uid);
                                                        set({
                                                            isAuthenticated: true,
                                                            isLoading: false,
                                                            user: identity,
                                                            firebaseUser: retryUser,
                                                        });
                                                        logger.info(`Delayed re-auth (post-grace) succeeded: uid=${retryUser.uid}`);
                                                    }
                                                } catch (e) {
                                                    logger.warn('Delayed re-auth (post-grace) failed:', e);
                                                }
                                            }, 10_000);
                                            return;
                                        }
                                        // No Firebase user AND no MMKV cache — session is truly dead
                                        logBootState(currentBootState, 'UNAUTHENTICATED', 'no Firebase user + no MMKV cache after grace');
                                        setCachedAuthenticatedSession(false);
                                        set({
                                            isAuthenticated: false,
                                            isLoading: false,
                                            user: null,
                                            firebaseUser: null,
                                        });
                                        return;
                                    }
                                    // Firebase user exists but onAuthStateChanged fired with null transiently
                                    logger.warn('Transient null auth — Firebase user still exists, preserving session');
                                    // FIX: Persist recovered auth to MMKV
                                    setCachedAuthenticatedSession(true, finalAuth.uid);
                                    setExplicitSignOutPending(false);
                                    set({
                                        isAuthenticated: true,
                                        isLoading: false,
                                        user: get().user,
                                        firebaseUser: finalAuth,
                                    });
                                    return;
                                }

                                // Harden against token-expiry/session-drop flows where explicit logout()
                                // is not called. This prevents cross-account data bleed.
                                try {
                                    const [{ presenceService }, { contactRequestService }, { authSessionCleanupService }] =
                                        await Promise.all([
                                            import('../services/PresenceService'),
                                            import('../services/ContactRequestService'),
                                            import('../services/AuthSessionCleanupService'),
                                        ]);
                                    await presenceService.cleanup();
                                    await contactRequestService.cleanup();
                                    await authSessionCleanupService.clearLocalSessionData();
                                } catch (cleanupError) {
                                    logger.warn('Auth sign-out cleanup encountered a non-blocking error:', cleanupError);
                                }

                                await identityService.clearIdentity().catch((identityError) => {
                                    logger.warn('Failed to clear cached identity after sign-out event:', identityError);
                                });

                                // CRITICAL: Clear cached auth state on confirmed sign-out
                                logBootState(currentBootState, 'UNAUTHENTICATED', 'explicit sign-out confirmed');
                                setCachedAuthenticatedSession(false);
                                setExplicitSignOutPending(false);

                                set({
                                    isAuthenticated: false,
                                    isLoading: false,
                                    user: null,
                                    firebaseUser: null,
                                });
                                if (authInitTimeout) {
                                    clearTimeout(authInitTimeout);
                                    authInitTimeout = null;
                                }

                                if (__DEV__) {
                                    logger.info('User signed out');
                                }
                            })();
                        }, SIGN_OUT_GRACE_MS);
                        return;
                    }

                    logBootState(currentBootState, 'UNAUTHENTICATED', 'no prior session, Firebase user null');
                    set({
                        isAuthenticated: false,
                        isLoading: false,
                        user: null,
                        firebaseUser: null,
                    });
                    if (authInitTimeout) {
                        clearTimeout(authInitTimeout);
                        authInitTimeout = null;
                    }
                }
            });

            if (__DEV__) {
                logger.info('🔐 Auth listener initialized');
            }
        } catch (error) {
            logBootState(currentBootState, 'ERROR', `initialize() threw: ${error}`);
            authListenerInitialized = false; // Allow retry on failure
            if (authInitTimeout) {
                clearTimeout(authInitTimeout);
            }
            // CRITICAL FIX: Do NOT force isAuthenticated=false on initialization error.
            // If MMKV cache says the user was authenticated (cachedAuth=true), an init
            // error (e.g., Firebase config race, module import failure) should NOT force
            // the user to re-authenticate. This was a root cause of the "logout on kill" bug:
            // any transient error during initialize() would override the cached auth state.
            if (!cachedAuth) {
                set({ isLoading: false, isAuthenticated: false });
            } else {
                logger.warn('initialize() threw but cachedAuth=true — preserving cached auth session');
                set({ isLoading: false });
            }
        }
    },

    setAuthenticated: (authenticated, user = null) => {
        set({
            isAuthenticated: authenticated,
            user,
            // CRITICAL: Clear firebaseUser when deauthenticating to prevent stale reference
            ...(authenticated ? {} : { firebaseUser: null }),
        });
    },

    forceUnauthenticated: () => {
        // Safety fallback: if auth loading hangs for too long, let the user
        // manually drop to the login screen. This prevents Apple Review rejection
        // for indefinite spinner.
        logBootState(currentBootState, 'UNAUTHENTICATED', 'forceUnauthenticated() — user tapped fallback login button');
        // FIX: Clear pendingSignOutTimer to prevent stale timer from overwriting
        // the forced-unauthenticated state with isAuthenticated: true after grace period.
        if (pendingSignOutTimer) { clearTimeout(pendingSignOutTimer); pendingSignOutTimer = null; }
        if (authInitTimeout) { clearTimeout(authInitTimeout); authInitTimeout = null; }
        // AUDIT FIX: Clear MMKV cache to prevent stale cached auth on next launch
        setCachedAuthenticatedSession(false);
        set({ isLoading: false, isAuthenticated: false });
    },

    logout: async () => {
        try {
            // CRITICAL FIX: Clear pending timers before sign-out.
            // A transient null from onAuthStateChanged may have scheduled pendingSignOutTimer
            // with a grace-period recovery. If we don't clear it, the timer fires AFTER logout()
            // completes and overwrites isAuthenticated=false with the stale cached user.
            if (pendingSignOutTimer) { clearTimeout(pendingSignOutTimer); pendingSignOutTimer = null; }
            if (authInitTimeout) { clearTimeout(authInitTimeout); authInitTimeout = null; }
            // CRITICAL: Set explicit sign-out flag BEFORE sign-out
            setExplicitSignOutPending(true);
            // CRITICAL FIX: Do NOT clear cached auth session BEFORE signOut completes.
            // If signOut() throws, the cache is already cleared but the user is still
            // signed in to Firebase → next cold start shows login screen despite valid session.
            // Clear the cache AFTER signOut succeeds.
            await AuthService.signOut();

            // Only clear cache AFTER sign-out succeeds
            setCachedAuthenticatedSession(false);

            set({
                isAuthenticated: false,
                user: null,
                firebaseUser: null,
            });

            if (__DEV__) {
                logger.info('🚪 User logged out');
            }
        } catch (error) {
            // CRITICAL FIX: Restore cached auth state on sign-out failure.
            // Previously, setCachedAuthenticatedSession(false) was called before signOut(),
            // so a failed sign-out left the cache cleared → next launch showed login screen.
            setExplicitSignOutPending(false);
            logger.error('Logout failed:', error);
        }
    },
}));

// ELITE: Cleanup function for app shutdown
export const cleanupAuthListener = () => {
    if (unsubscribeAuth) {
        unsubscribeAuth();
        unsubscribeAuth = null;
        authListenerInitialized = false;
        // CRITICAL FIX: Do NOT reset hasAuthenticatedInThisLaunch here.
        // It's a session-level flag. Resetting it causes the re-initialized
        // auth listener to misidentify transient null as initial-restore-phase,
        // triggering an 8-second grace timer and delayed/incorrect auth resolution.
    }
    if (pendingSignOutTimer) {
        clearTimeout(pendingSignOutTimer);
        pendingSignOutTimer = null;
    }
    if (authInitTimeout) {
        clearTimeout(authInitTimeout);
        authInitTimeout = null;
    }
    // Reset boot state for next session (hot reload, unmount+remount)
    currentBootState = 'COLD_START';
};

// CRITICAL FIX: Subscribe guard for isAuthenticated — mirrors the onboardingStore pattern.
// If MMKV auth cache said true at boot (cachedAuth=true), isAuthenticated must NEVER be
// set to false unless an EXPLICIT sign-out occurred. Without this guard, any code path
// (Firebase Auth init failure, onAuthStateChanged transient null, race condition) that
// sets isAuthenticated=false despite the cached session causes the user to see the login
// screen — the "logout on background kill" bug.
//
// The guard checks isExplicitSignOutPending() because:
//   1. logout() sets explicitSignOutPending=true BEFORE calling signOut()
//   2. onAuthStateChanged null handler checks isExplicitSignOutPending before clearing
//   3. If the flag is true, the user intentionally signed out — allow isAuthenticated=false
//
// This is the LAST LINE OF DEFENSE. Even if a bug in the auth listener or init code
// accidentally sets isAuthenticated=false, this guard immediately corrects it.
if (cachedAuth) {
    useAuthStore.subscribe((state) => {
        if (!state.isAuthenticated && !isExplicitSignOutPending()) {
            // Double-check MMKV is still consistent (not cleared by legitimate logout)
            if (hasCachedAuthenticatedSession()) {
                console.warn('[AuthStore] isAuthenticated was set to false despite cachedAuth=true and no explicit sign-out — restoring immediately');
                useAuthStore.setState({ isAuthenticated: true });
            }
        }
    });
}
