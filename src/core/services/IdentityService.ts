/**
 * IDENTITY SERVICE - ELITE FIREBASE EDITION
 * Single source of truth for "Who am I?"
 * 
 * Now fully integrated with Firebase Auth for persistent identity.
 * Manages the unified identity across Cloud (Firebase) and Mesh (Device ID).
 * 
 * @author AfetNet Elite Messaging System
 * @version 2.0.0 - Firebase Integration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getDeviceId } from '../../lib/device';
import { initializeFirebase } from '../../lib/firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('IdentityService');

// Storage keys
const IDENTITY_CACHE_KEY = '@afetnet:identity_cache_v2';

/**
 * User Identity Interface - The Golden Record
 */
export interface UserIdentity {
  id: string;              // The QR ID (AFN-XXXXXXXX format)
  deviceId: string;        // Physical device ID for mesh routing
  cloudUid?: string;       // Firebase Auth UID (if logged in)
  displayName: string;     // User display name
  email?: string;          // User email
  photoURL?: string;       // Profile photo URL
  publicKey?: string;      // For future E2E encryption
  isVerified: boolean;     // True if cloud authenticated
  type: 'CLOUD' | 'MESH_ONLY';
  createdAt?: number;      // When identity was created
  lastSyncAt?: number;     // Last Firebase sync time
}

/**
 * QR Payload Interface
 */
export interface QRPayload {
  v: number;               // Version
  id: string;              // QR ID (AFN-XXXXXXXX)
  uid: string;             // Firebase UID
  did: string;             // Device ID for mesh routing
  name: string;            // Display name
  type: 'CLOUD' | 'MESH_ONLY' | 'LEGACY';
  pk?: string;             // Public key (optional)
}

