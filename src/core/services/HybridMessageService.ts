/**
 * HYBRID MESSAGE SERVICE - ELITE EDITION V4
 * World-class unified messaging layer with guaranteed delivery.
 * 
 * FIXES APPLIED:
 * - M1: Memory leak prevention (proper interval cleanup)
 * - M2: Race condition prevention (mutex for queue operations)
 * - M4: Cryptographically secure message IDs
 * - M5: Queue size limits with eviction
 * - M6: DeliveryManager integration
 * - P1: Proper typing indicator debounce
 * - P2: Debounced queue persistence
 * - P3: LRU cache for seen IDs
 * - P6: Jitter in retry backoff
 * 
 * Features:
 * - Exponential Backoff with Jitter
 * - Priority-based Queue Processing
 * - Typing Indicator Broadcasting
 * - Connection State Events
 * - Delivery Confirmation Callbacks
 * - AppState awareness (background handling)
 */

import { createLogger } from '../utils/logger';
import { connectionManager } from './ConnectionManager';
import { meshNetworkService } from './mesh/MeshNetworkService';
import { MeshMessageType, MeshPriority } from './mesh/MeshProtocol';
import { identityService } from './IdentityService';
import { deliveryManager } from './DeliveryManager';
import { cryptoService } from './CryptoService';
import { validateMessage, sanitizeMessage } from '../utils/messageSanitizer';
import { LRUSet } from '../utils/LRUCache';
import { Mutex, Debouncer, Throttle } from '../utils/Mutex';
import { DirectStorage } from '../utils/storage';
import { useMeshStore, type MeshMessage } from './mesh/MeshStore';
import { AppState, AppStateStatus } from 'react-native';
import { isLikelyFirebaseUid, normalizeIdentityValue } from '../utils/messaging/identityUtils';
import { NON_CHAT_SYSTEM_TYPES, getEnvelopeTypeFromContent } from '../utils/messaging/filters';
import { getDeviceId as getDeviceIdFromLib } from '../../lib/device';
import {
  MAX_QUEUE_SIZE,
  MAX_SEEN_MESSAGE_IDS,
  QUEUE_SAVE_DEBOUNCE_MS,
  RETRY_INITIAL_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  RETRY_MULTIPLIER,
  RETRY_MAX_ATTEMPTS,
  RETRY_JITTER_MIN,
  RETRY_JITTER_MAX,
  TYPING_THROTTLE_MS,
  TYPING_AUTO_CLEAR_MS,
  TYPING_DEBOUNCE_MS,
  CONNECTION_CHECK_INTERVAL_MS,
  QUEUE_PROCESS_INTERVAL_MS,
  PRIORITY_ORDER,
  STORAGE_KEYS,
} from './messaging/constants';

const logger = createLogger('HybridMessageService');

// ELITE: Message priority levels
export type MessagePriority = 'critical' | 'high' | 'normal' | 'low';

// ELITE: Delivery status
export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

// ELITE: Message type
export type MessageType = 'CHAT' | 'SOS' | 'STATUS' | 'LOCATION' | 'TYPING' | 'ACK' | 'REACTION' | 'IMAGE' | 'VOICE';
type CloudMessageType = 'text' | 'sos' | 'location' | 'status' | 'image' | 'voice';
const isNonRoutableRecipientId = (value: string): boolean =>
  value === 'me' || value === 'ME' || value.startsWith('group:');

export interface HybridMessage {
  id: string;
  localId?: string;
  content: string;
  senderId: string;
  senderName: string;
  conversationId?: string;
  recipientId?: string;
  recipientAliases?: string[];
  timestamp: number;
  source: 'CLOUD' | 'MESH' | 'HYBRID';
  location?: { lat: number; lng: number; address?: string };
  status: DeliveryStatus;
  priority: MessagePriority;
  type: MessageType;
  replyTo?: string;
  replyPreview?: string;
  retryCount: number;
  lastRetryAt?: number;
  nextRetryAt?: number;
  isEncrypted?: boolean;
  // ELITE: Media attachments
  mediaUrl?: string;
  mediaType?: 'image' | 'voice' | 'location';
  mediaLocalUri?: string; // Local file URI for re-upload on retry
  mediaDuration?: number; // For voice (seconds)
  mediaThumbnail?: string; // Base64 thumbnail for images
  meshRoutedAt?: number;
}

// ELITE: Callback types
export type DeliveryCallback = (messageId: string, status: DeliveryStatus) => void;
export type TypingCallback = (userId: string, userName: string | undefined, isTyping: boolean) => void;
export type ConnectionCallback = (state: 'online' | 'mesh' | 'offline') => void;

class HybridMessageService {
  // State
  private queue: HybridMessage[] = [];
  private seenMessageIds: LRUSet<string>;  // P3: LRU cache instead of Set
  private isInitialized = false;
  private isProcessing = false;
  private isActive = true; // P8: AppState tracking
  private lastEmittedConnectionState: 'online' | 'mesh' | 'offline' | null = null;

  // M1: Store all interval/timer IDs for cleanup
  private processTimer: NodeJS.Timeout | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;
  private cleanupTimers: Set<NodeJS.Timeout> = new Set();
  private lastMeshPeerCount = 0;
  private physicalDeviceId: string | null = null;
  private cachedUid: string | null = null; // FIX: Cached at init for destroy() scoped key

  // M2: Mutex for queue operations
  private queueMutex = new Mutex();

  // P2: Debounced queue save
  private saveDebouncer: Debouncer;

  // FIX: Separate debouncer for seen IDs to prevent collision
  private seenIdsSaveDebouncer: Debouncer;

  // Callbacks
  private deliveryCallbacks: Map<string, DeliveryCallback[]> = new Map();
  private typingCallbacks: Set<TypingCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();

  // P1: Proper typing state
  private typingThrottle: Throttle;
  private typingDebouncers: Map<string, Debouncer> = new Map();
  private activeTypingUsers: Map<string, NodeJS.Timeout> = new Map();

  // P8: AppState subscription
  private appStateSubscription: { remove: () => void } | null = null;

  // FOREGROUND RE-ENSURE: Reference to active cloud subscription handler
  // Stored so handleAppStateChange can re-invoke it on foreground resume
  private cloudEnsureRefresher: (() => Promise<void>) | null = null;
  private lastInboxSyncAt = 0;

  // CRITICAL FIX: Prevent concurrent initialize() race condition
  private _initPromise: Promise<void> | null = null;

