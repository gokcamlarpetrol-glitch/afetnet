/**
 * MESH NETWORK SERVICE - ELITE EDITION V4
 * Unified BLE Mesh Network Controller
 * 
 * CONSOLIDATED FROM:
 * - BLEMeshService (priority queues, Q-Mesh Protocol)
 * - MeshNetworkService (simulation, relay logic)
 * 
 * V4 FEATURES:
 * - ACK system with delivery tracking
 * - Store & Forward for offline peers
 * - Emergency beacon integration
 * - Message bridge to online messageStore
 * - Media chunk handling
 * 
 * FIXES APPLIED:
 * - M1: Memory leak prevention (proper interval cleanup)
 * - P5: Optimized BLE scan timing (1000ms loop)
 * - P7: Adaptive heartbeat based on peer activity
 * - P8: AppState background handler
 * 
 * Features:
 * - Priority Queue (Critical > High > Normal > Relay)
 * - Persistent Queue (AsyncStorage)
 * - Real RSSI Tracking
 * - Adaptive Scan/Advertise Timing
 * - Q-Mesh Relay Protocol
 * - Simulation Mode for Development
 */

import { createLogger } from '../../utils/logger';
import { useMeshStore, MeshNode, MeshMessage } from './MeshStore';
import { MeshProtocol, MeshMessageType, MeshPriority, MeshPacket } from './MeshProtocol';
import { meshStoreForwardService } from './MeshStoreForwardService';
import { meshEmergencyService, EmergencyReasonCode } from './MeshEmergencyService';
import { Buffer } from 'buffer';
import { highPerformanceBle, BlePeer } from '../../ble/HighPerformanceBle';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LRUSet } from '../../utils/LRUCache';
import { sanitizeMessage } from '../../utils/messageSanitizer';
import { cryptoService } from '../CryptoService';
import { identityService } from '../IdentityService';
import { meshCompressionService } from './MeshCompressionService';
import { getDeviceId as getDeviceIdFromLib } from '../../../lib/device';
import {
  BLE_SCAN_DURATION_MS,
  BLE_ADVERTISE_DURATION_MS,
  BLE_HEARTBEAT_INTERVAL_MS,
  BLE_LOOP_INTERVAL_MS,
  PEER_STALE_TIMEOUT_MS,
  MESSAGE_DEFAULT_TTL,
  MAX_SEEN_MESSAGE_IDS,
  STORAGE_KEYS,
} from '../messaging/constants';

const logger = createLogger('MeshNetworkService');

// Mock Data for Simulation
const MOCK_NAMES = [
  'Ahmet (Kurtarıcı)',
  'Ayşe (Doktor)',
  'Mehmet (Enkaz Altı)',
  'Zeynep (Güvenli)',
  'Ali (Lojistik)',
  'Fatma (Hemşire)',
  'Can (Arama)',
];

// Adaptive timing thresholds
const ADAPTIVE_TIMING = {
  NO_PEERS_HEARTBEAT_MS: 60000,      // Slow heartbeat when no peers
  ACTIVE_HEARTBEAT_MS: 15000,         // Fast heartbeat when peers active
  LOW_BATTERY_HEARTBEAT_MS: 120000,   // Very slow when battery low
  DEFAULT_HEARTBEAT_MS: BLE_HEARTBEAT_INTERVAL_MS,
};

interface PendingMeshPacket {
  type: MeshMessageType;
  payloadBase64: string;
  ttl: number;
  priority: MeshPriority;
  messageId: number;
}

// ===========================================================================
// BLE CHUNKING PROTOCOL
// ===========================================================================
// BLE advertising payload limit is ~31 bytes total. After the 13-byte
// MeshProtocol header, only 18 bytes remain for payload. Messages larger
// than this must be split into BLE-level chunks.
//
// Chunk header format (5 bytes, prepended to each chunk payload):
//   [magic:          1 byte ] - 0xCE identifies this as a chunk
//   [messageIdShort: 2 bytes] - truncated message ID for reassembly
//   [chunkIndex:     1 byte ] - 0-based index
//   [totalChunks:    1 byte ] - total number of chunks (max 255)
//
// This leaves 13 bytes per chunk for actual data.

const BLE_ADV_MAX_BYTES = 31;
const BLE_PROTOCOL_HEADER_SIZE = 13; // MeshProtocol header
const BLE_CHUNK_MAGIC = 0xCE;        // Magic byte to identify chunk payloads
const BLE_CHUNK_HEADER_SIZE = 5;     // magic(1) + messageIdShort(2) + chunkIndex(1) + totalChunks(1)
const BLE_MAX_PAYLOAD_PER_ADV = BLE_ADV_MAX_BYTES - BLE_PROTOCOL_HEADER_SIZE; // 18 bytes
const BLE_CHUNK_DATA_SIZE = BLE_MAX_PAYLOAD_PER_ADV - BLE_CHUNK_HEADER_SIZE;  // 13 bytes
const CHUNK_REASSEMBLY_TIMEOUT_MS = 30000; // 30s timeout for incomplete chunk sets
const CHUNK_NACK_MAX_RETRIES = 2;         // Max NACK retransmission attempts per reassembly
const SENT_CHUNK_CACHE_TTL_MS = 60000;    // 60s — keep sent chunks for retransmission

interface ChunkReassemblyState {
  messageIdShort: number;
  totalChunks: number;
  receivedChunks: Map<number, Buffer>;
  firstReceivedAt: number;
  sourceId: string;
  type: MeshMessageType;
  ttl: number;
  qScore: number;
  meshMessageId: number;
  nackRetries: number;
}

interface SentChunkCacheEntry {
  chunks: Map<number, Buffer>;
  sentAt: number;
  type: MeshMessageType;
  ttl: number;
  priority: MeshPriority;
  messageId: number;
}

class MeshNetworkService {
  // Identity
  private myId: string = '';
  private physicalDeviceId: string | null = null;
  private recipientAliases: Set<string> = new Set(['me']);
  private initialized = false;
  private initializePromise: Promise<void> | null = null;

  // State
  private isRunning = false;
  private isRealMode = false;
  private isActive = true; // P8: AppState tracking

  // M1: Store all timer IDs for cleanup
  private loopTimer: NodeJS.Timeout | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private staleCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimers: Set<NodeJS.Timeout> = new Set();

  // Priority Queues (from BLEMeshService)
  private criticalQueue: PendingMeshPacket[] = [];
  private highQueue: PendingMeshPacket[] = [];
  private normalQueue: PendingMeshPacket[] = [];
  private relayQueue: PendingMeshPacket[] = [];

  // Deduplication
  private seenMessageIds: LRUSet<string>;

  // Message listeners
  private messageListeners: ((message: MeshMessage) => void)[] = [];

  // P8: AppState subscription
  private appStateSubscription: { remove: () => void } | null = null;

  // BLE chunk reassembly state
  private chunkReassembly: Map<string, ChunkReassemblyState> = new Map();
  private chunkCleanupTimer: NodeJS.Timeout | null = null;

  // NACK: Cache of recently sent chunks for retransmission on NACK
  private sentChunkCache: Map<string, SentChunkCacheEntry> = new Map();

  // Stats
  private stats = {
    packetsSent: 0,
    packetsReceived: 0,
    packetsRelayed: 0,
    lastPeerActivity: 0,
  };

  // P7: Adaptive heartbeat state
  private currentHeartbeatInterval = ADAPTIVE_TIMING.DEFAULT_HEARTBEAT_MS;

  constructor() {
    this.myId = 'me-' + Math.floor(Math.random() * 10000).toString(16);
    this.seenMessageIds = new LRUSet<string>(MAX_SEEN_MESSAGE_IDS);
    this.rebuildRecipientAliases();
    this.loadQueues();
  }

