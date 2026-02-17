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
  saveMessage as saveMessageV3,
  loadMessages as loadMessagesV3,
  subscribeToMessages as subscribeToMessagesV3,
  loadInboxThreads,
  subscribeToInbox,
  markConversationRead,
  deleteConversationFromInbox,
  saveMessageLegacy,
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

const logger = createLogger('FirebaseDataService');

// Re-export types for backward compatibility
export type { NewsSummaryRecord } from './firebase/FirebaseNewsOperations';
export type { NewsSummaryJobClaimResult } from './firebase/FirebaseNewsOperations';

class FirebaseDataService {
  private _isInitialized = false;
  private _authRetryUnsubscribe: (() => void) | null = null;
  private _initPromise: Promise<void> | null = null;

  private isLikelyUid(value: string): boolean {
    return /^[A-Za-z0-9]{20,40}$/.test(value);
  }

  /**
   * Resolve a recipient identifier (uid/public code/deviceId) to Firebase UID.
   * Unlike resolveUidForUserPath(), this resolver MUST NOT default to current user.
   */
  private async resolveRecipientUidInternal(candidate: string): Promise<string | null> {
    const trimmed = (candidate || '').trim();
    if (!trimmed || trimmed === 'broadcast') return null;

    if (this.isLikelyUid(trimmed)) {
      return trimmed;
    }

    try {
      const { contactService } = await import('./ContactService');
      const cloudUid = contactService.resolveCloudUid(trimmed);
      if (cloudUid && this.isLikelyUid(cloudUid)) {
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
        const { doc, getDoc, collection, getDocs, limit, query, where } = await import('firebase/firestore');

        // 1. Direct doc lookup: devices/{trimmed}
        const deviceDoc = await getDoc(doc(db, 'devices', trimmed));
        if (deviceDoc.exists()) {
          const ownerUid = deviceDoc.data()?.ownerUid;
          if (typeof ownerUid === 'string' && ownerUid.trim().length > 0 && this.isLikelyUid(ownerUid.trim())) {
            logger.info(`🔗 resolveRecipientUid: device doc lookup "${trimmed}" → ownerUid ${ownerUid.trim()}`);
            return ownerUid.trim();
          }
        }

        // 2. Query by deviceId field: handles BLE mesh IDs (e.g. "me-a3f2") stored as field values
        const devicesRef = collection(db, 'devices');
        const byDeviceId = query(devicesRef, where('deviceId', '==', trimmed), limit(1));
        const deviceQuerySnap = await getDocs(byDeviceId);
        if (!deviceQuerySnap.empty) {
          const ownerUid = deviceQuerySnap.docs[0].data()?.ownerUid;
          if (typeof ownerUid === 'string' && ownerUid.trim().length > 0 && this.isLikelyUid(ownerUid.trim())) {
            logger.info(`🔗 resolveRecipientUid: device query lookup "${trimmed}" → ownerUid ${ownerUid.trim()}`);
            return ownerUid.trim();
          }
        }
      }
    } catch {
      // best effort — device doc may not exist
    }

    // Last-resort lookup for users indexed by publicUserCode / qrId.
    try {
      const db = await getFirestoreInstanceAsync();
      if (db) {
        const { collection, getDocs, limit, query, where } = await import('firebase/firestore');
        const usersRef = collection(db, 'users');
        const candidateCodes = new Set<string>([trimmed]);
        if (/^afn-/i.test(trimmed)) {
          candidateCodes.add(trimmed.toUpperCase());
        }

        for (const code of candidateCodes) {
          const byPublicCode = query(usersRef, where('publicUserCode', '==', code), limit(1));
          const publicCodeSnap = await getDocs(byPublicCode);
          if (!publicCodeSnap.empty) {
            return publicCodeSnap.docs[0].id;
          }

          const byQrId = query(usersRef, where('qrId', '==', code), limit(1));
          const qrIdSnap = await getDocs(byQrId);
          if (!qrIdSnap.empty) {
            return qrIdSnap.docs[0].id;
          }
        }
      }
    } catch (error) {
      logger.debug(`resolveRecipientUid lookup failed for "${trimmed}"`, error);
    }

    return null;
  }

  /**
   * Public recipient resolver used by messaging screens/services to canonicalize
   * AFN/public-code/device aliases into Firebase UIDs before opening threads.
   */
  async resolveRecipientUid(candidate: string): Promise<string | null> {
    if (!this._isInitialized) return null;
    return this.resolveRecipientUidInternal(candidate);
  }

