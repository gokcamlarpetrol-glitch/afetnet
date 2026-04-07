/**
 * AUTH SERVICE - ELITE FIREBASE EDITION
 * Handles Google and Apple authentication with Firebase
 * 
 * Features:
 * - Google Sign-In with Firebase credential
 * - Apple Sign-In with Firebase credential
 * - Profile sync to Firestore
 * - Identity and Contact sync after login
 * 
 * @author AfetNet Elite Messaging System
 * @version 2.0.0 - Integrated Identity/Contact Sync
 */

// CRITICAL FIX: Lazy import to prevent TurboModule crash when native module not linked
let GoogleSignin: any = null;
let statusCodes: any = {};

try {
  const googleSigninModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSigninModule.GoogleSignin;
  statusCodes = googleSigninModule.statusCodes || {};
} catch (e) {
  // Native module not available - Google Sign-In will be disabled
  if (__DEV__) console.warn('[AuthService] GoogleSignin native module not available:', (e as Error).message);
}

import * as AppleAuthentication from 'expo-apple-authentication';
import { DirectStorage } from '../utils/storage';
import { Platform } from 'react-native';
import {
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  reload,
  GoogleAuthProvider,
  OAuthProvider,
  User,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { createLogger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { initializeFirebase, getFirebaseAuth } from '../../lib/firebase';
import { clearDeviceId, getDeviceId, setDeviceId } from '../../lib/device';
import { identityService } from './IdentityService';
import { contactService } from './ContactService';
import { presenceService } from './PresenceService';
import { contactRequestService } from './ContactRequestService';
import { authSessionCleanupService } from './AuthSessionCleanupService';

const logger = createLogger('AuthService');

// ============================================================================
// ELITE: TypeScript Strict Interfaces
// ============================================================================

/** Google Sign-In Configuration */
interface GoogleSignInConfig {
  webClientId: string;
  iosClientId?: string;
  offlineAccess: boolean;
}

/** Apple Full Name from Authentication */
interface AppleFullName {
  givenName?: string | null;
  familyName?: string | null;
  middleName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  nickname?: string | null;
}

/** User Profile Update Data for Firestore */
interface UserProfileUpdate {
  email: string | null;
  lastLoginAt: Date;
  photoURL: string | null;
  displayName?: string;
  qrId?: string;
  deviceId?: string;
  createdAt?: Date;
}

/** Google Sign-In Response */
interface GoogleSignInResponse {
  data?: {
    idToken?: string;
  };
  idToken?: string;
}

/** Auth Error with Code */
interface AuthError extends Error {
  code?: string;
}

// Google Auth Readiness State
let googleAuthAvailable = false;
// CRITICAL FIX: Increased retries from 3→5, max delay from 5s→10s.
// Profile sync failure previously caused FORCE LOGOUT even though Firebase Auth was successful.
// This is the ROOT CAUSE of "user logs in then gets kicked out" — Firestore network timeout
// or permission error during profile sync triggers signOut() despite valid auth session.
const PROFILE_SYNC_RETRY_CONFIG = { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 10000 };

function getRuntimeConfigValue(key: string): string | undefined {
  const fromEnv = process.env[key];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  if (process.env.JEST_WORKER_ID) {
    return undefined;
  }

  try {
    const Constants = require('expo-constants');
    const extra = Constants?.expoConfig?.extra || Constants?.manifest2?.extra || Constants?.manifest?.extra;
    const fromExtra = extra?.[key];
    if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
      return fromExtra.trim();
    }
  } catch {
    // ignore runtime config lookup failures
  }

  return undefined;
}

// Initialize Google Sign-In safely
const initGoogleSignIn = () => {
  if (!GoogleSignin) {
    logger.warn('Google Sign-In native module not available. Google sign-in disabled.');
    googleAuthAvailable = false;
    return;
  }
  try {
    const webClientId = getRuntimeConfigValue('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    const iosClientId = getRuntimeConfigValue('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');

    if (webClientId) {
      const config: GoogleSignInConfig = {
        webClientId: webClientId,
        offlineAccess: true,
      };

      if (iosClientId) {
        config.iosClientId = iosClientId;
      }

      GoogleSignin.configure(config);
      googleAuthAvailable = true;
    } else {
      logger.warn('Google Giriş: WEB_CLIENT_ID bulunamadı. Google girişi devre dışı.');
    }
  } catch (e) {
    logger.error('Google Giriş yapılandırması başarısız', e);
    googleAuthAvailable = false;
  }
};

initGoogleSignIn();

export const AuthService = {
  /**
   * Check if Google Auth is configured and available
   */
  isGoogleAuthAvailable: (): boolean => googleAuthAvailable,

  /**
   * Helper to get current Firebase user
   */
  getCurrentUser: (): User | null => {
    const auth = getFirebaseAuth();
    if (!auth) return null;
    return auth.currentUser;
  },

  /**
   * Sign in with Google
   */
  signInWithGoogle: async (): Promise<User | null> => {
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      const userInfo = await GoogleSignin.signIn() as GoogleSignInResponse;
      const idToken = userInfo.data?.idToken || userInfo.idToken;

      if (!idToken) throw new Error('Google\'dan ID token alınamadı');

      const credential = GoogleAuthProvider.credential(idToken);
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase başlatılamadı');

      const userCredential = await signInWithCredential(auth, credential);

      // ELITE: Profile sync with retry
      try {
        await retryWithBackoff(
          () => AuthService.syncUserProfile(userCredential.user),
          PROFILE_SYNC_RETRY_CONFIG,
        );
      } catch (syncError) {
        // CRITICAL FIX: Do NOT logout on profile sync failure!
        // Firebase Auth login SUCCEEDED — the user IS authenticated.
        // Profile sync is a Firestore operation that can fail due to network, permissions, timeout.
        // Forcing signOut() here is the ROOT CAUSE of "user logs in then gets kicked out".
        // Profile will be synced in init.ts Phase B (IdentityService.syncFromFirebase).
        logger.error('Profil senkronizasyonu başarısız (Google) — devam ediliyor (login iptal edilmiyor):', syncError);
      }

      // ELITE: Sync identity and contacts after successful auth
      try {
        await identityService.syncFromFirebase(userCredential.user);
        await contactService.initialize();
        await presenceService.initialize();
        await contactRequestService.initialize();
        logger.info('✅ All services synced after Google login');
      } catch (syncError) {
        logger.warn('Service sync failed (non-blocking):', syncError);
      }

      return userCredential.user;
    } catch (error: unknown) {
      const authError = error as AuthError;
      logger.error('Google Giriş Hatası', authError);

      if (authError.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Giriş iptal edildi');
      } else if (authError.code === statusCodes.IN_PROGRESS) {
        throw new Error('Giriş işlemi zaten devam ediyor');
      } else if (authError.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Hizmetleri kullanılamıyor');
      }
      throw authError;
    }
  },

  /**
   * Sign in with Apple
   */
  signInWithApple: async (): Promise<User | null> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName } = credential;
      if (!identityToken) throw new Error('Apple\'dan kimlik tokeni alınamadı');

      const provider = new OAuthProvider('apple.com');
      const authCredential = provider.credential({
        idToken: identityToken,
      });

      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase başlatılamadı');

      const userCredential = await signInWithCredential(auth, authCredential);

      // ELITE: Apple name persistence and profile sync
      try {
        const appleFullName: AppleFullName | null = fullName ? {
          givenName: fullName.givenName,
          familyName: fullName.familyName,
          middleName: fullName.middleName,
          namePrefix: fullName.namePrefix,
          nameSuffix: fullName.nameSuffix,
          nickname: fullName.nickname,
        } : null;

        // CRITICAL FIX: Apple provides fullName ONLY on first-ever authorization.
        // After account deletion + re-creation, UID changes but Apple User ID stays the same.
        // Store by BOTH Apple User ID (stable) and Firebase UID, plus a global latest key.
        const appleUserId = credential.user; // Apple's stable user identifier
        if (appleFullName?.givenName || appleFullName?.familyName) {
          const nameJson = JSON.stringify(appleFullName);
          DirectStorage.setString(`@afetnet:apple_name_${userCredential.user.uid}`, nameJson);
          DirectStorage.setString(`@afetnet:apple_name_apple_${appleUserId}`, nameJson);
          DirectStorage.setString('@afetnet:apple_name_latest', nameJson);
          logger.info(`✅ Apple name stored: ${appleFullName.givenName} ${appleFullName.familyName}`);
        }

        // Try to get stored Apple name if not provided (Apple only gives name on first auth)
        let nameToSync: AppleFullName | null = appleFullName;
        if (!nameToSync?.givenName && !nameToSync?.familyName) {
          try {
            // Priority: 1) By Apple User ID (most reliable), 2) By Firebase UID, 3) Global latest
            const storedByAppleId = DirectStorage.getString(`@afetnet:apple_name_apple_${appleUserId}`) ?? null;
            const storedByUid = DirectStorage.getString(`@afetnet:apple_name_${userCredential.user.uid}`) ?? null;
            const storedLatest = DirectStorage.getString('@afetnet:apple_name_latest') ?? null;
            const storedName = storedByAppleId || storedByUid || storedLatest;
            if (storedName) {
              nameToSync = JSON.parse(storedName) as AppleFullName;
              logger.info(`📦 Apple name recovered from storage: ${nameToSync?.givenName} ${nameToSync?.familyName}`);
            }
          } catch (storageError) {
            logger.debug('Apple isim depolama okuma hatası:', storageError);
          }
        }

        // CRITICAL FIX: Update Firebase Auth displayName so it persists across sessions.
        // Also overwrite if current displayName is just the email prefix (e.g. "Gokcamlarpetrol")
        const resolvedDisplayName = nameToSync
          ? `${nameToSync.givenName || ''} ${nameToSync.familyName || ''}`.trim()
          : null;
        const currentAuthDisplayName = userCredential.user.displayName || '';
        const isCurrentNameEmailDerived = (() => {
          if (!currentAuthDisplayName || !userCredential.user.email) return false;
          const emailLocal = userCredential.user.email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || '';
          const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/gi, '');
          return norm(currentAuthDisplayName) === norm(emailLocal);
        })();
        if (resolvedDisplayName && (!currentAuthDisplayName || isCurrentNameEmailDerived)) {
          try {
            await updateProfile(userCredential.user, { displayName: resolvedDisplayName });
            logger.info(`✅ Firebase Auth displayName updated: ${resolvedDisplayName}`);
          } catch (profileError) {
            logger.warn('Firebase Auth displayName update failed (non-blocking):', profileError);
          }
        }

        await retryWithBackoff(
          () => AuthService.syncUserProfile(userCredential.user, nameToSync),
          PROFILE_SYNC_RETRY_CONFIG,
        );
      } catch (syncError) {
        // CRITICAL FIX: Do NOT logout on profile sync failure!
        // Firebase Auth login SUCCEEDED. Profile will sync in init.ts Phase B.
        logger.error('Profil senkronizasyonu başarısız (Apple) — devam ediliyor (login iptal edilmiyor):', syncError);
      }

      // ELITE: Sync identity and contacts after successful auth
      try {
        await identityService.syncFromFirebase(userCredential.user);
        await contactService.initialize();
        await presenceService.initialize();
        await contactRequestService.initialize();
        logger.info('✅ All services synced after Apple login');
      } catch (syncError) {
        logger.warn('Service sync failed (non-blocking):', syncError);
      }

      return userCredential.user;

    } catch (error: unknown) {
      const authError = error as AuthError;

      if (authError.code === 'ERR_REQUEST_CANCELED') {
        throw new Error('Giriş iptal edildi');
      }

      logger.error('Apple Giriş Hatası', authError);

      // Specific handling for Simulator or Setup issues
      if (authError.code === '1000' || authError.message?.includes('unknown')) {
        if (__DEV__) {
          logger.debug('GELİŞTİRİCİ NOTU: Simülatörde Apple ID ile giriş yapılmamış olabilir.');
          throw new Error('Simülatörde Apple ID ile giriş yapılmamış olabilir. Lütfen ayarlardan giriş yapın.');
        }
      }
      throw authError;
    }
  },

  /**
   * Sign in with Email and Password
   */
  signInWithEmail: async (email: string, password: string): Promise<User | null> => {
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase başlatılamadı');

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await reload(userCredential.user);

      const refreshedUser = auth.currentUser ?? userCredential.user;
      if (!refreshedUser.emailVerified) {
        await firebaseSignOut(auth);
        throw new Error('E-posta adresiniz henüz doğrulanmamış. Lütfen doğruladıktan sonra giriş yapın.');
      }

      // Sync user profile
      try {
        await retryWithBackoff(
          () => AuthService.syncUserProfile(refreshedUser),
          PROFILE_SYNC_RETRY_CONFIG,
        );
      } catch (syncError) {
        // CRITICAL FIX: Do NOT logout on profile sync failure!
        // Firebase Auth login SUCCEEDED. Profile will sync in init.ts Phase B.
        logger.error('Profil senkronizasyonu başarısız (Email) — devam ediliyor (login iptal edilmiyor):', syncError);
      }

      // Sync identity and contacts after successful auth
      try {
        await identityService.syncFromFirebase(refreshedUser);
        await contactService.initialize();
        await presenceService.initialize();
        await contactRequestService.initialize();
        logger.info('✅ All services synced after Email login');
      } catch (syncError) {
        logger.warn('Service sync failed (non-blocking):', syncError);
      }

      return refreshedUser;
    } catch (error: unknown) {
      const authError = error as AuthError;
      logger.error('E-posta Giriş Hatası', authError);

      if (authError.code === 'auth/user-not-found') {
        throw new Error('Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı');
      } else if (authError.code === 'auth/wrong-password') {
        throw new Error('Şifre hatalı');
      } else if (authError.code === 'auth/invalid-credential') {
        throw new Error('Geçersiz kimlik bilgileri. E-posta veya şifre hatalı.');
      } else if (authError.code === 'auth/invalid-email') {
        throw new Error('Geçersiz e-posta adresi');
      } else if (authError.code === 'auth/user-disabled') {
        throw new Error('Bu hesap devre dışı bırakılmış.');
      } else if (authError.code === 'auth/too-many-requests') {
        throw new Error('Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin');
      } else if (authError.code === 'auth/network-request-failed') {
        throw new Error('Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.');
      }
      throw authError;
    }
  },

  /**
   * Sign up with Email and Password
   */
  signUpWithEmail: async (email: string, password: string, displayName?: string): Promise<User | null> => {
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase başlatılamadı');

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // CRITICAL FIX: Set Firebase Auth displayName so it persists across sessions.
      // Without this, email-signup users show as "İsimsiz Kahraman" forever.
      if (displayName) {
        try {
          await updateProfile(userCredential.user, { displayName });
          logger.info(`✅ Firebase Auth displayName set for email signup: ${displayName}`);
        } catch (profileError) {
          logger.warn('Firebase Auth displayName update failed (non-blocking):', profileError);
        }
      }

      // Sync user profile with display name
      try {
        await retryWithBackoff(
          () => AuthService.syncUserProfile(userCredential.user, displayName ? { givenName: displayName } as AppleFullName : null),
          PROFILE_SYNC_RETRY_CONFIG,
        );
      } catch (syncError) {
        // CRITICAL FIX: Do NOT logout on profile sync failure!
        // User account was CREATED successfully. Profile will sync later.
        logger.error('Profil senkronizasyonu başarısız (Email signup) — devam ediliyor:', syncError);
      }

      // Sync identity and contacts after successful auth
      try {
        await identityService.syncFromFirebase(userCredential.user);
        await contactService.initialize();
        await presenceService.initialize();
        await contactRequestService.initialize();
        logger.info('✅ All services synced after Email signup');
      } catch (syncError) {
        logger.warn('Service sync failed (non-blocking):', syncError);
      }

      return userCredential.user;
    } catch (error: unknown) {
      const authError = error as AuthError;
      logger.error('E-posta Kayıt Hatası', authError);

      if (authError.code === 'auth/email-already-in-use') {
        throw new Error('Bu e-posta adresi zaten kullanımda');
      } else if (authError.code === 'auth/invalid-email') {
        throw new Error('Geçersiz e-posta adresi');
      } else if (authError.code === 'auth/weak-password') {
        throw new Error('Şifre çok zayıf. En az 6 karakter olmalı');
      } else if (authError.code === 'auth/network-request-failed') {
        throw new Error('Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.');
      } else if (authError.code === 'auth/operation-not-allowed') {
        throw new Error('E-posta/şifre ile kayıt şu anda etkin değil.');
      }
      throw authError;
    }
  },

  /**
   * Sign Out - Clears identity and contacts
   */
  signOut: async (): Promise<void> => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    // CRITICAL: Capture UID NOW before Firebase sign-out nullifies currentUser
    const signOutUid = auth.currentUser?.uid || '';

    try {
      // Flush settings to cloud before logout (preserves preferences for next login)
      try {
        const { settingsSyncService } = await import('./SettingsSyncService');
        await settingsSyncService.flushSync();
        settingsSyncService.cleanup();
      } catch { /* best effort */ }

      // CRITICAL: Firebase sign-out FIRST, then local cleanup.
      // If local cleanup runs first and Firebase sign-out fails,
      // the user is still authenticated remotely but local session is destroyed.
      await firebaseSignOut(auth);

      try {
        if (GoogleSignin) {
          await GoogleSignin.signOut();
        }
      } catch (e) {
        // Ignore if not signed in with Google
      }

      // Local cleanup AFTER successful remote sign-out
      await presenceService.cleanup();
      await contactRequestService.cleanup();
      await authSessionCleanupService.clearLocalSessionData();
      await identityService.clearIdentity();
      await clearDeviceId();

      // AUTHORITATIVE: Purge ALL user-scoped security keys
      try {
        const { purgeUserSecurityKeys } = await import('./security/SecurityKeyCleanup');
        await purgeUserSecurityKeys(signOutUid);
      } catch { /* best effort */ }

      logger.info('✅ Signed out and cleared all data');
    } catch (error) {
      logger.error('Çıkış Hatası', error);
      throw error;
    }
  },

  /**
   * Create or Update User Profile in Firestore
   * This creates the "Golden Record" with QR ID
   */
  syncUserProfile: async (user: User, appleName?: AppleFullName | null): Promise<void> => {
    const app = initializeFirebase();
    if (!app) {
      logger.warn('Firebase başlatılamadı, profil senkronizasyonu atlandı');
      return;
    }

    // Ensure auth is initialized with persistence before any profile sync
    getFirebaseAuth();

    const db = await getFirestoreInstanceAsync();
    if (!db) return;
    const userRef = doc(db, 'users', user.uid);

    const snapshot = await getDoc(userRef);

    // Resolve display name with provider-first strategy.
    const normalizeName = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
    const deriveEmailDisplayName = (email?: string | null): string => {
      if (!email) return '';
      const local = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
      if (!local || local.length < 2) return '';
      return local.charAt(0).toUpperCase() + local.slice(1);
    };
    const isEmailDerivedName = (name: string, email?: string | null): boolean => {
      if (!name || !email) return false;
      const derived = deriveEmailDisplayName(email);
      if (!derived) return false;
      const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9ğüşöçıİ]/gi, '');
      return normalize(name) === normalize(derived);
    };
    const providerDisplayName = (() => {
      const providers = Array.isArray(user.providerData) ? user.providerData : [];
      for (const provider of providers) {
        const candidate = normalizeName(provider?.displayName);
        // CRITICAL FIX: Skip email-derived names from provider data.
        // Apple Sign-In sometimes sets providerData.displayName to the email prefix.
        if (candidate && candidate !== 'İsimsiz Kahraman' && !isEmailDerivedName(candidate, user.email)) {
          return candidate;
        }
      }
      return '';
    })();

    // CRITICAL FIX: Retrieve cached Apple name from MMKV.
    // Apple only provides the real name on FIRST authorization.
    // AuthService.signInWithApple() caches it in MMKV, but syncUserProfile
    // was not reading it — causing email prefix to persist as displayName.
    const getCachedAppleDisplayName = (): string => {
      try {
        const storedByUid = DirectStorage.getString(`@afetnet:apple_name_${user.uid}`) ?? null;
        const storedLatest = DirectStorage.getString('@afetnet:apple_name_latest') ?? null;
        const raw = storedByUid || storedLatest;
        if (!raw) return '';
        const parsed = JSON.parse(raw) as { givenName?: string | null; familyName?: string | null };
        return `${parsed?.givenName || ''} ${parsed?.familyName || ''}`.trim();
      } catch {
        return '';
      }
    };

    let displayName = normalizeName(user.displayName);

    // If auth displayName is email-derived, treat it as empty
    if (displayName && isEmailDerivedName(displayName, user.email)) {
      displayName = '';
    }

    // Try Apple name from current sign-in
    if (!displayName && appleName) {
      const givenName = appleName.givenName || '';
      const familyName = appleName.familyName || '';
      displayName = `${givenName} ${familyName}`.trim();
    }

    // Try provider display name
    if (!displayName && providerDisplayName) {
      displayName = providerDisplayName;
    }

    // Try cached Apple name from MMKV (Apple only gives name on first auth)
    if (!displayName) {
      const cachedApple = getCachedAppleDisplayName();
      if (cachedApple) {
        displayName = cachedApple;
      }
    }

    // Fallback: if Firestore doc already has a real displayName, preserve it
    if (!displayName && snapshot.exists()) {
      const existingName = normalizeName(snapshot.data()?.displayName);
      if (existingName && existingName !== 'İsimsiz Kahraman' && !isEmailDerivedName(existingName, user.email)) {
        displayName = existingName;
      }
    }

    // Last resort: derive a name from email (e.g., "gokhan@gmail.com" -> "Gokhan")
    if (!displayName && user.email) {
      displayName = deriveEmailDisplayName(user.email);
    }
    logger.info(`📝 syncUserProfile displayName resolved: "${displayName}" (auth: "${user.displayName}", email: "${user.email}")`);

    // CRITICAL: Generate QR ID from Firebase UID
    const qrId = `AFN-${user.uid.substring(0, 8).toUpperCase()}`;

    const dataToUpdate: UserProfileUpdate = {
      email: user.email,
      lastLoginAt: new Date(),
      photoURL: user.photoURL,
      qrId: qrId,
    };

    if (displayName) dataToUpdate.displayName = displayName;

    // FIX: Normalize device ID comparison — always use the same format (qrId)
    const currentDeviceId = await getDeviceId();
    const normalizedCurrentId = currentDeviceId?.toUpperCase() || '';
    const normalizedQrId = qrId.toUpperCase();

    if (normalizedCurrentId !== normalizedQrId) {
      await setDeviceId(qrId);
      logger.info(`Device ID re-linked to Account: ${qrId}`);
    }

    dataToUpdate.deviceId = qrId;

    // If new user, create initial profile
    if (!snapshot.exists()) {
      dataToUpdate.createdAt = new Date();
    }

    await setDoc(userRef, dataToUpdate, { merge: true });
    logger.info(`✅ Kullanıcı profili senkronize edildi: ${user.uid} (QR: ${qrId})`);
  },
};
