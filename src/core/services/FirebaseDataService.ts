/**
 * FIREBASE DATA SERVICE V3 — UID-CENTRIC FACADE
 * Unified facade delegating to modular UID-centric Firebase operations.
 * 
 * V3 MIGRATION:
 * - All methods now accept `uid` (Firebase Auth UID) as the primary identifier
 * - Legacy `userDeviceId` parameters are maintained for backward compat but
 *   internally resolve to UID where possible
 * - Message operations delegate to conversation-based model
 * - Family operations delegate to families/{familyId}/members/{uid} model
 * - Location/health/status delegate to users/{uid} subcollections
 */

import { createLogger } from '../utils/logger';
import { FamilyMember } from '../types/family';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import type {
  MessageData,
  ConversationData,
  HealthProfileData,
  ICEData,
  LocationUpdateData,
  StatusUpdateData,
  EarthquakeFirebaseData,
  FeltEarthquakeReportData,
  UserInboxThread,
} from '../types/firebase';

// V3 operations
import {
  findOrCreateDMConversation,
  getConversation,
  saveMessage as saveMessageV3,
  loadMessages as loadMessagesV3,
  subscribeToMessages as subscribeToMessagesV3,
  loadInboxThreads,
  subscribeToInbox,
  markConversationRead,
  deleteConversationFromInbox,
  saveMessageLegacy,
  markMessageAsDelivered as markMessageAsDeliveredOp,
  markMessageAsRead as markMessageAsReadOp,
  subscribeToLegacyDeviceMessages,
} from './firebase/FirebaseMessageOperations';
import {
  saveLocationUpdate as saveLocationUpdateV3,
  getCurrentLocation,
  subscribeToLocationAsync,
} from './firebase/FirebaseLocationOperations';
import {
  saveFamilyMember as saveFamilyMemberV3,
  loadFamilyMembers as loadFamilyMembersV3,
  deleteFamilyMember as deleteFamilyMemberV3,
  subscribeToFamilyMembers as subscribeToFamilyMembersV3,
  getOrCreateDefaultFamily,
  loadFamilyMembersLegacy,
} from './firebase/FirebaseFamilyOperations';
import {
  saveHealthProfile as saveHealthProfileV3,
  loadHealthProfile as loadHealthProfileV3,
  saveICE as saveICEV3,
  loadICE as loadICEV3,
} from './firebase/FirebaseHealthOperations';
import {
  saveStatusUpdate as saveStatusUpdateV3,
} from './firebase/FirebaseStatusOperations';
import {
  saveDeviceId as saveDeviceIdOp,
  subscribeToDeviceLocation as subscribeToDeviceLocationOp,
  ensureDeviceDocExists as ensureDeviceDocExistsOp,
} from './firebase/FirebaseDeviceOperations';
import {
  saveNewsSummary as saveNewsSummaryOp,
  getNewsSummary as getNewsSummaryOp,
  claimNewsSummaryJob as claimNewsSummaryJobOp,
  finalizeNewsSummaryJob as finalizeNewsSummaryJobOp,
  NewsSummaryRecord,
  NewsSummaryJobClaimResult,
} from './firebase/FirebaseNewsOperations';
import {
  saveEarthquake as saveEarthquakeOp,
  saveFeltEarthquakeReport as saveFeltEarthquakeReportOp,
  getIntensityData as getIntensityDataOp,
} from './firebase/FirebaseEarthquakeOperations';
import { isLikelyFirebaseUid } from '../utils/messaging/identityUtils';
import { readCachedAuthUid } from '../utils/authSessionCache';
import type { MessageSendOutcome, SaveMessageResult } from './messaging/types';

const logger = createLogger('FirebaseDataService');

// Re-export types for backward compatibility
export type { NewsSummaryRecord } from './firebase/FirebaseNewsOperations';
export type { NewsSummaryJobClaimResult } from './firebase/FirebaseNewsOperations';

class FirebaseDataService {
  private _isInitialized = false;
  private _authRetryUnsubscribe: (() => void) | null = null;
  private _initPromise: Promise<void> | null = null;
  private _recipientUidCache = new Map<string, { uid: string | null; expiresAt: number }>();
  private readonly RECIPIENT_UID_CACHE_TTL_MS = 10 * 60 * 1000;
  private readonly RECIPIENT_UID_NEGATIVE_CACHE_TTL_MS = 45 * 1000;

  private isLikelyUid(value: string): boolean {
    return isLikelyFirebaseUid(value);
  }

