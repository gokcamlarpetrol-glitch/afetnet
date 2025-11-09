/**
 * ELITE: FIREBASE AUTHENTICATION SERVICE
 * Anonymous authentication for Firestore access
 * Production-grade with comprehensive error handling and retry mechanisms
 */

// ELITE: Lazy import Firebase Auth to prevent Metro bundler issues
let firebaseAuth: any = null;

async function getFirebaseAuthModule() {
  if (!firebaseAuth) {
    try {
      firebaseAuth = await import('firebase/auth');
    } catch (error) {
      throw new Error(`Failed to load firebase/auth: ${error}`);
    }
  }
  return firebaseAuth;
}

import { createLogger } from '../utils/logger';
import getFirebaseApp from '../../lib/firebase';

const logger = createLogger('FirebaseAuthService');

class FirebaseAuthService {
  private auth: any = null;
  private currentUser: any = null;
  private isInitialized = false;
  private isAuthenticating = false;
  private authStateListener: (() => void) | null = null;
  private retryAttempts = 0;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private retryTimeout: NodeJS.Timeout | null = null;

  /**
   * Initialize Firebase Authentication
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return this.isAuthenticated();
    }

    try {
      // ELITE: Lazy load Firebase Auth module to prevent Metro bundler issues
      const authModule = await getFirebaseAuthModule();
      const { getAuth } = authModule;

      const firebaseApp = getFirebaseApp();
      if (!firebaseApp) {
        logger.warn('Firebase app not available - Auth disabled');
        return false;
      }

      // Get Auth instance
      this.auth = getAuth(firebaseApp);
      if (!this.auth) {
        logger.warn('Firebase Auth not available - Auth disabled');
        return false;
      }

      // Setup auth state listener
      await this.setupAuthStateListener();

      // Try to sign in anonymously
      await this.signInAnonymously();

      this.isInitialized = true;
      logger.info('✅ Firebase Authentication initialized successfully');
      return this.isAuthenticated();
    } catch (error) {
      logger.error('Firebase Auth initialization error:', error);
      // Continue without auth - app should still work
      return false;
    }
  }

  /**
   * ELITE: Setup auth state listener
   */
  private async setupAuthStateListener() {
    if (!this.auth) return;

    try {
      // ELITE: Lazy load Firebase Auth module
      const authModule = await getFirebaseAuthModule();
      const { onAuthStateChanged } = authModule;

      this.authStateListener = onAuthStateChanged(
        this.auth,
        (user: any | null) => {
          this.currentUser = user;
          
          if (user) {
            if (__DEV__) {
              logger.info('✅ User authenticated:', {
                uid: user.uid.substring(0, 8) + '...',
                isAnonymous: user.isAnonymous,
              });
            }
          } else {
            if (__DEV__) {
              logger.warn('⚠️ User signed out - attempting re-authentication');
            }
            
            // Try to sign in again if user signed out unexpectedly
            if (this.isInitialized && !this.isAuthenticating) {
              setTimeout(() => {
                this.signInAnonymously().catch((error) => {
                  logger.error('Re-authentication failed:', error);
                });
              }, 2000); // Wait 2 seconds before retry
            }
          }
        },
        (error) => {
          logger.error('Auth state listener error:', error);
          // Don't throw - auth state errors shouldn't break the app
        }
      );
    } catch (error) {
      logger.error('Failed to setup auth state listener:', error);
    }
  }

  /**
   * ELITE: Sign in anonymously with retry mechanism
   */
  private async signInAnonymously(): Promise<boolean> {
    if (!this.auth) {
      return false;
    }

    // If already authenticated, return true
    if (this.auth.currentUser && this.auth.currentUser.isAnonymous) {
      this.currentUser = this.auth.currentUser;
      return true;
    }

    // Prevent concurrent authentication attempts
    if (this.isAuthenticating) {
      if (__DEV__) {
        logger.debug('Authentication already in progress, waiting...');
      }
      // Wait for current attempt to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isAuthenticating) {
            clearInterval(checkInterval);
            resolve(this.isAuthenticated());
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 5000);
      });
    }

    this.isAuthenticating = true;

    try {
      // ELITE: Lazy load Firebase Auth module
      const authModule = await getFirebaseAuthModule();
      const { signInAnonymously } = authModule;

      const userCredential = await signInAnonymously(this.auth);
      this.currentUser = userCredential.user;
      this.retryAttempts = 0; // Reset retry counter on success
      
      if (__DEV__) {
        logger.info('✅ Anonymous sign-in successful:', {
          uid: userCredential.user.uid.substring(0, 8) + '...',
        });
      }
      
      this.isAuthenticating = false;
      return true;
    } catch (error: any) {
      this.isAuthenticating = false;
      
      const errorCode = error?.code || 'unknown';
      const errorMessage = error?.message || String(error);
      
      // Handle specific error codes
      if (errorCode === 'auth/network-request-failed') {
        logger.warn('Network error during authentication - will retry');
        
        // Retry with exponential backoff
        if (this.retryAttempts < this.MAX_RETRY_ATTEMPTS) {
          this.retryAttempts++;
          const delay = Math.pow(2, this.retryAttempts) * 1000; // 2s, 4s, 8s
          
          if (__DEV__) {
            logger.info(`Retrying authentication in ${delay}ms (attempt ${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS})`);
          }
          
          this.retryTimeout = setTimeout(() => {
            this.signInAnonymously().catch((retryError) => {
              logger.error('Retry authentication failed:', retryError);
            });
          }, delay);
          
          return false; // Will retry
        } else {
          logger.error('Max retry attempts reached for authentication');
          return false;
        }
      } else if (errorCode === 'auth/too-many-requests') {
        logger.warn('Too many authentication requests - rate limited');
        // Don't retry immediately for rate limiting
        return false;
      } else {
        logger.error('Anonymous sign-in failed:', {
          code: errorCode,
          message: errorMessage,
        });
        return false;
      }
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.auth) {
      return false;
    }
    
    const user = this.auth.currentUser || this.currentUser;
    return user !== null && user.isAnonymous === true;
  }

  /**
   * Get current user
   */
  getCurrentUser(): any | null {
    return this.auth?.currentUser || this.currentUser || null;
  }

  /**
   * Get user ID (for Firestore operations)
   */
  getUserId(): string | null {
    const user = this.getCurrentUser();
    return user?.uid || null;
  }

  /**
   * ELITE: Wait for authentication (useful for Firestore operations)
   */
  async waitForAuth(timeout: number = 10000): Promise<boolean> {
    if (this.isAuthenticated()) {
      return true;
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        if (this.isAuthenticated()) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Sign out (for testing or user logout)
   */
  async signOut(): Promise<void> {
    if (!this.auth) {
      return;
    }

    try {
      await this.auth.signOut();
      this.currentUser = null;
      logger.info('User signed out');
    } catch (error) {
      logger.error('Sign out error:', error);
      throw error;
    }
  }

  /**
   * Cleanup (remove listeners, clear timeouts)
   */
  cleanup() {
    if (this.authStateListener) {
      this.authStateListener();
      this.authStateListener = null;
    }

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.isInitialized = false;
    this.currentUser = null;
  }
}

export const firebaseAuthService = new FirebaseAuthService();