  /**
   * Subscribe to incoming mesh messages
   */
  onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Initialize the mesh service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.rebuildRecipientAliases();
      if (!useMeshStore.getState().myDeviceId) {
        useMeshStore.getState().setMyDeviceId(this.myId);
      }
      return;
    }
    if (this.initializePromise) {
      await this.initializePromise;
      return;
    }

    this.initializePromise = (async () => {
      const uid = identityService.getUid();
      if (uid) {
        this.myId = uid;
      }

      try {
        const stableDeviceId = await getDeviceIdFromLib();
        if (stableDeviceId) {
          this.physicalDeviceId = stableDeviceId;
          if (!uid) {
            this.myId = stableDeviceId;
          }
        }
      } catch {
        // Keep existing IDs fallback
      }

      if (!this.myId) {
        if (this.physicalDeviceId) {
          this.myId = this.physicalDeviceId;
        }
      }

      if (!this.myId) {
        try {
          const secureId = await cryptoService.generateUUID();
          this.myId = secureId || this.myId;
        } catch {
          // Keep existing myId
        }
      }

      this.rebuildRecipientAliases();
      useMeshStore.getState().setMyDeviceId(this.myId);

      // Load persisted queues
      await this.loadQueues();

      // V4: Initialize Store & Forward and Emergency services
      await meshStoreForwardService.initialize(this.myId);
      await meshEmergencyService.initialize(this.myId);

      // V4: Listen for ACK events
      meshStoreForwardService.onACKReceived((msgId) => {
        logger.debug(`ACK received for message ${msgId}`);
      });

      this.initialized = true;
      logger.info(`Mesh Service V4 Initialized (ID: ${this.myId})`);
    })();

    try {
      await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  /**
   * Start the mesh network (Real or Simulation)
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    await this.initialize();

    this.isRunning = true;
    useMeshStore.getState().toggleMesh(true);

    const isSimRequested = useMeshStore.getState().isSimulationMode;
    const isSim = __DEV__ && isSimRequested;
    if (isSimRequested && !__DEV__) {
      useMeshStore.getState().setSimulationMode(false);
      logger.warn('Simulation mode request ignored in production build');
    }

    if (isSim) {
      this.isRealMode = false;
      this.startSimulation();
    } else {
      await this.startRealBLE();
    }

    // P8: Listen to AppState changes
    this.setupAppStateListener();

    // Start stale peer cleanup
    this.startStalePeerCleanup();

    logger.info(`🛜 Mesh Network V3 Started (Simulation: ${isSim})`);
  }

  /**
   * Stop the mesh network
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    useMeshStore.getState().toggleMesh(false);
    useMeshStore.getState().setScanning(false);
    useMeshStore.getState().setAdvertising(false);

    // M1: Clear all timers
    this.clearAllTimers();

    // Stop BLE
    await this.stopRealBLE();
    this.stopSimulation();

    // Save state
    await this.saveQueues();

    // Remove AppState listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    logger.info('Mesh Network V3 Stopped');
  }

  /**
   * M1: Clear all timers to prevent memory leaks
   */
  private clearAllTimers(): void {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
    if (this.chunkCleanupTimer) {
      clearInterval(this.chunkCleanupTimer);
      this.chunkCleanupTimer = null;
    }
    this.chunkReassembly.clear();
    this.sentChunkCache.clear();
    this.cleanupTimers.forEach(timer => clearTimeout(timer));
    this.cleanupTimers.clear();
  }

  /**
   * P8: Setup AppState listener for background handling
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.isActive = false;
      // Pause BLE operations in background to save battery
      this.pauseForBackground();
      logger.debug('Mesh paused (background)');
    } else if (nextAppState === 'active') {
      this.isActive = true;
      // Resume operations
      this.resumeFromBackground();
      logger.debug('Mesh resumed (foreground)');
    }
  };

  private pauseForBackground(): void {
    // Stop the main loop but keep service "running"
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    // Save queues
    this.saveQueues();
  }

  private resumeFromBackground(): void {
    if (this.isRunning && !this.loopTimer) {
      // Restart the loop
      if (useMeshStore.getState().isSimulationMode && __DEV__) {
        // Simulation continues as interval
      } else {
        this.runLoop();
      }
    }
  }

  /**
   * Broadcast a message to the mesh
   */
  async broadcastMessage(
    content: string,
    type: MeshMessageType = MeshMessageType.TEXT,
    options: { to?: string; from?: string; messageId?: string } = {},
  ): Promise<void> {
    // Sanitize content
    const sanitized = sanitizeMessage(content);

    // Generate secure message ID
    let messageId: string = options.messageId || '';
    if (!messageId) {
      try {
        messageId = await cryptoService.generateUUID();
      } catch {
        messageId = Math.random().toString(16).substring(2, 10);
      }
    }

    const envelope = this.buildMessageEnvelope(sanitized, {
      senderId: options.from,
      to: options.to,
      messageId,
      meshType: type,
    });
    const { to, from: senderId } = envelope;
    const payload = Buffer.from(JSON.stringify(envelope), 'utf-8');
    const queuePacket: PendingMeshPacket = {
      type,
      payloadBase64: payload.toString('base64'),
      ttl: MESSAGE_DEFAULT_TTL,
      priority: this.getMeshPriority(type),
      messageId: this.toMessageIdUInt32(messageId),
    };

    // Media transfer control packets are transport-level and must not appear in chat UI.
    if (!this.isMeshMediaControlType(envelope.type)) {
      // CRITICAL FIX: Only persist chat-renderable messages to MeshStore.
      // STATUS & LOCATION are system payloads (e.g. family_status_update)
      // consumed by FamilyScreen via onMessage — they must NOT appear in chat.
      const storeType = this.mapEnvelopeTypeToStoreType(envelope.type);
      const isChatRenderable = storeType === 'CHAT' || storeType === 'SOS' ||
        storeType === 'IMAGE' || storeType === 'VOICE';
      if (isChatRenderable) {
        const storeMsg: MeshMessage = {
          id: messageId,
          senderId,
          to,
          type: storeType,
          content: envelope.content,
          senderName: envelope.senderName,
          timestamp: envelope.timestamp,
          hops: 0,
          status: 'sending',
          ttl: MESSAGE_DEFAULT_TTL,
          priority: this.getStorePriority(type),
          acks: [],
          retryCount: 0,
          ...(envelope.mediaType ? { mediaType: envelope.mediaType } : {}),
          ...(envelope.mediaUrl ? { mediaUrl: envelope.mediaUrl } : {}),
          ...(typeof envelope.mediaDuration === 'number' ? { mediaDuration: envelope.mediaDuration } : {}),
          ...(envelope.mediaThumbnail ? { mediaThumbnail: envelope.mediaThumbnail } : {}),
          ...(envelope.location ? { location: envelope.location } : {}),
        };
        useMeshStore.getState().addMessage(storeMsg);
      }
    }

    // Add to appropriate queue
    if (type === MeshMessageType.SOS) {
      this.criticalQueue.push(queuePacket);
      // Force immediate processing for SOS
      this.processQueues();
    } else {
      if (queuePacket.priority === MeshPriority.HIGH) {
        this.highQueue.push(queuePacket);
      } else {
        this.normalQueue.push(queuePacket);
      }
    }

    // Save queues
    this.saveQueues();

    logger.debug(`Message queued: ${messageId} (${payload.length} bytes, to: ${to})`);
  }

  /**
   * Start stale peer cleanup
   */
  private startStalePeerCleanup(): void {
    this.staleCheckTimer = setInterval(() => {
      const now = Date.now();
      const peers = useMeshStore.getState().peers;

      peers.forEach(peer => {
        if (now - peer.lastSeen > PEER_STALE_TIMEOUT_MS) {
          useMeshStore.getState().removePeer(peer.id);
          logger.debug(`Removed stale peer: ${peer.id}`);
        }
      });
    }, PEER_STALE_TIMEOUT_MS / 2);
  }

  // ===========================================================================
  // P7: ADAPTIVE HEARTBEAT
  // ===========================================================================

  /**
   * P7: Calculate optimal heartbeat interval based on conditions
   */
  private calculateHeartbeatInterval(): number {
    const peers = useMeshStore.getState().peers;
    const timeSinceActivity = Date.now() - this.stats.lastPeerActivity;

    // No peers for a while - slow down
    if (peers.length === 0 && timeSinceActivity > 60000) {
      return ADAPTIVE_TIMING.NO_PEERS_HEARTBEAT_MS;
    }

    // Active peers - speed up
    if (peers.length > 0 && timeSinceActivity < 30000) {
      return ADAPTIVE_TIMING.ACTIVE_HEARTBEAT_MS;
    }

    return ADAPTIVE_TIMING.DEFAULT_HEARTBEAT_MS;
  }

  private updateHeartbeatInterval(): void {
    const newInterval = this.calculateHeartbeatInterval();
    if (newInterval !== this.currentHeartbeatInterval) {
      this.currentHeartbeatInterval = newInterval;

      // Restart heartbeat timer with new interval
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
      this.startHeartbeat();

      logger.debug(`Heartbeat interval adjusted to ${newInterval}ms`);
    }
  }

  // ===========================================================================
  // QUEUE PERSISTENCE
  // ===========================================================================

  private async saveQueues(): Promise<void> {
    try {
      const data = JSON.stringify({
        critical: this.serializeQueue(this.criticalQueue),
        high: this.serializeQueue(this.highQueue),
        normal: this.serializeQueue(this.normalQueue),
        relay: this.serializeQueue(this.relayQueue),
        seenIds: this.seenMessageIds.toArray(),
      });
      await AsyncStorage.setItem(STORAGE_KEYS.MESH_QUEUE, data);
    } catch (e) {
      logger.error('Failed to save queues', e);
    }
  }

  private async loadQueues(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.MESH_QUEUE);
      if (data) {
        const parsed = JSON.parse(data);
        this.criticalQueue = this.deserializeQueue(parsed.critical);
        this.highQueue = this.deserializeQueue(parsed.high);
        this.normalQueue = this.deserializeQueue(parsed.normal);
        this.relayQueue = this.deserializeQueue(parsed.relay);
        if (parsed.seenIds) {
          this.seenMessageIds.fromArray(parsed.seenIds);
        }
      }
    } catch (e) {
      logger.error('Failed to load queues', e);
    }
  }

  private serializeQueue(queue: PendingMeshPacket[]): PendingMeshPacket[] {
    return queue.map((packet) => ({ ...packet }));
  }

  private deserializeQueue(rawQueue: unknown): PendingMeshPacket[] {
    if (!Array.isArray(rawQueue)) return [];

    return rawQueue
      .map((rawPacket) => this.normalizeQueuedPacket(rawPacket))
      .filter((packet): packet is PendingMeshPacket => packet !== null);
  }

  private normalizeQueuedPacket(rawPacket: unknown): PendingMeshPacket | null {
    if (!rawPacket || typeof rawPacket !== 'object') {
      return null;
    }

    const packet = rawPacket as {
      type?: unknown;
      payloadBase64?: unknown;
      ttl?: unknown;
      priority?: unknown;
      messageId?: unknown;
      header?: {
        ttl?: unknown;
        priority?: unknown;
        packetIdShort?: unknown;
      };
      payload?: unknown;
    };

    if (
      typeof packet.type === 'number' &&
      typeof packet.payloadBase64 === 'string' &&
      typeof packet.ttl === 'number' &&
      typeof packet.priority === 'number' &&
      typeof packet.messageId === 'number'
    ) {
      return {
        type: packet.type as MeshMessageType,
        payloadBase64: packet.payloadBase64,
        ttl: packet.ttl,
        priority: packet.priority as MeshPriority,
        messageId: packet.messageId,
      };
    }

    const legacyPayload = this.normalizeLegacyPayload(packet.payload);
    const legacyMeshType = this.inferLegacyMeshType(legacyPayload);
    const legacyPriority = typeof packet.header?.priority === 'number'
      ? packet.header.priority
      : MeshPriority.NORMAL;
    const legacyMessageId = packet.header?.packetIdShort;

    return {
      type: legacyMeshType,
      payloadBase64: legacyPayload.toString('base64'),
      ttl: typeof packet.header?.ttl === 'number' ? packet.header.ttl : MESSAGE_DEFAULT_TTL,
      priority: this.normalizePriority(legacyPriority),
      messageId: this.toMessageIdUInt32(
        typeof legacyMessageId === 'string' && legacyMessageId.trim().length > 0
          ? legacyMessageId
          : Date.now().toString(),
      ),
    };
  }

  private normalizeLegacyPayload(rawPayload: unknown): Buffer {
    if (Buffer.isBuffer(rawPayload)) {
      return rawPayload;
    }

    if (
      rawPayload &&
      typeof rawPayload === 'object' &&
      (rawPayload as { type?: unknown }).type === 'Buffer' &&
      Array.isArray((rawPayload as { data?: unknown }).data)
    ) {
      const data = (rawPayload as { data: number[] }).data;
      return Buffer.from(data);
    }

    if (typeof rawPayload === 'string') {
      return Buffer.from(rawPayload, 'utf-8');
    }

    return Buffer.alloc(0);
  }

  private inferLegacyMeshType(payload: Buffer): MeshMessageType {
    const payloadText = payload.toString('utf-8');
    try {
      const parsed = JSON.parse(payloadText);
      const parsedType = typeof parsed?.type === 'string' ? parsed.type.toUpperCase() : '';
      if (parsedType === 'SOS') return MeshMessageType.SOS;
      if (parsedType === 'LOCATION' || parsedType === 'FAMILY_LOCATION_UPDATE') return MeshMessageType.LOCATION;
      if (parsedType === 'STATUS' || parsedType === 'FAMILY_STATUS_UPDATE' || parsedType === 'STATUS_UPDATE') {
        return MeshMessageType.STATUS;
      }
    } catch {
      // Legacy plain text payload
    }

    if (payloadText.startsWith('SOS:')) {
      return MeshMessageType.SOS;
    }

    return MeshMessageType.TEXT;
  }

  private normalizePriority(priority: number): MeshPriority {
    switch (priority) {
      case MeshPriority.CRITICAL:
        return MeshPriority.CRITICAL;
      case MeshPriority.HIGH:
        return MeshPriority.HIGH;
      case MeshPriority.LOW:
        return MeshPriority.LOW;
      case MeshPriority.RELAY:
        return MeshPriority.RELAY;
      default:
        return MeshPriority.NORMAL;
    }
  }

  private getMeshPriority(type: MeshMessageType): MeshPriority {
    switch (type) {
      case MeshMessageType.SOS:
      case MeshMessageType.HEALTH_SOS:
      case MeshMessageType.EMERGENCY_BEACON:
        return MeshPriority.CRITICAL;
      case MeshMessageType.LOCATION:
      case MeshMessageType.STATUS:
        return MeshPriority.HIGH;
      default:
        return MeshPriority.NORMAL;
    }
  }

  private getStorePriority(type: MeshMessageType): MeshMessage['priority'] {
    const priority = this.getMeshPriority(type);
    if (priority === MeshPriority.CRITICAL) return 'critical';
    if (priority === MeshPriority.HIGH) return 'high';
    if (priority === MeshPriority.LOW) return 'low';
    return 'normal';
  }

  private getQScore(priority: MeshPriority): number {
    switch (priority) {
      case MeshPriority.CRITICAL:
        return 100;
      case MeshPriority.HIGH:
        return 90;
      case MeshPriority.RELAY:
        return 70;
      case MeshPriority.LOW:
        return 50;
      default:
        return 80;
    }
  }

  private normalizeRecipientId(value: string | null | undefined): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private rebuildRecipientAliases(): void {
    const aliases = new Set<string>(['me']);
    const normalizedMyId = this.normalizeRecipientId(this.myId);
    if (normalizedMyId) {
      aliases.add(normalizedMyId);
    }

    const identity = identityService.getIdentity();
    const identityUid = this.normalizeRecipientId(identity?.uid);
    const physicalId = this.normalizeRecipientId(this.physicalDeviceId);

    if (identityUid) aliases.add(identityUid);
    if (physicalId) aliases.add(physicalId);

    this.recipientAliases = aliases;
  }

  private isLocalRecipient(recipientId: string): boolean {
    const normalized = this.normalizeRecipientId(recipientId);
    if (!normalized) return false;
    this.rebuildRecipientAliases();
    return this.recipientAliases.has(normalized);
  }

  private toMessageIdUInt32(id: string | number): number {
    const raw = String(id);
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
  }

  private mapEnvelopeTypeToStoreType(type: string): MeshMessage['type'] {
    const normalized = typeof type === 'string' ? type.toUpperCase() : 'CHAT';
    if (normalized === 'SOS') return 'SOS';
    if (normalized === 'STATUS') return 'STATUS';
    if (normalized === 'FAMILY_STATUS_UPDATE' || normalized === 'STATUS_UPDATE') return 'STATUS';
    if (normalized === 'LOCATION') return 'LOCATION';
    if (normalized === 'FAMILY_LOCATION_UPDATE' || normalized === 'FAMILY_LOCATION') return 'LOCATION';
    if (normalized === 'IMAGE') return 'IMAGE';
    if (normalized === 'VOICE') return 'VOICE';
    return 'CHAT';
  }

  private isMeshMediaControlType(type: unknown): boolean {
    if (typeof type !== 'string') return false;
    const normalized = type.trim().toUpperCase();
    return normalized === 'MEDIA_START' || normalized === 'MEDIA_CHUNK' || normalized === 'MEDIA_END';
  }

  private handleMeshMediaControlPacket(parsedPayload: Record<string, unknown>, senderId: string): void {
    const rawType = typeof parsedPayload.type === 'string' ? parsedPayload.type.trim().toUpperCase() : '';
    if (!this.isMeshMediaControlType(rawType)) return;

    const mediaId = typeof parsedPayload.mediaId === 'string' ? parsedPayload.mediaId.trim() : '';
    if (!mediaId) return;
    const logicalSenderId = typeof parsedPayload.senderId === 'string' && parsedPayload.senderId.trim().length > 0
      ? parsedPayload.senderId.trim()
      : senderId;

    const rawRecipient = typeof parsedPayload.recipientId === 'string'
      ? parsedPayload.recipientId.trim()
      : typeof parsedPayload.to === 'string'
        ? parsedPayload.to.trim()
        : '';
    const recipientId = rawRecipient || 'broadcast';

    const normalizedPayload: Record<string, unknown> = {
      ...parsedPayload,
      type: rawType,
      mediaId,
      senderId: logicalSenderId,
      recipientId,
    };

    void import('./MeshMediaService')
      .then(async ({ meshMediaService }) => {
        await meshMediaService.initialize();
        await meshMediaService.handleMediaMessage(normalizedPayload);
      })
      .catch((error) => {
        logger.debug('Mesh media control packet handling skipped:', error);
      });
  }

  private normalizeMediaType(value: unknown): MeshMessage['mediaType'] | undefined {
    if (value === 'image' || value === 'voice' || value === 'location') {
      return value;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.toLowerCase();
    if (normalized === 'image' || normalized === 'voice' || normalized === 'location') {
      return normalized;
    }
    return undefined;
  }

  private normalizeEnvelopeLocation(value: unknown): MeshMessage['location'] | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const raw = value as Record<string, unknown>;
    const lat = typeof raw.lat === 'number'
      ? raw.lat
      : typeof raw.latitude === 'number'
        ? raw.latitude
        : null;
    const lng = typeof raw.lng === 'number'
      ? raw.lng
      : typeof raw.longitude === 'number'
        ? raw.longitude
        : null;
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return undefined;
    }

    const location: MeshMessage['location'] = { lat, lng };
    if (typeof raw.address === 'string' && raw.address.trim().length > 0) {
      location.address = raw.address.trim();
    }
    return location;
  }

  private buildMessageEnvelope(
    sanitizedContent: string,
    options: {
      senderId?: string;
      to?: string;
      messageId: string;
      meshType: MeshMessageType;
    },
  ): {
    id: string;
    from: string;
    to: string;
    type: string;
    senderName?: string;
    content: string;
    timestamp: number;
    mediaType?: 'image' | 'voice' | 'location';
    mediaUrl?: string;
    mediaDuration?: number;
    mediaThumbnail?: string;
    location?: { lat: number; lng: number; address?: string };
  } {
    let parsedContent = sanitizedContent;
    let parsedTimestamp: number | null = null;
    let parsedFrom: string | null = null;
    let parsedTo: string | null = null;
    let parsedType: string | null = null;
    let parsedSenderName: string | null = null;
    let parsedMediaType: 'image' | 'voice' | 'location' | undefined;
    let parsedMediaUrl: string | undefined;
    let parsedMediaDuration: number | undefined;
    let parsedMediaThumbnail: string | undefined;
    let parsedLocation: { lat: number; lng: number; address?: string } | undefined;

    try {
      const parsed = JSON.parse(sanitizedContent);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.content === 'string') {
          parsedContent = sanitizeMessage(parsed.content);
        } else if (typeof parsed.message === 'string') {
          parsedContent = sanitizeMessage(parsed.message);
        }
        if (typeof parsed.type === 'string' && parsed.type.trim().length > 0) {
          parsedType = parsed.type.trim();
        }
        if (typeof parsed.from === 'string' && parsed.from.trim().length > 0) {
          parsedFrom = parsed.from.trim();
        }
        if (typeof parsed.to === 'string' && parsed.to.trim().length > 0) {
          parsedTo = parsed.to.trim();
        }
        if (typeof parsed.senderName === 'string' && parsed.senderName.trim().length > 0) {
          parsedSenderName = parsed.senderName.trim();
        }
        parsedMediaType = this.normalizeMediaType(parsed.mediaType);
        if (typeof parsed.mediaUrl === 'string' && parsed.mediaUrl.trim().length > 0) {
          parsedMediaUrl = parsed.mediaUrl.trim();
        }
        if (typeof parsed.mediaDuration === 'number' && Number.isFinite(parsed.mediaDuration)) {
          parsedMediaDuration = parsed.mediaDuration;
        }
        if (typeof parsed.mediaThumbnail === 'string' && parsed.mediaThumbnail.trim().length > 0) {
          parsedMediaThumbnail = parsed.mediaThumbnail;
        }
        parsedLocation = this.normalizeEnvelopeLocation(parsed.location);
        if (typeof parsed.timestamp === 'number' && Number.isFinite(parsed.timestamp)) {
          parsedTimestamp = parsed.timestamp;
        }
      }
    } catch {
      // Regular plain-text payload
    }

    return {
      id: options.messageId,
      from: options.senderId || parsedFrom || this.myId || 'ME',
      to: options.to || parsedTo || 'broadcast',
      type: parsedType || (options.meshType === MeshMessageType.SOS ? 'SOS' : 'CHAT'),
      ...(parsedSenderName ? { senderName: parsedSenderName } : {}),
      content: parsedContent,
      timestamp: parsedTimestamp ?? Date.now(),
      ...(parsedMediaType ? { mediaType: parsedMediaType } : {}),
      ...(parsedMediaUrl ? { mediaUrl: parsedMediaUrl } : {}),
      ...(typeof parsedMediaDuration === 'number' ? { mediaDuration: parsedMediaDuration } : {}),
      ...(parsedMediaThumbnail ? { mediaThumbnail: parsedMediaThumbnail } : {}),
      ...(parsedLocation ? { location: parsedLocation } : {}),
    };
  }

  // ===========================================================================
  // SIMULATION MODE
  // ===========================================================================

  private startSimulation(): void {
    logger.info('Starting Mesh Simulation Loop');

    // Add initial peers
    this.simulatePeerDiscovery();
    this.simulatePeerDiscovery();

    this.simulationInterval = setInterval(() => {
      if (!this.isActive) return;

      // 10% chance to discover new peer
      if (Math.random() < 0.1) this.simulatePeerDiscovery();

      // 30% chance to update RSSI
      this.simulateRssiFluctuation();

      // 5% chance to receive message
      if (Math.random() < 0.05) this.simulateIncomingMessage();

    }, 2000);
  }

  private stopSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  private simulatePeerDiscovery(): void {
    const store = useMeshStore.getState();
    if (store.peers.length >= 5) return;

    const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
    const id = 'sim-' + Math.floor(Math.random() * 10000).toString(16);

    const newPeer: MeshNode = {
      id,
      name,
      isSelf: false,
      rssi: -Math.floor(Math.random() * 40 + 50),
      lastSeen: Date.now(),
      status: Math.random() < 0.2 ? 'danger' : 'safe',
      connections: [],
    };

    useMeshStore.getState().addPeer(newPeer);
    this.stats.lastPeerActivity = Date.now();
    logger.debug('Simulation: Discovered peer', name);
  }

  private simulateRssiFluctuation(): void {
    const store = useMeshStore.getState();
    store.peers.forEach(peer => {
      const noise = Math.floor(Math.random() * 10) - 5;
      const newRssi = Math.max(-100, Math.min(-40, peer.rssi + noise));
      useMeshStore.getState().updatePeer(peer.id, {
        rssi: newRssi,
        lastSeen: Date.now(),
      });
    });
  }

  private simulateIncomingMessage(): void {
    const store = useMeshStore.getState();
    if (store.peers.length === 0) return;

    const randomPeer = store.peers[Math.floor(Math.random() * store.peers.length)];
    const messages = [
      'Durum güncellemesi: Bölge güvenli.',
      'Yardım geliyor, beklemede kalın.',
      'Su ve gıda dağıtım noktası hazır.',
      'Enkaz altından ses duyuluyor!',
    ];
    const content = messages[Math.floor(Math.random() * messages.length)];

    const storeMsg: MeshMessage = {
      id: Math.random().toString(16).substring(2, 10),
      senderId: randomPeer.name,
      senderName: randomPeer.name,
      to: 'broadcast',
      type: 'CHAT',
      content,
      timestamp: Date.now(),
      hops: 0,
      status: 'delivered',
      ttl: MESSAGE_DEFAULT_TTL,
      priority: 'normal',
      acks: [],
      retryCount: 0,
    };

    useMeshStore.getState().addMessage(storeMsg);
    this.messageListeners.forEach(listener => listener(storeMsg));
    this.stats.lastPeerActivity = Date.now();
  }

  // ===========================================================================
  // REAL BLE IMPLEMENTATION
  // ===========================================================================

  private async startRealBLE(): Promise<void> {
    this.isRealMode = true;
    logger.info('Starting Real BLE Mesh (Dual Mode)');

    // Start the main loop
    this.runLoop();

    // Start heartbeat
    this.startHeartbeat();

    // Start scanning
    await highPerformanceBle.startScanning();
    highPerformanceBle.onPeerFound(this.handleDiscoveredPeer);

    // Start chunk reassembly cleanup timer
    this.startChunkCleanup();
  }

  private async stopRealBLE(): Promise<void> {
    this.isRealMode = false;
    highPerformanceBle.removePeerFoundListener(this.handleDiscoveredPeer);
    await highPerformanceBle.stopDualMode();
  }

  /**
   * P5: Main service loop with optimized timing
   */
  private async runLoop(): Promise<void> {
    if (!this.isRunning || !this.isActive) return;

    try {
      // Process priority queues
      if (this.hasPendingCritical() || this.hasPendingHigh()) {
        await this.processQueues();
      } else if (this.hasPendingNormal() || this.hasPendingRelay()) {
        await this.processQueues();
      }

      // P7: Update heartbeat interval based on activity
      this.updateHeartbeatInterval();

    } catch (error) {
      logger.error('Loop error:', error);
    }

    // P5: Schedule next loop with optimized interval (1000ms instead of 100ms)
    if (this.isRunning && this.isActive) {
      this.loopTimer = setTimeout(() => this.runLoop(), BLE_LOOP_INTERVAL_MS);
    }
  }

  private async processQueues(): Promise<void> {
    // Process critical (all)
    while (this.criticalQueue.length > 0) {
      const packet = this.criticalQueue.shift();
      if (packet) await this.broadcastPacket(packet);
    }

    // Process high (max 5)
    let highCount = 0;
    while (this.highQueue.length > 0 && highCount < 5) {
      const packet = this.highQueue.shift();
      if (packet) await this.broadcastPacket(packet);
      highCount++;
    }

    // Process normal (max 2)
    let normalCount = 0;
    while (this.normalQueue.length > 0 && normalCount < 2) {
      const packet = this.normalQueue.shift();
      if (packet) await this.broadcastPacket(packet);
      normalCount++;
    }

    // Process relay (max 2)
    let relayCount = 0;
    while (this.relayQueue.length > 0 && relayCount < 2) {
      const packet = this.relayQueue.shift();
      if (packet) await this.broadcastPacket(packet);
      relayCount++;
    }

    // Save queues after processing
    this.saveQueues();
  }

  // ===========================================================================
  // BLE CHUNKING: Split large payloads into BLE-sized chunks
  // ===========================================================================

  /**
   * Split a payload into BLE-sized chunks with reassembly headers.
   * Each chunk has a 4-byte header: [messageIdShort:2][chunkIndex:1][totalChunks:1]
   * followed by up to BLE_CHUNK_DATA_SIZE bytes of data.
   */
  private chunkPayload(payload: Buffer, messageIdShort: number): Buffer[] {
    const totalChunks = Math.ceil(payload.length / BLE_CHUNK_DATA_SIZE);
    if (totalChunks > 255) {
      logger.warn(`Message too large for BLE chunking: ${payload.length} bytes (${totalChunks} chunks > 255 max)`);
      return [];
    }

    const chunks: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const dataStart = i * BLE_CHUNK_DATA_SIZE;
      const dataEnd = Math.min(dataStart + BLE_CHUNK_DATA_SIZE, payload.length);
      const dataSlice = payload.subarray(dataStart, dataEnd);

      // Build chunk: [magic:1][messageIdShort:2][chunkIndex:1][totalChunks:1][data:N]
      const chunk = Buffer.alloc(BLE_CHUNK_HEADER_SIZE + dataSlice.length);
      chunk.writeUInt8(BLE_CHUNK_MAGIC, 0);
      chunk.writeUInt16BE(messageIdShort & 0xFFFF, 1);
      chunk.writeUInt8(i, 3);
      chunk.writeUInt8(totalChunks, 4);
      dataSlice.copy(chunk, BLE_CHUNK_HEADER_SIZE);

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Check if an incoming payload is a chunk (has the chunk header pattern).
   * A chunked payload always has totalChunks > 1 in byte 3.
   */
  private isChunkedPayload(payload: Buffer): boolean {
    if (payload.length < BLE_CHUNK_HEADER_SIZE) return false;
    const magic = payload.readUInt8(0);
    if (magic !== BLE_CHUNK_MAGIC) return false;
    const totalChunks = payload.readUInt8(4);
    return totalChunks > 1 && totalChunks <= 255;
  }

  /**
   * Process an incoming chunk. Returns the reassembled full payload Buffer
   * when all chunks have been received, or null if still waiting for more.
   */
  private processIncomingChunk(
    payload: Buffer,
    sourceId: string,
    type: MeshMessageType,
    ttl: number,
    qScore: number,
    meshMessageId: number,
  ): Buffer | null {
    if (payload.length < BLE_CHUNK_HEADER_SIZE) return null;

    // Skip magic byte at offset 0
    const messageIdShort = payload.readUInt16BE(1);
    const chunkIndex = payload.readUInt8(3);
    const totalChunks = payload.readUInt8(4);
    const chunkData = payload.subarray(BLE_CHUNK_HEADER_SIZE);

    // Reassembly key: combine source + short message ID
    const reassemblyKey = `${sourceId}:${messageIdShort}`;

    let state = this.chunkReassembly.get(reassemblyKey);
    if (!state) {
      state = {
        messageIdShort,
        totalChunks,
        receivedChunks: new Map(),
        firstReceivedAt: Date.now(),
        sourceId,
        type,
        ttl,
        qScore,
        meshMessageId,
        nackRetries: 0,
      };
      this.chunkReassembly.set(reassemblyKey, state);
    }

    // Validate consistency
    if (state.totalChunks !== totalChunks) {
      logger.warn(`Chunk totalChunks mismatch for ${reassemblyKey}: expected ${state.totalChunks}, got ${totalChunks}`);
      return null;
    }

    // Store chunk (overwrites duplicates silently)
    state.receivedChunks.set(chunkIndex, chunkData);

    logger.debug(`Chunk ${chunkIndex + 1}/${totalChunks} received for ${reassemblyKey} (${chunkData.length} bytes)`);

    // Check if all chunks received
    if (state.receivedChunks.size === totalChunks) {
      // Reassemble in order
      const parts: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const part = state.receivedChunks.get(i);
        if (!part) {
          logger.warn(`Missing chunk ${i} during reassembly of ${reassemblyKey}`);
          return null;
        }
        parts.push(part);
      }

      const reassembled = Buffer.concat(parts);
      this.chunkReassembly.delete(reassemblyKey);
      logger.info(`Reassembled ${totalChunks} chunks for ${reassemblyKey}: ${reassembled.length} bytes`);
      return reassembled;
    }

    return null; // Still waiting for more chunks
  }

  /**
   * Start periodic cleanup of stale incomplete chunk reassembly states.
   * NACK-based: sends retransmission requests before giving up.
   */
  private startChunkCleanup(): void {
    if (this.chunkCleanupTimer) return;

    this.chunkCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, state] of this.chunkReassembly.entries()) {
        if (now - state.firstReceivedAt > CHUNK_REASSEMBLY_TIMEOUT_MS) {
          if (state.nackRetries < CHUNK_NACK_MAX_RETRIES) {
            // Identify missing chunks and send NACK
            const missing: number[] = [];
            for (let i = 0; i < state.totalChunks; i++) {
              if (!state.receivedChunks.has(i)) missing.push(i);
            }
            if (missing.length > 0) {
              state.nackRetries++;
              state.firstReceivedAt = now; // Reset timeout for retry window
              logger.info(`NACK retry ${state.nackRetries}/${CHUNK_NACK_MAX_RETRIES} for ${key}: requesting chunks [${missing.join(',')}]`);
              this.sendChunkNack(state.sourceId, state.messageIdShort, missing, state.totalChunks);
            }
          } else {
            logger.warn(`Chunk reassembly final timeout: ${key} (${state.receivedChunks.size}/${state.totalChunks} chunks after ${CHUNK_NACK_MAX_RETRIES} NACKs)`);
            this.chunkReassembly.delete(key);
          }
        }
      }

      // Cleanup stale sent chunk cache entries
      for (const [key, entry] of this.sentChunkCache.entries()) {
        if (now - entry.sentAt > SENT_CHUNK_CACHE_TTL_MS) {
          this.sentChunkCache.delete(key);
        }
      }
    }, CHUNK_REASSEMBLY_TIMEOUT_MS / 2);
  }

  /**
   * Send a CHUNK_NACK requesting retransmission of specific chunks.
   */
  private sendChunkNack(sourceId: string, messageIdShort: number, missing: number[], totalChunks: number): void {
    const nackPayload = JSON.stringify({
      type: 'CHUNK_NACK',
      target: sourceId,
      messageIdShort,
      missing,
      totalChunks,
    });
    this.broadcastMessage(nackPayload, MeshMessageType.TEXT, {
      to: sourceId,
      from: this.myId,
    }).catch(err => logger.warn('NACK broadcast failed:', err));
  }

  /**
   * Handle incoming CHUNK_NACK: retransmit requested chunks from cache.
   */
  private async handleChunkNack(parsed: Record<string, unknown>): Promise<void> {
    const targetId = typeof parsed.target === 'string' ? parsed.target : '';
    if (!this.isLocalRecipient(targetId)) return; // NACK not for us

    const messageIdShort = typeof parsed.messageIdShort === 'number' ? parsed.messageIdShort : -1;
    const missing = Array.isArray(parsed.missing) ? parsed.missing.filter((i): i is number => typeof i === 'number') : [];
    if (messageIdShort < 0 || missing.length === 0) return;

    const cacheKey = `${this.myId}:${messageIdShort}`;
    const cached = this.sentChunkCache.get(cacheKey);
    if (!cached) {
      logger.debug(`NACK received for ${cacheKey} but no cached chunks available`);
      return;
    }

    logger.info(`Retransmitting ${missing.length} chunks for ${cacheKey} in response to NACK`);
    for (const idx of missing) {
      const chunkBuf = cached.chunks.get(idx);
      if (!chunkBuf) continue;
      const encoded = MeshProtocol.serialize(
        cached.type,
        this.myId,
        chunkBuf,
        cached.ttl,
        this.getQScore(cached.priority),
        cached.messageId,
      );
      await highPerformanceBle.startAdvertising(encoded);
      this.stats.packetsSent++;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // ===========================================================================
  // BROADCAST (with chunking support)
  // ===========================================================================

  private async broadcastPacket(packet: PendingMeshPacket): Promise<void> {
    if (!this.isRealMode) {
      this.stats.packetsSent++;
      logger.debug('Simulation mode: skipped BLE advertising for queued packet');
      return;
    }

    try {
      let payloadBuffer = Buffer.from(packet.payloadBase64, 'base64');

      // Compress payload if beneficial (only for text-like payloads)
      if (payloadBuffer.length > BLE_MAX_PAYLOAD_PER_ADV) {
        try {
          const payloadStr = payloadBuffer.toString('utf8');
          if (meshCompressionService.shouldCompress(payloadStr)) {
            const compressed = await meshCompressionService.compress(payloadStr);
            const compressedBuf = Buffer.from(compressed, 'utf8');
            if (compressedBuf.length < payloadBuffer.length) {
              logger.debug(`Compression: ${payloadBuffer.length} -> ${compressedBuf.length} bytes`);
              payloadBuffer = compressedBuf;
            }
          }
        } catch {
          // Compression failed; use original payload
        }
      }

      // If payload fits in a single BLE advertisement, send directly
      if (payloadBuffer.length <= BLE_MAX_PAYLOAD_PER_ADV) {
        const encoded = MeshProtocol.serialize(
          packet.type,
          this.myId,
          payloadBuffer,
          packet.ttl,
          this.getQScore(packet.priority),
          packet.messageId,
        );
        await highPerformanceBle.startAdvertising(encoded);
        this.stats.packetsSent++;
      } else {
        // Payload too large: chunk it
        const messageIdShort = packet.messageId & 0xFFFF;
        const chunks = this.chunkPayload(payloadBuffer, messageIdShort);

        if (chunks.length === 0) {
          logger.error(`Failed to chunk payload (${payloadBuffer.length} bytes) - message dropped`);
          return;
        }

        logger.info(`Chunking message: ${payloadBuffer.length} bytes -> ${chunks.length} chunks of ≤${BLE_MAX_PAYLOAD_PER_ADV} bytes each`);

        // Cache sent chunks for NACK-based retransmission
        const cacheKey = `${this.myId}:${messageIdShort}`;
        const chunkMap = new Map<number, Buffer>();
        chunks.forEach((ch, i) => chunkMap.set(i, ch));
        this.sentChunkCache.set(cacheKey, {
          chunks: chunkMap,
          sentAt: Date.now(),
          type: packet.type,
          ttl: packet.ttl,
          priority: packet.priority,
          messageId: packet.messageId,
        });

        // Send each chunk as a separate BLE advertisement with a small delay
        for (let i = 0; i < chunks.length; i++) {
          const encoded = MeshProtocol.serialize(
            packet.type,
            this.myId,
            chunks[i],
            packet.ttl,
            this.getQScore(packet.priority),
            packet.messageId,
          );
          await highPerformanceBle.startAdvertising(encoded);
          this.stats.packetsSent++;

          // Small inter-chunk delay to avoid BLE congestion (skip after last chunk)
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }

      // Revert to heartbeat after advertising
      const timer = setTimeout(() => {
        this.startHeartbeat();
      }, BLE_ADVERTISE_DURATION_MS);
      this.cleanupTimers.add(timer);

    } catch (e) {
      logger.error('Broadcast failed', e);
    }
  }

  private startHeartbeat(): void {
    if (!this.isRealMode) return;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(async () => {
      if (!this.isActive) return;

      try {
        const heartbeatPayload = Buffer.from('PING');
        const packet = MeshProtocol.serialize(
          MeshMessageType.PING,
          this.myId,
          heartbeatPayload,
          1,
          100
        );
        await highPerformanceBle.startAdvertising(packet);
      } catch (e) {
        logger.debug('Heartbeat error:', e);
      }
    }, this.currentHeartbeatInterval);
  }

  /**
   * Handle discovered BLE device
   */
  private handleDiscoveredPeer = async (blePeer: BlePeer): Promise<void> => {
    if (!blePeer.manufacturerData) return;

    try {
      const buffer = Buffer.from(blePeer.manufacturerData, 'hex');
      const packet = MeshProtocol.deserialize(buffer);

      if (!packet) return;

      const peerId = packet.header.sourceId || blePeer.id;

      // Update or add peer
      const existingPeer = useMeshStore.getState().peers.find(p => p.id === peerId);

      if (existingPeer) {
        useMeshStore.getState().updatePeer(peerId, {
          rssi: blePeer.rssi,
          lastSeen: Date.now(),
        });
      } else {
        useMeshStore.getState().addPeer({
          id: peerId,
          name: `Peer ${peerId.substring(0, 4)}`,
          isSelf: false,
          rssi: blePeer.rssi,
          lastSeen: Date.now(),
          status: 'unknown',
          connections: [],
        });
        logger.debug(`Found new Mesh Peer: ${peerId}`);
      }

      this.stats.lastPeerActivity = Date.now();
      this.stats.packetsReceived++;

      // Process message content
      if (packet.header.type !== MeshMessageType.PING) {
        // Check if this is a chunked payload that needs reassembly
        if (this.isChunkedPayload(packet.payload)) {
          const reassembled = this.processIncomingChunk(
            packet.payload,
            packet.header.sourceId,
            packet.header.type,
            packet.header.ttl,
            packet.header.qScore,
            packet.header.messageId,
          );

          if (reassembled) {
            // All chunks received - decompress if needed, then process
            let finalPayload = reassembled;
            try {
              const payloadStr = reassembled.toString('utf8');
              if (payloadStr.startsWith('AFCMP:')) {
                const decompressed = await meshCompressionService.decompress(payloadStr);
                finalPayload = Buffer.from(decompressed, 'utf8');
                logger.debug(`Decompressed reassembled payload: ${reassembled.length} -> ${finalPayload.length} bytes`);
              }
            } catch {
              // Not compressed or decompression failed; use raw reassembled data
            }

            // Create a synthetic packet with the full reassembled payload
            const fullPacket: MeshPacket = {
              header: { ...packet.header },
              payload: finalPayload,
              receivedRssi: blePeer.rssi,
            };
            this.processIncomingPacket(fullPacket, blePeer.rssi);
          }
          // else: still waiting for more chunks, do nothing
        } else {
          // Non-chunked packet: decompress if needed, then process normally
          let processPacket = packet;
          try {
            const payloadStr = packet.payload.toString('utf8');
            if (payloadStr.startsWith('AFCMP:')) {
              const decompressed = await meshCompressionService.decompress(payloadStr);
              processPacket = {
                header: { ...packet.header },
                payload: Buffer.from(decompressed, 'utf8'),
                receivedRssi: blePeer.rssi,
              };
            }
          } catch {
            // Not compressed; use original
          }
          this.processIncomingPacket(processPacket, blePeer.rssi);
        }
      }

    } catch (error) {
      // Silent fail for malformed packets
    }
  };

  private processIncomingPacket(packet: MeshPacket, rssi: number): void {
    // Deduplication - checkAndAdd returns true if ID was NEW (added), false if duplicate
    // Skip if duplicate (checkAndAdd returns false when ID already existed)
    const transportMsgId = `${packet.header.sourceId}:${packet.header.messageId}`;
    if (!this.seenMessageIds.checkAndAdd(transportMsgId)) {
      // This is correct! If checkAndAdd returns false, it was already seen
      return;
    }

    // Process chat-capable messages (TEXT / STATUS / SOS)
    if (
      packet.header.type === MeshMessageType.TEXT ||
      packet.header.type === MeshMessageType.STATUS ||
      packet.header.type === MeshMessageType.SOS
    ) {
      const rawContent = sanitizeMessage(packet.payload.toString('utf8'));

      // Default routing for legacy/plain payloads
      let to = 'broadcast';
      let senderId = packet.header.sourceId;
      let content = rawContent;
      let messageId = transportMsgId;
      let timestamp = Date.now();
      let messageType: MeshMessage['type'] =
        packet.header.type === MeshMessageType.SOS
          ? 'SOS'
          : packet.header.type === MeshMessageType.STATUS
            ? 'STATUS'
            : 'CHAT';
      let senderName: string | undefined;
      let mediaType: MeshMessage['mediaType'] | undefined;
      let mediaUrl: string | undefined;
      let mediaDuration: number | undefined;
      let mediaThumbnail: string | undefined;
      let location: MeshMessage['location'] | undefined;
      let parsedEnvelope: Record<string, unknown> | null = null;
      let parsedEnvelopeType: string | null = null;

      // Envelope support for direct/private messages
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed && typeof parsed === 'object') {
          parsedEnvelope = parsed as Record<string, unknown>;
          if (typeof parsed.to === 'string' && parsed.to.trim().length > 0) {
            to = parsed.to.trim();
          }
          if (typeof parsed.from === 'string' && parsed.from.trim().length > 0) {
            senderId = parsed.from.trim();
          }
          if (typeof parsed.id === 'string' && parsed.id.trim().length > 0) {
            messageId = parsed.id.trim();
          } else if (typeof parsed.id === 'number' && Number.isFinite(parsed.id)) {
            messageId = String(parsed.id);
          }
          if (typeof parsed.content === 'string') {
            content = sanitizeMessage(parsed.content);
          } else if (typeof parsed.message === 'string') {
            content = sanitizeMessage(parsed.message);
          }
          if (typeof parsed.timestamp === 'number' && Number.isFinite(parsed.timestamp)) {
            timestamp = parsed.timestamp;
          }
          if (typeof parsed.type === 'string' && parsed.type.trim().length > 0) {
            parsedEnvelopeType = parsed.type.trim().toUpperCase();
            messageType = this.mapEnvelopeTypeToStoreType(parsed.type);
          }
          if (typeof parsed.senderName === 'string' && parsed.senderName.trim().length > 0) {
            senderName = parsed.senderName.trim();
          }
          mediaType = this.normalizeMediaType(parsed.mediaType);
          if (typeof parsed.mediaUrl === 'string' && parsed.mediaUrl.trim().length > 0) {
            mediaUrl = parsed.mediaUrl.trim();
          }
          if (typeof parsed.mediaDuration === 'number' && Number.isFinite(parsed.mediaDuration)) {
            mediaDuration = parsed.mediaDuration;
          }
          if (typeof parsed.mediaThumbnail === 'string' && parsed.mediaThumbnail.trim().length > 0) {
            mediaThumbnail = parsed.mediaThumbnail.trim();
          }
          location = this.normalizeEnvelopeLocation(parsed.location);

          // Keep system payloads human-readable in any UI surface that renders them.
          if (
            !('content' in parsed) &&
            !('message' in parsed) &&
            typeof parsed.type === 'string'
          ) {
            const normalizedEnvelopeType = parsed.type.trim().toUpperCase();
            if (
              normalizedEnvelopeType === 'FAMILY_STATUS_UPDATE' ||
              normalizedEnvelopeType === 'STATUS_UPDATE' ||
              normalizedEnvelopeType === 'STATUS'
            ) {
              const statusValue =
                typeof parsed.status === 'string' ? parsed.status.trim().toLowerCase() : '';
              if (statusValue === 'safe') {
                content = 'Durum güncellendi: Güvendeyim';
              } else if (statusValue === 'need-help') {
                content = 'Durum güncellendi: Yardım lazım';
              } else if (statusValue === 'critical') {
                content = 'Durum güncellendi: ACİL DURUM';
              } else {
                content = 'Durum güncellendi';
              }
            } else if (
              normalizedEnvelopeType === 'FAMILY_LOCATION_UPDATE' ||
              normalizedEnvelopeType === 'FAMILY_LOCATION' ||
              normalizedEnvelopeType === 'LOCATION'
            ) {
              content = 'Konum güncellendi';
            }
          }
        }
      } catch {
        // Not an envelope JSON; treat as legacy plaintext broadcast
      }

      // Drop non-targeted direct messages locally (still relayed below).
      const normalizedTo = this.normalizeRecipientId(to);
      const isGroupRecipient = normalizedTo.startsWith('group:');
      if (normalizedTo !== 'broadcast' && !isGroupRecipient && !this.isLocalRecipient(to)) {
        if (packet.header.ttl > 0) {
          this.relayPacket(packet);
        }
        return;
      }

      // NACK handler: retransmit requested chunks
      if (parsedEnvelopeType === 'CHUNK_NACK' && parsedEnvelope) {
        this.handleChunkNack(parsedEnvelope).catch(err => logger.warn('NACK handler error:', err));
        return;
      }

      const isMediaControlPacket = parsedEnvelopeType
        ? this.isMeshMediaControlType(parsedEnvelopeType)
        : false;
      if (isMediaControlPacket && parsedEnvelope) {
        this.handleMeshMediaControlPacket(parsedEnvelope, senderId);
      } else {
        const message: MeshMessage = {
          id: messageId,
          senderId,
          ...(senderName ? { senderName } : {}),
          to,
          type: messageType,
          content,
          timestamp,
          hops: MESSAGE_DEFAULT_TTL - packet.header.ttl,
          status: 'delivered',
          ttl: packet.header.ttl,
          priority: this.getStorePriority(packet.header.type),
          acks: [],
          retryCount: 0,
          ...(mediaType ? { mediaType } : {}),
          ...(mediaUrl ? { mediaUrl } : {}),
          ...(typeof mediaDuration === 'number' ? { mediaDuration } : {}),
          ...(mediaThumbnail ? { mediaThumbnail } : {}),
          ...(location ? { location } : {}),
        };

        // CRITICAL FIX: Only persist chat-renderable messages to MeshStore.
        // STATUS & LOCATION are system payloads consumed by FamilyScreen via
        // onMessage callbacks — they must NOT appear in the chat message store.
        const isChatRenderable = messageType === 'CHAT' || messageType === 'SOS' ||
          messageType === 'IMAGE' || messageType === 'VOICE';
        if (isChatRenderable) {
          useMeshStore.getState().addMessage(message);
        }
        this.messageListeners.forEach(listener => listener(message));

        // MESH SOS HANDLER: When receiving an SOS via mesh, also add to incomingSOSAlerts
        // so the DisasterMapScreen shows a marker for the nearby trapped/emergency user
        if (messageType === 'SOS' && senderId !== this.myId) {
          try {
            const { useSOSStore } = require('../sos/SOSStateManager');
            const sosLat = location?.lat;
            const sosLng = location?.lng;

            useSOSStore.getState().addIncomingSOSAlert({
              id: `mesh_${messageId}`,
              signalId: messageId,
              senderDeviceId: senderId,
              senderName: senderName || `Mesh Peer ${senderId.substring(0, 6)}`,
              latitude: typeof sosLat === 'number' && isFinite(sosLat) ? sosLat : 0,
              longitude: typeof sosLng === 'number' && isFinite(sosLng) ? sosLng : 0,
              timestamp,
              message: content || 'Acil yardım gerekiyor! (Mesh)',
              trapped: content?.toLowerCase().includes('enkaz') || content?.toLowerCase().includes('trapped') || false,
            });

            logger.warn(`🚨 MESH SOS received from ${senderName || senderId} — added to map markers`);

            // CRITICAL FIX: Show local notification for offline SOS
            // Without this, user would never know someone nearby needs help!
            try {
              const { notificationCenter } = require('../notifications/NotificationCenter');
              const resolvedName = senderName || `Yakındaki Kullanıcı (${senderId.substring(0, 6)})`;
              notificationCenter.notify('sos_received', {
                from: resolvedName,
                senderName: resolvedName,
                senderId,
                signalId: messageId,
                message: content || 'Acil yardım gerekiyor! (BLE Mesh)',
                location: typeof sosLat === 'number' && typeof sosLng === 'number' && isFinite(sosLat) && isFinite(sosLng)
                  ? { latitude: sosLat, longitude: sosLng }
                  : undefined,
                timestamp,
              }, 'MeshNetworkService').catch((notifErr: unknown) => {
                logger.error('Mesh SOS notification failed:', notifErr);
              });
            } catch (notifImportErr) {
              logger.error('Failed to import NotificationCenter for mesh SOS:', notifImportErr);
            }
          } catch (sosError) {
            logger.error('Failed to add mesh SOS to incoming alerts:', sosError);
          }
        }

        // MESH RESCUE ACK HANDLER: When receiving a rescue ACK via mesh,
        // update SOSStore so the SOS sender sees help is coming
        // PERF: Only parse if content looks like a RESCUE_ACK JSON
        if (content && typeof content === 'string' && content.includes('"RESCUE_ACK"') && senderId !== this.myId) {
          try {
            const parsed = JSON.parse(content);
            if (parsed && parsed.type === 'RESCUE_ACK') {
              const { useSOSStore } = require('../sos/SOSStateManager');
              const store = useSOSStore.getState();

              if (store.currentSignal) {
                const rescuerName = typeof parsed.rescuerName === 'string'
                  ? parsed.rescuerName
                  : `Gönüllü (${senderId.substring(0, 6)})`;

                store.addAck({
                  id: `mesh_ack_${messageId}`,
                  receiverId: typeof parsed.rescuerDeviceId === 'string'
                    ? parsed.rescuerDeviceId
                    : senderId,
                  receiverName: rescuerName,
                  timestamp: typeof parsed.timestamp === 'number'
                    ? parsed.timestamp
                    : Date.now(),
                  type: 'responding',
                });
                logger.warn(`✅ MESH RESCUE ACK from ${rescuerName}`);

                // Haptic for the trapped person
                try {
                  const hapticsModule = require('../../utils/haptics');
                  hapticsModule.notificationSuccess();
                } catch {
                  // Haptics non-critical
                }
              }
            }
          } catch {
            // Not valid JSON or parse error — silently ignore
          }
        }
      }
    }

    // Handle location updates
    if (packet.header.type === MeshMessageType.LOCATION) {
      this.processLocationPacket(packet);
    }

    // Q-Mesh Relay
    if (packet.header.ttl > 0) {
      this.relayPacket(packet);
    }
  }

  private processLocationPacket(packet: MeshPacket): void {
    try {
      const payloadStr = packet.payload.toString('utf8');
      const locationData = JSON.parse(payloadStr);

      if (locationData.type === 'LOC') {
        useMeshStore.getState().updatePeer(packet.header.sourceId, {
          lastSeen: Date.now(),
          location: {
            lat: locationData.lat,
            lng: locationData.lng,
          },
        });
        logger.debug(`Received location from ${packet.header.sourceId}`);
      }
    } catch {
      // Ignore malformed location packets
    }
  }

  private async relayPacket(originalPacket: MeshPacket): Promise<void> {
    const newTtl = originalPacket.header.ttl - 1;
    if (newTtl <= 0) return;
    if (!this.isRealMode) {
      this.stats.packetsRelayed++;
      logger.debug('Simulation mode: skipped BLE relay advertising');
      return;
    }

    const sourceIdHash = Number.parseInt(originalPacket.header.sourceId, 16);
    const relaySourceId: string | number = Number.isFinite(sourceIdHash)
      ? sourceIdHash
      : originalPacket.header.sourceId;

    const packet = MeshProtocol.serialize(
      originalPacket.header.type,
      relaySourceId,
      originalPacket.payload,
      newTtl,
      originalPacket.header.qScore,
      originalPacket.header.messageId
    );

    await highPerformanceBle.stopAdvertising();
    await highPerformanceBle.startAdvertising(packet);

    this.stats.packetsRelayed++;

    // Revert to heartbeat
    const timer = setTimeout(() => {
      this.startHeartbeat();
    }, BLE_ADVERTISE_DURATION_MS);
    this.cleanupTimers.add(timer);
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  async sendSOS(reason: string): Promise<void> {
    await this.broadcastMessage(`SOS: ${reason}`, MeshMessageType.SOS);
  }

  async broadcastEmergency(data: string): Promise<void> {
    await this.sendSOS(data);
  }

  shareLocation(lat: number, lng: number): void {
    const locationData = JSON.stringify({ type: 'LOC', lat, lng, ts: Date.now() });
    this.broadcastMessage(locationData, MeshMessageType.LOCATION);
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getMyDeviceId(): string {
    return this.myId;
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  // Helpers
  private hasPendingCritical(): boolean { return this.criticalQueue.length > 0; }
  private hasPendingHigh(): boolean { return this.highQueue.length > 0; }
  private hasPendingNormal(): boolean { return this.normalQueue.length > 0; }
  private hasPendingRelay(): boolean { return this.relayQueue.length > 0; }
}

export const meshNetworkService = new MeshNetworkService();
export default meshNetworkService;