  private getCachedRecipientUid(candidate: string): string | null | undefined {
    const key = candidate.trim();
    if (!key) return undefined;

    const cached = this._recipientUidCache.get(key);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
      this._recipientUidCache.delete(key);
      return undefined;
    }
    return cached.uid;
  }

  private setCachedRecipientUid(candidate: string, uid: string | null): void {
    const key = candidate.trim();
    if (!key) return;

    this._recipientUidCache.set(key, {
      uid,
      expiresAt: Date.now() + (uid ? this.RECIPIENT_UID_CACHE_TTL_MS : this.RECIPIENT_UID_NEGATIVE_CACHE_TTL_MS),
    });
  }

  /**
   * Resolve a recipient identifier (uid/public code/deviceId) to Firebase Auth UID.
   * Unlike resolveUidForUserPath(), this resolver MUST NOT default to current user.
   *
   * CANONICAL: The return value is ALWAYS a Firebase Auth UID or null.
   * Never returns a deviceId, installationId, or other non-UID alias.
   */
  private async resolveRecipientUidInternal(candidate: string): Promise<string | null> {
    const trimmed = (candidate || '').trim();
    if (!trimmed || trimmed === 'broadcast') return null;

    if (this.isLikelyUid(trimmed)) {
      this.setCachedRecipientUid(trimmed, trimmed);
      return trimmed;
    }

    const cachedUid = this.getCachedRecipientUid(trimmed);
    if (cachedUid !== undefined) {
      return cachedUid;
    }

    try {
      const { contactService } = await import('./ContactService');
      const cloudUid = contactService.resolveCloudUid(trimmed);
      if (cloudUid && this.isLikelyUid(cloudUid)) {
        this.setCachedRecipientUid(trimmed, cloudUid);
        return cloudUid;
      }
    } catch {
      // best effort
    }

    try {
      const { useFamilyStore } = await import('../stores/familyStore');
      const member = useFamilyStore.getState().members.find((m) =>
        m.uid === trimmed || m.deviceId === trimmed,
      );
      if (member?.uid && this.isLikelyUid(member.uid)) {
        this.setCachedRecipientUid(trimmed, member.uid);
        return member.uid;
      }
    } catch {
      // best effort
    }

    // Device document lookup: devices/{deviceId} → ownerUid
    // This is the most common mapping for device-based identifiers (e.g. BLE mesh IDs).
    try {
      const db = await getFirestoreInstanceAsync();
      if (db) {
        const { doc, getDoc: firestoreGetDoc, collection, getDocs: firestoreGetDocs, limit, query, where } = await import('firebase/firestore');

        const withTimeout = <T>(promise: Promise<T>, ms: number = 3000): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firestore operation timed out')), ms))
          ]);
        };

        // 1. Direct doc lookup: devices/{trimmed}
        const deviceDoc = await withTimeout(firestoreGetDoc(doc(db, 'devices', trimmed)));
        if (deviceDoc.exists()) {
          const ownerUid = deviceDoc.data()?.ownerUid;
          if (typeof ownerUid === 'string' && ownerUid.trim().length > 0 && this.isLikelyUid(ownerUid.trim())) {
            logger.info(`🔗 resolveRecipientUid: device doc lookup "${trimmed}" → ownerUid ${ownerUid.trim()}`);
            this.setCachedRecipientUid(trimmed, ownerUid.trim());
            return ownerUid.trim();
          }
        }

        // 2. Query by deviceId field: handles BLE mesh IDs (e.g. "me-a3f2") stored as field values
        const devicesRef = collection(db, 'devices');
        const byDeviceId = query(devicesRef, where('deviceId', '==', trimmed), limit(1));
        const deviceQuerySnap = await withTimeout(firestoreGetDocs(byDeviceId));
        if (!deviceQuerySnap.empty) {
          const ownerUid = deviceQuerySnap.docs[0].data()?.ownerUid;
          if (typeof ownerUid === 'string' && ownerUid.trim().length > 0 && this.isLikelyUid(ownerUid.trim())) {
            logger.info(`🔗 resolveRecipientUid: device query lookup "${trimmed}" → ownerUid ${ownerUid.trim()}`);
            this.setCachedRecipientUid(trimmed, ownerUid.trim());
            return ownerUid.trim();
          }
        }
      }
    } catch {
      // best effort — device doc may not exist or timed out
    }

    // Last-resort lookup for users indexed by publicUserCode / qrId.
    try {
      const db = await getFirestoreInstanceAsync();
      if (db) {
        const { collection, getDocs: firestoreGetDocs, limit, query, where } = await import('firebase/firestore');
        const usersRef = collection(db, 'users');
        const candidateCodes = new Set<string>([trimmed]);
        if (/^afn-/i.test(trimmed)) {
          candidateCodes.add(trimmed.toUpperCase());
        }

        const withTimeout = <T>(promise: Promise<T>, ms: number = 3000): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firestore operation timed out')), ms))
          ]);
        };

        for (const code of candidateCodes) {
          const byPublicCode = query(usersRef, where('publicUserCode', '==', code), limit(1));
          const publicCodeSnap = await withTimeout(firestoreGetDocs(byPublicCode));
          if (!publicCodeSnap.empty) {
            const resolvedUid = publicCodeSnap.docs[0].id;
            // CANONICAL: Validate that Firestore doc ID is a Firebase Auth UID
            if (this.isLikelyUid(resolvedUid)) {
              this.setCachedRecipientUid(trimmed, resolvedUid);
              return resolvedUid;
            }
            logger.warn(`resolveRecipientUid: publicUserCode lookup returned non-UID doc ID "${resolvedUid}" for "${code}" — skipping`);
          }

          const byQrId = query(usersRef, where('qrId', '==', code), limit(1));
          const qrIdSnap = await withTimeout(firestoreGetDocs(byQrId));
          if (!qrIdSnap.empty) {
            const resolvedUid = qrIdSnap.docs[0].id;
            // CANONICAL: Validate that Firestore doc ID is a Firebase Auth UID
            if (this.isLikelyUid(resolvedUid)) {
              this.setCachedRecipientUid(trimmed, resolvedUid);
              return resolvedUid;
            }
            logger.warn(`resolveRecipientUid: qrId lookup returned non-UID doc ID "${resolvedUid}" for "${code}" — skipping`);
          }
        }
      }
    } catch (error) {
      logger.debug(`resolveRecipientUid lookup failed for "${trimmed}"`, error);
    }

    this.setCachedRecipientUid(trimmed, null);
    return null;
  }

  /**
   * Public recipient resolver used by messaging screens/services to canonicalize
   * AFN/public-code/device aliases into Firebase UIDs before opening threads.
   *
   * CANONICAL: Returns a Firebase Auth UID or null. Never returns deviceId/installationId.
   */
  async resolveRecipientUid(candidate: string): Promise<string | null> {
    if (!this._isInitialized) return null;
    return this.resolveRecipientUidInternal(candidate);
  }

  /**
   * Backward-compatible resolver:
   * - Prefer explicit candidate UID when provided
   * - Legacy fallback: resolve ownerUid from devices/{deviceId}
   * - Final fallback: current authenticated UID
   */
  private async resolveUidForUserPath(
    candidate: string,
    options?: { allowCurrentUserFallback?: boolean },
  ): Promise<string | null> {
    const allowCurrentUserFallback = options?.allowCurrentUserFallback ?? true;
    const trimmed = (candidate || '').trim();
    if (!trimmed) return null;

    if (this.isLikelyUid(trimmed)) {
      return trimmed;
    }

    try {
      const db = await getFirestoreInstanceAsync();
      if (db) {
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'devices', trimmed));
        const ownerUid = snap.data()?.ownerUid;
        if (typeof ownerUid === 'string' && ownerUid.trim().length > 0) {
          return ownerUid.trim();
        }
      }
    } catch (error) {
      logger.debug(`resolveUidForUserPath fallback lookup failed for "${trimmed}"`, error);
    }

    if (allowCurrentUserFallback) {
      try {
        const { identityService } = await import('./IdentityService');
        const identityUid = identityService.getUid();
        if (identityUid) return identityUid;
      } catch {
        // best effort
      }

      const currentUid = await this.getCurrentUid();
      if (currentUid) return currentUid;
    }

    return null;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize() {
    if (this._isInitialized) {
      if (__DEV__) {
        logger.debug('FirebaseDataService already initialized');
      }
      return;
    }

    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = (async () => {
      try {
        const firebaseModule = await import('../../lib/firebase');
        const getFirebaseAppAsync = firebaseModule.getFirebaseAppAsync;

        if (!getFirebaseAppAsync || typeof getFirebaseAppAsync !== 'function') {
          logger.warn('⚠️ getFirebaseAppAsync is not available — Firestore disabled');
          return;
        }

        const initPromise = getFirebaseAppAsync();
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 5000),
        );

        const firebaseApp = await Promise.race([initPromise, timeoutPromise]);

        if (!firebaseApp) {
          logger.warn('⚠️ Firebase app not initialized after 5s — Firestore disabled');
          return;
        }

        const dbPromise = getFirestoreInstanceAsync();
        const dbTimeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 5000),
        );

        const db = await Promise.race([dbPromise, dbTimeoutPromise]);

        if (!db) {
          logger.warn('⚠️ Firestore not available after 5s — messaging will not work');
          return;
        }

        // Verify authentication
        try {
          const { onAuthStateChanged } = await import('firebase/auth');
          const { getFirebaseAuth } = await import('../../lib/firebase');
          const auth = getFirebaseAuth();
          if (!auth) {
            logger.warn('⚠️ Firebase Auth not available — messaging will not work');
            return;
          }
          if (!auth.currentUser) {
            const user = await new Promise<import('firebase/auth').User | null>((resolve) => {
              let settled = false;
              let unsubscribe: (() => void) | null = null;
              let timeout: ReturnType<typeof setTimeout> | null = null;

              const finish = (value: import('firebase/auth').User | null) => {
                if (settled) return;
                settled = true;
                if (timeout) {
                  clearTimeout(timeout);
                  timeout = null;
                }
                if (unsubscribe) {
                  unsubscribe();
                  unsubscribe = null;
                }
                resolve(value);
              };

              unsubscribe = onAuthStateChanged(auth, (u) => {
                if (u) {
                  finish(u);
                }
              });

              timeout = setTimeout(() => finish(null), 3000);
            });

            if (!user) {
              logger.warn('⚠️ FirebaseDataService: auth not available after 3s — initializing anyway');
              if (!this._authRetryUnsubscribe) {
                this._authRetryUnsubscribe = onAuthStateChanged(auth, async (u) => {
                  if (u && this._isInitialized) {
                    logger.info('🔄 Auth became available — triggering familyStore re-init');
                    this._authRetryUnsubscribe?.();
                    this._authRetryUnsubscribe = null;
                    try {
                      const { useFamilyStore } = await import('../stores/familyStore');
                      await useFamilyStore.getState().initialize();
                    } catch (e) {
                      logger.warn('Failed to re-init familyStore after auth:', e);
                    }
                  }
                });
              }
            }
          }
        } catch {
          // Auth module not available
        }

        this._isInitialized = true;
        logger.info('✅ FirebaseDataService V3 initialized (UID-centric)');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // CRITICAL: Always log init failures — previously hidden behind __DEV__ guard,
        // making TestFlight/production failures completely invisible
        logger.error('FirebaseDataService init error:', { error: errorMessage });
      }
    })();

    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  // ── Helper: Get current UID ──────────────────────────────────
  private async getCurrentUid(): Promise<string | null> {
    try {
      const { identityService } = await import('./IdentityService');
      const identityUid = identityService.getUid();
      if (identityUid) return identityUid;
    } catch {
      // best effort
    }

    const cachedUid = readCachedAuthUid();
    if (cachedUid) {
      return cachedUid;
    }

    try {
      const { getFirebaseAuth } = await import('../../lib/firebase');
      return getFirebaseAuth()?.currentUser?.uid || null;
    } catch {
      return null;
    }
  }

  private async getCurrentDisplayName(): Promise<string> {
    try {
      const { identityService } = await import('./IdentityService');
      const identityName = identityService.getDisplayName();
      if (identityName && identityName.trim().length > 0) {
        return identityName.trim();
      }
    } catch {
      // best effort
    }

    try {
      const { getFirebaseAuth } = await import('../../lib/firebase');
      const authName = getFirebaseAuth()?.currentUser?.displayName;
      if (authName && authName.trim().length > 0) {
        return authName.trim();
      }
    } catch {
      // best effort
    }

    return 'AfetNet Kullanıcısı';
  }

  // ── Device (Legacy Compat) ──────────────────────────────────
  async saveDeviceId(deviceId: string): Promise<boolean> {
    return saveDeviceIdOp(deviceId, this._isInitialized);
  }

  async subscribeToDeviceLocation(
    deviceId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (location: any) => void,
  ): Promise<() => void> {
    return subscribeToDeviceLocationOp(deviceId, callback, this._isInitialized);
  }

  async ensureDeviceDocExists(deviceId: string): Promise<boolean> {
    return ensureDeviceDocExistsOp(deviceId);
  }

  // ── V3 Location ─────────────────────────────────────────────
  /**
   * Save location update using UID-centric model.
   * @param uid Firebase Auth UID (or legacy deviceId — internally resolves)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveLocationUpdate(uid: string, location: any): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      const targetUid = await this.resolveUidForUserPath(uid, { allowCurrentUserFallback: true });
      if (!targetUid) {
        logger.warn(`saveLocationUpdate skipped: unable to resolve UID from "${uid}"`);
        return false;
      }
      await saveLocationUpdateV3(targetUid, location);
      return true;
    } catch (error) {
      logger.warn('saveLocationUpdate failed:', error);
      return false;
    }
  }

  /**
   * V3: Subscribe to a user's current location
   */
  async subscribeToUserLocation(
    uid: string,
    callback: (location: LocationUpdateData | null) => void,
    onError?: (error: any) => void,
  ): Promise<() => void> {
    if (!this._isInitialized) return () => { };
    const targetUid = await this.resolveUidForUserPath(uid, { allowCurrentUserFallback: false });
    if (!targetUid) {
      logger.warn(`subscribeToUserLocation skipped: unable to resolve UID from "${uid}"`);
      return () => { };
    }
    const unsub = await subscribeToLocationAsync(targetUid, callback, onError);
    return unsub || (() => { });
  }

  // ── V3 Family ───────────────────────────────────────────────
  /**
   * Save family member using V3 families/{familyId}/members/{uid} model.
   */
  async saveFamilyMember(uid: string, member: FamilyMember): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      const ownerUid = (await this.resolveUidForUserPath(uid)) || uid;
      if (!ownerUid) return false;
      const myDisplayName = await this.getCurrentDisplayName();
      const familyId = await getOrCreateDefaultFamily(ownerUid, myDisplayName);
      if (!familyId) return false;
      const result = await saveFamilyMemberV3(familyId, member, ownerUid);
      return result !== false;
    } catch (error) {
      logger.warn('saveFamilyMember V3 failed:', error);
      return false;
    }
  }

  /**
   * Load family members from V3 model with legacy fallback.
   */
  async loadFamilyMembers(uid: string): Promise<FamilyMember[]> {
    if (!this._isInitialized) return [];
    try {
      const ownerUid = (await this.resolveUidForUserPath(uid)) || uid;
      if (!ownerUid) return [];
      const myDisplayName = await this.getCurrentDisplayName();
      const familyId = await getOrCreateDefaultFamily(ownerUid, myDisplayName);
      if (!familyId) return [];
      const members = await loadFamilyMembersV3(familyId);
      if (members.length > 0) return members;
      // Fallback: try legacy model
      return await loadFamilyMembersLegacy(uid);
    } catch (error) {
      logger.warn('loadFamilyMembers V3 failed:', error);
      return [];
    }
  }

  /**
   * Delete family member from V3 model.
   */
  async deleteFamilyMember(uid: string, memberUid: string): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      const ownerUid = (await this.resolveUidForUserPath(uid)) || uid;
      if (!ownerUid) return false;
      const myDisplayName = await this.getCurrentDisplayName();
      const familyId = await getOrCreateDefaultFamily(ownerUid, myDisplayName);
      if (!familyId) return false;
      await deleteFamilyMemberV3(familyId, memberUid, ownerUid);
      return true;
    } catch (error) {
      logger.warn('deleteFamilyMember V3 failed:', error);
      return false;
    }
  }

  /**
   * Subscribe to family members with V3 model.
   */
  async subscribeToFamilyMembers(
    uid: string,
    callback: (members: FamilyMember[]) => void,
    onError?: (error: Error) => void,
  ): Promise<() => void> {
    if (!this._isInitialized) return () => { };
    try {
      const ownerUid = (await this.resolveUidForUserPath(uid)) || uid;
      if (!ownerUid) return () => { };
      const myDisplayName = await this.getCurrentDisplayName();
      const familyId = await getOrCreateDefaultFamily(ownerUid, myDisplayName);
      if (!familyId) return () => { };
      return subscribeToFamilyMembersV3(familyId, callback);
    } catch (error) {
      logger.warn('subscribeToFamilyMembers V3 failed:', error);
      return () => { };
    }
  }

  // ── V3 Messaging (Conversation Model) ──────────────────────
  /**
   * Send a message using V3 conversation model.
   * Creates or finds DM conversation, saves message, updates inbox.
   * Also does legacy dual-write for backward compat.
   */
  async saveMessage(uid: string, message: MessageData): Promise<SaveMessageResult> {
    const retryableFailure = (error?: string, conversationId?: string): SaveMessageResult => ({
      success: false,
      conversationId,
      outcome: { status: 'retryable_failure', messagePersisted: false, inboxDelivered: false, error },
    });
    const permanentFailure = (error: string): SaveMessageResult => ({
      success: false,
      outcome: { status: 'permanent_failure', messagePersisted: false, inboxDelivered: false, error },
    });

    // CRITICAL FIX: Short-circuit when offline. Firestore on React Native has NO persistent
    // cache (memory-only). Offline getDocs/setDoc calls either block for 10-30s on timeouts
    // or "succeed" into volatile memory cache. Either way the result is useless:
    // - Timeout blocking holds the queueMutex, stalling ALL other message sends
    // - Memory cache "success" evaporates on app kill, permanently losing the message
    // The caller (HybridMessageService.attemptSend) already handles { success: false }
    // correctly by keeping the message in the MMKV retry queue for later.
    try {
      const { connectionManager } = await import('./ConnectionManager');
      if (!connectionManager.isOnline) {
        return retryableFailure('Device offline');
      }
    } catch {
      // ConnectionManager unavailable — proceed with Firestore attempt
    }

    // CRITICAL FIX: Lazy re-initialization — if init failed silently during startup
    // (timeout, slow network, etc.), retry here instead of permanently breaking messaging
    if (!this._isInitialized) {
      logger.warn('saveMessage: not initialized — attempting lazy re-init');
      await this.initialize();
      if (!this._isInitialized) {
        logger.error('saveMessage: lazy re-init FAILED — message will not be sent');
        return retryableFailure('FirebaseDataService not initialized');
      }
    }
    try {
      // CRITICAL FIX: Use message.senderUid as fallback when getAuth().currentUser is temporarily null.
      // identityService.getUid() (used by attemptSend to set message.senderUid) reads from MMKV cache
      // which survives auth state transitions. getAuth().currentUser?.uid can be null during:
      // - Cold start (Firebase Auth SDK restoring from persistence)
      // - Token refresh (brief gap between old and new token)
      // - Network-triggered re-authentication
      // Without this fallback, ALL messages silently fail until auth state stabilizes.
      let senderUid = await this.getCurrentUid();
      if (!senderUid) {
        const messageSenderUid = typeof message.senderUid === 'string' ? message.senderUid.trim() : '';
        if (messageSenderUid && this.isLikelyUid(messageSenderUid)) {
          logger.warn(`saveMessage: getCurrentUid() returned null — using message.senderUid="${messageSenderUid}" as fallback`);
          senderUid = messageSenderUid;
        } else {
          logger.error('🚨 saveMessage: NO authenticated user AND no valid senderUid in message — cannot send');
          return permanentFailure('No authenticated user and no valid senderUid');
        }
      }

      let v3Outcome: MessageSendOutcome | null = null;
      const requestedConversationId = typeof message.conversationId === 'string'
        ? message.conversationId.trim()
        : '';
      let resolvedConversationId: string | undefined;

      // Determine recipient UID from any supported identity form
      const rawRecipientId = typeof message.toDeviceId === 'string' ? message.toDeviceId.trim() : '';
      const recipientUid = rawRecipientId && rawRecipientId !== 'broadcast'
        ? await this.resolveRecipientUidInternal(rawRecipientId)
        : null;

      // PRODUCTION LOGGING: Always log resolution result for delivery debugging
      if (rawRecipientId && rawRecipientId !== 'broadcast') {
        if (recipientUid) {
          logger.info(`📨 saveMessage: recipient resolved "${rawRecipientId}" → UID ${recipientUid}`);
        } else {
          logger.warn(`🚨 saveMessage: recipient UID NOT resolved from "${rawRecipientId}" — V3 conversation path will be SKIPPED, message may NOT be delivered!`);
        }
      }

      // Determine effective recipient UID for V3 path.
      // CRITICAL: Only use resolved UIDs — never use raw identifiers as participants.
      // Non-UID participants break security rules (receiver can't read the conversation).
      let effectiveRecipientUid = recipientUid && this.isLikelyUid(recipientUid) ? recipientUid : null;

      if (requestedConversationId) {
        try {
          const existingConversation = await getConversation(requestedConversationId);
          const participants = Array.isArray(existingConversation?.participants)
            ? existingConversation.participants.filter((participant): participant is string =>
              typeof participant === 'string' && this.isLikelyUid(participant),
            )
            : [];
          if (existingConversation?.id && participants.includes(senderUid)) {
            const peerUidFromConversation = participants.find((participant) => participant !== senderUid) || null;
            if (peerUidFromConversation) {
              effectiveRecipientUid = effectiveRecipientUid || peerUidFromConversation;
              resolvedConversationId = existingConversation.id;
              logger.info(`📨 saveMessage: reusing existing conversation ${existingConversation.id} for sender ${senderUid}`);
            }
          }
        } catch (conversationError) {
          logger.warn(`saveMessage: failed to inspect requested conversation ${requestedConversationId}`, conversationError);
        }
      }

      if (!effectiveRecipientUid && rawRecipientId && rawRecipientId !== 'broadcast') {
        // CANONICAL: UID resolution failed for a directed message. Do NOT fall back to
        // legacy device-based write path with a non-UID key — that creates orphan documents
        // in Firestore that no receiver subscribes to. Return retryable failure so the
        // caller (HybridMessageService) keeps the message in its retry queue.
        logger.error(`🚨 saveMessage: UID resolution failed for "${rawRecipientId}" — returning retryable failure (no legacy fallback for non-UID keys)`);
        return retryableFailure(`Recipient UID not resolved from "${rawRecipientId}"`);
      }

      if (effectiveRecipientUid) {
        const conversation = resolvedConversationId
          ? { id: resolvedConversationId }
          : await findOrCreateDMConversation(
            senderUid,
            effectiveRecipientUid,
            message.metadata?.senderName as string || '',
          );

        if (conversation) {
          // Build V3 message
          const v3Message: MessageData = {
            ...message,
            senderUid: senderUid,
            senderName: message.metadata?.senderName as string || (message as any).fromName || message.senderName || '',
            // CRITICAL FIX: Mark as V3 so legacy onNewMessage CF skips it.
            // Without schemaVersion: 3, the legacy CF fires on devices/{id}/messages
            // and sends a DUPLICATE push or no push at all when V3 path is used.
            schemaVersion: 3,
          };

          resolvedConversationId = conversation.id;
          v3Outcome = await saveMessageV3(resolvedConversationId, v3Message, [senderUid, effectiveRecipientUid]);

          if (v3Outcome.messagePersisted) {
            logger.info(`✅ V3 message saved to conversation ${resolvedConversationId} (outcome: ${v3Outcome.status})`);
            if (!v3Outcome.inboxDelivered) {
              logger.warn(`⚠️ V3 message ${message.id}: inbox write failed — CF syncConversationInboxV3 will deliver server-side`);
            }
            // CRITICAL FIX: Propagate conversationId back to messageStore.
            // Without this, the sent message has no conversationId and is INVISIBLE
            // in ConversationScreen which filters primarily by conversationId.
            try {
              const { useMessageStore } = require('../stores/messageStore');
              const existingMsg = useMessageStore.getState().messages.find((m: any) => m.id === message.id);
              if (existingMsg && !existingMsg.conversationId) {
                useMessageStore.getState().addMessage({
                  ...existingMsg,
                  conversationId: resolvedConversationId,
                });
                logger.info(`📨 Backfilled conversationId=${resolvedConversationId} onto sent message ${message.id}`);
              }
            } catch (backfillError) {
              logger.debug('conversationId backfill failed (non-critical):', backfillError);
            }
          } else {
            logger.warn(`❌ V3 message save FAILED for conversation ${resolvedConversationId} (outcome: ${v3Outcome.status})`);
          }
        } else {
          logger.warn('saveMessage: conversation could not be created/resolved');
        }
      }

      // Derive v3Success from outcome for legacy path decision
      const v3Success = v3Outcome?.messagePersisted === true;

      // DUPLICATE-NOTIFICATION FIX: Legacy write is now SKIPPED when V3 succeeds.
      // The legacy path (devices/{id}/messages/{id}) triggers the old onNewMessage
      // Cloud Function which sends a SECOND FCM push to the recipient → duplicate notification.
      // V3 onNewConversationMessageV3 CF already handles push for the V3 path.
      // CANONICAL: Legacy write is ONLY used for broadcast (no specific recipient).
      // For directed messages (rawRecipientId != broadcast), the early return above
      // already rejects unresolved UIDs. Legacy device-based write paths with non-UID
      // keys create orphan documents that no receiver subscribes to.
      let legacySuccess = false;
      if (!v3Success) {
        // Only allow legacy write for broadcast/self-addressed messages (not directed non-UID)
        const isBroadcastOrSelf = !rawRecipientId || rawRecipientId === 'broadcast';
        if (isBroadcastOrSelf) {
          try {
            const legacyTargetDeviceId = uid;
            if (legacyTargetDeviceId) {
              legacySuccess = await saveMessageLegacy(legacyTargetDeviceId, message);
            }
          } catch {
            // Legacy write failure is non-blocking
          }
        } else {
          // Directed message where V3 failed — return retryable failure
          logger.warn(`⚠️ saveMessage: V3 path failed for directed message to "${rawRecipientId}" — skipping legacy write, returning retryable failure`);
          return retryableFailure(
            v3Outcome?.error || 'V3 path failed for directed message',
            resolvedConversationId,
          );
        }
      }

      // Build the final result with structured outcome
      const overallSuccess = v3Success || legacySuccess;

      if (v3Outcome && v3Success) {
        // V3 path succeeded — propagate the structured outcome directly
        return {
          success: true,
          conversationId: resolvedConversationId || v3Outcome.conversationId,
          outcome: { ...v3Outcome, conversationId: resolvedConversationId || v3Outcome.conversationId },
        };
      }

      if (legacySuccess) {
        // Only legacy succeeded (no V3 path taken — e.g., broadcast)
        return {
          success: true,
          conversationId: resolvedConversationId,
          outcome: {
            status: 'full_success',
            messagePersisted: true,
            inboxDelivered: true,
            conversationId: resolvedConversationId,
          },
        };
      }

      // Both paths failed
      return retryableFailure(
        v3Outcome?.error || 'V3 and legacy paths both failed',
        resolvedConversationId,
      );
    } catch (error) {
      logger.warn('saveMessage V3 failed:', error);
      return retryableFailure(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Mark message as delivered for Double-tick (WhatsApp style)
   */
  async markMessageAsDelivered(conversationId: string, messageId: string): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      return await markMessageAsDeliveredOp(conversationId, messageId);
    } catch (error) {
      logger.warn('markMessageAsDelivered failed:', error);
      return false;
    }
  }

  /**
   * Mark message as read (Blue ticks)
   */
  async markMessageAsRead(conversationId: string, messageId: string): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      return await markMessageAsReadOp(conversationId, messageId);
    } catch (error) {
      logger.warn('markMessageAsRead failed:', error);
      return false;
    }
  }

  /**
   * Load messages from V3 conversation model.
   * @param conversationId The conversation ID to load messages from
   */
  async loadMessages(conversationId: string): Promise<MessageData[]> {
    if (!this._isInitialized) return [];
    try {
      return await loadMessagesV3(conversationId);
    } catch (error) {
      logger.warn('loadMessages V3 failed:', error);
      return [];
    }
  }

  /**
   * ELITE: Load voice messages for a user across all conversations
   * Used for Voice Message Hydration (restoring history from cloud)
   */
  async loadVoiceMessagesForUser(uid: string, limitCount = 50): Promise<MessageData[]> {
    if (!this._isInitialized) return [];
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return [];

      const { collectionGroup, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');

      // Query 'messages' collection group for type == 'voice' AND participant == uid
      // Note: This requires a composite index: messages(type, participants)
      // If index is missing, this might fail or require index creation link in logs.
      // Alternative: Query by senderUid == uid OR we can rely on conversation sync.
      // But for "Walkie-Talkie" history, we want all voice notes.

      // Strategy: 
      // 1. Sent by me: senderUid == uid, type == 'voice'
      // 2. Received by me: Not easily queryable without "participants" array in message doc.
      //    Standard Chat messages are in subcollections.

      // Better Strategy for MVP:
      // VoiceMessageService backs up metadata to `voice/${userId}/${messageId}` in storage? 
      // No, it uploads blob to storage, but metadata should be in Firestore.

      // Let's use a Collection Group query on 'messages' where type == 'voice'
      // AND (senderUid == uid OR (conversation participants include uid -> hard in subcollection))

      // Actually, standard messages have `senderUid`.
      // We can easily find "Sent by me".
      // To find "Received by me", we need to query conversations first, then messages.
      // BUT `loadInboxThreads` already gives us active conversations.
      // `HybridMessageService.syncMessagesWithCloud` already handles text hydration per conversation.

      // So `VoiceMessageService` only needs to find "Voice Notes I sent/received" that might NOT be in active text threads?
      // Or maybe we just use this to find ALL voice notes quickly.

      // Let's query for "voice" messages where senderUid == uid (Sent by me)
      // For received, we rely on `HybridMessageService` sync, OR we query if we store `recipientUid` on message.

      const messagesRef = collectionGroup(db, 'messages');
      const q = query(
        messagesRef,
        where('type', '==', 'voice'),
        where('senderUid', '==', uid), // Only ones sent by me for now to guarantee index safety
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const messages: MessageData[] = [];
      snapshot.forEach(doc => {
        messages.push({ id: doc.id, ...doc.data() } as MessageData);
      });

      return messages;
    } catch (error) {
      logger.warn('loadVoiceMessagesForUser failed:', error);
      return [];
    }
  }

  /**
   * Subscribe to real-time message updates (V3 conversation model).
   * @param conversationId The conversation ID (NOT user UID!)
   */
  async subscribeToMessages(
    conversationId: string,
    callback: (messages: MessageData[]) => void,
    onError?: (error: Error) => void,
  ): Promise<(() => void) | null> {
    return this.subscribeToConversationMessages(conversationId, callback, onError);
  }

  /**
   * Subscribe to real-time message updates for a specific conversation.
   * Path: conversations/{conversationId}/messages/
   * @param conversationId The V3 conversation ID (random UUID)
   */
  async subscribeToConversationMessages(
    conversationId: string,
    callback: (messages: MessageData[]) => void,
    onError?: (error: Error) => void,
  ): Promise<(() => void) | null> {
    // CRITICAL FIX: Lazy re-initialization for subscriptions too
    if (!this._isInitialized) {
      logger.warn('subscribeToConversationMessages: not initialized — attempting lazy re-init');
      await this.initialize();
      if (!this._isInitialized) {
        logger.error('subscribeToConversationMessages: lazy re-init FAILED — no real-time messages');
        return null;
      }
    }
    try {
      // CRITICAL FIX: Pass onError through so the caller (subscribeToConversation in
      // HybridMessageService) can detect when the underlying Firestore listener dies
      // and remove the dead entry from conversationUnsubscribers for re-subscription.
      return subscribeToMessagesV3(conversationId, callback, onError);
    } catch (error) {
      logger.warn('subscribeToConversationMessages V3 failed:', error);
      onError?.(error as Error);
      return null;
    }
  }

  /**
   * Subscribe to real-time legacy message updates for a specific device.
   * Path: devices/{deviceId}/messages/
   * @param deviceId The legacy device ID
   */
  async subscribeToLegacyDeviceMessages(
    deviceId: string,
    callback: (messages: MessageData[]) => void,
    onError?: (error: Error) => void,
  ): Promise<(() => void) | null> {
    // CRITICAL FIX: Lazy re-initialization for subscriptions too
    if (!this._isInitialized) {
      logger.warn('subscribeToLegacyDeviceMessages: not initialized — attempting lazy re-init');
      await this.initialize();
      if (!this._isInitialized) {
        logger.error('subscribeToLegacyDeviceMessages: lazy re-init FAILED — no real-time messages');
        return null;
      }
    }
    try {
      return subscribeToLegacyDeviceMessages(deviceId, callback, onError);
    } catch (error) {
      logger.warn('subscribeToLegacyDeviceMessages failed:', error);
      return null;
    }
  }

  /**
   * V3: Load user inbox threads
   */
  async loadInboxThreads(uid: string): Promise<UserInboxThread[]> {
    if (!this._isInitialized) return [];
    return loadInboxThreads(uid);
  }

  /**
   * V3: Subscribe to inbox updates
   */
  async subscribeToInbox(
    uid: string,
    callback: (threads: UserInboxThread[]) => void,
  ): Promise<(() => void) | null> {
    if (!this._isInitialized) return () => { };
    return subscribeToInbox(uid, callback);
  }

  /**
   * V3: Mark conversation as read
   */
  async markConversationRead(uid: string, conversationId: string): Promise<void> {
    await markConversationRead(uid, conversationId);
  }

  /**
   * Save conversation metadata (backward compat shim)
   */
  async saveConversation(_uid: string, _conversation: ConversationData): Promise<boolean> {
    // V3: Conversations are created via findOrCreateDMConversation
    return true;
  }

  /**
   * Load conversations (backward compat → returns inbox threads as conversations)
   */
  async loadConversations(uid: string): Promise<ConversationData[]> {
    if (!this._isInitialized) return [];
    try {
      const threads = await loadInboxThreads(uid);
      // Map threads to ConversationData for backward compat
      return threads.map(t => ({
        id: t.conversationId,
        participants: [],
        type: 'dm' as const,
        lastMessagePreview: t.lastMessagePreview,
        lastMessageAt: t.lastMessageAt,
        updatedAt: t.lastMessageAt,
        createdAt: t.lastMessageAt,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Delete conversation from inbox
   */
  async deleteConversation(uid: string, conversationId: string): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      await deleteConversationFromInbox(uid, conversationId);
      return true;
    } catch {
      return false;
    }
  }

  // ── V3 Health & ICE ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveHealthProfile(uid: string, profile: any): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      await saveHealthProfileV3(uid, profile);
      return true;
    } catch (error) {
      logger.warn('saveHealthProfile V3 failed:', error);
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadHealthProfile(uid: string): Promise<any | null> {
    if (!this._isInitialized) return null;
    try {
      return await loadHealthProfileV3(uid);
    } catch (error) {
      logger.warn('loadHealthProfile V3 failed:', error);
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveICE(uid: string, iceData: any): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      await saveICEV3(uid, iceData);
      return true;
    } catch (error) {
      logger.warn('saveICE V3 failed:', error);
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadICE(uid: string): Promise<any | null> {
    if (!this._isInitialized) return null;
    try {
      return await loadICEV3(uid);
    } catch (error) {
      logger.warn('loadICE V3 failed:', error);
      return null;
    }
  }

  // ── V3 Status ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveStatusUpdate(uid: string, statusData: any): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      const targetUid = await this.resolveUidForUserPath(uid);
      if (!targetUid) {
        logger.warn(`saveStatusUpdate skipped: unable to resolve UID from "${uid}"`);
        return false;
      }
      await saveStatusUpdateV3(targetUid, statusData);
      return true;
    } catch (error) {
      logger.warn('saveStatusUpdate V3 failed:', error);
      return false;
    }
  }

  // ── News (unchanged) ───────────────────────────────────────
  async saveNewsSummary(summary: NewsSummaryRecord): Promise<boolean> {
    return saveNewsSummaryOp(summary, this._isInitialized);
  }

  async getNewsSummary(articleId: string): Promise<NewsSummaryRecord | null> {
    return getNewsSummaryOp(articleId, this._isInitialized);
  }

  async claimNewsSummaryJob(articleId: string, leaseMs: number): Promise<NewsSummaryJobClaimResult> {
    return claimNewsSummaryJobOp(articleId, leaseMs, this._isInitialized);
  }

  async finalizeNewsSummaryJob(
    articleId: string,
    status: 'completed' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    await finalizeNewsSummaryJobOp(articleId, status, this._isInitialized, errorMessage);
  }

  // ── Earthquake (unchanged) ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveEarthquake(earthquake: any): Promise<boolean> {
    return saveEarthquakeOp(earthquake, this._isInitialized);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveFeltEarthquakeReport(report: any): Promise<boolean> {
    return saveFeltEarthquakeReportOp(report, this._isInitialized);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getIntensityData(earthquakeId: string): Promise<any | null> {
    return getIntensityDataOp(earthquakeId, this._isInitialized);
  }

  // ── Seismic Detection (unchanged) ──────────────────────────
  async saveSeismicDetection(detection: {
    id: string;
    deviceId: string;
    timestamp: number;
    latitude: number;
    longitude: number;
    magnitude: number;
    depth: number;
    pWaveDetected: boolean;
    sWaveDetected: boolean;
    confidence: number;
    warningTime: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waveCalculation?: any;
    source: string;
  }): Promise<boolean> {
    if (!this._isInitialized) {
      return false;
    }

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return false;

      const { doc, setDoc } = await import('firebase/firestore');

      const TIMEOUT_MS = 10000;
      const savePromise = setDoc(doc(db, 'seismicDetections', detection.id), {
        ...detection,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Seismic detection save timeout')), TIMEOUT_MS);
      });

      try {
        await Promise.race([savePromise, timeoutPromise]);
        return true;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      const errorObj = error as { code?: string; message?: string };
      const errorMessage = errorObj?.message || String(error);

      if (errorObj?.code === 'permission-denied' || errorMessage.includes('permission')) {
        return false;
      }
      if (errorMessage.includes('LoadBundleFromServerRequestError')) {
        return false;
      }

      logger.error('Failed to save seismic detection:', error);
      return false;
    }
  }
}

export const firebaseDataService = new FirebaseDataService();