  /**
   * Backward-compatible resolver:
   * - Prefer authenticated UID
   * - Accept direct UID input
   * - Legacy fallback: resolve ownerUid from devices/{deviceId}
   */
  private async resolveUidForUserPath(candidate: string): Promise<string | null> {
    const trimmed = (candidate || '').trim();
    if (!trimmed) return null;

    const currentUid = await this.getCurrentUid();
    if (currentUid) return currentUid;

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

    try {
      const { identityService } = await import('./IdentityService');
      const identityUid = identityService.getUid();
      if (identityUid) return identityUid;
    } catch {
      // best effort
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
          if (__DEV__) {
            logger.debug('getFirebaseAppAsync is not available — Firestore disabled');
          }
          return;
        }

        const initPromise = getFirebaseAppAsync();
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 8000),
        );

        const firebaseApp = await Promise.race([initPromise, timeoutPromise]);

        if (!firebaseApp) {
          if (__DEV__) {
            logger.debug('Firebase app not initialized — Firestore disabled');
          }
          return;
        }

        const dbPromise = getFirestoreInstanceAsync();
        const dbTimeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 5000),
        );

        const db = await Promise.race([dbPromise, dbTimeoutPromise]);

        if (!db) {
          if (__DEV__) {
            logger.debug('Firestore not available — using AsyncStorage fallback');
          }
          return;
        }

        // Verify authentication
        try {
          const { getAuth, onAuthStateChanged } = await import('firebase/auth');
          const auth = getAuth();
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

              timeout = setTimeout(() => finish(null), 15000);
            });

            if (!user) {
              logger.warn('⚠️ FirebaseDataService: auth not available after 15s — initializing anyway');
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
        if (errorMessage.includes('LoadBundleFromServerRequestError') ||
          errorMessage.includes('Could not load bundle')) {
          if (__DEV__) {
            logger.debug('FirebaseDataService init skipped (bundle load error)');
          }
        } else {
          logger.error('FirebaseDataService init error:', { error: errorMessage });
        }
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
      const { getAuth } = await import('firebase/auth');
      return getAuth().currentUser?.uid || null;
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
      const { getAuth } = await import('firebase/auth');
      const authName = getAuth().currentUser?.displayName;
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
      const targetUid = await this.resolveUidForUserPath(uid);
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
  ): Promise<() => void> {
    if (!this._isInitialized) return () => { };
    const targetUid = await this.resolveUidForUserPath(uid);
    if (!targetUid) {
      logger.warn(`subscribeToUserLocation skipped: unable to resolve UID from "${uid}"`);
      return () => { };
    }
    const unsub = await subscribeToLocationAsync(targetUid, callback);
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
      await saveFamilyMemberV3(familyId, member, ownerUid);
      return true;
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
      await deleteFamilyMemberV3(familyId, memberUid);
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
  async saveMessage(uid: string, message: MessageData): Promise<boolean> {
    if (!this._isInitialized) return false;
    try {
      const senderUid = await this.getCurrentUid();
      if (!senderUid) {
        logger.warn('saveMessage: no authenticated user');
        return false;
      }

      let v3Success = false;

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
      const effectiveRecipientUid = recipientUid && this.isLikelyUid(recipientUid) ? recipientUid : null;

      if (!effectiveRecipientUid && rawRecipientId && rawRecipientId !== 'broadcast') {
        logger.warn(`⚠️ saveMessage: UID resolution failed for "${rawRecipientId}" — V3 path skipped (non-UID participants would break security rules)`);
      }

      if (effectiveRecipientUid) {
        // DM: Find or create conversation
        const conversation = await findOrCreateDMConversation(
          senderUid,
          effectiveRecipientUid,
          message.metadata?.senderName as string || '',
        );

        if (conversation) {
          // Build V3 message
          const v3Message: MessageData = {
            ...message,
            senderUid: senderUid,
            senderName: message.metadata?.senderName as string || message.senderName || '',
          };

          v3Success = await saveMessageV3(conversation.id, v3Message, [senderUid, effectiveRecipientUid]);
          if (v3Success) {
            logger.info(`✅ V3 message saved to conversation ${conversation.id}`);
          } else {
            logger.warn(`❌ V3 message save FAILED for conversation ${conversation.id}`);
          }
        } else {
          logger.warn('saveMessage: conversation could not be created/resolved');
        }
      }

      // LEGACY: Also write to devices path for backward compat
      let legacySuccess = false;
      try {
        // Legacy path is recipient device inbox, not sender identity.
        const legacyTargetDeviceId = rawRecipientId && rawRecipientId !== 'broadcast' ? rawRecipientId : uid;
        if (legacyTargetDeviceId) {
          legacySuccess = await saveMessageLegacy(legacyTargetDeviceId, message);
        }
      } catch {
        // Legacy write failure is non-blocking
      }

      // CRITICAL: V3 path is the ONLY path receivers subscribe to.
      // If V3 failed but legacy succeeded, the message WON'T be delivered.
      // Return false so the caller retries (and potentially resolves UID on retry).
      if (!v3Success && legacySuccess && rawRecipientId && rawRecipientId !== 'broadcast') {
        logger.warn(`⚠️ saveMessage: ONLY legacy path succeeded for "${rawRecipientId}" — returning false to trigger retry (V3 conversation needed for delivery)`);
        return false;
      }

      return v3Success || legacySuccess;
    } catch (error) {
      logger.warn('saveMessage V3 failed:', error);
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
    if (!this._isInitialized) return null;
    try {
      return subscribeToMessagesV3(conversationId, callback);
    } catch (error) {
      logger.warn('subscribeToConversationMessages V3 failed:', error);
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
  ): Promise<() => void> {
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

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Seismic detection save timeout')), TIMEOUT_MS),
      );

      await Promise.race([savePromise, timeoutPromise]);
      return true;
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
