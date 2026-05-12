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

import { DirectStorage } from '../utils/storage';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
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
  /** Stable QR/device share code (legacy compatible, e.g. AFN-1A2B3C4D) */
  qrId?: string;
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

const UID_REGEX = /^[A-Za-z0-9_.\-+:]{1,128}$/;

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
  private listeners: Array<() => void> = [];

  /** Subscribe to identity changes */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  private normalizeDisplayName(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private deriveEmailDisplayName(email?: string | null): string {
    if (!email) return '';
    const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
    if (!localPart || localPart.length < 2) return '';
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }

  private getProviderDisplayName(user: User): string {
    const providerEntries = Array.isArray(user.providerData) ? user.providerData : [];
    for (const entry of providerEntries) {
      const providerName = this.normalizeDisplayName(entry?.displayName);
      if (providerName && providerName !== 'İsimsiz Kahraman' && !this.isEmailDerivedDisplayName(providerName, user.email)) {
        return providerName;
      }
    }
    return '';
  }

  private isEmailDerivedDisplayName(name: string, email?: string | null): boolean {
    if (!name || !email) return false;
    const derived = this.deriveEmailDisplayName(email);
    if (!derived) return false;

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9ğüşöçıİ]/gi, '');
    return normalize(name) === normalize(derived);
  }

  /**
   * Retrieve the cached Apple Sign-In name from MMKV.
   * Apple only provides the user's name on FIRST authorization.
   * AuthService caches it under multiple keys for reliability.
   */
  private getCachedAppleName(uid: string): string {
    try {
      // Priority: 1) By Firebase UID, 2) Global latest
      const storedByUid = DirectStorage.getString(`@afetnet:apple_name_${uid}`) ?? null;
      const storedLatest = DirectStorage.getString('@afetnet:apple_name_latest') ?? null;
      const raw = storedByUid || storedLatest;
      if (!raw) return '';

      const parsed = JSON.parse(raw) as { givenName?: string | null; familyName?: string | null };
      const givenName = (parsed?.givenName || '').trim();
      const familyName = (parsed?.familyName || '').trim();
      const fullName = `${givenName} ${familyName}`.trim();
      return fullName || '';
    } catch {
      return '';
    }
  }

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
        this.notifyListeners();
        logger.info(`✅ Identity from Firebase: uid=${this.identity?.uid}`);
        return;
      }

      const cached = await this.loadCachedIdentity();
      if (cached?.isVerified && cached.uid) {
        this.identity = cached;
        this.isInitialized = true;
        this.notifyListeners();
        logger.info(`✅ Identity from cache: uid=${this.identity.uid}`);
        return;
      }

      this.isInitialized = true;
      logger.warn('⚠️ No identity — user must login');
    } catch (error) {
      logger.error('❌ Identity init failed:', error);
      // Leave isInitialized = false to allow retry on next call
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

      const db = await getFirestoreInstanceAsync();
      if (!db) return;
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const derivedQrId = `AFN-${user.uid.substring(0, 8).toUpperCase()}`;

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

        const firestoreName = this.normalizeDisplayName(data.displayName);
        const authName = this.normalizeDisplayName(user.displayName);
        const providerName = this.getProviderDisplayName(user);
        const resolvedEmail = (data.email || user.email || '').trim();
        const emailName = this.deriveEmailDisplayName(resolvedEmail);
        // CRITICAL FIX: Apple Sign-In only provides the user's real name on FIRST authorization.
        // AuthService caches it in MMKV. If Firestore/Auth only have the email prefix,
        // the cached Apple name is the ONLY source of the real name.
        const cachedAppleName = this.getCachedAppleName(user.uid);

        // Filter out email-derived names from the resolution chain
        const isFirestoreNameEmailDerived = this.isEmailDerivedDisplayName(firestoreName, resolvedEmail);
        const isAuthNameEmailDerived = this.isEmailDerivedDisplayName(authName, resolvedEmail);

        // Prefer provider name if stored name is missing/generic/email-derived.
        const shouldPreferProviderName = !!providerName && (
          !firestoreName ||
          firestoreName === 'İsimsiz Kahraman' ||
          isFirestoreNameEmailDerived
        );

        // Name resolution priority:
        // 1. Provider display name (if Firestore name is missing/generic/email-derived)
        // 2. Firestore name (if it's a real name, not email-derived)
        // 3. Cached Apple Sign-In name (only source of real name after first Apple auth)
        // 4. Auth display name (if it's a real name, not email-derived)
        // 5. Provider name (even if not preferred)
        // 6. Firestore name (even if email-derived — better than nothing)
        // 7. Auth name (even if email-derived)
        // 8. Email-derived name as last resort
        // 9. 'Kullanici' as absolute fallback
        const resolvedName =
          (shouldPreferProviderName ? providerName : '') ||
          (!isFirestoreNameEmailDerived ? firestoreName : '') ||
          cachedAppleName ||
          (!isAuthNameEmailDerived ? authName : '') ||
          providerName ||
          firestoreName ||
          authName ||
          emailName ||
          'Kullanıcı';

        const resolvedQrId = this.normalizeDisplayName(data.qrId) || derivedQrId;

        const userDocPatch: Record<string, unknown> = {
          lastLoginAt: new Date(),
        };
        if (!data.publicUserCode) {
          userDocPatch.publicUserCode = publicUserCode;
        }
        if (!this.normalizeDisplayName(data.qrId)) {
          userDocPatch.qrId = resolvedQrId;
        }
        if (shouldPreferProviderName && providerName !== firestoreName) {
          userDocPatch.displayName = providerName;
        }
        // CRITICAL FIX: If Firestore has an email-derived name but we found a real name
        // (from cached Apple name, auth, or provider), update Firestore so future syncs
        // use the correct name directly.
        if (isFirestoreNameEmailDerived && resolvedName && resolvedName !== firestoreName && !this.isEmailDerivedDisplayName(resolvedName, resolvedEmail) && resolvedName !== 'Kullanıcı') {
          userDocPatch.displayName = resolvedName;
        }

        this.identity = {
          uid: user.uid,
          publicUserCode,
          qrId: resolvedQrId,
          displayName: resolvedName || 'Kullanıcı',
          email: resolvedEmail || undefined,
          photoURL: data.photoURL || user.photoURL || undefined,
          isVerified: true,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
          lastSyncAt: Date.now(),
        };

        if (Object.keys(userDocPatch).length > 0) {
          await setDoc(userRef, userDocPatch, { merge: true });
          if (!data.publicUserCode) {
            logger.info(`✅ User doc updated: users/${user.uid}`);
          }
        }

      } else {
        // New user
        let publicUserCode = await generatePublicUserCode();
        if (!publicUserCode) {
          publicUserCode = `AFN-${Date.now().toString(16).slice(-8).toUpperCase()}`;
        }

        // New user: resolve display name from auth/provider first, email only as last resort
        const authName = this.normalizeDisplayName(user.displayName);
        const providerName = this.getProviderDisplayName(user);
        const cachedAppleNameNew = this.getCachedAppleName(user.uid);
        const emailName = this.deriveEmailDisplayName(user.email || undefined);
        // Priority: real auth name > provider name > cached Apple name > email-derived
        const isAuthNameEmailDerived = this.isEmailDerivedDisplayName(authName, user.email);
        const newUserName =
          (!isAuthNameEmailDerived ? authName : '') ||
          providerName ||
          cachedAppleNameNew ||
          authName ||
          emailName;
        const qrId = derivedQrId;

        this.identity = {
          uid: user.uid,
          publicUserCode,
          qrId,
          displayName: newUserName || 'Kullanıcı',
          email: user.email || undefined,
          photoURL: user.photoURL || undefined,
          isVerified: true,
          createdAt: Date.now(),
          lastSyncAt: Date.now(),
        };

        const userData: Record<string, any> = {
          publicUserCode,
          qrId,
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
      this.notifyListeners();
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

  /**
   * Returns the Firebase Auth UID — the SINGLE canonical primary key for ALL write paths.
   * CANONICAL: This is a Firebase Auth UID. Never use deviceId or installationId for write paths.
   * Returns null when not initialized.
   */
  getUid(): string | null {
    return this.identity?.uid || null;
  }

  /** Public sharing code for QR display and friend-add */
  getPublicUserCode(): string {
    return this.identity?.publicUserCode || '';
  }

  /** Display name */
  getDisplayName(): string {
    return this.identity?.displayName || 'Kullanıcı';
  }

  /**
   * Identity aliases used for routing/dedup in chat + mesh layers.
   * NOTE: These are for READ/MATCHING purposes only (e.g., mesh routing, dedup).
   * NEVER use aliases as Firestore document keys in write paths — use getUid() instead.
   */
  getAliases(): string[] {
    if (!this.identity?.uid) return [];

    const aliases = new Set<string>();
    aliases.add(this.identity.uid);

    if (this.identity.publicUserCode) {
      aliases.add(this.identity.publicUserCode);
    }
    if (this.identity.qrId) {
      aliases.add(this.identity.qrId);
    } else {
      aliases.add(`AFN-${this.identity.uid.substring(0, 8).toUpperCase()}`);
    }

    return Array.from(aliases);
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
  // All these methods return Firebase Auth UID. They exist only for backward
  // compatibility — callers should migrate to getUid() directly.

  /** @deprecated Use getUid(). Returns Firebase Auth UID (NOT a legacy device ID). */
  getMyId(): string | null { return this.getUid(); }
  /** @deprecated Use getUid(). Returns Firebase Auth UID. */
  getCloudUid(): string | undefined { return this.identity?.uid; }
  /** @deprecated Use getUid(). Returns Firebase Auth UID (NOT a hardware device ID). */
  getDeviceId(): string | null { return this.getUid(); }
  /** @deprecated Use getUid(). Returns Firebase Auth UID (NOT a BLE mesh device ID). */
  getMeshDeviceId(): string | null { return this.getUid(); }
  /** @deprecated Use getUid(). Returns Firebase Auth UID (NOT an installation ID). */
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
          // CRITICAL FIX: parseQRPayload is async — must await recursive call
          const result = await this.parseQRPayload(val);
          if (result) return result;
        }
      }
    } catch {
      // Not a URL
    }

    // Plain UID
    if (UID_REGEX.test(raw) && !raw.toUpperCase().startsWith('AFN-')) {
      return { v: 0, uid: raw, name: 'Bilinmeyen Kullanıcı' };
    }

    // AFN code — resolve via Firestore lookup (publicUserCode or qrId)
    if (raw.toUpperCase().startsWith('AFN-')) {
      const attemptResolve = async (): Promise<QRPayload | null> => {
        const app = initializeFirebase();
        if (!app) return null;

        const db = await getFirestoreInstanceAsync();
        if (!db) return null;
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
          const db = await getFirestoreInstanceAsync();
          if (!db) return;
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
          const db = await getFirestoreInstanceAsync();
          if (!db) return;
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

      const db = await getFirestoreInstanceAsync();
      if (!db) return null;
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
    this.notifyListeners();
    try { DirectStorage.delete(IDENTITY_CACHE_KEY); } catch { /* best effort */ }
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
      DirectStorage.setString(IDENTITY_CACHE_KEY, JSON.stringify(this.identity));
    } catch (error) {
      logger.error('Failed to cache identity:', error);
    }
  }

  private async loadCachedIdentity(): Promise<UserIdentity | null> {
    try {
      const cached = DirectStorage.getString(IDENTITY_CACHE_KEY) ?? null;
      if (cached) return JSON.parse(cached) as UserIdentity;
    } catch (error) {
      logger.error('Failed to load cached identity:', error);
    }
    return null;
  }
}

export const identityService = new IdentityService();
