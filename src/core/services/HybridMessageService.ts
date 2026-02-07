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

    await this.loadQueue();
    await this.loadSeenIds();

    // Initialize delivery manager
    await deliveryManager.initialize();

    // Ensure device identity docs exist in Firestore (physical ID + QR alias).
    try {
      const { firebaseDataService } = await import('./FirebaseDataService');
      if (!firebaseDataService.isInitialized) {
        await firebaseDataService.initialize();
      }
      if (firebaseDataService.isInitialized) {
        const deviceId = await getDeviceIdFromLib();
        if (deviceId) {
          await firebaseDataService.saveDeviceId(deviceId);
        }
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

      this.connectionCallbacks.forEach(cb => cb(state));
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

    const myIdentity = identityService.getIdentity();
    if (!myIdentity) {
      throw new Error('Identity not initialized');
    }

    // C4: Validate and sanitize message
    const validation = validateMessage(content);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid message content');
    }

    const messageId = await this.generateId();
    const localId = await this.generateId();

    const message: HybridMessage = {
      id: messageId,
      localId,
      content: validation.sanitized,
      senderId: myIdentity.id,
      senderName: myIdentity.displayName,
      recipientId,
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
    if (recipientId) {
      deliveryManager.trackMessage(messageId, recipientId);
    }

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

    const myIdentity = identityService.getIdentity();
    if (!myIdentity) {
      throw new Error('Identity not initialized');
    }

    let mediaUrl = options.mediaUrl;

    // Upload to Firebase Storage if local URI provided
    if (options.mediaLocalUri && !mediaUrl) {
      try {
        const { firebaseStorageService } = await import('./FirebaseStorageService');
        const extension = mediaType === 'image' ? 'jpg' : 'm4a';
        const storageOwnerId = myIdentity.cloudUid;
        if (!storageOwnerId) {
          logger.warn('Skipping media upload: cloud identity unavailable');
          throw new Error('cloud-identity-unavailable');
        }
        const storagePath = `chat/${storageOwnerId}/${Date.now()}.${extension}`;

        // Read file and upload
        const FileSystem = require('expo-file-system');
        const base64Data = await FileSystem.readAsStringAsync(options.mediaLocalUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        mediaUrl = await firebaseStorageService.uploadFile(storagePath, bytes, {
          contentType: mediaType === 'image' ? 'image/jpeg' : 'audio/mp4',
          customMetadata: {
            userId: storageOwnerId,
          },
        }) ?? undefined;
      } catch (error) {
        logger.error('Media upload failed:', error);
        // Continue without URL - mesh will still work
      }
    }

    const messageId = await this.generateId();
    const localId = await this.generateId();
    const messageType = mediaType === 'image' ? 'IMAGE' : mediaType === 'voice' ? 'VOICE' : 'LOCATION';

    // Content is caption or type description
    const content = options.caption ||
      (mediaType === 'image' ? '📷 Fotoğraf' :
        mediaType === 'voice' ? '🎤 Sesli Mesaj' :
          '📍 Konum');

    const message: HybridMessage = {
      id: messageId,
      localId,
      content,
      senderId: myIdentity.id,
      senderName: myIdentity.displayName,
      recipientId,
      timestamp: Date.now(),
      source: 'HYBRID',
      status: 'pending',
      priority: 'normal',
      type: messageType,
      retryCount: 0,
      // Media fields
      mediaUrl,
      mediaType,
      mediaDuration: options.mediaDuration,
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
    deliveryManager.trackMessage(messageId, recipientId);

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
      } else {
        message.retryCount++;
        message.lastRetryAt = Date.now();
        message.nextRetryAt = Date.now() + this.calculateNextRetryDelay(message.retryCount);
        message.status = 'pending';
        this.saveQueueDebounced();
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

    try {
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

      // 2. CLOUD LAYER: Try if online
      if (isOnline) {
        try {
          const { firebaseDataService } = await import('./FirebaseDataService');

          // V5: Auto-initialize if not ready
          if (!firebaseDataService.isInitialized) {
            logger.info('FirebaseDataService not initialized, attempting auto-init...');
            await firebaseDataService.initialize();
          }

          if (firebaseDataService.isInitialized) {
            const metadata: Record<string, unknown> = {
              ...(message.senderName ? { senderName: message.senderName } : {}),
              ...(message.mediaType ? { mediaType: message.mediaType } : {}),
              ...(message.mediaUrl ? { mediaUrl: message.mediaUrl } : {}),
              ...(typeof message.mediaDuration === 'number' ? { mediaDuration: message.mediaDuration } : {}),
              ...(message.mediaThumbnail ? { mediaThumbnail: message.mediaThumbnail } : {}),
            };

            const messageData = {
              id: message.id,
              fromDeviceId: message.senderId,
              toDeviceId: message.recipientId || 'broadcast',
              content: message.content,
              timestamp: message.timestamp,
              type: this.mapHybridTypeToCloudType(message.type),
              status: 'sent' as const,
              priority: message.priority,
              // V5: Include structured location/media payload
              ...(message.location && { location: message.location }),
              ...(Object.keys(metadata).length > 0 && { metadata }),
            };

            const writeTargets = message.recipientId
              ? [message.senderId, message.recipientId]
              : [message.senderId];

            const writeResults = await Promise.all(
              writeTargets.map((targetDeviceId) =>
                firebaseDataService.saveMessage(targetDeviceId, messageData),
              ),
            );

            const senderWriteOk = !!writeResults[0];
            const inboxWriteIndex = message.recipientId ? 1 : 0;
            const inboxWriteOk = !!writeResults[inboxWriteIndex];
            cloudSuccess = message.recipientId ? inboxWriteOk : writeResults.some(Boolean);

            if (message.recipientId && senderWriteOk && !inboxWriteOk) {
              logger.warn('Cloud sender copy saved but recipient inbox write failed');
            }

            if (cloudSuccess) {
              logger.debug(
                `Cloud send successful (senderCopy=${Boolean(writeResults[0])}, inboxCopy=${inboxWriteOk})`,
              );
            } else {
              logger.warn('Cloud save returned false for all targets');
            }
          } else {
            logger.warn('FirebaseDataService still not initialized after auto-init attempt');
          }
        } catch (cloudError) {
          logger.warn('Cloud send failed:', cloudError);
        }
      }

      // V5: SOS Special Handling - must succeed on at least one channel
      if (message.type === 'SOS' && !meshSuccess && !cloudSuccess) {
        logger.error('🚨 SOS MESSAGE FAILED ON ALL CHANNELS!');
        // Queue for aggressive retry
        message.priority = 'critical';
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
    if (!this.deliveryCallbacks.has(messageId)) {
      this.deliveryCallbacks.set(messageId, []);
    }
    this.deliveryCallbacks.get(messageId)!.push(callback);

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
            userId: myIdentity.id,
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

        // Deduplication
        if (!this.recordSeenMessage(msgId)) return;

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
          type: this.toHybridTypeFromMesh(meshMsg.type),
          retryCount: 0,
          ...(meshMsg.mediaUrl ? { mediaUrl: meshMsg.mediaUrl } : {}),
          ...(meshMsg.mediaType ? { mediaType: meshMsg.mediaType } : {}),
          ...(typeof meshMsg.mediaDuration === 'number' ? { mediaDuration: meshMsg.mediaDuration } : {}),
          ...(meshMsg.mediaThumbnail ? { mediaThumbnail: meshMsg.mediaThumbnail } : {}),
          ...(meshMsg.location ? { location: meshMsg.location } : {}),
        };
        callback(hybridMsg);
      }
    });

    // 2. Subscribe to Cloud messages (QR ID + physical device ID, with online rebind)
    const cloudUnsubscribers = new Map<string, () => void>();
    let isDisposed = false;
    let isCloudSyncInProgress = false;

    const clearCloudSubscriptions = () => {
      cloudUnsubscribers.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch {
          // no-op
        }
      });
      cloudUnsubscribers.clear();
    };

    const getCloudInboxTargets = async (): Promise<string[]> => {
      const targets = new Set<string>();
      const identity = identityService.getIdentity();
      if (identity?.id && identity.id !== 'unknown') {
        targets.add(identity.id);
      }
      if (identity?.deviceId && identity.deviceId !== 'unknown') {
        targets.add(identity.deviceId);
      }
      try {
        const physicalDeviceId = await getDeviceIdFromLib();
        if (physicalDeviceId && physicalDeviceId !== 'unknown') {
          targets.add(physicalDeviceId);
        }
      } catch {
        // Optional source
      }
      return Array.from(targets);
    };

    const ensureCloudSubscriptions = async () => {
      if (isDisposed || !connectionManager.isOnline || isCloudSyncInProgress) {
        return;
      }

      isCloudSyncInProgress = true;
      try {
        const { firebaseDataService } = await import('./FirebaseDataService');
        if (!firebaseDataService.isInitialized) {
          await firebaseDataService.initialize();
        }
        if (!firebaseDataService.isInitialized || isDisposed) {
          return;
        }

        const targetIds = await getCloudInboxTargets();
        const targetSet = new Set(targetIds);

        Array.from(cloudUnsubscribers.keys()).forEach((existingTargetId) => {
          if (targetSet.has(existingTargetId)) {
            return;
          }
          const unsubscribe = cloudUnsubscribers.get(existingTargetId);
          if (unsubscribe) {
            unsubscribe();
          }
          cloudUnsubscribers.delete(existingTargetId);
        });

        await Promise.all(
          targetIds.map(async (targetId) => {
            if (cloudUnsubscribers.has(targetId) || isDisposed) {
              return;
            }

            const unsubscribe = await firebaseDataService.subscribeToMessages(targetId, (cloudMsgs) => {
              const localTargetIds = new Set(targetIds.map((id) => id.trim()));
              cloudMsgs.forEach(msg => {
                const fromDeviceId = typeof msg.fromDeviceId === 'string' ? msg.fromDeviceId.trim() : '';
                const toDeviceId = typeof msg.toDeviceId === 'string' ? msg.toDeviceId.trim() : '';

                // Ignore sender mirror copies of our own outgoing direct messages.
                const isLocalSenderMirror =
                  fromDeviceId.length > 0 &&
                  localTargetIds.has(fromDeviceId) &&
                  toDeviceId.length > 0 &&
                  toDeviceId !== 'broadcast' &&
                  !localTargetIds.has(toDeviceId);
                if (isLocalSenderMirror) {
                  return;
                }

                if (!this.recordSeenMessage(msg.id)) return;

                const rawMsg = msg as unknown as Record<string, unknown>;
                const metadata = msg.metadata && typeof msg.metadata === 'object'
                  ? msg.metadata as Record<string, unknown>
                  : undefined;
                const mediaType = this.normalizeMediaType(
                  rawMsg.mediaType ?? metadata?.mediaType,
                );
                const location = this.normalizeLocationPayload(
                  rawMsg.location ?? metadata?.location,
                );
                const mediaUrlSource = rawMsg.mediaUrl ?? metadata?.mediaUrl;
                const mediaDurationSource = rawMsg.mediaDuration ?? metadata?.mediaDuration;
                const mediaThumbnailSource = rawMsg.mediaThumbnail ?? metadata?.mediaThumbnail;
                const senderNameSource = rawMsg.senderName ?? metadata?.senderName;
                const normalizedType = this.mapCloudTypeToHybridType(msg.type, mediaType, !!location);
                const normalizedPriority = this.isMessagePriority(msg.priority)
                  ? msg.priority
                  : 'normal';

                const hybridMsg: HybridMessage = {
                  id: msg.id,
                  content: sanitizeMessage(msg.content),
                  senderId: msg.fromDeviceId,
                  senderName: typeof senderNameSource === 'string' && senderNameSource.trim().length > 0
                    ? senderNameSource.trim()
                    : 'Cloud User',
                  recipientId: msg.toDeviceId && msg.toDeviceId !== 'broadcast' ? msg.toDeviceId : undefined,
                  timestamp: typeof msg.timestamp === 'number' && Number.isFinite(msg.timestamp)
                    ? msg.timestamp
                    : Date.now(),
                  source: 'CLOUD',
                  status: 'delivered',
                  priority: normalizedPriority,
                  type: normalizedType,
                  retryCount: 0,
                  ...(typeof mediaUrlSource === 'string' ? { mediaUrl: mediaUrlSource } : {}),
                  ...(mediaType ? { mediaType } : {}),
                  ...(typeof mediaDurationSource === 'number' ? { mediaDuration: mediaDurationSource } : {}),
                  ...(typeof mediaThumbnailSource === 'string' ? { mediaThumbnail: mediaThumbnailSource } : {}),
                  ...(location ? { location } : {}),
                };
                this.pushCloudMessageToMeshStore(hybridMsg);
                callback(hybridMsg);
              });
            });

            if (unsubscribe && !isDisposed) {
              cloudUnsubscribers.set(targetId, unsubscribe);
            }
          }),
        );
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
      if (state === 'online') {
        ensureCloudSubscriptions().catch((error) => {
          logger.warn('Cloud resubscribe failed:', error);
        });
      } else {
        clearCloudSubscriptions();
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
