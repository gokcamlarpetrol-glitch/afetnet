/**
 * IDENTITY SERVICE — SINGLE-UID ARCHITECTURE v4.0
 * 
 * THE GOLDEN RULE: Firebase Auth UID is the SINGLE PRIMARY KEY.
 * 
 *   uid              → Primary key for ALL operations (Firestore, messages, contacts, family)
 *   publicUserCode   → Human-readable sharing code (QR, invite links)
 * 
 * Firestore paths use uid:
 *   users/{uid}, locations_current/{uid}, push_tokens/{uid},
 *   conversations/{convId}, families/{familyId}/members/{uid}
 * 
 * @version 4.0.0 — Single-UID Clean Architecture
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getDeviceId as getHardwareDeviceId } from '../../lib/device';
import { getInstallationId } from '../../lib/installationId';
import { initializeFirebase, getFirebaseAuth } from '../../lib/firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('IdentityService');

const IDENTITY_CACHE_KEY = '@afetnet:identity_cache_v4';

/**
 * User Identity — Clean Single-UID Model
 * 
 * uid = the ONLY key used everywhere.
 * publicUserCode = human-readable sharing code (QR, invite links).
 */
export interface UserIdentity {
  /** Firebase Auth UID — TEK BİRİNCİL ANAHTAR */
  uid: string;
  /** Random, rotatable sharing code (e.g. "AFN-A3F9B2C1") */
  publicUserCode: string;
  /** User display name */
  displayName: string;
  /** User email */
  email?: string;
  /** Profile photo URL */
  photoURL?: string;
  /** True if cloud authenticated */
  isVerified: boolean;
  /** When identity was created */
  createdAt: number;
  /** Last Firebase sync time */
  lastSyncAt: number;
}

/**
 * QR Payload v4 — Minimal & Clean
 * Only uid + name required. Everything else derived from Firestore.
 */
export interface QRPayload {
  /** Payload version */
  v: number;
  /** Firebase Auth UID */
  uid: string;
  /** Display name */
  name: string;
  /** Human-readable public code (e.g. AFN-A3F9B2C1) */
  code?: string;
}

const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;

/**
 * Generate a random, collision-resistant public user code.
 * Format: AFN-XXXXXXXX (8 random hex chars = 4 bytes = ~4 billion combos)
 */
async function generatePublicUserCode(): Promise<string> {
  try {
    const { default: Crypto } = await import('expo-crypto');
    const bytes = await Crypto.getRandomBytesAsync(4);
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `AFN-${hex}`.toUpperCase();
  } catch {
    const ts = Date.now().toString(16).slice(-4);
    const rand = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    return `AFN-${ts}${rand}`.toUpperCase();
  }
}

