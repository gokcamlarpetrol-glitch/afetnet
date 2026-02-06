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

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { createLogger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { initializeFirebase } from '../../lib/firebase';
import { identityService } from './IdentityService';
import { contactService } from './ContactService';
import { presenceService } from './PresenceService';
import { contactRequestService } from './ContactRequestService';

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

// Initialize Google Sign-In safely
const initGoogleSignIn = () => {
  try {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

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
    const app = initializeFirebase();
    if (!app) return null;
    return getAuth(app).currentUser;
  },

  /**
   * Sign in with Google
   */
  signInWithGoogle: async (): Promise<User | null> => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn() as GoogleSignInResponse;
      const idToken = userInfo.data?.idToken || userInfo.idToken;

      if (!idToken) throw new Error('Google\'dan ID token alınamadı');

      const credential = GoogleAuthProvider.credential(idToken);
      const app = initializeFirebase();
      if (!app) throw new Error('Firebase başlatılamadı');

      const auth = getAuth(app);
      const userCredential = await signInWithCredential(auth, credential);

      // ELITE: Profile sync with retry
      try {
        await retryWithBackoff(
          () => AuthService.syncUserProfile(userCredential.user),
          { maxRetries: 2, baseDelayMs: 500 },
        );
      } catch (syncError) {
        logger.warn('Profil senkronizasyonu başarısız (engelleyici değil):', syncError);
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

      const app = initializeFirebase();
      if (!app) throw new Error('Firebase başlatılamadı');

      const auth = getAuth(app);
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

        if (appleFullName?.givenName || appleFullName?.familyName) {
          await AsyncStorage.setItem(
            `@afetnet:apple_name_${userCredential.user.uid}`,
            JSON.stringify(appleFullName),
          );
        }

        // Try to get stored Apple name if not provided
        let nameToSync: AppleFullName | null = appleFullName;
        if (!nameToSync?.givenName && !nameToSync?.familyName) {
          try {
            const storedName = await AsyncStorage.getItem(
              `@afetnet:apple_name_${userCredential.user.uid}`,
            );
            if (storedName) {
              nameToSync = JSON.parse(storedName) as AppleFullName;
            }
          } catch (storageError) {
            logger.debug('Apple isim depolama okuma hatası:', storageError);
          }
        }

        await retryWithBackoff(
          () => AuthService.syncUserProfile(userCredential.user, nameToSync),
          { maxRetries: 2, baseDelayMs: 500 },
        );
      } catch (syncError) {
        logger.warn('Profil senkronizasyonu başarısız (engelleyici değil):', syncError);
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
      const app = initializeFirebase();
      if (!app) throw new Error('Firebase başlatılamadı');

      const auth = getAuth(app);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Sync user profile
      try {
        await retryWithBackoff(
          () => AuthService.syncUserProfile(userCredential.user),
          { maxRetries: 2, baseDelayMs: 500 },
        );
      } catch (syncError) {
        logger.warn('Profil senkronizasyonu başarısız (engelleyici değil):', syncError);
      }

      // Sync identity and contacts after successful auth
      try {
        await identityService.syncFromFirebase(userCredential.user);
        await contactService.initialize();
        await presenceService.initialize();
        await contactRequestService.initialize();
        logger.info('✅ All services synced after Email login');
      } catch (syncError) {
        logger.warn('Service sync failed (non-blocking):', syncError);
      }

      return userCredential.user;
    } catch (error: unknown) {
      const authError = error as AuthError;
      logger.error('E-posta Giriş Hatası', authError);

      if (authError.code === 'auth/user-not-found') {
        throw new Error('Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı');
      } else if (authError.code === 'auth/wrong-password') {
        throw new Error('Şifre hatalı');
      } else if (authError.code === 'auth/invalid-email') {
        throw new Error('Geçersiz e-posta adresi');
      } else if (authError.code === 'auth/too-many-requests') {
        throw new Error('Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin');
      }
      throw authError;
    }
  },

  /**
   * Sign up with Email and Password
   */
  signUpWithEmail: async (email: string, password: string, displayName?: string): Promise<User | null> => {
    try {
      const app = initializeFirebase();
      if (!app) throw new Error('Firebase başlatılamadı');

      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Sync user profile with display name
      try {
        await retryWithBackoff(
          () => AuthService.syncUserProfile(userCredential.user, displayName ? { givenName: displayName } as AppleFullName : null),
          { maxRetries: 2, baseDelayMs: 500 },
        );
      } catch (syncError) {
        logger.warn('Profil senkronizasyonu başarısız (engelleyici değil):', syncError);
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
      }
      throw authError;
    }
  },

  /**
   * Sign Out - Clears identity and contacts
   */
  signOut: async (): Promise<void> => {
    const app = initializeFirebase();
    if (!app) return;

    try {
      // ELITE: Cleanup all services on logout
      await presenceService.cleanup();
      await contactRequestService.cleanup();
      await identityService.clearIdentity();
      await contactService.clearAll();

      await firebaseSignOut(getAuth(app));

      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore if not signed in with Google
      }

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

    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);

    const snapshot = await getDoc(userRef);

    let displayName = user.displayName;
    if (!displayName && appleName) {
      const givenName = appleName.givenName || '';
      const familyName = appleName.familyName || '';
      displayName = `${givenName} ${familyName}`.trim() || null;
    }

    // CRITICAL: Generate QR ID from Firebase UID
    const qrId = `AFN-${user.uid.substring(0, 8).toUpperCase()}`;

    const dataToUpdate: UserProfileUpdate = {
      email: user.email,
      lastLoginAt: new Date(),
      photoURL: user.photoURL,
      qrId: qrId,
    };

    if (displayName) dataToUpdate.displayName = displayName;

    // Update device ID to match QR ID
    const { setDeviceId, getDeviceId } = require('../utils/device');
    const currentDeviceId = await getDeviceId();

    if (currentDeviceId !== qrId) {
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
