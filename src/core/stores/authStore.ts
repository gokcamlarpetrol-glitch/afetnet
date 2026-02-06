/**
 * AUTH STORE - Zorunlu Kimlik Doğrulama
 * Firebase Auth state management with Zustand
 * ELITE: Persistent auth state with listener
 */

import { create } from 'zustand';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirebase } from '../../lib/firebase';
import { identityService, UserIdentity } from '../services/IdentityService';
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

        try {
            const app = initializeFirebase();
            if (!app) {
                logger.error('Firebase app not initialized');
                set({ isLoading: false, isAuthenticated: false });
                return;
            }

            const auth = getAuth(app);

            // ELITE: Set up persistent auth state listener
            unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
                if (firebaseUser) {
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
                            logger.info(`✅ User authenticated: ${identity?.id}`);
                        }
                    } catch (error) {
                        logger.error('Failed to sync identity:', error);
                        set({ isLoading: false, isAuthenticated: false });
                    }
                } else {
                    // User is signed out
                    set({
                        isAuthenticated: false,
                        isLoading: false,
                        user: null,
                        firebaseUser: null,
                    });

                    if (__DEV__) {
                        logger.info('👤 User signed out');
                    }
                }
            });

            authListenerInitialized = true;
            if (__DEV__) {
                logger.info('🔐 Auth listener initialized');
            }
        } catch (error) {
            logger.error('Failed to initialize auth:', error);
            set({ isLoading: false, isAuthenticated: false });
        }
    },

    setAuthenticated: (authenticated, user = null) => {
        set({ isAuthenticated: authenticated, user });
    },

    logout: async () => {
        try {
            const app = initializeFirebase();
            if (app) {
                const auth = getAuth(app);
                await auth.signOut();
            }

            await identityService.clearIdentity();

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
    }
};