class IdentityService {
  private identity: UserIdentity | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the identity service.
   * Priority: Firebase Auth > Cached Identity > Device ID fallback
   */
  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) return this.initPromise;
    if (this.isInitialized) return;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      logger.info('🔐 Initializing IdentityService...');

      const deviceId = await getDeviceId();
      if (!deviceId) {
        throw new Error('Cannot get device ID');
      }

      // Step 1: Try Firebase Auth
      const app = initializeFirebase();
      if (app) {
        const auth = getAuth(app);
        const currentUser = auth.currentUser;

        if (currentUser) {
          await this.syncFromFirebase(currentUser, deviceId);
          this.isInitialized = true;
          logger.info(`✅ Identity initialized from Firebase: ${this.identity?.id}`);
          return;
        }
      }

      // Step 2: Try cached identity
      const cached = await this.loadCachedIdentity();
      if (cached) {
        this.identity = cached;
        this.isInitialized = true;
        logger.info(`✅ Identity loaded from cache: ${this.identity.id}`);
        return;
      }

      // Step 3: Fallback to mesh-only identity
      this.identity = {
        id: deviceId,
        deviceId: deviceId,
        displayName: 'İsimsiz Kahraman',
        isVerified: false,
        type: 'MESH_ONLY',
        createdAt: Date.now(),
      };

      await this.cacheIdentity();
      this.isInitialized = true;
      logger.info(`✅ Identity initialized as MESH_ONLY: ${this.identity.id}`);

    } catch (error) {
      logger.error('❌ Failed to init Identity:', error);
      this.isInitialized = true; // Prevent retry loops
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Sync identity from Firebase Auth user
   */
  async syncFromFirebase(user: User, deviceId?: string): Promise<void> {
    try {
      const app = initializeFirebase();
      if (!app) return;

      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      // Generate consistent QR ID from UID
      const qrId = `AFN-${user.uid.substring(0, 8).toUpperCase()}`;
      const currentDeviceId = deviceId || await getDeviceId() || qrId;

      if (userDoc.exists()) {
        const data = userDoc.data();
        this.identity = {
          id: data.qrId || qrId,
          deviceId: currentDeviceId,
          cloudUid: user.uid,
          displayName: data.displayName || user.displayName || 'İsimsiz Kahraman',
          email: data.email || user.email || undefined,
          photoURL: data.photoURL || user.photoURL || undefined,
          isVerified: true,
          type: 'CLOUD',
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
          lastSyncAt: Date.now(),
        };
      } else {
        // New user - create profile
        this.identity = {
          id: qrId,
          deviceId: currentDeviceId,
          cloudUid: user.uid,
          displayName: user.displayName || 'İsimsiz Kahraman',
          email: user.email || undefined,
          photoURL: user.photoURL || undefined,
          isVerified: true,
          type: 'CLOUD',
          createdAt: Date.now(),
          lastSyncAt: Date.now(),
        };

        // Save to Firestore
        await setDoc(userRef, {
          qrId: qrId,
          deviceId: currentDeviceId,
          displayName: this.identity.displayName,
          email: this.identity.email,
          photoURL: this.identity.photoURL,
          createdAt: new Date(),
          lastLoginAt: new Date(),
        }, { merge: true });
      }

      // Cache locally
      await this.cacheIdentity();
      logger.info(`🔄 Identity synced from Firebase: ${this.identity.id}`);

    } catch (error) {
      logger.error('Failed to sync from Firebase:', error);
    }
  }

  /**
   * Cache identity locally for offline access
   */
  private async cacheIdentity(): Promise<void> {
    if (!this.identity) return;
    try {
      await AsyncStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(this.identity));
    } catch (error) {
      logger.error('Failed to cache identity:', error);
    }
  }

  /**
   * Load cached identity
   */
  private async loadCachedIdentity(): Promise<UserIdentity | null> {
    try {
      const cached = await AsyncStorage.getItem(IDENTITY_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as UserIdentity;
      }
    } catch (error) {
      logger.error('Failed to load cached identity:', error);
    }
    return null;
  }

  /**
   * Get the current unified identity
   */
  getIdentity(): UserIdentity | null {
    return this.identity;
  }

  /**
   * Returns the QR ID that should be used for messaging.
   * Format: AFN-XXXXXXXX
   */
  getMyId(): string {
    return this.identity?.id || 'unknown';
  }

  /**
   * Get the Firebase UID
   */
  getCloudUid(): string | undefined {
    return this.identity?.cloudUid;
  }

  /**
   * Get the device ID for mesh routing
   */
  getDeviceId(): string {
    return this.identity?.deviceId || 'unknown';
  }

  /**
   * Get the current display name
   */
  getDisplayName(): string {
    return this.identity?.displayName || 'İsimsiz Kahraman';
  }

  /**
   * Get the user's email
   */
  getEmail(): string | undefined {
    return this.identity?.email;
  }

  /**
   * Get the user's photo URL
   */
  getPhotoURL(): string | undefined {
    return this.identity?.photoURL;
  }

  /**
   * Check if user is authenticated with cloud
   */
  isCloudAuthenticated(): boolean {
    return this.identity?.type === 'CLOUD' && !!this.identity?.cloudUid;
  }

  /**
   * Generate the QR Code Payload
   * Contains enough info for another user to add us securely.
   */
  getQRPayload(): string {
    if (!this.identity) return '';

    const payload: QRPayload = {
      v: 2, // Version 2 with Firebase integration
      id: this.identity.id,
      uid: this.identity.cloudUid || '',
      did: this.identity.deviceId,
      name: this.identity.displayName,
      type: this.identity.type,
    };

    return JSON.stringify(payload);
  }

  /**
   * Parse a scanned QR payload
   */
  parseQRPayload(data: string): QRPayload | null {
    try {
      const parsed = JSON.parse(data);

      // Version 2 format
      if (parsed.v === 2) {
        if (!parsed.id || !parsed.uid) {
          throw new Error('Invalid V2 QR Data');
        }
        return parsed as QRPayload;
      }

      // Version 1 format (legacy)
      if (parsed.v === 1) {
        return {
          v: 1,
          id: parsed.id,
          uid: parsed.id, // V1 didn't have separate UID
          did: parsed.did || parsed.id,
          name: parsed.name || 'Unknown User',
          type: parsed.type || 'LEGACY',
        };
      }

      throw new Error('Unknown QR version');
    } catch (e) {
      logger.warn('Failed to parse QR:', e);

      // Fallback for legacy QR codes (plain text IDs)
      if (data.startsWith('AFN-') || data.startsWith('afn-')) {
        return {
          v: 0,
          id: data.toUpperCase(),
          uid: data.toUpperCase(),
          did: data.toUpperCase(),
          name: 'Bilinmeyen Kullanıcı',
          type: 'LEGACY',
        };
      }
      return null;
    }
  }

  /**
   * Update display name (syncs to Firebase)
   */
  async updateDisplayName(name: string): Promise<void> {
    if (!this.identity) return;

    this.identity.displayName = name;
    await this.cacheIdentity();

    // Sync to Firebase if authenticated
    if (this.identity.cloudUid) {
      try {
        const app = initializeFirebase();
        if (app) {
          const db = getFirestore(app);
          await setDoc(
            doc(db, 'users', this.identity.cloudUid),
            { displayName: name, updatedAt: new Date() },
            { merge: true }
          );
        }
      } catch (error) {
        logger.error('Failed to sync display name:', error);
      }
    }
  }

  /**
   * Update profile photo (syncs to Firebase)
   */
  async updatePhotoURL(photoURL: string): Promise<void> {
    if (!this.identity) return;

    this.identity.photoURL = photoURL;
    await this.cacheIdentity();

    // Sync to Firebase if authenticated
    if (this.identity.cloudUid) {
      try {
        const app = initializeFirebase();
        if (app) {
          const db = getFirestore(app);
          await setDoc(
            doc(db, 'users', this.identity.cloudUid),
            { photoURL: photoURL, updatedAt: new Date() },
            { merge: true }
          );
        }
      } catch (error) {
        logger.error('Failed to sync photo URL:', error);
      }
    }
  }

  /**
   * Clear identity (for logout)
   */
  async clearIdentity(): Promise<void> {
    this.identity = null;
    this.isInitialized = false;
    await AsyncStorage.removeItem(IDENTITY_CACHE_KEY);
    logger.info('🗑️ Identity cleared');
  }

  /**
   * Force re-sync from Firebase
   */
  async forceSync(): Promise<void> {
    const app = initializeFirebase();
    if (!app) return;

    const auth = getAuth(app);
    const user = auth.currentUser;

    if (user) {
      await this.syncFromFirebase(user);
      logger.info('🔄 Force sync completed');
    }
  }
}

export const identityService = new IdentityService();