class IdentityService {
  private identity: UserIdentity | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the identity service.
   * Priority: Firebase Auth > Cached Identity > No identity (must login)
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.isInitialized) return;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      logger.info('🔐 Initializing IdentityService v4 (Single-UID)...');

      const auth = getFirebaseAuth();
      if (auth?.currentUser) {
        await this.syncFromFirebase(auth.currentUser);
        this.isInitialized = true;
        logger.info(`✅ Identity from Firebase: uid=${this.identity?.uid}`);
        return;
      }

      const cached = await this.loadCachedIdentity();
      if (cached?.isVerified && cached.uid) {
        this.identity = cached;
        this.isInitialized = true;
        logger.info(`✅ Identity from cache: uid=${this.identity.uid}`);
        return;
      }

      this.isInitialized = true;
      logger.warn('⚠️ No identity — user must login');
    } catch (error) {
      logger.error('❌ Identity init failed:', error);
      this.isInitialized = true;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Sync identity from Firebase Auth user.
   */
  async syncFromFirebase(user: User): Promise<void> {
    try {
      const app = initializeFirebase();
      if (!app) return;

      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const data = userDoc.data();

        let publicUserCode = data.publicUserCode;
        if (!publicUserCode) {
          publicUserCode = await generatePublicUserCode();
        }
        // Validate generated code is truthy before using
        if (!publicUserCode) {
          publicUserCode = `AFN-${Date.now().toString(16).slice(-8).toUpperCase()}`;
        }

        this.identity = {
          uid: user.uid,
          publicUserCode,
          displayName: data.displayName || user.displayName || 'İsimsiz Kahraman',
          email: data.email || user.email || undefined,
          photoURL: data.photoURL || user.photoURL || undefined,
          isVerified: true,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
          lastSyncAt: Date.now(),
        };

        // Ensure user doc has publicUserCode
        if (!data.publicUserCode) {
          await setDoc(userRef, { publicUserCode, lastLoginAt: new Date() }, { merge: true });
          logger.info(`✅ User doc updated: users/${user.uid}`);
        } else {
          await setDoc(userRef, { lastLoginAt: new Date() }, { merge: true });
        }

      } else {
        // New user
        let publicUserCode = await generatePublicUserCode();
        if (!publicUserCode) {
          publicUserCode = `AFN-${Date.now().toString(16).slice(-8).toUpperCase()}`;
        }

        this.identity = {
          uid: user.uid,
          publicUserCode,
          displayName: user.displayName || 'İsimsiz Kahraman',
          email: user.email || undefined,
          photoURL: user.photoURL || undefined,
          isVerified: true,
          createdAt: Date.now(),
          lastSyncAt: Date.now(),
        };

        const userData: Record<string, any> = {
          publicUserCode,
          displayName: this.identity.displayName,
          createdAt: new Date(),
          lastLoginAt: new Date(),
        };
        if (this.identity.email) userData.email = this.identity.email;
        if (this.identity.photoURL) userData.photoURL = this.identity.photoURL;

        await setDoc(userRef, userData, { merge: true });
        logger.info(`✅ New user: users/${user.uid}`);
      }

      await this.cacheIdentity();
      logger.info(`🔄 Identity synced: uid=${user.uid}, code=${this.identity!.publicUserCode}`);
    } catch (error) {
      logger.error('Failed to sync from Firebase:', error);
    }
  }

  // ─── ACCESSORS ──────────────────────────────────────

  /** Get the full identity object */
  getIdentity(): UserIdentity | null {
    return this.identity;
  }

  /** Firebase Auth UID — TEK BİRİNCİL ANAHTAR. Returns null when not initialized. */
  getUid(): string | null {
    return this.identity?.uid || null;
  }

  /** Public sharing code for QR display and friend-add */
  getPublicUserCode(): string {
    return this.identity?.publicUserCode || '';
  }

  /** Display name */
  getDisplayName(): string {
    return this.identity?.displayName || 'İsimsiz Kahraman';
  }

  getEmail(): string | undefined {
    return this.identity?.email;
  }

  getPhotoURL(): string | undefined {
    return this.identity?.photoURL;
  }

  isCloudAuthenticated(): boolean {
    return !!this.identity?.uid && this.identity.isVerified;
  }

  // ─── BACKWARD COMPAT ALIASES (tüm eski çağrıları uid'ye yönlendir) ──

  /** @deprecated Use getUid() */
  getMyId(): string | null { return this.getUid(); }
  /** @deprecated Use getUid() */
  getCloudUid(): string | undefined { return this.identity?.uid; }
  /** @deprecated Use getUid() — deviceId artık identity katmanında yok */
  getDeviceId(): string | null { return this.getUid(); }
  /** @deprecated Use getUid() */
  getMeshDeviceId(): string | null { return this.getUid(); }
  /** @deprecated Not needed */
  getInstallationId(): string | null { return this.getUid(); }

  // ─── QR CODE ──────────────────────────────────────

  /** Generate QR Code Payload v4 — minimal */
  getQRPayload(): string {
    if (!this.identity) return '';

    const payload: QRPayload = {
      v: 4,
      uid: this.identity.uid,
      name: this.identity.displayName,
      code: this.identity.publicUserCode,
    };

    return JSON.stringify(payload);
  }

  /**
   * Parse a scanned QR payload.
   * Supports v4 (clean), v3/v2/v1 (legacy), plain UID, and AFN codes.
   */
  async parseQRPayload(data: string): Promise<QRPayload | null> {
    const trim = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

    const raw = trim(data);
    if (!raw) return null;

    // Try JSON parse
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const uid = trim(parsed.uid || parsed.cloudUid || parsed.userUid || parsed.id || parsed.code);
        const name = trim(parsed.name) || 'Bilinmeyen Kullanıcı';
        if (uid && UID_REGEX.test(uid)) {
          return { v: parsed.v || 4, uid, name };
        }
        // Legacy: code might be AFN- format, try to extract uid
        const legacyUid = trim(parsed.uid || parsed.cloudUid || parsed.userUid);
        if (legacyUid && UID_REGEX.test(legacyUid)) {
          return { v: parsed.v || 4, uid: legacyUid, name };
        }
      }
    } catch {
      // Not JSON
    }

    // URL payload support
    try {
      const url = new URL(raw);
      for (const param of ['payload', 'data', 'qr', 'uid', 'id']) {
        const val = trim(url.searchParams.get(param));
        if (val) {
          const result = this.parseQRPayload(val);
          if (result) return result;
        }
      }
    } catch {
      // Not a URL
    }

    // Plain UID
    if (UID_REGEX.test(raw)) {
      return { v: 0, uid: raw, name: 'Bilinmeyen Kullanıcı' };
    }

    // AFN code — resolve via Firestore lookup (publicUserCode or qrId)
    if (raw.toUpperCase().startsWith('AFN-')) {
      const attemptResolve = async (): Promise<QRPayload | null> => {
        const app = initializeFirebase();
        if (!app) return null;

        const db = getFirestore(app);
        const { collection, getDocs, query, where, limit } = require('firebase/firestore');
        const usersRef = collection(db, 'users');
        const code = raw.toUpperCase();

        // Try publicUserCode first
        const byPublicCode = query(usersRef, where('publicUserCode', '==', code), limit(1));
        const publicSnap = await getDocs(byPublicCode);
        if (!publicSnap.empty) {
          const docData = publicSnap.docs[0];
          return { v: 0, uid: docData.id, name: docData.data()?.displayName || 'Bilinmeyen Kullanıcı' };
        }

        // Fallback to qrId
        const byQrId = query(usersRef, where('qrId', '==', code), limit(1));
        const qrSnap = await getDocs(byQrId);
        if (!qrSnap.empty) {
          const docData = qrSnap.docs[0];
          return { v: 0, uid: docData.id, name: docData.data()?.displayName || 'Bilinmeyen Kullanıcı' };
        }

        return null;
      };

      try {
        const result = await attemptResolve();
        if (result) return result;
      } catch (error: any) {
        // Retry once after 1s for network errors only
        const isNetworkError = error?.code === 'unavailable' || error?.code === 'deadline-exceeded' ||
          error?.message?.includes('network') || error?.message?.includes('fetch');
        if (isNetworkError) {
          logger.warn('AFN code Firestore resolution failed (network), retrying in 1s:', error?.message);
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResult = await attemptResolve();
            if (retryResult) return retryResult;
          } catch (retryError) {
            logger.warn('AFN code Firestore retry also failed:', retryError);
          }
        } else {
          logger.warn('AFN code Firestore resolution failed:', error);
        }
      }
      // If resolution fails, return null so caller knows it's unresolvable
      return null;
    }

    logger.warn('Failed to parse QR payload');
    return null;
  }

  // ─── PROFILE UPDATES ──────────────────────────────

  async updateDisplayName(name: string): Promise<void> {
    if (!this.identity) return;

    this.identity.displayName = name;
    await this.cacheIdentity();

    if (this.identity.uid) {
      try {
        const app = initializeFirebase();
        if (app) {
          const db = getFirestore(app);
          await setDoc(
            doc(db, 'users', this.identity.uid),
            { displayName: name, updatedAt: new Date() },
            { merge: true }
          );
        }
      } catch (error) {
        logger.error('Failed to sync display name:', error);
      }
    }
  }

  async updatePhotoURL(photoURL: string): Promise<void> {
    if (!this.identity) return;

    this.identity.photoURL = photoURL;
    await this.cacheIdentity();

    if (this.identity.uid) {
      try {
        const app = initializeFirebase();
        if (app) {
          const db = getFirestore(app);
          await setDoc(
            doc(db, 'users', this.identity.uid),
            { photoURL, updatedAt: new Date() },
            { merge: true }
          );
        }
      } catch (error) {
        logger.error('Failed to sync photo URL:', error);
      }
    }
  }

  /** Rotate the public user code (spam/abuse prevention) */
  async rotatePublicUserCode(): Promise<string | null> {
    if (!this.identity?.uid) return null;

    try {
      const newCode = await generatePublicUserCode();
      const app = initializeFirebase();
      if (!app) return null;

      const db = getFirestore(app);
      await setDoc(
        doc(db, 'users', this.identity.uid),
        { publicUserCode: newCode, updatedAt: new Date() },
        { merge: true }
      );

      this.identity.publicUserCode = newCode;
      await this.cacheIdentity();

      logger.info(`🔄 Public user code rotated: ${newCode}`);
      return newCode;
    } catch (error) {
      logger.error('Failed to rotate public user code:', error);
      return null;
    }
  }

  // ─── LIFECYCLE ──────────────────────────────────────

  async clearIdentity(): Promise<void> {
    this.identity = null;
    this.isInitialized = false;
    await AsyncStorage.removeItem(IDENTITY_CACHE_KEY);
    logger.info('🗑️ Identity cleared');
  }

  async forceSync(): Promise<void> {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return;
    await this.syncFromFirebase(auth.currentUser);
    logger.info('🔄 Force sync completed');
  }

  // ─── INTERNAL ──────────────────────────────────────

  private async cacheIdentity(): Promise<void> {
    if (!this.identity) return;
    try {
      await AsyncStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(this.identity));
    } catch (error) {
      logger.error('Failed to cache identity:', error);
    }
  }

  private async loadCachedIdentity(): Promise<UserIdentity | null> {
    try {
      const cached = await AsyncStorage.getItem(IDENTITY_CACHE_KEY);
      if (cached) return JSON.parse(cached) as UserIdentity;
    } catch (error) {
      logger.error('Failed to load cached identity:', error);
    }
    return null;
  }
}

export const identityService = new IdentityService();
