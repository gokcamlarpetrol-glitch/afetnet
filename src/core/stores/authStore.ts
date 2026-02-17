/**
 * AUTH STORE - Zorunlu Kimlik Doğrulama
 * Firebase Auth state management with Zustand
 * ELITE: Persistent auth state with listener
 */

import { create } from 'zustand';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth } from '../../lib/firebase';
import { identityService, UserIdentity } from '../services/IdentityService';
import { AuthService } from '../services/AuthService';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthStore');

interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: UserIdentity | null;
    firebaseUser: User | null;

    // Actions
    initialize: () => Promise<void>;
    setAuthenticated: (authenticated: boolean, user?: UserIdentity | null) => void;
    logout: () => Promise<void>;
}

// ELITE: Track if already initialized to prevent duplicate listeners
let authListenerInitialized = false;
let unsubscribeAuth: (() => void) | null = null;
let hasAuthenticatedInThisLaunch = false;
let pendingSignOutTimer: ReturnType<typeof setTimeout> | null = null;
const SIGN_OUT_GRACE_MS = 3000;
const INITIAL_RESTORE_GRACE_MS = 8000;

export const useAuthStore = create<AuthState>((set, get) => ({
    isAuthenticated: false,
    isLoading: true,
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

        let authTimeout: ReturnType<typeof setTimeout> | null = null;

        try {
            // ELITE: Use getFirebaseAuth() which ensures AsyncStorage persistence
            const auth = getFirebaseAuth();
            if (!auth) {
                logger.error('Firebase auth not initialized');
                set({ isLoading: false, isAuthenticated: false });
                return;
            }

            // CRITICAL FIX: Safety timeout with cached-user fallback.
            // If listener is delayed, prefer current cached auth user over forced logout UI.
            authTimeout = setTimeout(async () => {
                const state = get();
                if (!state.isLoading) {
                    return;
                }

                const cachedUser = auth.currentUser;
                if (cachedUser) {
                    logger.warn('Auth listener timeout (15s) - using cached auth user fallback');
                    try {
                        await identityService.syncFromFirebase(cachedUser);
                        const identity = identityService.getIdentity();
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

                logger.warn('Auth listener timeout (15s) - forcing unauthenticated UI');
                set({ isLoading: false, isAuthenticated: false });
            }, 15000);

            // ELITE: Set up persistent auth state listener
            unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
                if (firebaseUser) {
                    if (authTimeout) {
                        clearTimeout(authTimeout);
                        authTimeout = null;
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

                        set({
                            isAuthenticated: true,
                            isLoading: false,
                            user: identity,
                            firebaseUser: firebaseUser,
                        });

                        if (__DEV__) {
                            logger.info(`✅ User authenticated: ${identity?.uid}`);
                        }
                    } catch (error) {
                        logger.error('Failed to sync identity:', error);
                        set({ isLoading: false, isAuthenticated: false });
                    }
                } else {
                    const currentState = get();
                    const isInitialRestorePhase =
                        currentState.isLoading
                        && !currentState.isAuthenticated
                        && !currentState.firebaseUser
                        && !hasAuthenticatedInThisLaunch;

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
                                        if (authTimeout) {
                                            clearTimeout(authTimeout);
                                            authTimeout = null;
                                        }
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

                                if (authTimeout) {
                                    clearTimeout(authTimeout);
                                    authTimeout = null;
                                }
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
                                        if (authTimeout) {
                                            clearTimeout(authTimeout);
                                            authTimeout = null;
                                        }
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

                                set({
                                    isAuthenticated: false,
                                    isLoading: false,
                                    user: null,
                                    firebaseUser: null,
                                });
                                if (authTimeout) {
                                    clearTimeout(authTimeout);
                                    authTimeout = null;
                                }

                                if (__DEV__) {
                                    logger.info('👤 User signed out');
                                }
                            })();
                        }, SIGN_OUT_GRACE_MS);
                        return;
                    }

                    set({
                        isAuthenticated: false,
                        isLoading: false,
                        user: null,
                        firebaseUser: null,
                    });
                    if (authTimeout) {
                        clearTimeout(authTimeout);
                        authTimeout = null;
                    }
                }
            });

            authListenerInitialized = true;
            if (__DEV__) {
                logger.info('🔐 Auth listener initialized');
            }
        } catch (error) {
            logger.error('Failed to initialize auth:', error);
            if (authTimeout) {
                clearTimeout(authTimeout);
            }
            set({ isLoading: false, isAuthenticated: false });
        }
    },

    setAuthenticated: (authenticated, user = null) => {
        set({ isAuthenticated: authenticated, user });
    },

    logout: async () => {
        try {
            await AuthService.signOut();

            set({
                isAuthenticated: false,
                user: null,
                firebaseUser: null,
            });

            if (__DEV__) {
                logger.info('🚪 User logged out');
            }
        } catch (error) {
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
        hasAuthenticatedInThisLaunch = false;
    }
    if (pendingSignOutTimer) {
        clearTimeout(pendingSignOutTimer);
        pendingSignOutTimer = null;
    }
};