  constructor() {
    this.seenMessageIds = new LRUSet<string>(MAX_SEEN_MESSAGE_IDS);
    this.saveDebouncer = new Debouncer(QUEUE_SAVE_DEBOUNCE_MS);
    this.seenIdsSaveDebouncer = new Debouncer(QUEUE_SAVE_DEBOUNCE_MS);
    this.typingThrottle = new Throttle(TYPING_THROTTLE_MS);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    // CRITICAL FIX: Prevent concurrent initialize() calls from racing
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInitialize();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  private async _doInitialize(): Promise<void> {
    // CRITICAL FIX: Verify identity before registering device or setting up message processing
    const uid = identityService.getUid();
    this.cachedUid = uid || null; // FIX: Cache UID for destroy() scoped key
    if (!uid) {
      logger.warn('⚠️ HybridMessageService: UID not resolved yet');
    } else {
      logger.info(`📨 HybridMessageService initializing with UID: ${uid}`);
    }

    try {
      const physicalId = await getDeviceIdFromLib();
      this.physicalDeviceId = typeof physicalId === 'string' && physicalId.trim().length > 0
        ? physicalId.trim()
        : null;
    } catch (deviceIdError) {
      logger.debug('Physical device ID unavailable during HybridMessageService init', deviceIdError);
    }

    await this.loadQueue();
    await this.loadSeenIds();

    // Initialize delivery manager
    await deliveryManager.initialize();

    // Ensure device identity doc exists in Firestore.
    // NOTE: firebaseDataService.initialize() is NOT called here — init.ts Phase B
    // already initializes it in parallel. If it isn't ready yet, saveDeviceId will
    // gracefully fail and the device ID will be saved on next app launch.
    try {
      const { firebaseDataService } = await import('./FirebaseDataService');
      const myUid = identityService.getUid();
      if (myUid && firebaseDataService.isInitialized) {
        await firebaseDataService.saveDeviceId(myUid);
      }
    } catch (error) {
      logger.warn('Firestore device registration skipped:', error);
    }

    this.isInitialized = true;

    // M1: Schedule queue processing with stored timer reference
    this.scheduleQueueProcessing();
    this.setupConnectionListener();

    // P8: Listen to AppState changes
    this.setupAppStateListener();

    logger.info('🚀 HybridMessageService V4 initialized');

    // ELITE: Start Cloud Hydration (Background)
    // This restores message history from Firestore on app launch, correcting "Amnesia".
    this.syncMessagesWithCloud().catch((err) => {
      logger.warn('Cloud hydration failed, will retry:', err?.message);
      const retryTimer = setTimeout(() => this.syncMessagesWithCloud().catch(e => { if (__DEV__) logger.debug('HybridMsg: cloud sync retry failed:', e); }), 30000);
      this.cleanupTimers.add(retryTimer);
    });
  }

  /**
   * ELITE: Cloud Hydration
   * Fetches the last 20 messages for active conversations from Firestore
   * and silenty imports them into messageStore.
   */
  async syncMessagesWithCloud(): Promise<void> {
    if (!connectionManager.isOnline) {
      logger.debug('Skipping cloud sync: Offline');
      return;
    }

    try {
      const { firebaseDataService } = await import('./FirebaseDataService');
      const { useMessageStore } = await import('../stores/messageStore');

      // Initialize Firebase service if needed
      await firebaseDataService.initialize();

      // 1. Get active conversations — query conversations directly (not inbox)
      // This matches the WhatsApp-style architecture: conversations are the source of truth
      const uid = identityService.getUid?.();
      if (!uid) {
        logger.debug('Cloud sync: No UID available, skipping.');
        return;
      }

      // Try direct conversations query first, fall back to inbox threads
      let threads: Array<{ conversationId: string; conversationType?: string; isGroup?: boolean }> = [];
      try {
        const { collection, query: firestoreQuery, where, getDocs, limit, orderBy } = await import('firebase/firestore');
        const { getFirestoreInstanceAsync } = await import('./firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (db) {
          const q = firestoreQuery(
            collection(db, 'conversations'),
            where('participants', 'array-contains', uid),
            orderBy('lastMessageAt', 'desc'),
            limit(50),
          );
          const snapshot = await getDocs(q);
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const convType = typeof data?.type === 'string' ? data.type : '';
            const isGroupConversation = convType === 'group' || docSnap.id.startsWith('grp_');
            if (isGroupConversation) return;
            threads.push({ conversationId: docSnap.id, conversationType: convType });
          });
        }
      } catch {
        // Fallback to inbox threads if conversations query fails
        const inboxThreads = await firebaseDataService.loadInboxThreads(uid);
        threads = inboxThreads.filter((thread: any) => {
          const convId = typeof thread?.conversationId === 'string' ? thread.conversationId : '';
          const convType = typeof thread?.conversationType === 'string' ? thread.conversationType : '';
          const isGroupConversation =
            convType === 'group'
            || thread?.isGroup === true
            || thread?.isGroup === 'true'
            || convId.startsWith('grp_');
          return !isGroupConversation;
        });
      }

      if (!threads || threads.length === 0) {
        logger.debug('Cloud sync: No conversations found.');
        return;
      }

      logger.info(`Cloud sync: Found ${threads.length} active conversations. Hydrating...`);

      // 2. Fetch last 20 messages for each thread
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messagesToImport: any[] = []; // Using any[] to avoid circular dependency issues

      // Limit parallelism to prevent network flooding
      const chunks = [];
      const CHUNK_SIZE = 3;
      for (let i = 0; i < threads.length; i += CHUNK_SIZE) {
        chunks.push(threads.slice(i, i + CHUNK_SIZE));
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (thread) => {
          try {
            // Fix: loadMessages only accepts conversationId
            const threadMessages = await firebaseDataService.loadMessages(
              thread.conversationId
            );

            // FIX: Reduced from 200 to 50 per conversation for cloud sync.
            // 200 messages x 50 conversations = 10,000 messages loaded into memory at once,
            // causing OOM crashes on older devices. 50 messages per conversation is sufficient
            // for recent context. Full history loads lazily when user opens a conversation.
            const recentMessages = Array.isArray(threadMessages) ? threadMessages.slice(0, 50) : [];

            if (recentMessages && recentMessages.length > 0) {
              const selfIds = this.getSelfIdentityIds();

              recentMessages.forEach(msg => {
                // Convert Firestore data to Store Message format
                // Handle senderUid (V3) or senderId (legacy)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rawMsg = msg as any;
                const senderId = rawMsg.senderUid || rawMsg.senderId || 'unknown';

                const isFromMe = senderId === identityService.getUid?.() || selfIds.has(senderId);
                const receiptState = this.resolveCloudDeliveryState(rawMsg, {
                  isFromMe,
                  selfIds,
                });

                // Map media type safely — check top-level first, then metadata fallback
                const rawMetadata = rawMsg.metadata as Record<string, unknown> | undefined;
                const rawMediaType = rawMsg.mediaType || rawMetadata?.mediaType;
                let mediaType: 'image' | 'voice' | 'location' | undefined;
                if (rawMediaType === 'image') mediaType = 'image';
                else if (rawMediaType === 'voice') mediaType = 'voice';
                else if (rawMediaType === 'location') mediaType = 'location';

                // Use actual UID for from/to fields instead of 'me'/conversationId.
                // ConversationScreen filters messages by checking selfIds.has(msg.from) and
                // peerIdCandidates.has(msg.to). Using 'me' and conversationId breaks this filter.
                const myUid = identityService.getUid?.() || 'me';
                // For sent messages, derive peer from toDeviceId field; for received, peer is sender.
                // V3 messages always have toDeviceId (set during attemptSend). Legacy messages
                // without it fall back to conversation participants discovery.
                let peerUid = isFromMe
                  ? (rawMsg.toDeviceId || rawMsg.recipientId || '')
                  : senderId;
                // If peerUid is empty/broadcast for a sent message, resolve from conversation participants
                if (isFromMe && (!peerUid || peerUid === 'broadcast')) {
                  const convData = rawMsg._conversationParticipants as string[] | undefined;
                  if (convData) {
                    const peer = convData.find((uid: string) => uid !== myUid);
                    if (peer) peerUid = peer;
                  }
                  // FIX: Do NOT fall back to senderId for sent messages — senderId is SELF,
                  // which would make to=self, hiding the message in conversations.
                  // Use conversationId as peerUid so ConversationScreen's TIER 1 filter
                  // (conversationId match) can still display it.
                  if (!peerUid && rawMsg.conversationId) peerUid = rawMsg.conversationId;
                }

                messagesToImport.push({
                  id: msg.id,
                  from: isFromMe ? myUid : senderId,
                  to: isFromMe ? peerUid : myUid,
                  senderId: senderId,
                  senderName: rawMsg.senderName,
                  content: rawMsg.content || '',
                  timestamp: rawMsg.timestamp || Date.now(),
                  type: this.toMeshStoreType(this.mapCloudTypeToHybridType(rawMsg.type, mediaType)),
                  status: receiptState.status,
                  delivered: receiptState.delivered,
                  read: receiptState.read,
                  priority: this.isMessagePriority(rawMsg.priority) ? rawMsg.priority : 'normal',
                  hops: 0,
                  retryCount: 0,
                  acks: [],
                  ttl: 3,
                  mediaUrl: rawMsg.mediaUrl ?? (rawMetadata?.mediaUrl as string | undefined),
                  mediaType: mediaType,
                  mediaDuration: typeof rawMsg.mediaDuration === 'number' ? rawMsg.mediaDuration
                    : typeof rawMetadata?.mediaDuration === 'number' ? rawMetadata.mediaDuration as number
                    : undefined,
                  location: this.normalizeLocationPayload(rawMsg.location),
                  conversationId: thread.conversationId,
                });
              });
            }
          } catch (e: any) {
            logger.warn(`Failed to hydrate thread ${thread.conversationId}:`, e?.message);
            // Let outer catch handle if this is a critical/auth error
            if (e?.code === 'permission-denied' || e?.code === 'unauthenticated') {
              throw e;
            }
          }
        }));
      }

      // 3. Import into store
      if (messagesToImport.length > 0) {
        await useMessageStore.getState().importMessages(messagesToImport);
        logger.info(`✅ Cloud sync complete: Imported ${messagesToImport.length} messages.`);
      }
    } catch (error) {
      logger.error('Critical error during cloud sync:', error);
    }
  }

  /**
   * M1: Proper cleanup - call this to prevent memory leaks
   */
  destroy(): void {
    // Clear main timers
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = null;
    }

    // Clear all stored timers
    this.cleanupTimers.forEach(timer => clearTimeout(timer));
    this.cleanupTimers.clear();

    // Clear typing debouncers
    this.typingDebouncers.forEach(debouncer => debouncer.cancel());
    this.typingDebouncers.clear();

    // Clear typing timers
    this.activeTypingUsers.forEach(timer => clearTimeout(timer));
    this.activeTypingUsers.clear();

    // Cancel save debouncers
    this.saveDebouncer.cancel();
    this.seenIdsSaveDebouncer.cancel();

    // Remove AppState listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // CRITICAL FIX: Clear delivery callbacks to prevent memory leak
    this.deliveryCallbacks.clear();

    // Clear typing and connection callbacks
    this.typingCallbacks.clear();
    this.connectionCallbacks.clear();

    // Force save queue AND seen IDs before shutdown
    this.saveQueueImmediate();
    this.saveSeenIdsImmediate();

    // CRITICAL: Clear in-memory state so re-initialize by a different user
    // doesn't inherit stale data from the previous account
    this.queue = [];
    this.seenMessageIds = new LRUSet<string>(MAX_SEEN_MESSAGE_IDS);
    this.lastMeshPeerCount = 0;
    this.physicalDeviceId = null;
    this.cachedUid = null; // FIX: Clear AFTER save completes above
    this.isProcessing = false; // Reset so queue isn't permanently stuck after re-init
    this.lastEmittedConnectionState = null; // Reset so first connection event after re-init fires
    this.isActive = true; // Reset to default so next init doesn't start with background state

    this.isInitialized = false;
    this._initPromise = null; // CRITICAL FIX: Reset init promise so re-initialize works after destroy
    logger.info('HybridMessageService destroyed');
  }

  // P8: AppState handling
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.isActive = false;
      // Pause processing in background
      if (this.processTimer) {
        clearInterval(this.processTimer);
        this.processTimer = null;
      }
      // Force save queue
      this.saveQueueImmediate();
      logger.debug('HybridMessageService paused (background)');
    } else if (nextAppState === 'active') {
      this.isActive = true;
      // Resume processing
      this.scheduleQueueProcessing();
      // Process queued messages immediately on foreground resume (don't wait 10s)
      if (this.queue.length > 0) {
        this.processQueue();
      }
      // CRITICAL: Re-ensure cloud subscriptions on foreground resume.
      // Firestore listeners may have died during backgrounding (auth token refresh,
      // network interruption). Without this, messages are missed until the next
      // online connection event.
      if (this.cloudEnsureRefresher) {
        this.cloudEnsureRefresher().catch(e => { if (__DEV__) logger.debug('HybridMsg: cloud refresher error:', e); });
      }
      logger.debug('HybridMessageService resumed (foreground)');
    }
  };

  private scheduleQueueProcessing(): void {
    if (this.processTimer) clearInterval(this.processTimer);
    this.processTimer = setInterval(() => {
      if (this.isActive) this.processQueue();
    }, QUEUE_PROCESS_INTERVAL_MS);
  }

  private setupConnectionListener(): void {
    if (this.connectionTimer) clearInterval(this.connectionTimer);
    this.connectionTimer = setInterval(() => {
      if (!this.isActive) return;

      const isOnline = connectionManager.isOnline;
      const meshState = useMeshStore.getState();
      const meshPeerCount = Array.isArray(meshState.peers) ? meshState.peers.length : 0;
      const meshConnected = meshState.isConnected || meshPeerCount > 0;

      let state: 'online' | 'mesh' | 'offline';
      if (isOnline) {
        state = 'online';
      } else if (meshConnected) {
        state = 'mesh';
      } else {
        state = 'offline';
      }

      // CRITICAL FIX: Only emit when state actually changes.
      // Without this guard, every tick re-emits the same state, causing
      // subscribeToMessages → clearCloudSubscriptions + ensureCloudSubscriptions
      // ping-pong that destroys active Firestore onSnapshot listeners.
      if (state !== this.lastEmittedConnectionState) {
        const previousState = this.lastEmittedConnectionState;
        this.lastEmittedConnectionState = state;
        [...this.connectionCallbacks].forEach(cb => cb(state));

        // When transitioning to online, immediately process pending queue
        // so queued messages don't wait for the next 10-second cycle
        if (state === 'online' && previousState !== 'online' && this.queue.length > 0) {
          logger.info(`Connection restored (${previousState} → online), processing ${this.queue.length} queued messages`);
          this.processQueue();
        }
      }

      // Peer discovery nudge: when first peer appears, make queued messages immediately eligible.
      if (this.lastMeshPeerCount === 0 && meshPeerCount > 0 && this.queue.length > 0) {
        const now = Date.now();
        for (const msg of this.queue) {
          if (msg.status === 'pending' || msg.status === 'sending') {
            msg.nextRetryAt = now;
          }
        }
        this.saveQueueDebounced();
        logger.info(`Mesh peer discovered (${meshPeerCount}); triggering immediate queue flush (${this.queue.length} messages)`);
        this.processQueue();
      }
      this.lastMeshPeerCount = meshPeerCount;
    }, CONNECTION_CHECK_INTERVAL_MS);
  }

  /**
   * P6: Calculate retry delay with jitter to prevent thundering herd
   */
  private calculateNextRetryDelay(retryCount: number): number {
    const baseDelay = RETRY_INITIAL_DELAY_MS * Math.pow(RETRY_MULTIPLIER, retryCount);
    const cappedDelay = Math.min(baseDelay, RETRY_MAX_DELAY_MS);

    // Add random jitter (0.5x to 1.5x)
    const jitter = RETRY_JITTER_MIN + Math.random() * (RETRY_JITTER_MAX - RETRY_JITTER_MIN);
    return Math.floor(cappedDelay * jitter);
  }

  /**
   * M4: Generate cryptographically secure message ID
   */
  private async generateId(): Promise<string> {
    try {
      return cryptoService.generateUUID();
    } catch {
      // Fallback if crypto not ready
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 9);
      return `${timestamp}-${randomPart}`;
    }
  }

  /**
   * P3: Check duplicate using LRU cache
   */
  isDuplicate(messageId: string): boolean {
    return this.seenMessageIds.has(messageId);
  }

  /**
   * P3: Record seen message ID using LRU
   */
  recordSeenMessage(messageId: string): boolean {
    const isNew = this.seenMessageIds.checkAndAdd(messageId);
    if (isNew) {
      this.saveSeenIdsDebounced();
    }
    return isNew;
  }

  private mapHybridTypeToCloudType(type: MessageType): CloudMessageType {
    switch (type) {
      case 'SOS':
        return 'sos';
      case 'LOCATION':
        return 'location';
      case 'STATUS':
        return 'status';
      case 'IMAGE':
        return 'image';
      case 'VOICE':
        return 'voice';
      default:
        return 'text';
    }
  }

  private mapCloudTypeToHybridType(
    cloudType?: string,
    mediaType?: HybridMessage['mediaType'],
    hasLocation: boolean = false,
  ): MessageType {
    switch (cloudType) {
      case 'sos':
        return 'SOS';
      case 'location':
        return 'LOCATION';
      case 'status':
        return 'STATUS';
      case 'image':
        return 'IMAGE';
      case 'voice':
        return 'VOICE';
      default:
        if (mediaType === 'image') return 'IMAGE';
        if (mediaType === 'voice') return 'VOICE';
        if (mediaType === 'location' || hasLocation) return 'LOCATION';
        return 'CHAT';
    }
  }

  /** Delegates to shared getEnvelopeTypeFromContent from messaging/filters */
  private getEnvelopeTypeFromContent(content: string): string {
    return getEnvelopeTypeFromContent(content);
  }

  private deriveMessageTypeFromContent(
    fallbackType: MeshMessage['type'],
    content: string,
  ): MessageType {
    if (fallbackType === 'STATUS') return 'STATUS';
    if (fallbackType === 'LOCATION') return 'LOCATION';

    const envelopeType = this.getEnvelopeTypeFromContent(content);
    if (!envelopeType) {
      return this.toHybridTypeFromMesh(fallbackType);
    }
    if (envelopeType === 'family_status_update' || envelopeType === 'status_update') {
      return 'STATUS';
    }
    if (envelopeType === 'family_location_update' || envelopeType === 'family_location') {
      return 'LOCATION';
    }
    return this.toHybridTypeFromMesh(fallbackType);
  }

  private isSystemPayloadForConversation(message: Pick<HybridMessage, 'type' | 'content'>): boolean {
    if (message.type === 'STATUS' || message.type === 'TYPING' || message.type === 'ACK' || message.type === 'REACTION') {
      return true;
    }

    const envelopeType = this.getEnvelopeTypeFromContent(message.content);
    if (!envelopeType) {
      return false;
    }
    return NON_CHAT_SYSTEM_TYPES.has(envelopeType);
  }

  private normalizeLocationPayload(raw: unknown): HybridMessage['location'] | undefined {
    if (!raw || typeof raw !== 'object') {
      return undefined;
    }

    const location = raw as Record<string, unknown>;
    const lat = typeof location.lat === 'number'
      ? location.lat
      : typeof location.latitude === 'number'
        ? location.latitude
        : null;
    const lng = typeof location.lng === 'number'
      ? location.lng
      : typeof location.longitude === 'number'
        ? location.longitude
        : null;

    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return undefined;
    }

    const normalized: HybridMessage['location'] = { lat, lng };
    if (typeof location.address === 'string' && location.address.trim().length > 0) {
      normalized.address = location.address.trim();
    }
    return normalized;
  }

  private normalizeMediaType(raw: unknown): HybridMessage['mediaType'] | undefined {
    if (raw === 'image' || raw === 'voice' || raw === 'location') {
      return raw;
    }
    if (typeof raw !== 'string') {
      return undefined;
    }
    const normalized = raw.toLowerCase();
    if (normalized === 'image' || normalized === 'voice' || normalized === 'location') {
      return normalized;
    }
    return undefined;
  }

  private isMessagePriority(value: unknown): value is MessagePriority {
    return value === 'critical' || value === 'high' || value === 'normal' || value === 'low';
  }

  private isDeliveryStatus(value: unknown): value is DeliveryStatus {
    return value === 'pending'
      || value === 'sending'
      || value === 'sent'
      || value === 'delivered'
      || value === 'read'
      || value === 'failed';
  }

  private extractReceiptActorIds(value: unknown): string[] {
    if (!value) return [];
    if (typeof value === 'string') {
      const normalized = this.normalizeIdentity(value);
      return normalized ? [normalized] : [];
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => this.normalizeIdentity(typeof item === 'string' ? item : ''))
        .filter((item) => item.length > 0);
    }
    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .map((key) => this.normalizeIdentity(key))
        .filter((key) => key.length > 0);
    }
    return [];
  }

  private resolveCloudDeliveryState(
    rawMessage: Record<string, unknown>,
    options: {
      isFromMe: boolean;
      selfIds: Set<string>;
    },
  ): {
    status: DeliveryStatus;
    delivered: boolean;
    read: boolean;
  } {
    const rawStatus = this.isDeliveryStatus(rawMessage.status)
      ? rawMessage.status
      : 'sent';
    const readByIds = this.extractReceiptActorIds(rawMessage.readBy);
    const deliveredToIds = this.extractReceiptActorIds(rawMessage.deliveredTo);
    const hasSelfRead = readByIds.some((id) => options.selfIds.has(id));
    const hasPeerRead = readByIds.some((id) => !options.selfIds.has(id));
    const hasSelfDelivered = deliveredToIds.some((id) => options.selfIds.has(id));
    const hasPeerDelivered = deliveredToIds.some((id) => !options.selfIds.has(id));

    const read = rawStatus === 'read'
      || rawMessage.read === true
      || (options.isFromMe ? hasPeerRead : hasSelfRead);

    const delivered = read
      || rawStatus === 'delivered'
      || rawMessage.delivered === true
      || (options.isFromMe ? hasPeerDelivered : hasSelfDelivered)
      || !options.isFromMe;

    let status: DeliveryStatus = rawStatus;
    if (read) {
      status = 'read';
    } else if (delivered) {
      status = 'delivered';
    } else if (!options.isFromMe && (rawStatus === 'pending' || rawStatus === 'sending' || rawStatus === 'sent')) {
      status = 'delivered';
    }

    return { status, delivered, read };
  }

  private getSelfIdentityIds(): Set<string> {
    const ids = new Set<string>(['ME', 'me']);
    const uid = identityService.getUid();
    if (uid) {
      ids.add(uid);
    }

    const identity = identityService.getIdentity() as (ReturnType<typeof identityService.getIdentity> & {
      id?: string;
      deviceId?: string;
      qrId?: string;
      publicUserCode?: string;
    }) | null;
    if (identity?.id) {
      ids.add(identity.id);
    }
    if (identity?.deviceId) {
      ids.add(identity.deviceId);
    }
    if (identity?.uid) {
      ids.add(identity.uid);
    }
    if (identity?.publicUserCode) {
      ids.add(identity.publicUserCode);
    }
    if (identity?.qrId) {
      ids.add(identity.qrId);
    }

    const myId = identityService.getMyId?.();
    if (myId) {
      ids.add(myId);
    }

    if (this.physicalDeviceId) {
      ids.add(this.physicalDeviceId);
    }
    return ids;
  }

  private resolveRecipientId(recipientId?: string): string | undefined {
    if (!recipientId) return undefined;
    const trimmed = recipientId.trim();
    if (!trimmed || trimmed === 'broadcast') return 'broadcast';
    if (isNonRoutableRecipientId(trimmed)) return undefined;
    if (isLikelyFirebaseUid(trimmed)) return trimmed;
    return undefined; // Only UIDs are routable in v4
  }

  private buildMeshRecipientAliases(
    requestedRecipientId?: string,
    resolvedRecipientId?: string,
    extraAliases?: string[],
  ): string[] | undefined {
    const aliases = new Set<string>();

    const tryAdd = (value?: string) => {
      if (!value) return;
      const trimmed = value.trim();
      if (!trimmed || trimmed === 'broadcast') return;
      if (isNonRoutableRecipientId(trimmed)) return;
      aliases.add(trimmed);
    };

    tryAdd(requestedRecipientId);
    tryAdd(resolvedRecipientId);
    if (Array.isArray(extraAliases)) {
      extraAliases.forEach((alias) => tryAdd(alias));
    }

    return aliases.size > 0 ? Array.from(aliases) : undefined;
  }

  private isDirectedRecipient(recipientId?: string): boolean {
    return !!(
      typeof recipientId === 'string'
      && recipientId.trim().length > 0
      && recipientId !== 'broadcast'
    );
  }

  private isUidRecipient(recipientId?: string): boolean {
    return !!(
      this.isDirectedRecipient(recipientId)
      && isLikelyFirebaseUid(recipientId as string)
    );
  }

  private normalizeMeshPeerId(value?: string | null): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private getDirectedRecipientTargets(
    message: Pick<HybridMessage, 'recipientId' | 'recipientAliases'>,
  ): Set<string> {
    const targets = new Set<string>();
    const tryAdd = (value?: string | null) => {
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (!trimmed || trimmed === 'broadcast' || isNonRoutableRecipientId(trimmed)) {
        return;
      }
      const normalized = this.normalizeMeshPeerId(trimmed);
      if (normalized) {
        targets.add(normalized);
      }
    };

    tryAdd(message.recipientId);
    if (Array.isArray(message.recipientAliases)) {
      message.recipientAliases.forEach((alias) => tryAdd(alias));
    }

    return targets;
  }

  private hasVisibleMeshPeerForRecipient(
    message: Pick<HybridMessage, 'recipientId' | 'recipientAliases'>,
  ): boolean {
    const targets = this.getDirectedRecipientTargets(message);
    if (targets.size === 0) {
      return false;
    }

    const peers = useMeshStore.getState().peers;
    if (!Array.isArray(peers) || peers.length === 0) {
      return false;
    }

    return peers.some((peer) => targets.has(this.normalizeMeshPeerId(peer?.id)));
  }

  private canTreatMeshSendAsDelivery(
    message: Pick<HybridMessage, 'recipientId' | 'recipientAliases'>,
  ): boolean {
    // Broadcast/system messages can be considered sent once handed to mesh transport.
    if (!this.isDirectedRecipient(message.recipientId)) {
      return true;
    }
    // Direct messages are only trusted when the intended peer (or one of its aliases)
    // is actually visible in the current mesh peer table. Treating "any peer" as
    // successful delivery caused false positives and dropped offline retries.
    return this.hasVisibleMeshPeerForRecipient(message);
  }

  private shouldKeepRetryingAfterMaxAttempts(
    message: Pick<HybridMessage, 'type' | 'recipientId' | 'recipientAliases' | 'meshRoutedAt'>,
    isOnline: boolean,
  ): boolean {
    if (message.type === 'SOS') {
      return true;
    }

    if (message.meshRoutedAt && this.isUidRecipient(message.recipientId)) {
      return true;
    }

    // Life-safety/offline-first behavior:
    // direct offline messages must stay queued until the recipient becomes reachable
    // or cloud sync returns. Hard-failing here makes offline chat appear broken.
    if (!isOnline && this.getDirectedRecipientTargets(message).size > 0) {
      return true;
    }

    return false;
  }

  private async resolveRecipientIdForSend(recipientId?: string): Promise<string | undefined> {
    if (!recipientId) return undefined;
    const trimmed = recipientId.trim();
    if (!trimmed) return undefined;

    const resolved = this.resolveRecipientId(recipientId);
    logger.info(`🔍 resolveRecipientIdForSend: input="${recipientId}", after resolveRecipientId="${resolved}"`);

    // Already a valid UID — return directly (with self-UID alias detection)
    if (resolved && isLikelyFirebaseUid(resolved)) {
      // If alias resolution collapsed to current user's UID, preserve the original
      // non-UID recipient alias for mesh routing (multi-device/same-account safety).
      if (recipientId) {
        const rawRecipient = recipientId.trim();
        const selfIds = this.getSelfIdentityIds();
        if (
          rawRecipient &&
          !isLikelyFirebaseUid(rawRecipient) &&
          !isNonRoutableRecipientId(rawRecipient) &&
          selfIds.has(resolved)
        ) {
          logger.info(`🔍 resolveRecipientIdForSend: resolved to self UID, preserving raw alias "${rawRecipient}"`);
          return rawRecipient;
        }
      }
      return resolved;
    }

    // Broadcast — return as-is
    if (resolved === 'broadcast') return 'broadcast';

    // Non-routable (me, group:*) — no point in Firestore lookup
    if (isNonRoutableRecipientId(trimmed)) return undefined;

    // CANONICAL: For non-UID inputs (AFN codes, device IDs, etc.),
    // attempt Firestore resolution to Firebase Auth UID.
    // If resolution fails, return undefined — NOT the raw alias.
    // A raw non-UID alias in recipientId causes Firestore writes to non-UID paths
    // that no receiver subscribes to, creating orphan documents.
    try {
      const { firebaseDataService } = await import('./FirebaseDataService');
      try {
        await firebaseDataService.initialize();
      } catch {
        // best effort
      }
      const resolvedUid = await firebaseDataService.resolveRecipientUid(trimmed);
      if (resolvedUid && isLikelyFirebaseUid(resolvedUid)) {
        logger.info(`🔍 resolveRecipientIdForSend: Firestore resolved "${trimmed}" → UID ${resolvedUid}`);
        return resolvedUid;
      }
      logger.warn(`⚠️ resolveRecipientIdForSend: Firestore could NOT resolve "${trimmed}" to UID — returning undefined (caller will show error to user)`);
    } catch (error) {
      logger.warn(`resolveRecipientIdForSend Firestore lookup failed for "${trimmed}" — returning undefined`, error);
    }

    // CANONICAL: Do NOT return raw non-UID alias for cloud write paths.
    // sendMessage() checks for undefined and throws a user-visible error.
    // Mesh routing still works via recipientAliases (built separately).
    return undefined;
  }

  /** Delegates to shared normalizeIdentityValue from messaging/identityUtils */
  private normalizeIdentity(value: string | null | undefined): string {
    return normalizeIdentityValue(value);
  }


  private getIdentityAliasCandidates(value: string | null | undefined): Set<string> {
    const aliases = new Set<string>();
    const normalized = this.normalizeIdentity(value);
    if (!normalized) return aliases;
    aliases.add(normalized);
    return aliases;
  }

  private isBlockedSender(senderId: string | null | undefined): boolean {
    const normalizedSender = this.normalizeIdentity(senderId);
    if (!normalizedSender) return false;

    try {
      const { blockedUsers } = require('../stores/settingsStore').useSettingsStore.getState();
      if (!Array.isArray(blockedUsers) || blockedUsers.length === 0) {
        return false;
      }

      const senderAliases = this.getIdentityAliasCandidates(normalizedSender);
      if (senderAliases.size === 0) {
        return blockedUsers.includes(normalizedSender);
      }

      for (const blockedUserId of blockedUsers) {
        const blockedAliases = this.getIdentityAliasCandidates(blockedUserId);
        if (blockedAliases.size === 0) {
          if (senderAliases.has(this.normalizeIdentity(blockedUserId))) {
            return true;
          }
          continue;
        }

        for (const alias of senderAliases) {
          if (blockedAliases.has(alias)) {
            return true;
          }
        }
      }
    } catch {
      // best effort
    }

    return false;
  }

  private toMeshStoreType(type: MessageType): MeshMessage['type'] {
    switch (type) {
      case 'SOS':
        return 'SOS';
      case 'STATUS':
        return 'STATUS';
      case 'LOCATION':
        return 'LOCATION';
      case 'TYPING':
        return 'TYPING';
      case 'ACK':
        return 'ACK';
      case 'REACTION':
        return 'REACTION';
      case 'IMAGE':
        return 'IMAGE';
      case 'VOICE':
        return 'VOICE';
      default:
        return 'CHAT';
    }
  }

  private toHybridTypeFromMesh(type: MeshMessage['type']): MessageType {
    switch (type) {
      case 'SOS':
        return 'SOS';
      case 'STATUS':
        return 'STATUS';
      case 'LOCATION':
        return 'LOCATION';
      case 'TYPING':
        return 'TYPING';
      case 'ACK':
        return 'ACK';
      case 'REACTION':
        return 'REACTION';
      case 'IMAGE':
        return 'IMAGE';
      case 'VOICE':
        return 'VOICE';
      default:
        return 'CHAT';
    }
  }

  private pushCloudMessageToMeshStore(message: HybridMessage, conversationId?: string): void {
    if (this.isSystemPayloadForConversation(message)) {
      if (__DEV__) {
        logger.debug('Skipping system payload bridge push', {
          id: message.id,
          type: message.type,
        });
      }
      return;
    }

    const meshMessage: MeshMessage = {
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      to: message.recipientId || 'broadcast',
      type: this.toMeshStoreType(message.type),
      content: message.content,
      timestamp: message.timestamp,
      ttl: 3,
      priority: message.priority,
      status: message.status === 'pending' ? 'sending' : message.status,
      acks: [],
      retryCount: message.retryCount,
      hops: 0,
      ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
      ...(message.mediaType ? { mediaType: message.mediaType } : {}),
      ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
      ...(message.mediaThumbnail ? { mediaThumbnail: message.mediaThumbnail } : {}),
      ...(message.location ? { location: message.location } : {}),
    };

    useMeshStore.getState().addMessage(meshMessage);

    // ELITE V2: Also push to messageStore as SINGLE SOURCE OF TRUTH
    // This ensures ConversationScreen (which reads from messageStore) can see sent messages
    try {
      const { useMessageStore } = require('../stores/messageStore');
      const selfIds = this.getSelfIdentityIds();
      const canonicalSelfId = identityService.getUid() || 'me';

      // CRITICAL FIX: Determine if this message is from us or from another user.
      // Previously, `from` was always set to 'me', which made incoming messages
      // appear as outgoing — corrupting the conversation index and hiding them.
      const isFromMe = selfIds.has(message.senderId);
      const normalizedStatus: DeliveryStatus = isFromMe
        ? (message.status === 'pending' ? 'sending' : (message.status || 'sent'))
        : (message.status === 'read' ? 'read' : 'delivered');
      const delivered = isFromMe
        ? (normalizedStatus === 'delivered' || normalizedStatus === 'read')
        : true;
      const read = normalizedStatus === 'read';

      const fromField = isFromMe ? 'me' : message.senderId;
      const toField = isFromMe
        ? (message.recipientId || 'broadcast')
        : canonicalSelfId;

      useMessageStore.getState().addMessage({
        id: message.id,
        localId: message.localId,
        from: fromField,
        fromName: message.senderName,
        to: toField,
        content: message.content,
        timestamp: message.timestamp,
        delivered,
        read,
        type: message.type as 'CHAT' | 'SOS' | 'STATUS' | 'LOCATION' | 'VOICE',
        priority: message.priority,
        status: normalizedStatus,
        replyTo: message.replyTo,
        replyPreview: message.replyPreview,
        // CRITICAL FIX: Pass media fields to messageStore
        // Without these, ConversationScreen can't display media content
        // for messages that come from messageStore (cloud path)
        ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
        ...(message.mediaType ? { mediaType: message.mediaType } : {}),
        ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
        ...(message.mediaThumbnail ? { mediaThumbnail: message.mediaThumbnail } : {}),
        ...(message.location ? { location: message.location } : {}),
        ...(conversationId ? { conversationId } : {}),
      });

      // CRITICAL FIX: Send Delivery Receipt (Double-tick) back to Sender
      // Previously, incoming messages were added to the store but Firebase wasn't informed
      // that they were delivered, leaving the sender with a single tick forever.
      if (!isFromMe) {
        useMessageStore.getState().markAsDelivered(message.id).catch((err: any) => {
          logger.debug('Failed to auto-mark message as delivered', err);
        });
      }

      // CRITICAL FIX: Auto-create and update conversation previews for BOTH incoming and outgoing messages.
      // Previously, outgoing messages never updated the conversation list preview because it was
      // guarded by `if (!isFromMe)`.
      const conversationTargetId = isFromMe ? message.recipientId : message.senderId;
      const isUUIDv4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(conversationTargetId || '');

      const targetIdValid = conversationTargetId
        && conversationTargetId !== 'unknown'
        && conversationTargetId !== 'broadcast'
        && !conversationTargetId.startsWith('group:')
        && !conversationTargetId.startsWith('grp_')
        && !conversationTargetId.startsWith('family-')
        && !conversationTargetId.startsWith('device-')
        && (
          /^[A-Za-z0-9]{20,40}$/.test(conversationTargetId) ||
          /^\+[1-9]\d{5,14}$/.test(conversationTargetId) ||
          (conversationTargetId.length >= 20 && /^[A-Za-z0-9\-_.]+$/.test(conversationTargetId) && !isUUIDv4)
        );

      if (targetIdValid) {
        const conversations = useMessageStore.getState().conversations;
        const existingConv = conversations.find((c: { userId: string }) => c.userId === conversationTargetId);

        if (!existingConv) {
          // Look up contact display name before falling back to generic name
          let displayName = !isFromMe ? (message.senderName || '') : '';
          if (!displayName) {
            try {
              const { contactService } = require('./ContactService');
              const contact = contactService.getContact?.(conversationTargetId);
              displayName = contact?.displayName || contact?.nickname || '';
            } catch {
              // ContactService not available
            }
          }
          if (!conversationTargetId) return;
          useMessageStore.getState().addConversation({
            userId: conversationTargetId,
            userName: displayName || `Cihaz ${conversationTargetId.slice(0, 8)}...`,
            lastMessage: (message.content || 'Yeni Medya/Konum').substring(0, 100),
            lastMessageTime: message.timestamp,
            unreadCount: isFromMe ? 0 : 1,
            ...(conversationId ? { conversationId } : {}),
          });
        } else {
          // CRITICAL FIX: Always update the conversation preview for BOTH incoming and outgoing messages!
          useMessageStore.getState().addConversation({
            ...existingConv,
            conversationId: conversationId || existingConv.conversationId,
            lastMessage: (message.content || 'Yeni Medya/Konum').substring(0, 100),
            lastMessageTime: Math.max(existingConv.lastMessageTime || 0, message.timestamp),
            // NOTE: Do NOT increment unreadCount client-side — CF onNewConversationMessageV3
            // already increments it server-side. Client increment + CF increment = double count.
            // The inbox onSnapshot will bring the authoritative count from Firestore.
            unreadCount: existingConv.unreadCount || 0,
          });
        }

        // Local notification for INCOMING messages when app is NOT in active foreground.
        // CRITICAL FIX: Previously gated on `!connectionManager.isOnline`, which meant
        // when the device is online but the app is backgrounded, NO local notification
        // fired. The code relied 100% on CF push (onNewConversationMessageV3), but CF
        // push can fail silently (token not registered, Expo API down, rate limited, etc.)
        // leaving the user with ZERO notification.
        //
        // Now: Fire local notification when app is backgrounded/inactive, regardless of
        // online status. When the app is in the foreground, the OS banner from the CF push
        // handles display (via setNotificationHandler with shouldShowAlert: true).
        // Duplicate prevention: expo-notifications deduplicates by notification identifier,
        // and NotificationCenter's conversation-level suppression handles foreground dedup.
        if (!isFromMe && AppState.currentState !== 'active') {
          try {
            const { notificationCenter } = require('./notifications/NotificationCenter');
            notificationCenter.notify('message', {
              messageId: message.id,
              userId: message.senderId,
              senderUid: message.senderId,
              senderName: existingConv?.userName || message.senderName || `Cihaz ${message.senderId.slice(0, 8)}...`,
              message: message.content || 'Yeni Medya/Konum',
              conversationId: conversationId || existingConv?.conversationId,
              timestamp: message.timestamp
            }).catch((err: any) => logger.debug('Local notify failed:', err));
          } catch (err) {
            logger.debug('Failed to trigger local notification', err);
          }
        }
      }
    } catch (error) {
      // messageStore push is best-effort — MeshStore is still the backup display
      logger.warn('Failed to push message to messageStore:', error);
    }
  }

  /**
   * Send a message with guaranteed delivery
   */
  async sendMessage(
    content: string,
    recipientId?: string,
    options: {
      priority?: MessagePriority;
      type?: MessageType;
      conversationId?: string;
      replyTo?: string;
      replyPreview?: string;
      location?: { lat: number; lng: number; address?: string };
      recipientAliases?: string[];
    } = {}
  ): Promise<HybridMessage> {
    if (!this.isInitialized) await this.initialize();

    // CRITICAL FIX: Gracefully handle identity not yet loaded (race condition).
    // Previously threw immediately → crash. Now retry identity init first.
    let myIdentity = identityService.getIdentity();
    if (!myIdentity?.uid) {
      logger.warn('⚠️ Identity not ready in sendMessage, attempting re-init...');
      try {
        await identityService.initialize();
        myIdentity = identityService.getIdentity();
      } catch (initError) {
        logger.error('Identity re-init failed:', initError);
      }
    }
    if (!myIdentity?.uid) {
      throw new Error('Kimlik bilgisi yüklenemedi. Lütfen yeniden giriş yapın.');
    }

    // C4: Validate and sanitize message
    const validation = validateMessage(content);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid message content');
    }

    const messageId = await this.generateId();
    const localId = await this.generateId();

    // CRITICAL FIX: Use myIdentity.uid directly (already validated above) instead of
    // re-calling getUid() which could theoretically return null in a race condition
    const senderUid = myIdentity.uid;
    const requestedRecipientId = typeof recipientId === 'string' ? recipientId.trim() : '';
    const resolvedRecipientId = await this.resolveRecipientIdForSend(recipientId);
    if (
      requestedRecipientId &&
      requestedRecipientId !== 'broadcast' &&
      !resolvedRecipientId
    ) {
      throw new Error('Alıcı kimliği çözümlenemedi. Lütfen kişiyi tekrar ekleyin.');
    }
    const recipientAliases = this.buildMeshRecipientAliases(
      requestedRecipientId,
      resolvedRecipientId,
      options.recipientAliases,
    );

    const message: HybridMessage = {
      id: messageId,
      localId,
      content: validation.sanitized,
      senderId: senderUid,
      senderName: myIdentity.displayName,
      conversationId: typeof options.conversationId === 'string' && options.conversationId.trim().length > 0
        ? options.conversationId.trim()
        : undefined,
      recipientId: resolvedRecipientId,
      recipientAliases,
      timestamp: Date.now(),
      source: 'HYBRID',
      status: 'pending',
      priority: options.priority || 'normal',
      type: options.type || 'CHAT',
      replyTo: options.replyTo,
      replyPreview: options.replyPreview ? sanitizeMessage(options.replyPreview) : undefined,
      location: options.location,
      retryCount: 0,
    };

    // M2: Use mutex for queue operations
    await this.queueMutex.withLock(async () => {
      // M5: Check queue size limit
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        // Remove oldest low-priority messages
        const removed = this.evictOldMessages(1);
        if (removed === 0) {
          throw new Error('Message queue full');
        }
      }

      this.queue.push(message);
      // Save immediately for new messages to prevent loss on crash
      await this.saveQueueImmediate();
    });

    // M6: Track with DeliveryManager
    if (resolvedRecipientId && resolvedRecipientId !== 'broadcast') {
      deliveryManager.trackMessage(messageId, resolvedRecipientId);
    }

    // CRITICAL FIX: Register message as "seen" BEFORE cloud write.
    // Without this, the Firestore subscription callback calls recordSeenMessage(msg.id),
    // sees it as "new" (returns true), and reprocesses it → duplicate in messageStore.
    // By recording here first, the subscription callback's recordSeenMessage returns false → skip.
    this.recordSeenMessage(messageId);

    // CRITICAL FIX: Push sent message to MeshStore immediately for UI display.
    // Without this, the sender never sees their own message in ConversationScreen
    // (which reads from useMeshStore.messages).
    this.pushCloudMessageToMeshStore(message, message.conversationId);

    // Attempt immediate send (fire-and-forget but catch unhandled rejection)
    this.processMessageImmediate(message).catch(e => {
      logger.error('processMessageImmediate failed for text message:', e);
    });

    return message;
  }

  /**
   * ELITE: Send a media message (image, voice, location)
   */
  async sendMediaMessage(
    mediaType: 'image' | 'voice' | 'location',
    recipientId: string,
    options: {
      mediaUrl?: string; // Firebase Storage URL
      mediaLocalUri?: string; // Local file URI for upload
      mediaDuration?: number; // For voice messages
      mediaThumbnail?: string; // Base64 thumbnail
      location?: { lat: number; lng: number; address?: string };
      caption?: string;
      conversationId?: string;
      recipientAliases?: string[];
    }
  ): Promise<HybridMessage> {
    if (!this.isInitialized) await this.initialize();

    // CRITICAL FIX: Same graceful identity handling as sendMessage
    let myIdentity = identityService.getIdentity();
    if (!myIdentity?.uid) {
      logger.warn('⚠️ Identity not ready in sendMediaMessage, attempting re-init...');
      try {
        await identityService.initialize();
        myIdentity = identityService.getIdentity();
      } catch (initError) {
        logger.error('Identity re-init failed:', initError);
      }
    }
    if (!myIdentity?.uid) {
      throw new Error('Kimlik bilgisi yüklenemedi. Lütfen yeniden giriş yapın.');
    }

    const messageId = await this.generateId();
    const localId = await this.generateId();
    const timestamp = Date.now();
    const messageType = mediaType === 'image' ? 'IMAGE' : mediaType === 'voice' ? 'VOICE' : 'LOCATION';
    const requestedRecipientId = typeof recipientId === 'string' ? recipientId.trim() : '';
    const resolvedRecipientId = await this.resolveRecipientIdForSend(recipientId);
    if (
      requestedRecipientId &&
      requestedRecipientId !== 'broadcast' &&
      !resolvedRecipientId
    ) {
      throw new Error('Alıcı kimliği çözümlenemedi. Lütfen kişiyi tekrar ekleyin.');
    }
    const recipientAliases = this.buildMeshRecipientAliases(
      requestedRecipientId,
      resolvedRecipientId,
      options.recipientAliases,
    );

    let mediaUrl = options.mediaUrl;
    let meshBinaryFallbackStarted = false;
    let mediaUploadHardFailure: string | null = null;

    // Upload to Firebase Storage if local URI provided
    if (options.mediaLocalUri && !mediaUrl) {
      try {
        const { firebaseStorageService } = await import('./FirebaseStorageService');
        // CRITICAL FIX: Initialize storage service before upload.
        // Without this, uploadFile() returns null because _isInitialized is false,
        // causing ALL image/voice messages to be sent without media URL.
        await firebaseStorageService.initialize();
        const extension = mediaType === 'image' ? 'jpg' : 'm4a';
        const storageOwnerId = myIdentity.uid;
        if (!storageOwnerId) {
          logger.warn('Skipping media upload: UID unavailable');
          throw new Error('uid-unavailable');
        }
        const storagePath = `chat/${storageOwnerId}/${Date.now()}.${extension}`;

        const FileSystem = await import('expo-file-system');

        // PERFORMANCE FIX: Compress images before upload to reduce bandwidth & memory.
        // This avoids base64 + Buffer duplication that can crash on large photos.
        let uploadUri = options.mediaLocalUri;
        if (mediaType === 'image') {
          const originalInfo = await FileSystem.getInfoAsync(options.mediaLocalUri);
          if (!originalInfo.exists) {
            mediaUploadHardFailure = 'Seçilen fotoğraf dosyası bulunamadı.';
            throw new Error('image-file-missing');
          }

          try {
            const ImageManipulator = await import('expo-image-manipulator');
            const compressed = await ImageManipulator.manipulateAsync(
              options.mediaLocalUri,
              [{ resize: { width: 1280 } }], // Max 1280px width (preserves aspect ratio)
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            uploadUri = compressed.uri;

            const compressedInfo = await FileSystem.getInfoAsync(uploadUri);
            if (compressedInfo.exists && typeof compressedInfo.size === 'number' && compressedInfo.size > 5 * 1024 * 1024) {
              // Re-compress from ORIGINAL to avoid cascading quality degradation
              const tighter = await ImageManipulator.manipulateAsync(
                options.mediaLocalUri,
                [{ resize: { width: 960 } }],
                { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG }
              );
              uploadUri = tighter.uri;
            }
          } catch {
            // expo-image-manipulator not available — upload original
            logger.debug('Image compression skipped (manipulator unavailable)');
          }

          const finalInfo = await FileSystem.getInfoAsync(uploadUri);
          if (finalInfo.exists && typeof finalInfo.size === 'number' && finalInfo.size > 15 * 1024 * 1024) {
            mediaUploadHardFailure = 'Fotoğraf çok büyük. Lütfen daha küçük bir fotoğraf seçin.';
            throw new Error('image-too-large');
          }
        }

        const uploadResult = await firebaseStorageService.uploadFileFromUri(storagePath, uploadUri, {
          contentType: mediaType === 'image' ? 'image/jpeg' : 'audio/mp4',
          customMetadata: {
            userId: storageOwnerId,
          },
        });
        if (uploadResult) {
          mediaUrl = uploadResult;
        } else {
          logger.error(`🚨 Media upload returned null for ${messageId} — storage may not be initialized or upload failed silently`);
        }
      } catch (error) {
        logger.error('Media upload failed:', error);
        // Continue without URL - binary mesh fallback below can still deliver media.
      }
    }

    if (mediaUploadHardFailure) {
      throw new Error(mediaUploadHardFailure);
    }

    // Offline-proof fallback: if cloud media URL is unavailable, push raw media over mesh chunks.
    // Transfer ID is pinned to messageId so receiver can merge/update the same chat bubble.
    if ((mediaType === 'image' || mediaType === 'voice') && options.mediaLocalUri && !mediaUrl) {
      try {
        const { meshMediaService } = await import('./mesh/MeshMediaService');
        await meshMediaService.initialize();

        if (mediaType === 'image') {
          await meshMediaService.sendImage(resolvedRecipientId || 'broadcast', options.mediaLocalUri, {
            transferId: messageId,
            caption: options.caption,
            timestamp,
            senderName: myIdentity.displayName,
            senderId: myIdentity.uid || identityService.getUid() || 'unknown',
          });
        } else {
          await meshMediaService.sendVoice(
            resolvedRecipientId || 'broadcast',
            options.mediaLocalUri,
            typeof options.mediaDuration === 'number' ? options.mediaDuration : 0,
            {
              transferId: messageId,
              timestamp,
              senderName: myIdentity.displayName,
              senderId: myIdentity.uid || identityService.getUid() || 'unknown',
            },
          );
        }
        meshBinaryFallbackStarted = true;
      } catch (meshFallbackError) {
        logger.warn('Binary mesh media fallback failed:', meshFallbackError);
      }
    }

    // CRITICAL FIX: If both cloud upload AND mesh fallback failed, throw error instead of
    // sending an empty media message. Without this, recipient gets "📷 Fotoğraf" text with
    // no actual image — misleading and wastes their time.
    if (!mediaUrl && !meshBinaryFallbackStarted && options.mediaLocalUri) {
      logger.error(`🚨 CRITICAL: Media for message ${messageId} has NO cloud URL and NO mesh fallback — aborting send`);
      throw new Error(
        mediaType === 'image'
          ? 'Fotoğraf yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'
          : mediaType === 'voice'
            ? 'Ses mesajı yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'
            : 'Medya yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'
      );
    }

    const senderUid = myIdentity.uid;

    // Content is caption or type description
    const content = options.caption ||
      (mediaType === 'image' ? '📷 Fotoğraf' :
        mediaType === 'voice' ? '🎤 Sesli Mesaj' :
          '📍 Konum');

    // FIX: Validate mediaDuration — must be a positive finite number (seconds)
    const validatedDuration = typeof options.mediaDuration === 'number'
      && Number.isFinite(options.mediaDuration)
      && options.mediaDuration > 0
      ? Math.floor(options.mediaDuration)
      : undefined;

    const message: HybridMessage = {
      id: messageId,
      localId,
      content,
      senderId: senderUid,
      senderName: myIdentity.displayName,
      conversationId: typeof options.conversationId === 'string' && options.conversationId.trim().length > 0
        ? options.conversationId.trim()
        : undefined,
      recipientId: resolvedRecipientId,
      recipientAliases,
      timestamp,
      source: 'HYBRID',
      status: 'pending',
      priority: 'normal',
      type: messageType,
      retryCount: 0,
      // Media fields
      mediaUrl,
      // Retained for re-upload on retry when initial cloud upload fails.
      // Cleared when mediaUrl exists (upload already succeeded — no need to persist local path).
      mediaLocalUri: mediaUrl ? undefined : options.mediaLocalUri,
      mediaType,
      mediaDuration: validatedDuration,
      mediaThumbnail: options.mediaThumbnail,
      location: options.location,
    };

    // Add to queue
    await this.queueMutex.withLock(async () => {
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        const removed = this.evictOldMessages(1);
        if (removed === 0) {
          throw new Error('Message queue full');
        }
      }
      this.queue.push(message);
      // Save immediately for new messages to prevent loss on crash
      await this.saveQueueImmediate();
    });

    // Track delivery
    if (resolvedRecipientId && resolvedRecipientId !== 'broadcast') {
      deliveryManager.trackMessage(messageId, resolvedRecipientId);
    }

    // CRITICAL FIX: Register message as "seen" BEFORE cloud write (same as sendMessage).
    // Without this, the Firestore subscription reprocesses the sender's own media message.
    this.recordSeenMessage(messageId);

    // CRITICAL FIX: Push sent media message to MeshStore immediately for UI display.
    // Without this, the sender never sees their own media message in ConversationScreen
    // (which reads from useMeshStore.messages). Same fix as sendMessage line 589.
    this.pushCloudMessageToMeshStore(message, message.conversationId);
    if (meshBinaryFallbackStarted && options.mediaLocalUri) {
      // Local preview for sender; receiver gets real media through chunk transfer.
      useMeshStore.getState().updateMessage(messageId, {
        mediaType,
        mediaUrl: options.mediaLocalUri,
      });
    }

    // Attempt immediate send (fire-and-forget but catch unhandled rejection)
    this.processMessageImmediate(message).catch(e => {
      logger.error('processMessageImmediate failed for media message:', e);
    });

    logger.info(`📤 Media message sent: ${mediaType}`);
    return message;
  }

  /**
   * M5: Evict oldest low-priority messages
   * ELITE: Fixed splice index shifting - remove from highest index first
   */
  private evictOldMessages(count: number): number {
    // Sort by priority (low first) then by timestamp (oldest first)
    const sortedIndices = this.queue
      .map((msg, index) => ({ msg, index }))
      .sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[b.msg.priority] - PRIORITY_ORDER[a.msg.priority];
        if (priorityDiff !== 0) return priorityDiff; // Lower priority (higher number) first
        return a.msg.timestamp - b.msg.timestamp; // Older first
      });

    // ELITE: Get indices to remove, filter out critical, sort descending
    const indicesToRemove = sortedIndices
      .slice(0, count)
      .filter(item => item.msg.priority !== 'critical')
      .map(item => item.index)
      .sort((a, b) => b - a); // Descending order to avoid index shifting

    // Remove from highest index first
    for (const idx of indicesToRemove) {
      const removed = this.queue[idx];
      this.queue.splice(idx, 1);
      logger.warn(`Evicted message ${removed.id} due to queue overflow`);
    }

    return indicesToRemove.length;
  }

  /**
   * Process single message immediately
   * CRITICAL: attemptSend + status update MUST be in a single mutex lock.
   * Two separate locks had a race window where processQueue could call attemptSend
   * on the same message between the first lock release and second lock acquire.
   */
  private async processMessageImmediate(message: HybridMessage): Promise<void> {
    // CRITICAL FIX: Do NOT hold queueMutex throughout attemptSend.
    // attemptSend involves network I/O (Firestore writes, media uploads, mesh broadcasts)
    // that can take seconds. Holding the mutex blocks ALL other message operations:
    // - sendMessage() can't add new messages to queue (user sees frozen UI)
    // - processQueue() can't process other pending messages
    // - sendMediaMessage() queue addition is blocked
    // Instead: mark as 'sending' under mutex BEFORE network I/O, then update after.
    // The 'sending' status prevents processQueue from picking up the same message.
    const alreadySending = await this.queueMutex.withLock(async () => {
      if (message.status === 'sending' || message.status === 'sent' || message.status === 'delivered' || message.status === 'read') {
        return true; // Another path is already handling this message
      }
      message.status = 'sending';
      return false;
    });
    if (alreadySending) return;

    const sendResult = await this.attemptSend(message);

    await this.queueMutex.withLock(async () => {
      if (sendResult === 'success') {
        this.updateMessageStatus(message.id, 'sent');
        // ELITE V2: Sync delivery status to messageStore (WhatsApp 3-tick: ✓ sent)
        try {
          const { useMessageStore } = require('../stores/messageStore');
          useMessageStore.getState().updateMessageStatus(message.id, 'sent');
        } catch { /* best-effort */ }
        // CRITICAL: Update MeshStore too — ConversationScreen reads from here
        try {
          useMeshStore.getState().updateMessage(message.id, { status: 'sent' });
        } catch { /* best-effort */ }
      } else if (sendResult === 'permanent') {
        // PERMANENT FAILURE: Non-retryable (permission denied, conversation deleted, etc.)
        // Force-remove from queue so auto-retry and retryAllFailed() don't resurrect it.
        // updateMessageStatus('failed') does NOT remove from queue (only sent/delivered/read do),
        // so we must splice manually. Without this, processQueue's connectivity-restore auto-retry
        // resurrects permanently-failed messages, causing infinite futile retry loops.
        const permIdx = this.queue.findIndex(m => m.id === message.id);
        if (permIdx >= 0) {
          this.queue.splice(permIdx, 1);
          this.saveQueueDebounced();
        }
        try {
          const { useMessageStore } = require('../stores/messageStore');
          useMessageStore.getState().updateMessageStatus(message.id, 'failed');
        } catch { /* best-effort */ }
        try {
          useMeshStore.getState().updateMessage(message.id, { status: 'failed' });
        } catch { /* best-effort */ }
        // Notify delivery callbacks so UI can show error state
        const permCallbacks = this.deliveryCallbacks.get(message.id);
        if (permCallbacks) {
          permCallbacks.forEach(cb => cb(message.id, 'failed'));
          this.deliveryCallbacks.delete(message.id);
        }
        logger.error(`🚫 Message ${message.id} permanently failed — removed from retry queue`);
      } else {
        // RETRYABLE FAILURE: Temporary error, schedule retry
        const meshRouted = typeof message.meshRoutedAt === 'number';
        message.retryCount++;
        message.lastRetryAt = Date.now();
        message.nextRetryAt = Date.now() + this.calculateNextRetryDelay(message.retryCount);
        message.status = 'pending';
        this.saveQueueImmediate();
        // If message already went out over mesh, keep optimistic sent status in UI
        // while cloud sync retries continue in background.
        if (meshRouted) {
          try {
            const { useMessageStore } = require('../stores/messageStore');
            useMessageStore.getState().updateMessageStatus(message.id, 'sent');
          } catch { /* best-effort */ }
          try {
            useMeshStore.getState().updateMessage(message.id, { status: 'sent' });
          } catch { /* best-effort */ }
        } else {
          // ELITE V2: Mark as pending in messageStore too
          try {
            const { useMessageStore } = require('../stores/messageStore');
            useMessageStore.getState().updateMessageStatus(message.id, 'pending');
          } catch { /* best-effort */ }
          // Update MeshStore visual status
          try {
            useMeshStore.getState().updateMessage(message.id, { status: 'pending' });
          } catch { /* best-effort */ }
        }

        // CRITICAL: Trigger a near-immediate retry tick instead of waiting for the
        // periodic 10s queue cycle. This improves "instant send" behavior after
        // transient failures (short network blips, auth refresh, etc.).
        const retryDelay = Math.max(
          300,
          Math.min((message.nextRetryAt || Date.now()) - Date.now(), 2000),
        );
        const retryTimer = setTimeout(() => {
          this.cleanupTimers.delete(retryTimer);
          if (this.isActive) {
            this.processQueue();
          }
        }, retryDelay);
        this.cleanupTimers.add(retryTimer);
      }
    });
  }

  /**
   * ELITE V5: Internal send logic with multi-channel support
   * - Auto-initialize Firebase if not ready
   * - SOS messages get priority treatment
   * - Store-and-Forward integration
   *
   * Returns:
   * - 'success': Cloud delivery confirmed (or mesh-only for broadcasts)
   * - 'retryable': Temporary failure, keep in queue for retry
   * - 'permanent': Non-retryable error (permission denied, etc.), mark permanently_failed
   */
  private async attemptSend(message: HybridMessage): Promise<'success' | 'retryable' | 'permanent'> {
    const isOnline = connectionManager.isOnline;
    const meshCanBeTrustedForDelivery = this.canTreatMeshSendAsDelivery(message);
    let meshSuccess = false;
    let cloudSuccess = false;
    let isPermanentFailure = false;

    // PRODUCTION LOGGING: Always log send attempts for delivery debugging
    logger.info(`📤 attemptSend: id=${message.id}, to=${message.recipientId || 'broadcast'}, from=${message.senderId}, type=${message.type}, online=${isOnline}`);

    try {
      // Ensure mesh is active before offline-first send attempt.
      if (!meshNetworkService.getIsRunning()) {
        try {
          await meshNetworkService.start();
        } catch (meshStartError) {
          logger.warn('Mesh auto-start failed during send attempt:', meshStartError);
        }
      }

      // 1. MESH LAYER: Always try (offline-first priority)
      try {
        const meshType = message.type === 'SOS' ? MeshMessageType.SOS : MeshMessageType.TEXT;
        const meshTarget = message.recipientId || message.recipientAliases?.[0] || 'broadcast';
        const meshPayload = JSON.stringify({
          id: message.id,
          from: message.senderId,
          to: meshTarget,
          ...(message.recipientAliases && message.recipientAliases.length > 0
            ? { toAliases: message.recipientAliases }
            : {}),
          type: message.type,
          content: message.content,
          timestamp: message.timestamp,
          senderName: message.senderName,
          ...(message.replyTo && { replyTo: message.replyTo }),
          ...(message.replyPreview && { replyPreview: message.replyPreview }),
          ...(message.mediaType && { mediaType: message.mediaType }),
          ...(message.mediaUrl && { mediaUrl: message.mediaUrl }),
          ...(typeof message.mediaDuration === 'number' && { mediaDuration: message.mediaDuration }),
          ...(message.mediaThumbnail && { mediaThumbnail: message.mediaThumbnail }),
          ...(message.location && { location: message.location }),
        });

        await meshNetworkService.broadcastMessage(meshPayload, meshType, {
          to: meshTarget,
          from: message.senderId,
          messageId: message.id,
        });
        meshSuccess = true;
        logger.debug(`Mesh broadcast successful (type: ${meshType})`);
        // CRITICAL FIX: Always mark meshRoutedAt when offline and mesh broadcast succeeds.
        // Previously, meshRoutedAt was only set when the specific recipient's device ID
        // was visible in BLE peer list. But BLE peer IDs (peripheral UUID on iOS, MAC on
        // Android) NEVER match Firebase UIDs or installation IDs — so hasVisibleMeshPeerForRecipient()
        // was ALWAYS false for DMs. This caused ALL offline messages to stay "pending" forever
        // in the sender's UI, even though the mesh network DID deliver them to nearby devices.
        // Now: when offline, trust that mesh will deliver the packet (it retries every 1s).
        // The message stays in the cloud sync queue so it syncs when connectivity returns.
        if (meshCanBeTrustedForDelivery || !connectionManager.isOnline) {
          message.meshRoutedAt = Date.now();
        } else {
          logger.warn(`Mesh route not trusted for direct message ${message.id} (online, no visible peers)`);
        }

        // V5: Store-and-Forward for offline peers
        const storeForwardTargets = this.getDirectedRecipientTargets(message);
        if (storeForwardTargets.size > 0) {
          try {
            const { meshStoreForwardService } = await import('./mesh/MeshStoreForwardService');
            for (const targetId of storeForwardTargets) {
              await meshStoreForwardService.storeForPeer(
                targetId,
                message.type === 'SOS' ? MeshMessageType.SOS : MeshMessageType.TEXT,
                meshPayload,
                { priority: message.priority === 'critical' ? MeshPriority.CRITICAL : MeshPriority.NORMAL }
              );
            }
          } catch {
            // Silent fail - Store-Forward is optional enhancement
          }
        }
      } catch (meshError) {
        logger.warn('Mesh broadcast failed:', meshError);
      }

      // 2a. MEDIA RE-UPLOAD: If initial cloud upload failed but local file URI is retained,
      // try uploading again before the Firestore write. Without this, retried messages
      // go to Firestore without mediaUrl — receiver gets "📷 Fotoğraf" with no actual image.
      if (message.mediaLocalUri && !message.mediaUrl && message.mediaType && isOnline) {
        try {
          const FileSystem = await import('expo-file-system');
          const fileInfo = await FileSystem.getInfoAsync(message.mediaLocalUri);
          if (fileInfo.exists) {
            const { firebaseStorageService } = await import('./FirebaseStorageService');
            await firebaseStorageService.initialize();
            const extension = message.mediaType === 'image' ? 'jpg' : 'm4a';
            const storageOwnerId = identityService.getUid();
            if (storageOwnerId) {
              // FIX: Compress images on re-upload (same as initial send path).
              // Without this, the original uncompressed photo (potentially 10-15MB)
              // is uploaded instead of the compressed version (~1-2MB).
              let uploadUri = message.mediaLocalUri!;
              if (message.mediaType === 'image') {
                try {
                  const ImageManipulator = await import('expo-image-manipulator');
                  const compressed = await ImageManipulator.manipulateAsync(
                    uploadUri,
                    [{ resize: { width: 1280 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                  );
                  uploadUri = compressed.uri;
                } catch {
                  logger.debug('Image compression skipped on re-upload (manipulator unavailable)');
                }
              }
              const storagePath = `chat/${storageOwnerId}/${Date.now()}.${extension}`;
              const uploadResult = await firebaseStorageService.uploadFileFromUri(storagePath, uploadUri, {
                contentType: message.mediaType === 'image' ? 'image/jpeg' : 'audio/mp4',
                customMetadata: { userId: storageOwnerId },
              });
              if (uploadResult) {
                message.mediaUrl = uploadResult;
                // Clear local URI — no longer needed after successful cloud upload
                message.mediaLocalUri = undefined;
                this.saveQueueDebounced();
                // Update sender's MeshStore preview with the permanent cloud URL
                try {
                  const { useMeshStore } = await import('./mesh/MeshStore');
                  useMeshStore.getState().updateMessage(message.id, { mediaUrl: uploadResult });
                } catch { /* best-effort */ }
                logger.info(`✅ Media re-upload succeeded for ${message.id}`);
              }
            }
          } else {
            // Local file no longer exists (iOS/Android cleaned temp cache)
            logger.warn(`⚠️ Local media file gone for ${message.id}: ${message.mediaLocalUri}`);
            message.mediaLocalUri = undefined;
            this.saveQueueDebounced();
          }
        } catch (reuploadError) {
          logger.warn(`Media re-upload attempt failed for ${message.id}:`, reuploadError);
        }
      }

      // FIX: If this is a media message but has no cloud URL and local file is gone,
      // skip cloud write. Writing a media-type message without mediaUrl to Firestore
      // causes receiver to see an empty "📷 Fotoğraf" or "🎤 Sesli Mesaj" bubble.
      // The message stays in queue; if mesh already delivered the binary, that's enough.
      if (message.mediaType && message.mediaType !== 'location' && !message.mediaUrl && !message.mediaLocalUri) {
        logger.warn(`⚠️ Skipping cloud write for ${message.id}: media message has no URL and no local file`);
        // Don't return false yet — mesh may have succeeded above
        // Just skip the cloud write section
      } else

      // 2b. CLOUD LAYER: Always attempt cloud write.
      // Firestore SDK handles offline queuing automatically.
      // Previously gated on isOnline which was unreliable on iOS
      // (isInternetReachable=null → isOnline=false → cloud writes silently skipped).
      {
        try {
          const { firebaseDataService } = await import('./FirebaseDataService');

          // V5: Auto-initialize if not ready
          try {
            await firebaseDataService.initialize();
          } catch { /* best effort */ }

          const metadata: Record<string, unknown> = {
            ...(message.senderName ? { senderName: message.senderName } : {}),
            ...(message.mediaType ? { mediaType: message.mediaType } : {}),
            ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
            ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
            ...(message.mediaThumbnail ? { mediaThumbnail: message.mediaThumbnail } : {}),
          };

          const senderDeviceRouteId = (
            identityService.getUid() ||
            message.senderId
          ).toString().trim();

          // V3: Build message data with senderUid — MUST be Firebase Auth UID
          const authUid = identityService.getUid();
          if (!authUid) {
            logger.warn('☁️ Cloud write skipped: no authenticated UID available');
            throw new Error('No auth UID for cloud write');
          }
          const messageData = {
            id: message.id,
            senderUid: authUid,
            ...(message.conversationId ? { conversationId: message.conversationId } : {}),
            senderName: message.senderName || '',
            // BELT-AND-SUSPENDERS: onNewConversationMessageV3 CF reads fromName first,
            // then falls back to senderName. Include both so notification title is always correct.
            fromName: message.senderName || '',
            content: message.content,
            timestamp: message.timestamp,
            type: this.mapHybridTypeToCloudType(message.type),
            status: 'sent' as const,
            priority: message.priority,
            ...(message.replyTo ? { replyTo: message.replyTo } : {}),
            ...(message.replyPreview ? { replyPreview: message.replyPreview } : {}),
            // CRITICAL FIX: Media fields MUST be top-level for ConversationScreen to render them.
            // Previously stored only in nested metadata — receiver UI couldn't find them.
            ...(message.location && { location: message.location }),
            ...(message.mediaType ? { mediaType: message.mediaType } : {}),
            ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
            ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
            ...(message.mediaThumbnail ? { mediaThumbnail: message.mediaThumbnail } : {}),
            // Keep metadata for backwards compat
            ...(Object.keys(metadata).length > 0 && { metadata }),
            // Legacy compat fields
            fromDeviceId: senderDeviceRouteId,
            toDeviceId: message.recipientId || 'broadcast',
          };


          // V3: Use conversation model via FirebaseDataService facade
          const recipientId = message.recipientId && message.recipientId !== 'broadcast'
            ? message.recipientId
            : null;

          // PRODUCTION LOGGING
          logger.info(`☁️ V3 Cloud write: msg ${message.id} → ${recipientId || 'broadcast'} from ${message.senderId}`);

          const legacyFallbackTarget =
            message.recipientId && message.recipientId !== 'broadcast'
              ? message.recipientId
              : message.senderId;
          const result = await firebaseDataService.saveMessage(legacyFallbackTarget, messageData);
          // Extract structured outcome if available, with backward-compat boolean fallback
          const outcome = typeof result === 'object' && result.outcome ? result.outcome : null;
          const rawCloudSuccess = outcome
            ? (outcome.status === 'full_success' || outcome.status === 'partial_success')
            : (typeof result === 'object' ? result.success : !!result);
          // CRITICAL FIX: Don't trust Firestore "success" when offline.
          // On React Native, Firestore uses memory-only cache (no IndexedDB).
          // setDoc() "succeeds" into memory cache even when offline, but this data
          // is LOST on app kill. If we treat this as cloudSuccess=true, the message
          // is removed from the retry queue (updateMessageStatus('sent') → splice).
          // When the user kills the app, the message is permanently lost — never
          // delivered to the recipient. Fix: only trust cloud success when actually online.
          // Re-check connectivity AFTER the cloud write. If network dropped during
          // the operation, Firestore may have resolved to volatile memory cache.
          const stillOnline = connectionManager.isOnline;
          cloudSuccess = rawCloudSuccess && isOnline && stillOnline;

          // Handle permanent failures — mark as permanently_failed immediately, don't retry
          if (outcome?.status === 'permanent_failure') {
            logger.error(`🚨 V3 Cloud save PERMANENT FAILURE: msg ${message.id} — ${outcome.error}`);
            cloudSuccess = false;
            isPermanentFailure = true;
            // Caller will mark as permanently_failed via the return value
          }

          // Log partial_success with inbox failure detail (CF provides backup)
          if (outcome?.status === 'partial_success' && cloudSuccess) {
            logger.warn(`⚠️ V3 Cloud partial success: msg ${message.id} — message persisted but inbox write failed. CF syncConversationInboxV3 will handle inbox delivery server-side.`);
          }

          const resolvedConversationId =
            typeof result === 'object' && typeof result.conversationId === 'string' && result.conversationId.trim().length > 0
              ? result.conversationId.trim()
              : undefined;
          if (resolvedConversationId) {
            message.conversationId = resolvedConversationId;
            this.pushCloudMessageToMeshStore(message, resolvedConversationId);
          }

          if (cloudSuccess) {
            logger.info(`✅ V3 Cloud send successful: msg ${message.id} → recipient=${recipientId || 'broadcast'}, toDeviceId=${messageData.toDeviceId} (outcome: ${outcome?.status || 'legacy'})`);
          } else if (rawCloudSuccess && !isOnline) {
            logger.warn(`⚠️ V3 Cloud write accepted by memory cache (offline): msg ${message.id} — keeping in retry queue for real delivery`);
          } else {
            logger.error(`🚨 V3 Cloud save FAILED: msg ${message.id} → recipient=${recipientId || 'broadcast'}, toDeviceId=${messageData.toDeviceId}, senderUid=${authUid} — message will NOT be delivered until retry succeeds (outcome: ${outcome?.status || 'unknown'})`);
          }
        } catch (cloudError) {
          logger.warn('❌ Cloud send failed:', cloudError);
        }
      }

      // V5: SOS Special Handling - must succeed on at least one channel
      if (message.type === 'SOS' && !meshSuccess && !cloudSuccess) {
        logger.error('🚨 SOS MESSAGE FAILED ON ALL CHANNELS!');
        // Queue for aggressive retry (do NOT increment retryCount here — caller does it)
        message.priority = 'critical';

        // CRITICAL FIX: Immediate retry — don't wait for 10s queue cycle
        // SOS is life-critical; 10s delay is unacceptable
        const currentRetry = message.retryCount || 0;
        if (currentRetry <= 5) {
          logger.warn(`🔄 SOS immediate retry ${currentRetry}/5 in 500ms`);
          const sosRetryTimer = setTimeout(() => this.processQueue(), 500);
          // Track timer for cleanup — without this, the timer fires after destroy()
          this.cleanupTimers.add(sosRetryTimer);
        } else {
          logger.error('🚨 SOS EXHAUSTED ALL RETRIES (5/5) — falling back to normal queue');
          // After 5 fast retries, fall back to normal 10s queue cycle
          // The message stays in queue with critical priority
        }
      }
    } catch (error) {
      logger.error('Attempt send failed:', error);
    }

    // Permanent failure short-circuits everything — no point retrying
    if (isPermanentFailure) {
      logger.error(`🚫 Message ${message.id} permanently failed — will not retry`);
      return 'permanent';
    }

    const isUidTarget =
      this.isUidRecipient(message.recipientId);

    const meshDeliveryAccepted = meshSuccess && meshCanBeTrustedForDelivery;

    // CRITICAL FIX: For SOS and directed DMs, cloud success is REQUIRED for queue completion.
    // Previously, SOS with mesh-only was treated as success, setting status to 'sent' which
    // processQueue skips forever — cloud delivery was NEVER retried. For life-safety SOS,
    // this means the alert only reaches nearby BLE devices but the server never gets it,
    // so push notifications are never sent to family members or rescue teams.
    // Fix: SOS always requires cloud (for maximum reach via push notifications).
    // UID DMs always require cloud (for reliable cross-device delivery).
    // Broadcasts are fine with mesh-only (all nearby devices received it).
    // meshRoutedAt flag preserves 'sent' UI status while cloud retry continues.
    const success = (message.type === 'SOS' || isUidTarget)
      ? cloudSuccess
      : (meshDeliveryAccepted || cloudSuccess);

    if (!success && meshSuccess && !cloudSuccess) {
      logger.warn(`☁️ Message ${message.id} mesh-routed; keeping in queue for cloud sync (type=${message.type})`);
    }

    if (success) {
      logger.info(`✅ Message ${message.id} sent (mesh: ${meshSuccess}, cloud: ${cloudSuccess})`);
    }
    return success ? 'success' : 'retryable';
  }


  /**
   * Update message status and notify callbacks.
   * Uses the shared delivery state machine guard from constants.ts.
   */
  private updateMessageStatus(messageId: string, status: DeliveryStatus): void {
    const msgIndex = this.queue.findIndex(m => m.id === messageId);

    if (msgIndex >= 0) {
      // Use shared state machine guard — single source of truth
      const { isStatusTransitionAllowed } = require('./messaging/constants');
      if (!isStatusTransitionAllowed(this.queue[msgIndex].status, status)) {
        return; // Block illegal transition
      }
      this.queue[msgIndex].status = status;

      // Remove from queue on completion states:
      // - sent/delivered/read: Cloud delivery confirmed, further updates via Firestore subscriptions.
      // - 'failed' messages STAY in queue so retryAllFailed() can resurrect them.
      //   The 24h stale cleanup in processQueue handles eventual eviction.
      // Without removal, completed messages accumulate forever in the queue.
      if (status === 'sent' || status === 'delivered' || status === 'read') {
        this.queue.splice(msgIndex, 1);
      }

      this.saveQueueDebounced();
    }

    // Notify callbacks
    const callbacks = this.deliveryCallbacks.get(messageId);
    if (callbacks) {
      callbacks.forEach(cb => cb(messageId, status));
      // CRITICAL FIX: Clean up callbacks for terminal states to prevent memory leak
      if (status === 'delivered' || status === 'read' || status === 'sent' || status === 'failed') {
        this.deliveryCallbacks.delete(messageId);
      }
    }
  }

  /**
   * Register delivery callback
   */
  onDelivery(messageId: string, callback: DeliveryCallback): () => void {
    let callbacks = this.deliveryCallbacks.get(messageId);
    if (!callbacks) {
      callbacks = [];
      this.deliveryCallbacks.set(messageId, callbacks);
    }
    callbacks.push(callback);

    return () => {
      const callbacks = this.deliveryCallbacks.get(messageId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index >= 0) callbacks.splice(index, 1);
      }
    };
  }

  /**
   * P1: Broadcast typing indicator with proper throttle and debounce.
   * Sends via both Mesh (BLE) and Firestore (cloud) for universal delivery.
   */
  broadcastTyping(conversationId: string): void {
    // Throttle: max 1 broadcast per TYPING_THROTTLE_MS
    this.typingThrottle.execute(() => {
      const myIdentity = identityService.getIdentity();
      if (!myIdentity?.uid) return;

      // Mesh broadcast (BLE nearby)
      try {
        meshNetworkService.broadcastMessage(
          JSON.stringify({
            type: 'TYPING',
            conversationId,
            userId: myIdentity.uid,
            userName: myIdentity.displayName,
          }),
          MeshMessageType.TEXT
        );
      } catch {
        // Silent fail for typing indicators
      }

      // Firestore broadcast (cloud — remote users)
      import('./firebase/FirebaseMessageOperations').then(({ setTypingIndicator }) => {
        setTypingIndicator(conversationId, myIdentity.uid!, true);
      }).catch(e => { if (__DEV__) logger.debug('HybridMsg: typing start indicator error:', e); });
    });

    // P1: Debounce stop-typing (send stop after TYPING_DEBOUNCE_MS of no typing)
    let debouncer = this.typingDebouncers.get(conversationId);
    if (!debouncer) {
      debouncer = new Debouncer(TYPING_DEBOUNCE_MS);
      this.typingDebouncers.set(conversationId, debouncer);
    }
    debouncer.schedule(() => {
      // Clear typing indicator from Firestore after debounce
      const uid = identityService.getUid();
      if (uid) {
        import('./firebase/FirebaseMessageOperations').then(({ setTypingIndicator }) => {
          setTypingIndicator(conversationId, uid, false);
        }).catch(e => { if (__DEV__) logger.debug('HybridMsg: typing stop indicator error:', e); });
      }
    });
  }

  /**
   * CRITICAL FIX: Lightweight method for ConversationScreen to ensure cloud
   * subscriptions are alive WITHOUT creating duplicate subscriptions.
   *
   * Previously, ConversationScreen called subscribeToMessages() which created
   * entirely new Firestore onSnapshot listeners (duplicating init.ts's subscription).
   * When ConversationScreen unmounted, its cleanup set cloudEnsureRefresher = null,
   * killing the foreground-resume mechanism for init.ts's subscription — causing
   * messages to silently stop being delivered after the first conversation view.
   *
   * This method simply re-invokes the existing cloudEnsureRefresher (from init.ts's
   * subscription closure) to re-ensure subscriptions are active, without creating
   * any new closures or listeners.
   */
  async refreshCloudSubscriptions(): Promise<void> {
    if (this.cloudEnsureRefresher) {
      try {
        await this.cloudEnsureRefresher();
      } catch (error) {
        logger.warn('refreshCloudSubscriptions failed:', error);
      }
    } else {
      logger.warn('refreshCloudSubscriptions: no cloudEnsureRefresher available (init.ts subscription not active)');
    }
  }

  /**
   * Subscribe to typing indicators
   */
  onTyping(callback: TypingCallback): () => void {
    this.typingCallbacks.add(callback);
    return () => this.typingCallbacks.delete(callback);
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  /**
   * Subscribe to messages from all sources
   */
  async subscribeToMessages(callback: (message: HybridMessage) => void): Promise<() => void> {
    // 1. Subscribe to Mesh messages
    const unsubscribeMesh = meshNetworkService.onMessage((meshMsg) => {
      // Check for typing indicator
      if (typeof meshMsg.content === 'string' && meshMsg.content.startsWith('{"type":"TYPING"')) {
        try {
          const typingData = JSON.parse(meshMsg.content);
          this.handleTypingIndicator(typingData.userId, typingData.userName);
          return;
        } catch {
          // Not valid JSON, treat as regular message
        }
      }

      if (
        (
          meshMsg.type === 'CHAT' ||
          meshMsg.type === 'SOS' ||
          meshMsg.type === 'IMAGE' ||
          meshMsg.type === 'VOICE' ||
          meshMsg.type === 'LOCATION'
        ) &&
        typeof meshMsg.content === 'string'
      ) {
        const msgId = meshMsg.id || Date.now().toString(36);
        const meshSenderId = typeof meshMsg.senderId === 'string' ? meshMsg.senderId.trim() : '';

        if (this.isBlockedSender(meshSenderId)) {
          return;
        }

        // Deduplication
        if (!this.recordSeenMessage(msgId)) return;

        const normalizedType = this.deriveMessageTypeFromContent(
          meshMsg.type,
          typeof meshMsg.content === 'string' ? meshMsg.content : '',
        );

        const hybridMsg: HybridMessage = {
          id: msgId,
          content: sanitizeMessage(meshMsg.content),
          senderId: meshMsg.senderId || 'unknown',
          senderName: meshMsg.senderName || 'Mesh User',
          recipientId: meshMsg.to && meshMsg.to !== 'broadcast' ? meshMsg.to : undefined,
          timestamp: meshMsg.timestamp || Date.now(),
          source: 'MESH',
          status: 'delivered',
          priority: 'normal',
          type: normalizedType,
          retryCount: 0,
          ...(meshMsg.mediaUrl ? { mediaUrl: meshMsg.mediaUrl } : {}),
          ...(meshMsg.mediaType ? { mediaType: meshMsg.mediaType } : {}),
          ...(typeof meshMsg.mediaDuration === 'number' ? { mediaDuration: meshMsg.mediaDuration } : {}),
          ...(meshMsg.mediaThumbnail ? { mediaThumbnail: meshMsg.mediaThumbnail } : {}),
          ...(meshMsg.location ? { location: meshMsg.location } : {}),
        };
        if (this.isSystemPayloadForConversation(hybridMsg)) {
          return;
        }
        callback(hybridMsg);
      }
    });

    // 2. Subscribe to Cloud messages via V3 inbox model:
    //    user_inbox/{uid}/threads → discover conversationIds → subscribe to each conversation's messages
    const conversationUnsubscribers = new Map<string, () => void>();
    let conversationsListUnsubscriber: (() => void) | null = null;
    let legacyDeviceUnsubscriber: (() => void) | null = null;
    let isDisposed = false;
    let isCloudSyncInProgress = false;

    const clearCloudSubscriptions = () => {
      conversationUnsubscribers.forEach((unsubscribe) => {
        try { unsubscribe(); } catch { /* no-op */ }
      });
      conversationUnsubscribers.clear();
      if (conversationsListUnsubscriber) {
        try { conversationsListUnsubscriber(); } catch { /* no-op */ }
        conversationsListUnsubscriber = null;
      }
      if (legacyDeviceUnsubscriber) {
        try { legacyDeviceUnsubscriber(); } catch { /* no-op */ }
        legacyDeviceUnsubscriber = null;
      }
    };

    // Build self-ID set for sender mirror detection
    const getSelfIds = (): Set<string> => {
      return this.getSelfIdentityIds();
    };

    const processCloudMessage = (msg: any, conversationId?: string) => {
      const selfIds = getSelfIds();
      const fromDeviceId = typeof msg.fromDeviceId === 'string' ? msg.fromDeviceId.trim() : '';
      const senderUid = typeof msg.senderUid === 'string' ? msg.senderUid.trim() : '';
      const toDeviceId = typeof msg.toDeviceId === 'string' ? msg.toDeviceId.trim() : '';
      const senderUidIsSelf = !!senderUid && selfIds.has(senderUid);

      // CRITICAL FIX: Direct senderUid usage!
      // Previously: `(senderUidIsSelf && fromDeviceId) ? fromDeviceId : (senderUid || fromDeviceId)`
      // This caused OUR OWN sent messages to be labeled with `fromDeviceId` instead of `senderUid`,
      // making `isFromMe` false in `pushCloudMessageToMeshStore`. This led the system to treat our
      // own sent messages as INCOMING, setting `to=our_uid` and `from=our_deviceId`, bypassing UI filters!
      const senderId = senderUid || fromDeviceId;

      // PRODUCTION LOGGING: Log every incoming cloud message for delivery debugging
      logger.info(`📨 processCloudMessage: id=${msg.id}, senderUid=${senderUid}, fromDeviceId=${fromDeviceId}, toDeviceId=${toDeviceId}, isSelf=${senderUidIsSelf}, conv=${conversationId} -> mappedSenderId=${senderId}`);

      if (this.isBlockedSender(senderId)) {
        logger.debug(`📨 processCloudMessage: BLOCKED sender ${senderId}`);
        return;
      }

      // Process updates to our own sent messages (Delivery receipts / Read receipts)
      // CRITICAL FIX: Only check senderUidIsSelf — fromDeviceId is NOT in selfIds
      // (selfIds only contains Firebase Auth UID, not device IDs).
      // Without this fix, delivery receipts are NEVER detected because the condition
      // `!fromDeviceId || senderDeviceIdIsSelf` fails when fromDeviceId is present.
      if (senderUidIsSelf) {
        let isLocalMessageFound = false;
        try {
          // Check if this is a delivery or read receipt update from the server
          const { useMessageStore } = require('../stores/messageStore');
          // Use shared status priority from constants for consistency
          const { MESSAGE_STATUS_PRIORITY: PRIORITY_ORDER } = require('./messaging/constants');

          const localMessage = useMessageStore.getState().getMessage(msg.id) || useMessageStore.getState().getMessage(msg.localId);
          if (localMessage) {
            isLocalMessageFound = true;
            let isRead = msg.read === true || msg.status === 'read';
            let isDelivered = msg.delivered === true || msg.status === 'delivered';

            // CRITICAL FIX: Firestore V3 schema uses readBy: { [uid]: timestamp } and deliveredTo
            if (msg.readBy && typeof msg.readBy === 'object') {
              const readers = Object.keys(msg.readBy).filter(id => !selfIds.has(id));
              if (readers.length > 0) isRead = true;
            } else if (msg.readBy && (typeof msg.readBy === 'string' || Array.isArray(msg.readBy))) {
              if (Array.isArray(msg.readBy)) {
                if (msg.readBy.some((id: string) => !selfIds.has(id))) isRead = true;
              } else if (!selfIds.has(msg.readBy)) {
                isRead = true;
              }
            }

            if (msg.deliveredTo && typeof msg.deliveredTo === 'object') {
              const recipients = Object.keys(msg.deliveredTo).filter(id => !selfIds.has(id));
              if (recipients.length > 0) isDelivered = true;
            } else if (msg.deliveredTo && (typeof msg.deliveredTo === 'string' || Array.isArray(msg.deliveredTo))) {
              if (Array.isArray(msg.deliveredTo)) {
                if (msg.deliveredTo.some((id: string) => !selfIds.has(id))) isDelivered = true;
              } else if (!selfIds.has(msg.deliveredTo)) {
                isDelivered = true;
              }
            }
            const rawDbStatus = msg.status || localMessage.status;
            const newStatus = isRead ? 'read' : isDelivered ? 'delivered' : rawDbStatus;

            // Only update if the new status is an advancement (e.g. sent -> delivered -> read)
            const currentLevel = PRIORITY_ORDER[localMessage.status] ?? 0;
            const newLevel = PRIORITY_ORDER[newStatus] ?? 0;

            if (newLevel > currentLevel) {
              useMessageStore.getState().updateMessageStatus(localMessage.id, newStatus);
              // CRITICAL FIX: Also update MeshStore — ConversationScreen reads from both
              try {
                useMeshStore.getState().updateMessage(localMessage.id, {
                  status: newStatus as any,
                });
              } catch { /* best-effort */ }
              logger.info(`✅ Delivery receipt: ${localMessage.id} → ${newStatus}`);
            }
          }
        } catch (e) {
          logger.debug('Failed to sync delivery receipt for own message:', e);
        }

        // CRITICAL FIX: If the message was NOT found locally, it means we sent it from ANOTHER device
        // or the app was reinstalled. We MUST NOT return early; instead, we let it fall through
        // to be added to the local store (so our own sent messages sync across devices!).
        if (isLocalMessageFound) {
          return;
        }
      }

      if (!this.recordSeenMessage(msg.id)) {
        logger.debug(`📨 processCloudMessage: DEDUP skip msg ${msg.id} (already seen)`);
        return;
      }

      const rawMsg = msg as unknown as Record<string, unknown>;
      const metadata = msg.metadata && typeof msg.metadata === 'object'
        ? msg.metadata as Record<string, unknown>
        : undefined;
      const receiptState = this.resolveCloudDeliveryState(rawMsg, {
        isFromMe: senderUidIsSelf,
        selfIds,
      });
      const mediaType = this.normalizeMediaType(rawMsg.mediaType ?? metadata?.mediaType);
      const location = this.normalizeLocationPayload(rawMsg.location ?? metadata?.location);
      const mediaUrlSource = rawMsg.mediaUrl ?? metadata?.mediaUrl;
      const mediaDurationSource = rawMsg.mediaDuration ?? metadata?.mediaDuration;
      const mediaThumbnailSource = rawMsg.mediaThumbnail ?? metadata?.mediaThumbnail;
      const senderNameSource = rawMsg.senderName ?? metadata?.senderName;
      const normalizedType = this.mapCloudTypeToHybridType(msg.type, mediaType, !!location);
      const finalType = normalizedType === 'CHAT'
        ? this.deriveMessageTypeFromContent('CHAT', typeof msg.content === 'string' ? msg.content : '')
        : normalizedType;
      const normalizedPriority = this.isMessagePriority(msg.priority) ? msg.priority : 'normal';

      let resolvedToDeviceId = toDeviceId && toDeviceId !== 'broadcast' ? toDeviceId : undefined;
      let resolvedConversationId = conversationId
        || (typeof (rawMsg.conversationId) === 'string' ? rawMsg.conversationId : undefined)
        || (typeof (rawMsg.threadId) === 'string' ? rawMsg.threadId : undefined)
        || (typeof (rawMsg.threadID) === 'string' ? rawMsg.threadID : undefined);

      // ELITE FIX: If this is our own message synced from the cloud, and toDeviceId is missing
      // (as is standard in V3 Data structure), we MUST resolve the recipient ID so it doesn't default to 'broadcast'.
      // Otherwise, the message vanishes from our own ConversationScreen!
      if (senderUidIsSelf && !resolvedToDeviceId) {
        try {
          const { useMessageStore } = require('../stores/messageStore');
          if (conversationId) {
            const conv = useMessageStore.getState().conversations.find((c: any) => c.conversationId === conversationId);
            if (conv && conv.userId) resolvedToDeviceId = conv.userId;
          }
          if (!resolvedToDeviceId && msg.deliveredTo && typeof msg.deliveredTo === 'object') {
            const peers = Object.keys(msg.deliveredTo).filter(id => !selfIds.has(id));
            if (peers.length > 0) resolvedToDeviceId = peers[0];
          }
        } catch (resolveError) {
          logger.debug('Failed to resolve missing recipientId for synced self-message:', resolveError);
        }
      }

      // CRITICAL: Ensure every bridged message carries a conversationId for UI filtering.
      if (!resolvedConversationId && resolvedToDeviceId && senderUid) {
        const [a, b] = [senderUid, resolvedToDeviceId].sort();
        resolvedConversationId = `pair_${a}_${b}`;
      }

      const hybridMsg: HybridMessage = {
        id: msg.id,
        content: sanitizeMessage(msg.content),
        senderId: senderId || 'unknown',
        senderName: typeof senderNameSource === 'string' && senderNameSource.trim().length > 0
          ? senderNameSource.trim()
          : 'Cloud User',
        recipientId: resolvedToDeviceId,
        timestamp: typeof msg.timestamp === 'number' && Number.isFinite(msg.timestamp)
          ? msg.timestamp
          : Date.now(),
        source: 'CLOUD',
        status: receiptState.status,
        priority: normalizedPriority,
        type: finalType,
        retryCount: 0,
        ...(typeof mediaUrlSource === 'string' ? { mediaUrl: mediaUrlSource } : {}),
        ...(mediaType ? { mediaType } : {}),
        ...(typeof mediaDurationSource === 'number' ? { mediaDuration: mediaDurationSource } : {}),
        ...(typeof mediaThumbnailSource === 'string' ? { mediaThumbnail: mediaThumbnailSource } : {}),
        ...(location ? { location } : {}),
        ...(resolvedConversationId ? { conversationId: resolvedConversationId } : {}),
      };
      if (this.isSystemPayloadForConversation(hybridMsg)) {
        return;
      }
      this.pushCloudMessageToMeshStore(hybridMsg, resolvedConversationId || conversationId);
      logger.info(`✅ processCloudMessage: STORED msg ${msg.id} from ${senderId} → MeshStore + messageStore`);

      // NOTE: Auto-delivery ACK (Triple-tick ✓✓) is handled inside pushCloudMessageToMeshStore()
      // for all incoming (!isFromMe) messages. No duplicate ACK needed here.

      callback(hybridMsg);
    };

    const subscribeToConversation = async (
      conversationId: string,
      firebaseDataService: any,
      retryAttempt: number = 0,
    ): Promise<void> => {
      if (conversationUnsubscribers.has(conversationId) || isDisposed) return;

      // CRITICAL FIX: Error handler that removes dead subscriptions from the map and
      // schedules a retry. Without this, dead subscriptions stay in conversationUnsubscribers
      // forever, preventing re-subscription even after auth token refresh or network recovery.
      const onSubError = (err: any) => {
        if (isDisposed) return;
        logger.warn(`📨 Per-conversation subscription died for ${conversationId}:`, err);
        // Remove dead entry so the next ensureCloudSubscriptions pass can re-subscribe
        conversationUnsubscribers.delete(conversationId);
        // FIX: Do NOT call scheduleCloudRetry (which increments global cloudRetryCount).
        // Per-conversation failures should NOT exhaust the global retry budget — 15+
        // conversation deaths during a brief network outage would permanently kill ALL
        // subscriptions. Instead, trigger re-ensure directly with a short delay.
        if (!isDisposed) {
          const reEnsureTimer = setTimeout(() => {
            this.cleanupTimers.delete(reEnsureTimer);
            if (!isDisposed) {
              ensureCloudSubscriptions().catch(e => { if (__DEV__) logger.debug('HybridMsg: per-conv re-ensure failed:', e); });
            }
          }, 3000);
          this.cleanupTimers.add(reEnsureTimer);
        }
      };

      try {
        const unsubscribe = await firebaseDataService.subscribeToConversationMessages(
          conversationId,
          (cloudMsgs: any[]) => {
            cloudMsgs.forEach((msg) => processCloudMessage(msg, conversationId));
          },
          onSubError,
        );
        if (unsubscribe && !isDisposed) {
          conversationUnsubscribers.set(conversationId, unsubscribe);
          logger.info(`✅ Subscribed to conversation: ${conversationId}`);
        }
      } catch (err) {
        logger.warn(`Failed to subscribe to conversation ${conversationId} (attempt ${retryAttempt + 1}):`, err);
        // Retry with exponential backoff, max 3 attempts
        if (retryAttempt < 3 && !isDisposed) {
          const delay = Math.min(2000 * Math.pow(2, retryAttempt), 8000);
          const retryTimer = setTimeout(() => {
            // Remove from cleanup set once fired naturally
            this.cleanupTimers.delete(retryTimer);
            if (!isDisposed && !conversationUnsubscribers.has(conversationId)) {
              subscribeToConversation(conversationId, firebaseDataService, retryAttempt + 1).catch(e => { if (__DEV__) logger.debug('HybridMsg: conversation subscription retry failed:', e); });
            }
          }, delay);
          // Track for cleanup — without this, the timer fires after destroy()
          this.cleanupTimers.add(retryTimer);
        }
      }
    };

    // CRITICAL FIX: Retry cloud subscriptions when auth is not ready.
    // Without this, if Firebase Auth isn't ready during Phase B init,
    // cloud subscriptions die permanently and messages are NEVER received.
    let cloudRetryCount = 0;
    const MAX_CLOUD_RETRIES = 15; // ~8 min total with exponential backoff (was 8 / ~4min — too short for cold-start auth)
    let cloudRetryTimer: NodeJS.Timeout | null = null;

    const scheduleCloudRetry = (reason: string) => {
      if (isDisposed || cloudRetryCount >= MAX_CLOUD_RETRIES) {
        if (cloudRetryCount >= MAX_CLOUD_RETRIES) {
          logger.error(`📨 Cloud subscription EXHAUSTED ${MAX_CLOUD_RETRIES} retries (${reason})`);
        }
        return;
      }
      cloudRetryCount++;
      const delay = Math.min(2000 * Math.pow(2, cloudRetryCount - 1), 30000); // 2s, 4s, 8s, 16s, 30s, 30s, 30s, 30s
      logger.info(`📨 Cloud subscription retry ${cloudRetryCount}/${MAX_CLOUD_RETRIES} in ${delay}ms (${reason})`);
      if (cloudRetryTimer) clearTimeout(cloudRetryTimer);
      cloudRetryTimer = setTimeout(() => {
        cloudRetryTimer = null;
        if (!isDisposed) {
          ensureCloudSubscriptions().catch(e => { if (__DEV__) logger.debug('HybridMsg: cloud subscriptions retry failed:', e); });
        }
      }, delay);
    };

    const ensureCloudSubscriptions = async () => {
      if (isDisposed || isCloudSyncInProgress) return;
      isCloudSyncInProgress = true;

      try {
        const { firebaseDataService } = await import('./FirebaseDataService');
        try { await firebaseDataService.initialize(); } catch { /* best effort */ }
        if (isDisposed) return;

        const uid = identityService.getUid();
        if (!uid) {
          logger.warn('📨 Cloud subscription skipped: no UID — scheduling retry');
          scheduleCloudRetry('UID not available');
          return;
        }

        // CRITICAL FIX: Verify Firebase Auth is ACTUALLY authenticated before subscribing.
        // identityService.getUid() may return a cached UID (from MMKV) even when
        // Firebase Auth token is expired/not-yet-resolved. Without this check,
        // the Firestore onSnapshot query fires with a non-null uid but
        // request.auth is null → permission-denied → subscription dies.
        try {
          const { getFirebaseAuth } = await import('../../lib/firebase');
          const currentUser = getFirebaseAuth()?.currentUser ?? null;
          if (!currentUser) {
            logger.warn('📨 Cloud subscription skipped: Firebase Auth not ready (cached UID available but Auth not authenticated) — scheduling retry');
            scheduleCloudRetry('Firebase Auth not authenticated');
            return;
          }
        } catch (authCheckError) {
          logger.debug('📨 Firebase Auth check failed (non-critical, proceeding):', authCheckError);
          // Proceed anyway — the error handler below will catch permission-denied
        }

        // ─────────────────────────────────────────────────────────
        // WHATSAPP-STYLE ARCHITECTURE: Direct conversations onSnapshot
        //
        // OLD (broken): user_inbox → discover conversations → subscribe to each
        //   Problem: inbox write race conditions, fallback scan hacks, dropped messages
        //
        // NEW (reliable): Single onSnapshot on conversations where user is participant
        //   - Firestore automatically notifies when new conversations appear
        //   - No inbox layer needed for message delivery
        //   - Same pattern that GroupChatService uses (proven to work)
        //   - Inbox still written for UI (unread counts) but NOT for delivery
        // ─────────────────────────────────────────────────────────
        logger.info(`📨 Setting up WhatsApp-style conversations subscription for uid=${uid}`);

        // Clean up previous top-level conversations query (so we get a fresh snapshot).
        // Per-conversation subscriptions are intentionally NOT cleared here — they have
        // their own internal retry logic and self-remove from conversationUnsubscribers
        // when they die (via the onSubError handler in subscribeToConversation).
        // Clearing them here would create a message gap while re-subscribing.
        if (conversationsListUnsubscriber) {
          try { conversationsListUnsubscriber(); } catch { /* no-op */ }
          conversationsListUnsubscriber = null;
        }

        const { collection, query: firestoreQuery, where, onSnapshot, getDocs } = await import('firebase/firestore');
        const { getFirestoreInstanceAsync } = await import('./firebase/FirebaseInstanceManager');
        const db = await getFirestoreInstanceAsync();
        if (!db || isDisposed) {
          scheduleCloudRetry('Firestore not available');
          return;
        }

        // Single onSnapshot on ALL conversations where user is a participant.
        // This fires immediately with existing conversations AND whenever
        // a new conversation is created with user as participant.
        const conversationsRef = collection(db, 'conversations');
        const q = firestoreQuery(
          conversationsRef,
          where('participants', 'array-contains', uid),
        );

        conversationsListUnsubscriber = onSnapshot(
          q,
          async (snapshot) => {
            if (isDisposed) return;

            // Reset retry count — subscription is alive
            cloudRetryCount = 0;

            const activeConvIds = new Set<string>();
            // Build a map of convId → type so we can skip group conversations below
            const convTypeMap = new Map<string, string>();
            snapshot.forEach((docSnap) => {
              activeConvIds.add(docSnap.id);
              const data = docSnap.data();
              if (data?.type) convTypeMap.set(docSnap.id, data.type);
            });

            // CRITICAL FIX: Sync conversation metadata to messageStore.
            // Previously, only conversation IDs were used (to set up message subscriptions),
            // but the conversation's metadata (participant names, last message) was discarded.
            // This meant new conversations didn't appear in MessagesScreen until a message
            // arrived AND was processed by pushCloudMessageToMeshStore. Now we proactively
            // create/update conversation entries from the Firestore snapshot.
            try {
              const { useMessageStore } = require('../stores/messageStore');
              snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (!data || !data.participants) return;

                // CRITICAL FIX: Skip group conversations — they're managed by GroupChatService.
                // Adding them to messageStore causes "phantom groups" in MessagesScreen
                // because groups appear TWICE: once from GroupChatService subscription and
                // once from this DM-oriented sync. Only sync 1-on-1 (DM) conversations here.
                if (data.type === 'group') return;

                // Find the OTHER participant's UID for DM conversations
                const otherUid = Array.isArray(data.participants)
                  ? data.participants.find((p: string) => p !== uid)
                  : null;
                if (!otherUid) return;
                const peerName = data.participantNames?.[otherUid] || data.name || '';
                useMessageStore.getState().addConversation({
                  userId: otherUid,
                  userName: peerName || otherUid.slice(0, 8) + '...',
                  // CRITICAL FIX: lastMessage may be an object (old group format: { content, from, fromName, timestamp })
                  // or a string (DM format / new group format). Handle both to prevent "[object Object]" display.
                  lastMessage: typeof data.lastMessage === 'string'
                    ? data.lastMessage
                    : (typeof data.lastMessage === 'object' && data.lastMessage !== null
                      ? ((data.lastMessage as any).content || '')
                      : (data.lastMessagePreview || '')),
                  lastMessageTime: data.lastMessageAt || data.updatedAt || Date.now(),
                  // O3 FIX: Don't pass unreadCount — let addConversation preserve
                  // existing value from MMKV. Real counts synced from user_inbox below.
                  conversationId: docSnap.id,
                });
              });

              // O3 FIX: Sync accurate unread counts from user_inbox/{uid}/threads.
              // The Cloud Function increments unreadCount there. After restart, MMKV might
              // have stale counts, and message dedup prevents re-counting. Single query
              // to get all thread docs with their unreadCount values.
              // AUDIT FIX: Throttle inbox sync — getDocs runs on every onSnapshot fire.
              // 20s throttle balances freshness vs Firestore read cost.
              const now = Date.now();
              if (db && !isDisposed && now - this.lastInboxSyncAt > 20000) {
                this.lastInboxSyncAt = now;
                try {
                  const inboxRef = collection(db, 'user_inbox', uid, 'threads');
                  const inboxSnapshot = await getDocs(inboxRef);
                  inboxSnapshot.forEach((threadDoc) => {
                    const threadData = threadDoc.data();
                    const cloudUnread = threadData?.unreadCount;
                    if (typeof cloudUnread === 'number' && cloudUnread > 0) {
                      const convId = threadDoc.id;
                      const store = useMessageStore.getState();
                      const existing = store.conversations.find(c => c.conversationId === convId);
                      if (existing && (existing.unreadCount || 0) < cloudUnread) {
                        store.addConversation({
                          ...existing,
                          unreadCount: cloudUnread,
                        });
                      }
                    }
                  });
                } catch (inboxErr) {
                  if (__DEV__) logger.debug('user_inbox unread count sync failed (non-critical):', inboxErr);
                }
              }
            } catch (syncError) {
              logger.debug('Conversation metadata sync to messageStore failed (non-critical):', syncError);
            }

            // Subscribe to new conversations' messages
            // CRITICAL FIX: Use Promise.allSettled instead of sequential await.
            // Previously, subscriptions were awaited one-by-one in a for loop.
            // If one subscription hung (slow Firestore init, network timeout),
            // ALL subsequent conversations were blocked — no messages received
            // for any conversation until the hanging one resolved/timed out.
            // Now all subscriptions are initiated in parallel.
            const subscriptionPromises: Promise<void>[] = [];
            for (const convId of activeConvIds) {
              if (!conversationUnsubscribers.has(convId)) {
                // CRITICAL FIX: Skip group conversations — managed by GroupChatService
                const convType = convTypeMap.get(convId);
                if (convType === 'group' || convId.startsWith('grp_')) {
                  continue;
                }
                subscriptionPromises.push(subscribeToConversation(convId, firebaseDataService));
              }
            }
            if (subscriptionPromises.length > 0) {
              await Promise.allSettled(subscriptionPromises);
            }

            // Unsubscribe from conversations user is no longer part of
            for (const [convId, unsub] of conversationUnsubscribers) {
              if (!activeConvIds.has(convId)) {
                try { unsub(); } catch { /* no-op */ }
                conversationUnsubscribers.delete(convId);
              }
            }

            logger.info(`📨 Conversations sync: ${activeConvIds.size} active, ${conversationUnsubscribers.size} subscribed`);
          },
          (error: any) => {
            const code = error?.code || '';
            if (code === 'permission-denied' || code === 'unauthenticated') {
              // CRITICAL FIX: Do NOT treat permission-denied as permanent.
              // On cold start, identityService.getUid() may return a cached UID
              // (from MMKV) before Firebase Auth token is fully resolved. This
              // causes the Firestore query to fire with a non-null uid but
              // request.auth is still null → permission-denied. After Firebase
              // Auth resolves (1-5 seconds), the subscription will succeed.
              // Previously this was marked as permanent → subscription DEAD forever
              // → messages never appeared in chat even though notifications arrived.
              logger.warn(`📨 Conversations subscription auth error (${code}) — scheduling retry (auth may still be resolving)`);
              conversationsListUnsubscriber = null;
              scheduleCloudRetry(`auth error: ${code}`);
              return;
            }
            logger.error('📨 Conversations subscription error:', error);
            conversationsListUnsubscriber = null;
            scheduleCloudRetry('conversations onSnapshot error');
          },
        );

        // ─────────────────────────────────────────────────────────
        // MESH/OFFLINE FALLBACK: Legacy Device Messages Listener
        //
        // Messages explicitly sent to 'devices/{deviceId}/messages'
        // due to missing UIDs (e.g. Offline QR Code scanning) are caught here.
        // ─────────────────────────────────────────────────────────
        if (legacyDeviceUnsubscriber) {
          try { legacyDeviceUnsubscriber(); } catch { /* no-op */ }
          legacyDeviceUnsubscriber = null;
        }

        const deviceId = identityService.getUid();
        if (deviceId) {
          logger.info(`📨 Setting up Legacy Device Message subscription for deviceId=${deviceId}`);

          legacyDeviceUnsubscriber = await firebaseDataService.subscribeToLegacyDeviceMessages(
            deviceId,
            (legacyMsgs: any[]) => {
              if (isDisposed) return;
              legacyMsgs.forEach((msg) => {
                // Determine conversation ID for routing (sender UID or Device ID)
                const senderId = typeof msg.senderUid === 'string' && msg.senderUid.trim() !== ''
                  ? msg.senderUid.trim()
                  : typeof msg.fromDeviceId === 'string'
                    ? msg.fromDeviceId.trim()
                    : 'unknown';

                // Process the legacy message and push it to mesh store
                processCloudMessage(msg, senderId);
              });
            }
          );
        } else {
          logger.warn(`📨 Legacy subscription skipped: no device ID found`);
        }

      } catch (error) {
        logger.warn('Cloud subscription failed:', error);
        scheduleCloudRetry('ensureCloudSubscriptions threw');
      } finally {
        isCloudSyncInProgress = false;
      }
    };

    // Store reference for foreground re-ensure (handleAppStateChange uses this)
    this.cloudEnsureRefresher = ensureCloudSubscriptions;

    const unsubscribeConnection = this.onConnectionChange((state) => {
      if (isDisposed) {
        return;
      }
      // CRITICAL FIX: Do NOT clear cloud subscriptions when going offline.
      // Firestore SDK handles offline mode internally via its persistence layer.
      // Clearing subscriptions on offline would kill the onSnapshot listeners,
      // preventing message delivery even when connectivity is restored.
      // We only re-ensure subscriptions on online transition to handle
      // edge cases like auth token refresh or identity changes.
      if (state === 'online') {
        ensureCloudSubscriptions().catch((error) => {
          logger.warn('Cloud resubscribe failed:', error);
        });
      }
    });

    await ensureCloudSubscriptions();

    return () => {
      isDisposed = true;
      this.cloudEnsureRefresher = null;
      unsubscribeMesh();
      unsubscribeConnection();
      clearCloudSubscriptions();
      if (cloudRetryTimer) {
        clearTimeout(cloudRetryTimer);
        cloudRetryTimer = null;
      }
    };
  }

  /**
   * P1: Handle incoming typing indicator
   */
  private handleTypingIndicator(userId: string, userName?: string): void {
    // Notify callbacks
    this.typingCallbacks.forEach(cb => cb(userId, userName, true));

    // Clear existing timer for this user
    const existingTimer = this.activeTypingUsers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      // CRITICAL FIX: Remove old timer from cleanupTimers to prevent unbounded Set growth.
      // Previously, each new typing event added a new timer to cleanupTimers without removing
      // the old one — a memory leak proportional to typing frequency.
      this.cleanupTimers.delete(existingTimer);
    }

    // Auto-clear after TYPING_AUTO_CLEAR_MS
    const timer = setTimeout(() => {
      this.typingCallbacks.forEach(cb => cb(userId, userName, false));
      this.activeTypingUsers.delete(userId);
      // CRITICAL FIX: Remove from cleanupTimers when fired naturally (prevents set growth)
      this.cleanupTimers.delete(timer);
    }, TYPING_AUTO_CLEAR_MS);

    this.activeTypingUsers.set(userId, timer);
    this.cleanupTimers.add(timer);
  }

  /**
   * Process queue with priority and backoff
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || !this.isActive) return;

    this.isProcessing = true;

    try {
      // CRITICAL FIX: Snapshot the queue under mutex, then release mutex for network I/O.
      // Previously, queueMutex was held for the entire loop including attemptSend (which
      // does Firestore writes, media uploads, and mesh broadcasts). This blocked ALL other
      // message operations (sendMessage, sendMediaMessage, processMessageImmediate) for
      // potentially 10+ seconds when multiple messages were queued. Users experienced
      // frozen send buttons and lost messages because new messages couldn't be added to the queue.
      const messagesToProcess: HybridMessage[] = await this.queueMutex.withLock(async () => {
        const now = Date.now();
        const sortedQueue = [...this.queue].sort((a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        );

        const eligible: HybridMessage[] = [];
        const isOnlineNow = connectionManager.isOnline;
        for (const msg of sortedQueue) {
          if (msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'read' || msg.status === 'sending') continue;
          // AUTO-RETRY FAILED MESSAGES: When connectivity is restored, automatically
          // resurrect failed messages instead of requiring manual user retry.
          // WhatsApp/Telegram behavior: failed messages retry transparently on reconnect.
          // Without this, failed messages sit in queue forever until retryAllFailed() is called.
          if (msg.status === 'failed') {
            if (isOnlineNow) {
              msg.status = 'pending';
              msg.retryCount = 0;
              msg.nextRetryAt = undefined;
              logger.info(`Auto-retrying failed message ${msg.id} (connectivity restored)`);
            } else {
              continue; // Still offline — leave as failed
            }
          }
          if (msg.nextRetryAt && now < msg.nextRetryAt) continue;

          if (msg.retryCount >= RETRY_MAX_ATTEMPTS) {
            if (this.shouldKeepRetryingAfterMaxAttempts(msg, connectionManager.isOnline)) {
              msg.retryCount = Math.max(RETRY_MAX_ATTEMPTS - 2, 0);
              msg.nextRetryAt = now + RETRY_MAX_DELAY_MS;
              msg.status = 'pending';
              continue;
            }
            this.updateMessageStatus(msg.id, 'failed');
            try {
              const { useMessageStore } = require('../stores/messageStore');
              useMessageStore.getState().updateMessageStatus(msg.id, 'failed');
            } catch { /* best-effort */ }
            continue;
          }

          eligible.push(msg);
        }
        return eligible;
      });

      // Process each message WITHOUT holding the mutex during network I/O
      for (const msg of messagesToProcess) {
        // Re-check status in case processMessageImmediate handled it concurrently
        if (msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'read' || msg.status === 'sending') continue;

        // Mark as 'sending' under mutex to prevent processMessageImmediate from double-sending
        const skipMsg = await this.queueMutex.withLock(async () => {
          if (msg.status === 'sending' || msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'read') {
            return true;
          }
          msg.status = 'sending';
          return false;
        });
        if (skipMsg) continue;

        const sendResult = await this.attemptSend(msg);
        const now = Date.now();

        // Acquire mutex only for the brief queue state mutation
        await this.queueMutex.withLock(async () => {
          if (sendResult === 'success') {
            this.updateMessageStatus(msg.id, 'sent');
            try {
              const { useMessageStore } = require('../stores/messageStore');
              useMessageStore.getState().updateMessageStatus(msg.id, 'sent');
              const { useMeshStore } = require('./mesh/MeshStore');
              useMeshStore.getState().updateMessage(msg.id, { status: 'sent' });
            } catch { /* best-effort */ }
          } else if (sendResult === 'permanent') {
            // PERMANENT FAILURE: Force-remove from queue (same logic as processMessageImmediate).
            // updateMessageStatus('failed') alone does NOT remove — only sent/delivered/read do.
            const permIdx = this.queue.findIndex(m => m.id === msg.id);
            if (permIdx >= 0) {
              this.queue.splice(permIdx, 1);
            }
            try {
              const { useMessageStore } = require('../stores/messageStore');
              useMessageStore.getState().updateMessageStatus(msg.id, 'failed');
              const { useMeshStore } = require('./mesh/MeshStore');
              useMeshStore.getState().updateMessage(msg.id, { status: 'failed' });
            } catch { /* best-effort */ }
            // Notify delivery callbacks
            const permCbs = this.deliveryCallbacks.get(msg.id);
            if (permCbs) {
              permCbs.forEach(cb => cb(msg.id, 'failed'));
              this.deliveryCallbacks.delete(msg.id);
            }
            logger.error(`🚫 processQueue: Message ${msg.id} permanently failed — removed from retry queue`);
          } else {
            // RETRYABLE FAILURE: Schedule retry
            msg.status = 'pending'; // Reset from 'sending' so future queue cycles can retry
            msg.retryCount++;
            msg.lastRetryAt = now;
            msg.nextRetryAt = now + this.calculateNextRetryDelay(msg.retryCount);
            const meshRouted = typeof msg.meshRoutedAt === 'number';
            try {
              const { useMessageStore } = require('../stores/messageStore');
              const { useMeshStore } = require('./mesh/MeshStore');
              if (meshRouted) {
                useMessageStore.getState().updateMessageStatus(msg.id, 'sent');
                useMeshStore.getState().updateMessage(msg.id, { status: 'sent' });
              } else {
                useMessageStore.getState().updateMessageStatus(msg.id, 'pending');
                useMeshStore.getState().updateMessage(msg.id, { status: 'pending' });
              }
            } catch { /* best-effort */ }
          }
        });
      }

      // Safety-net: evict stale 'failed' messages older than 24h to prevent unbounded
      // queue growth. Users can still manually retry from the UI store; this only cleans
      // the background retry queue.
      const STALE_FAILED_TTL = 24 * 60 * 60 * 1000; // 24 hours
      const evictNow = Date.now();
      for (let i = this.queue.length - 1; i >= 0; i--) {
        const m = this.queue[i];
        if (m.status === 'failed' && m.lastRetryAt && (evictNow - m.lastRetryAt) > STALE_FAILED_TTL) {
          logger.warn(`🧹 Evicting stale failed message ${m.id} from queue (last retry ${Math.round((evictNow - m.lastRetryAt) / 3600000)}h ago)`);
          this.queue.splice(i, 1);
        }
      }

      // CRITICAL FIX: Use immediate save, not debounced, to persist retry state mutations.
      // Debounced save has a 2s window where app crash loses retryCount/nextRetryAt changes,
      // causing messages to reset their backoff on restart.
      await this.saveQueueImmediate();
    } catch (error) {
      logger.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): 'online' | 'mesh' | 'offline' {
    const isOnline = connectionManager.isOnline;
    const meshState = useMeshStore.getState();
    const meshConnected = meshState.isConnected || (Array.isArray(meshState.peers) && meshState.peers.length > 0);

    if (isOnline) return 'online';
    if (meshConnected) return 'mesh';
    return 'offline';
  }

  /**
   * Get pending message count
   */
  getPendingCount(): number {
    return this.queue.filter(m => m.status === 'pending' || m.status === 'sending').length;
  }

  /**
   * Get failed message count
   */
  getFailedCount(): number {
    return this.queue.filter(m => m.status === 'failed').length;
  }

  /**
   * Retry all failed messages
   */
  async retryAllFailed(): Promise<void> {
    await this.queueMutex.withLock(async () => {
      const failedMessages = this.queue.filter(m => m.status === 'failed');
      for (const msg of failedMessages) {
        msg.status = 'pending';
        msg.retryCount = 0;
        msg.nextRetryAt = undefined;
      }
      this.saveQueueDebounced();
    });
    this.processQueue();
  }

  // CRITICAL FIX: User-scoped storage keys to prevent cross-account data leak.
  // Without this, after account switch the new user inherits the previous user's
  // pending message queue and seen IDs (wrong messages sent under wrong identity).
  private getScopedKey(baseKey: string): string {
    // FIX: Use cachedUid first (survives auth clear during destroy()),
    // then fall back to live identityService.getUid()
    const uid = this.cachedUid || identityService.getUid?.();
    return uid ? `${baseKey}:${uid}` : baseKey;
  }

  // P2: Debounced save
  private saveQueueDebounced(): void {
    this.saveDebouncer.schedule(() => this.saveQueueImmediate());
  }

  private async saveQueueImmediate(): Promise<void> {
    try {
      DirectStorage.setString(this.getScopedKey(STORAGE_KEYS.MESSAGE_QUEUE), JSON.stringify(this.queue));
    } catch (e) {
      logger.error('Failed to save queue', e);
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const scopedKey = this.getScopedKey(STORAGE_KEYS.MESSAGE_QUEUE);
      const data = DirectStorage.getString(scopedKey) ?? null;
      if (data) {
        const parsed = JSON.parse(data);
        this.queue = Array.isArray(parsed) ? parsed : [];
      } else {
        // Migration: Try loading from legacy unscoped key
        const legacyData = DirectStorage.getString(STORAGE_KEYS.MESSAGE_QUEUE) ?? null;
        if (legacyData && scopedKey !== STORAGE_KEYS.MESSAGE_QUEUE) {
          const parsed = JSON.parse(legacyData);
          this.queue = Array.isArray(parsed) ? parsed : [];
          // Save to scoped key and remove legacy
          DirectStorage.setString(scopedKey, legacyData);
          DirectStorage.delete(STORAGE_KEYS.MESSAGE_QUEUE);
          logger.info('Migrated message queue to user-scoped key');
        }
      }
      // CRITICAL: Reset any 'sending' messages back to 'pending'.
      // If the app was killed during attemptSend, messages are persisted with
      // status='sending' and would be skipped forever by processQueue.
      // Clean up 'sent'/'delivered'/'read' messages that should have been removed
      // on completion but were persisted before the queue-removal fix.
      // 'failed' messages are intentionally kept — retryAllFailed() can resurrect them.
      const beforeLen = this.queue.length;
      this.queue = this.queue.filter(msg => {
        // Remove completed states that should have been cleaned up
        if (msg.status === 'sent' || msg.status === 'delivered' || msg.status === 'read') {
          return false;
        }
        return true;
      });
      for (const msg of this.queue) {
        if (msg.status === 'sending') {
          msg.status = 'pending';
        }
      }
      if (this.queue.length !== beforeLen) {
        logger.info(`Queue cleanup: removed ${beforeLen - this.queue.length} completed messages`);
      }
      if (this.queue.length > 0) {
        const pendingCount = this.queue.filter(m => m.status === 'pending').length;
        const failedCount = this.queue.filter(m => m.status === 'failed').length;
        logger.info(`Loaded ${this.queue.length} messages from outbox (${pendingCount} pending, ${failedCount} failed)`);
      }
    } catch (e) {
      logger.error('Failed to load queue', e);
    }
  }

  private saveSeenIdsDebounced(): void {
    // FIX: Use separate debouncer to prevent collision with queue save
    this.seenIdsSaveDebouncer.schedule(() => this.saveSeenIdsImmediate());
  }

  private async saveSeenIdsImmediate(): Promise<void> {
    try {
      DirectStorage.setString(
        this.getScopedKey(STORAGE_KEYS.SEEN_MESSAGE_IDS),
        JSON.stringify(this.seenMessageIds.toArray())
      );
    } catch (e) {
      logger.error('Failed to save seen IDs', e);
    }
  }

  private async loadSeenIds(): Promise<void> {
    try {
      const scopedKey = this.getScopedKey(STORAGE_KEYS.SEEN_MESSAGE_IDS);
      const data = DirectStorage.getString(scopedKey) ?? null;
      if (data) {
        const parsed = JSON.parse(data);
        const ids: string[] = Array.isArray(parsed) ? parsed : [];
        this.seenMessageIds.fromArray(ids);
      } else {
        // Migration: Try loading from legacy unscoped key
        const legacyData = DirectStorage.getString(STORAGE_KEYS.SEEN_MESSAGE_IDS) ?? null;
        if (legacyData && scopedKey !== STORAGE_KEYS.SEEN_MESSAGE_IDS) {
          const parsed = JSON.parse(legacyData);
          const ids: string[] = Array.isArray(parsed) ? parsed : [];
          this.seenMessageIds.fromArray(ids);
          DirectStorage.setString(scopedKey, legacyData);
          DirectStorage.delete(STORAGE_KEYS.SEEN_MESSAGE_IDS);
          logger.info('Migrated seen IDs to user-scoped key');
        }
      }
    } catch (e) {
      logger.error('Failed to load seen IDs', e);
    }
  }
}

export const hybridMessageService = new HybridMessageService();
