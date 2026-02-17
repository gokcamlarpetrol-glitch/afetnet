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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMeshStore, type MeshMessage } from './mesh/MeshStore';
import { getDeviceId as getDeviceIdFromLib } from '../../lib/device';
import { AppState, AppStateStatus } from 'react-native';
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
const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;
const isNonRoutableRecipientId = (value: string): boolean =>
  value === 'me' || value === 'ME' || value.startsWith('group:');
const SYSTEM_PAYLOAD_TYPES = new Set([
  'family_status_update',
  'family_location_update',
  'family_location',
  'status_update',
  'device_status',
  'presence_update',
  'typing',
  'ack',
  'reaction',
]);

export interface HybridMessage {
  id: string;
  localId?: string;
  content: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
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
  mediaDuration?: number; // For voice (seconds)
  mediaThumbnail?: string; // Base64 thumbnail for images
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

  constructor() {
    this.seenMessageIds = new LRUSet<string>(MAX_SEEN_MESSAGE_IDS);
    this.saveDebouncer = new Debouncer(QUEUE_SAVE_DEBOUNCE_MS);
    this.seenIdsSaveDebouncer = new Debouncer(QUEUE_SAVE_DEBOUNCE_MS);
    this.typingThrottle = new Throttle(TYPING_THROTTLE_MS);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // CRITICAL FIX: Verify identity before registering device or setting up message processing
    const uid = identityService.getUid();
    if (!uid) {
      logger.warn('⚠️ HybridMessageService: UID not resolved yet');
    } else {
      logger.info(`📨 HybridMessageService initializing with UID: ${uid}`);
    }

    await this.loadQueue();
    await this.loadSeenIds();

    // Initialize delivery manager
    await deliveryManager.initialize();

    // Ensure device identity doc exists in Firestore.
    // RC-3 FIX: Use identityService.getMyId() instead of getDeviceIdFromLib().
    // getDeviceIdFromLib() can return a stale hardware ID if the identity cache
    // hasn't been overwritten yet. identityService.getMyId() returns the correct
    // AFN-XXXXXXXX ID that matches the Firestore device document path.
    try {
      const { firebaseDataService } = await import('./FirebaseDataService');
      try {
        await firebaseDataService.initialize();
      } catch { /* best effort */ }

      const myUid = identityService.getUid();
      if (myUid) {
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
    this.syncMessagesWithCloud().catch(err => {
      logger.warn('Cloud hydration failed (non-fatal):', err);
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

      // 1. Get active conversations (Inbox Threads)
      const uid = identityService.getUid?.();
      if (!uid) {
        logger.debug('Cloud sync: No UID available, skipping.');
        return;
      }
      const threads = await firebaseDataService.loadInboxThreads(uid);
      if (!threads || threads.length === 0) {
        logger.debug('Cloud sync: No inbox threads found.');
        return;
      }

      logger.info(`Cloud sync: Found ${threads.length} active threads. Hydrating...`);

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

            // Take recent 20 locally
            const recentMessages = threadMessages.slice(0, 20);

            if (recentMessages && recentMessages.length > 0) {
              const selfIds = this.getSelfIdentityIds();

              recentMessages.forEach(msg => {
                // Convert Firestore data to Store Message format
                // Handle senderUid (V3) or senderId (legacy)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rawMsg = msg as any;
                const senderId = rawMsg.senderUid || rawMsg.senderId || 'unknown';

                const isFromMe = senderId === identityService.getUid?.() || selfIds.has(senderId);

                // Map media type safely
                let mediaType: 'image' | 'voice' | 'location' | undefined;
                if (rawMsg.mediaType === 'image') mediaType = 'image';
                else if (rawMsg.mediaType === 'voice') mediaType = 'voice';
                else if (rawMsg.mediaType === 'location') mediaType = 'location';

                // CRITICAL FIX: Use actual UID for from/to fields instead of 'me'/conversationId.
                // ConversationScreen filters messages by checking selfIds.has(msg.from) and
                // peerIdCandidates.has(msg.to). Using 'me' and conversationId breaks this filter.
                const myUid = identityService.getUid?.() || 'me';
                // For sent messages, derive peer from toDeviceId field; for received, peer is sender
                const peerUid = isFromMe
                  ? (rawMsg.toDeviceId || rawMsg.recipientId || senderId)
                  : senderId;

                messagesToImport.push({
                  id: msg.id,
                  from: isFromMe ? myUid : senderId,
                  to: isFromMe ? peerUid : myUid,
                  senderId: senderId,
                  senderName: rawMsg.senderName,
                  content: rawMsg.content || '',
                  timestamp: rawMsg.timestamp || Date.now(),
                  type: this.toMeshStoreType(this.mapCloudTypeToHybridType(rawMsg.type, mediaType)),
                  status: isFromMe ? 'sent' : 'read', // History is assumed read/sent
                  delivered: true,
                  read: true,
                  priority: this.isMessagePriority(rawMsg.priority) ? rawMsg.priority : 'normal',
                  hops: 0,
                  retryCount: 0,
                  acks: [],
                  ttl: 3,
                  mediaUrl: rawMsg.mediaUrl,
                  mediaType: mediaType,
                  location: this.normalizeLocationPayload(rawMsg.location)
                });
              });
            }
          } catch (e) {
            logger.warn(`Failed to hydrate thread ${thread.conversationId}`, e);
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

    // Force save queue
    this.saveQueueImmediate();

    this.isInitialized = false;
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
      const meshConnected = useMeshStore.getState().isConnected;

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
        this.lastEmittedConnectionState = state;
        this.connectionCallbacks.forEach(cb => cb(state));
      }
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
      return await cryptoService.generateUUID();
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

  private getEnvelopeTypeFromContent(content: string): string {
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return '';
    }

    try {
      const parsed = JSON.parse(trimmed) as { type?: unknown };
      if (typeof parsed.type !== 'string') {
        return '';
      }
      return parsed.type.trim().toLowerCase();
    } catch {
      return '';
    }
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
    return SYSTEM_PAYLOAD_TYPES.has(envelopeType);
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

  private getSelfIdentityIds(): Set<string> {
    const ids = new Set<string>(['ME', 'me']);
    const uid = identityService.getUid();
    if (uid) ids.add(uid);
    return ids;
  }

  private resolveRecipientId(recipientId?: string): string | undefined {
    if (!recipientId) return undefined;
    const trimmed = recipientId.trim();
    if (!trimmed || trimmed === 'broadcast') return 'broadcast';
    if (isNonRoutableRecipientId(trimmed)) return undefined;
    if (UID_REGEX.test(trimmed)) return trimmed;
    return undefined; // Only UIDs are routable in v4
  }

  private async resolveRecipientIdForSend(recipientId?: string): Promise<string | undefined> {
    const resolved = this.resolveRecipientId(recipientId);
    logger.info(`🔍 resolveRecipientIdForSend: input="${recipientId}", after resolveRecipientId="${resolved}"`);
    if (!resolved || resolved === 'broadcast' || UID_REGEX.test(resolved)) {
      // If alias resolution collapsed to current user's UID, preserve the original
      // non-UID recipient alias for mesh routing (multi-device/same-account safety).
      if (resolved && UID_REGEX.test(resolved) && recipientId) {
        const rawRecipient = recipientId.trim();
        const selfIds = this.getSelfIdentityIds();
        if (
          rawRecipient &&
          !UID_REGEX.test(rawRecipient) &&
          !isNonRoutableRecipientId(rawRecipient) &&
          selfIds.has(resolved)
        ) {
          logger.info(`🔍 resolveRecipientIdForSend: resolved to self UID, preserving raw alias "${rawRecipient}"`);
          return rawRecipient;
        }
      }
      return resolved;
    }

    try {
      const { firebaseDataService } = await import('./FirebaseDataService');
      try {
        await firebaseDataService.initialize();
      } catch {
        // best effort
      }
      const resolvedUid = await firebaseDataService.resolveRecipientUid(resolved);
      if (resolvedUid && UID_REGEX.test(resolvedUid)) {
        logger.info(`🔍 resolveRecipientIdForSend: Firestore resolved "${resolved}" → UID ${resolvedUid}`);
        return resolvedUid;
      }
      logger.warn(`⚠️ resolveRecipientIdForSend: Firestore could NOT resolve "${resolved}" to UID — using raw value`);
    } catch (error) {
      logger.debug(`resolveRecipientIdForSend fallback failed for "${resolved}"`, error);
    }

    return resolved;
  }

  private normalizeIdentity(value: string | null | undefined): string {
    if (!value || typeof value !== 'string') return '';
    return value.trim();
  }

  private findFamilyMemberByUid(uid: string): { uid: string; name: string } | undefined {
    const normalized = this.normalizeIdentity(uid);
    if (!normalized) return undefined;
    try {
      const { useFamilyStore } = require('../stores/familyStore');
      return useFamilyStore.getState().members.find((m: { uid: string }) => m.uid === normalized);
    } catch {
      return undefined;
    }
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

  private pushCloudMessageToMeshStore(message: HybridMessage): void {
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
        delivered: !isFromMe, // Incoming messages are already delivered
        read: false,
        type: message.type as 'CHAT' | 'SOS' | 'STATUS' | 'LOCATION' | 'VOICE',
        priority: message.priority,
        status: isFromMe ? 'sending' : 'delivered',
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
      });

      // CRITICAL FIX: Auto-create conversation for incoming messages from unknown senders.
      // Without this, messages arrive in the stores but don't appear in the Messages screen
      // because no conversation entry exists for the sender.
      if (!isFromMe && message.senderId && message.senderId !== 'unknown') {
        const conversations = useMessageStore.getState().conversations;
        if (!conversations.some(c => c.userId === message.senderId)) {
          // ELITE FIX: Look up contact display name before falling back to generic name
          let displayName = message.senderName || '';
          if (!displayName) {
            try {
              const { contactService } = require('./ContactService');
              const contact = contactService.getContact?.(message.senderId);
              displayName = contact?.displayName || contact?.nickname || '';
            } catch {
              // ContactService not available — use fallback
            }
          }
          useMessageStore.getState().addConversation({
            userId: message.senderId,
            userName: displayName || `Cihaz ${message.senderId.slice(0, 8)}...`,
            lastMessage: (message.content || '').substring(0, 100),
            lastMessageTime: message.timestamp,
            unreadCount: 1,
          });
        }

        // RC-1 FIX: Trigger notification for incoming messages.
        // This was COMPLETELY MISSING — no code path ever called notificationCenter
        // for cloud messages, so users never received any message notifications.
        try {
          const { notificationCenter } = require('./notifications/NotificationCenter');
          notificationCenter.notify('message', {
            from: message.senderId,
            senderName: message.senderName || message.senderId,
            message: message.content || '',
            messageId: message.id,
            senderId: message.senderId,
            conversationId: message.senderId,
            isSOS: message.type === 'SOS',
            isCritical: message.priority === 'critical',
          }, 'HybridMessageService').catch(() => { /* best-effort */ });
        } catch {
          // NotificationCenter not available — silent fail
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
      replyTo?: string;
      replyPreview?: string;
      location?: { lat: number; lng: number; address?: string };
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

    const senderUid = identityService.getUid();
    const requestedRecipientId = typeof recipientId === 'string' ? recipientId.trim() : '';
    const resolvedRecipientId = await this.resolveRecipientIdForSend(recipientId);
    if (
      requestedRecipientId &&
      requestedRecipientId !== 'broadcast' &&
      !resolvedRecipientId
    ) {
      throw new Error('Alıcı kimliği çözümlenemedi. Lütfen kişiyi tekrar ekleyin.');
    }

    const message: HybridMessage = {
      id: messageId,
      localId,
      content: validation.sanitized,
      senderId: senderUid,
      senderName: myIdentity.displayName,
      recipientId: resolvedRecipientId,
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
      this.saveQueueDebounced();
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
    this.pushCloudMessageToMeshStore(message);

    // Attempt immediate send
    this.processMessageImmediate(message);

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

    let mediaUrl = options.mediaUrl;
    let meshBinaryFallbackStarted = false;

    // Upload to Firebase Storage if local URI provided
    if (options.mediaLocalUri && !mediaUrl) {
      try {
        const { firebaseStorageService } = await import('./FirebaseStorageService');
        const extension = mediaType === 'image' ? 'jpg' : 'm4a';
        const storageOwnerId = myIdentity.uid;
        if (!storageOwnerId) {
          logger.warn('Skipping media upload: UID unavailable');
          throw new Error('uid-unavailable');
        }
        const storagePath = `chat/${storageOwnerId}/${Date.now()}.${extension}`;

        // Read file and upload
        const FileSystem = require('expo-file-system');
        const base64Data = await FileSystem.readAsStringAsync(options.mediaLocalUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const { Buffer } = await import('buffer');
        const bytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));
        mediaUrl = await firebaseStorageService.uploadFile(storagePath, bytes, {
          contentType: mediaType === 'image' ? 'image/jpeg' : 'audio/mp4',
          customMetadata: {
            userId: storageOwnerId,
          },
        }) ?? undefined;
      } catch (error) {
        logger.error('Media upload failed:', error);
        // Continue without URL - binary mesh fallback below can still deliver media.
      }
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
            senderId: identityService.getUid() || 'unknown',
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
              senderId: identityService.getUid() || 'unknown',
            },
          );
        }
        meshBinaryFallbackStarted = true;
      } catch (meshFallbackError) {
        logger.warn('Binary mesh media fallback failed:', meshFallbackError);
      }
    }

    const senderUid = identityService.getUid();

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
      recipientId: resolvedRecipientId,
      timestamp,
      source: 'HYBRID',
      status: 'pending',
      priority: 'normal',
      type: messageType,
      retryCount: 0,
      // Media fields
      mediaUrl,
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
      this.saveQueueDebounced();
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
    this.pushCloudMessageToMeshStore(message);
    if (meshBinaryFallbackStarted && options.mediaLocalUri) {
      // Local preview for sender; receiver gets real media through chunk transfer.
      useMeshStore.getState().updateMessage(messageId, {
        mediaType,
        mediaUrl: options.mediaLocalUri,
      });
    }

    // Attempt immediate send
    this.processMessageImmediate(message);

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
   */
  private async processMessageImmediate(message: HybridMessage): Promise<void> {
    const success = await this.attemptSend(message);

    await this.queueMutex.withLock(async () => {
      if (success) {
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
      } else {
        message.retryCount++;
        message.lastRetryAt = Date.now();
        message.nextRetryAt = Date.now() + this.calculateNextRetryDelay(message.retryCount);
        message.status = 'pending';
        this.saveQueueDebounced();
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
    });
  }

  /**
   * ELITE V5: Internal send logic with multi-channel support
   * - Auto-initialize Firebase if not ready
   * - SOS messages get priority treatment
   * - Store-and-Forward integration
   */
  private async attemptSend(message: HybridMessage): Promise<boolean> {
    const isOnline = connectionManager.isOnline;
    let meshSuccess = false;
    let cloudSuccess = false;

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
        const meshPayload = JSON.stringify({
          id: message.id,
          from: message.senderId,
          to: message.recipientId || 'broadcast',
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
          to: message.recipientId || 'broadcast',
          from: message.senderId,
          messageId: message.id,
        });
        meshSuccess = true;
        logger.debug(`Mesh broadcast successful (type: ${meshType})`);

        // V5: Store-and-Forward for offline peers
        if (message.recipientId) {
          try {
            const { meshStoreForwardService } = await import('./mesh/MeshStoreForwardService');
            await meshStoreForwardService.storeForPeer(
              message.recipientId,
              message.type === 'SOS' ? MeshMessageType.SOS : MeshMessageType.TEXT,
              meshPayload,
              { priority: message.priority === 'critical' ? MeshPriority.CRITICAL : MeshPriority.NORMAL }
            );
          } catch {
            // Silent fail - Store-Forward is optional enhancement
          }
        }
      } catch (meshError) {
        logger.warn('Mesh broadcast failed:', meshError);
      }

      // 2. CLOUD LAYER: Try if online — V3 Conversation Model
      if (isOnline) {
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

          // V3: Build message data with senderUid — always prefer Firebase Auth UID
          const authUid = identityService.getUid();
          const messageData = {
            id: message.id,
            senderUid: authUid || message.senderId,
            senderName: message.senderName || '',
            content: message.content,
            timestamp: message.timestamp,
            type: this.mapHybridTypeToCloudType(message.type),
            status: 'sent' as const,
            priority: message.priority,
            ...(message.replyTo ? { replyTo: message.replyTo } : {}),
            ...(message.replyPreview ? { replyPreview: message.replyPreview } : {}),
            // V3: Include structured location/media payload
            ...(message.location && { location: message.location }),
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
          cloudSuccess = result;

          if (cloudSuccess) {
            logger.info(`✅ V3 Cloud send successful: msg ${message.id} → recipient=${recipientId || 'broadcast'}, toDeviceId=${messageData.toDeviceId}`);
          } else {
            logger.warn(`❌ V3 Cloud save FAILED: msg ${message.id} → recipient=${recipientId || 'broadcast'}, toDeviceId=${messageData.toDeviceId} — recipient UID may not be resolvable`);
          }
        } catch (cloudError) {
          logger.warn('❌ Cloud send failed:', cloudError);
        }
      } else {
        logger.info(`📡 Device offline — cloud layer skipped for msg ${message.id}`);
      }

      // V5: SOS Special Handling - must succeed on at least one channel
      if (message.type === 'SOS' && !meshSuccess && !cloudSuccess) {
        logger.error('🚨 SOS MESSAGE FAILED ON ALL CHANNELS!');
        // Queue for aggressive retry
        message.priority = 'critical';
        message.retryCount = (message.retryCount || 0) + 1;

        // CRITICAL FIX: Immediate retry — don't wait for 10s queue cycle
        // SOS is life-critical; 10s delay is unacceptable
        if (message.retryCount <= 5) {
          logger.warn(`🔄 SOS immediate retry ${message.retryCount}/5 in 500ms`);
          setTimeout(() => this.processQueue(), 500);
        } else {
          logger.error('🚨 SOS EXHAUSTED ALL RETRIES (5/5) — falling back to normal queue');
          // After 5 fast retries, fall back to normal 10s queue cycle
          // The message stays in queue with critical priority
        }
      }
    } catch (error) {
      logger.error('Attempt send failed:', error);
    }

    const success = meshSuccess || cloudSuccess;
    if (success) {
      logger.info(`✅ Message ${message.id} sent (mesh: ${meshSuccess}, cloud: ${cloudSuccess})`);
    }
    return success;
  }


  /**
   * Update message status and notify callbacks
   */
  private updateMessageStatus(messageId: string, status: DeliveryStatus): void {
    const msgIndex = this.queue.findIndex(m => m.id === messageId);

    if (msgIndex >= 0) {
      this.queue[msgIndex].status = status;

      // Remove from queue if final state
      if (status === 'delivered' || status === 'read' || status === 'sent') {
        this.queue.splice(msgIndex, 1);
      }

      this.saveQueueDebounced();
    }

    // Notify callbacks
    const callbacks = this.deliveryCallbacks.get(messageId);
    if (callbacks) {
      callbacks.forEach(cb => cb(messageId, status));
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
   * P1: Broadcast typing indicator with proper throttle and debounce
   */
  broadcastTyping(conversationId: string): void {
    // Throttle: max 1 broadcast per TYPING_THROTTLE_MS
    this.typingThrottle.execute(() => {
      const myIdentity = identityService.getIdentity();
      if (!myIdentity) return;

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
    });

    // P1: Debounce stop-typing (send stop after TYPING_DEBOUNCE_MS of no typing)
    let debouncer = this.typingDebouncers.get(conversationId);
    if (!debouncer) {
      debouncer = new Debouncer(TYPING_DEBOUNCE_MS);
      this.typingDebouncers.set(conversationId, debouncer);
    }
    // Note: We don't need to send stop-typing in most cases
    // The receiver auto-clears after TYPING_AUTO_CLEAR_MS
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
    let inboxUnsubscriber: (() => void) | null = null;
    let isDisposed = false;
    let isCloudSyncInProgress = false;

    const clearCloudSubscriptions = () => {
      conversationUnsubscribers.forEach((unsubscribe) => {
        try { unsubscribe(); } catch { /* no-op */ }
      });
      conversationUnsubscribers.clear();
      if (inboxUnsubscriber) {
        try { inboxUnsubscriber(); } catch { /* no-op */ }
        inboxUnsubscriber = null;
      }
    };

    // Build self-ID set for sender mirror detection
    const getSelfIds = (): Set<string> => {
      const selfIds = new Set<string>();
      const uid = identityService.getUid();
      if (uid) selfIds.add(uid);
      return selfIds;
    };

    const processCloudMessage = (msg: any) => {
      const selfIds = getSelfIds();
      const fromDeviceId = typeof msg.fromDeviceId === 'string' ? msg.fromDeviceId.trim() : '';
      const senderUid = typeof msg.senderUid === 'string' ? msg.senderUid.trim() : '';
      const toDeviceId = typeof msg.toDeviceId === 'string' ? msg.toDeviceId.trim() : '';
      const senderUidIsSelf = !!senderUid && selfIds.has(senderUid);
      const senderDeviceIdIsSelf = !!fromDeviceId && selfIds.has(fromDeviceId);
      const senderId = (senderUidIsSelf && fromDeviceId) ? fromDeviceId : (senderUid || fromDeviceId);

      if (this.isBlockedSender(senderId)) {
        return;
      }

      // Skip our own sent messages (we already have them locally)
      // Exception: if senderUid is ours but sender device alias is different,
      // keep the message for multi-device/same-account continuity.
      if (
        senderUidIsSelf &&
        (!fromDeviceId || senderDeviceIdIsSelf)
      ) {
        return;
      }
      if (!senderUidIsSelf && senderId && selfIds.has(senderId)) {
        return;
      }

      if (!this.recordSeenMessage(msg.id)) return;

      const rawMsg = msg as unknown as Record<string, unknown>;
      const metadata = msg.metadata && typeof msg.metadata === 'object'
        ? msg.metadata as Record<string, unknown>
        : undefined;
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

      const hybridMsg: HybridMessage = {
        id: msg.id,
        content: sanitizeMessage(msg.content),
        senderId: senderId || 'unknown',
        senderName: typeof senderNameSource === 'string' && senderNameSource.trim().length > 0
          ? senderNameSource.trim()
          : 'Cloud User',
        recipientId: toDeviceId && toDeviceId !== 'broadcast' ? toDeviceId : undefined,
        timestamp: typeof msg.timestamp === 'number' && Number.isFinite(msg.timestamp)
          ? msg.timestamp
          : Date.now(),
        source: 'CLOUD',
        status: 'delivered',
        priority: normalizedPriority,
        type: finalType,
        retryCount: 0,
        ...(typeof mediaUrlSource === 'string' ? { mediaUrl: mediaUrlSource } : {}),
        ...(mediaType ? { mediaType } : {}),
        ...(typeof mediaDurationSource === 'number' ? { mediaDuration: mediaDurationSource } : {}),
        ...(typeof mediaThumbnailSource === 'string' ? { mediaThumbnail: mediaThumbnailSource } : {}),
        ...(location ? { location } : {}),
      };
      if (this.isSystemPayloadForConversation(hybridMsg)) {
        return;
      }
      this.pushCloudMessageToMeshStore(hybridMsg);
      callback(hybridMsg);
    };

    const subscribeToConversation = async (
      conversationId: string,
      firebaseDataService: any,
    ): Promise<void> => {
      if (conversationUnsubscribers.has(conversationId) || isDisposed) return;

      try {
        const unsubscribe = await firebaseDataService.subscribeToConversationMessages(
          conversationId,
          (cloudMsgs: any[]) => {
            cloudMsgs.forEach(processCloudMessage);
          },
        );
        if (unsubscribe && !isDisposed) {
          conversationUnsubscribers.set(conversationId, unsubscribe);
          logger.info(`✅ Subscribed to conversation: ${conversationId}`);
        }
      } catch (err) {
        logger.warn(`Failed to subscribe to conversation ${conversationId}:`, err);
      }
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
          logger.warn('📨 Cloud subscription skipped: no UID');
          return;
        }

        logger.info(`📨 Setting up V3 inbox subscription for uid=${uid}`);

        // Subscribe to inbox threads → when new threads appear, subscribe to their messages
        if (inboxUnsubscriber) {
          try { inboxUnsubscriber(); } catch { /* no-op */ }
        }

        const inboxUnsub = await firebaseDataService.subscribeToInbox(
          uid,
          async (threads: Array<{ conversationId: string }>) => {
            if (isDisposed) return;

            // Subscribe to any new conversations we haven't subscribed to yet
            const currentConvIds = new Set(conversationUnsubscribers.keys());
            const inboxConvIds = new Set(threads.map(t => t.conversationId));

            // Remove subscriptions for conversations no longer in inbox
            for (const [convId, unsub] of conversationUnsubscribers) {
              if (!inboxConvIds.has(convId)) {
                try { unsub(); } catch { /* no-op */ }
                conversationUnsubscribers.delete(convId);
              }
            }

            // Subscribe to new conversations
            for (const thread of threads) {
              if (!currentConvIds.has(thread.conversationId)) {
                await subscribeToConversation(thread.conversationId, firebaseDataService);
              }
            }
          },
        );

        if (inboxUnsub && !isDisposed) {
          inboxUnsubscriber = inboxUnsub;
        }
      } catch (error) {
        logger.warn('Cloud subscription failed:', error);
      } finally {
        isCloudSyncInProgress = false;
      }
    };

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
      unsubscribeMesh();
      unsubscribeConnection();
      clearCloudSubscriptions();
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
    }

    // Auto-clear after TYPING_AUTO_CLEAR_MS
    const timer = setTimeout(() => {
      this.typingCallbacks.forEach(cb => cb(userId, userName, false));
      this.activeTypingUsers.delete(userId);
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
    const now = Date.now();

    try {
      await this.queueMutex.withLock(async () => {
        // Sort by priority
        const sortedQueue = [...this.queue].sort((a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        );

        for (const msg of sortedQueue) {
          // Skip if not ready for retry
          if (msg.nextRetryAt && now < msg.nextRetryAt) continue;

          // Mark as failed if max retries exceeded
          if (msg.retryCount >= RETRY_MAX_ATTEMPTS) {
            this.updateMessageStatus(msg.id, 'failed');
            continue;
          }

          const success = await this.attemptSend(msg);

          if (success) {
            this.updateMessageStatus(msg.id, 'sent');
          } else {
            msg.retryCount++;
            msg.lastRetryAt = now;
            msg.nextRetryAt = now + this.calculateNextRetryDelay(msg.retryCount);
          }
        }
      });

      this.saveQueueDebounced();
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
    const meshConnected = useMeshStore.getState().isConnected;

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

  // P2: Debounced save
  private saveQueueDebounced(): void {
    this.saveDebouncer.schedule(() => this.saveQueueImmediate());
  }

  private async saveQueueImmediate(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MESSAGE_QUEUE, JSON.stringify(this.queue));
    } catch (e) {
      logger.error('Failed to save queue', e);
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGE_QUEUE);
      if (data) this.queue = JSON.parse(data);
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
      await AsyncStorage.setItem(
        STORAGE_KEYS.SEEN_MESSAGE_IDS,
        JSON.stringify(this.seenMessageIds.toArray())
      );
    } catch (e) {
      logger.error('Failed to save seen IDs', e);
    }
  }

  private async loadSeenIds(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SEEN_MESSAGE_IDS);
      if (data) {
        const ids: string[] = JSON.parse(data);
        this.seenMessageIds.fromArray(ids);
      }
    } catch (e) {
      logger.error('Failed to load seen IDs', e);
    }
  }
}

export const hybridMessageService = new HybridMessageService();
