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
import {
  AFETNET_CHAR_MSG_UUID,
  AFETNET_CHAR_CHUNK_UUID,
  AFETNET_CHAR_SOS_UUID,
  AFETNET_CHAR_LOCATION_UUID,
  MAX_CHUNK_SIZE,
} from '../../ble/constants';
import { AppState, AppStateStatus } from 'react-native';
import { DirectStorage } from '../../utils/storage';
import { LRUSet } from '../../utils/LRUCache';
import { sanitizeMessage } from '../../utils/messageSanitizer';
import { cryptoService } from '../CryptoService';
import { identityService } from '../IdentityService';
import { meshCompressionService } from './MeshCompressionService';
import { meshCryptoService } from './MeshCryptoService';
import { getDeviceId as getDeviceIdFromLib } from '../../../lib/device';
import { getInstallationId as getInstallationIdFromLib } from '../../../lib/installationId';
import {
  BLE_SCAN_DURATION_MS,
  BLE_ADVERTISE_DURATION_MS,
  BLE_HEARTBEAT_INTERVAL_MS,
  BLE_LOOP_INTERVAL_MS,
  PEER_STALE_TIMEOUT_MS,
  MESSAGE_DEFAULT_TTL,
  MAX_SEEN_MESSAGE_IDS,
  STORAGE_KEYS,
  getAdaptiveTTL,
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
  enqueuedAt: number; // Timestamp for TTL-based expiry
  sourceIdOverride?: string; // For relay: use original sender's ID instead of this.myId
  originalStringId?: string; // Original UUID message ID for MeshStore ACK status updates
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

// ===========================================================================
// MESH ENCRYPTION ENVELOPE
// ===========================================================================
// Encrypted messages are wrapped in a JSON envelope that the receiver can
// detect via the `_enc` marker field.
//
// Broadcast encryption (any mesh peer can decrypt):
//   { "_enc": 1, "ct": "<nonce_b64>:<ciphertext_b64>", "k": "<key_b64>" }
//
// Peer-to-peer encryption (only peers with shared secret can decrypt):
//   { "_enc": 2, "ep": { ciphertext, iv, authTag, senderId, keyVersion } }
//
// Plaintext fallback (no marker):
//   { "id": "...", "from": "...", ... }   (original envelope format)

const ENC_BROADCAST = 1;
const ENC_PEER = 2;

class MeshNetworkService {
  // Identity
  private myId: string = '';
  private physicalDeviceId: string | null = null;
  private installationId: string | null = null;
  private recipientAliases: Set<string> = new Set(['me']);
  private initialized = false;
  private initializePromise: Promise<void> | null = null;

  // State
  private isRunning = false;
  // CRITICAL FIX: Default to true so broadcastPacket() always attempts real BLE.
  // Previously defaulted to false (simulation mode), which meant if startRealBLE()
  // failed/threw (BLE permissions denied, Bluetooth off), isRealMode was never set
  // to true — but isRunning WAS true. All subsequent broadcastPacket() calls returned
  // success in simulation mode, silently dropping EVERY packet. This made offline
  // SOS and messaging appear to work (all channels report "sent") but NOTHING was
  // actually transmitted over BLE. With true as default, broadcastPacket() will
  // properly check isBluetoothPoweredOn() and defer packets when BLE isn't ready.
  private isRealMode = true;
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

  // GATT incoming data listener cleanup
  private incomingDataUnsubscribe: (() => void) | null = null;
  private ackReceivedUnsubscribe: (() => void) | null = null;

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

  // Throttle store-forward delivery checks on scan re-discovery (Bug 8 fix)
  // Scan fires many times per second per peer — limit delivery checks to once per 10s per peer
  private lastDeliveryCheckAt: Map<string, number> = new Map();
  private static readonly DELIVERY_CHECK_THROTTLE_MS = 10_000;

  // P7: Adaptive heartbeat state
  private currentHeartbeatInterval = ADAPTIVE_TIMING.DEFAULT_HEARTBEAT_MS;

  constructor() {
    this.myId = 'me-' + Math.floor(Math.random() * 10000).toString(16);
    this.seenMessageIds = new LRUSet<string>(MAX_SEEN_MESSAGE_IDS);
    this.rebuildRecipientAliases();
    // FIX: Removed loadQueues() — myId is a random placeholder here, not the real UID.
    // Queue storage is user-scoped, so loading here reads from a nonexistent key.
    // initialize() calls loadQueues() after setting the real UID (line ~308).
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

      try {
        const stableInstallationId = await getInstallationIdFromLib();
        if (stableInstallationId) {
          this.installationId = stableInstallationId;
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

      // V4: Initialize encryption service (best-effort — mesh works without it)
      try {
        await meshCryptoService.initialize();
        logger.info('MeshCryptoService initialized for encrypted mesh');
      } catch (cryptoErr) {
        logger.warn('MeshCryptoService init failed (mesh will use plaintext):', cryptoErr);
      }

      // V4: Listen for ACK events — store unsubscribe to prevent leak on re-init
      if (this.ackReceivedUnsubscribe) {
        this.ackReceivedUnsubscribe();
      }
      this.ackReceivedUnsubscribe = meshStoreForwardService.onACKReceived((msgId) => {
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
    // NOTE: Do NOT clear messageListeners here — they are NOT timers.
    // HybridMessageService and MeshMessageBridge register listeners once via onMessage()
    // and have guards (meshSubscribed, isSubscribed) that prevent re-registration.
    // Clearing them on stop() means they're lost forever after a stop/start cycle,
    // causing ALL incoming mesh messages to be silently dropped.
    if (this.incomingDataUnsubscribe) {
      this.incomingDataUnsubscribe();
      this.incomingDataUnsubscribe = null;
    }
  }

  /**
   * P8: Setup AppState listener for background handling
   */
  private setupAppStateListener(): void {
    // CRITICAL FIX: Remove existing listener before adding new one to prevent duplicates
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
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
    // Save queues synchronously (saveQueues uses synchronous DirectStorage)
    this.saveQueues().catch(e => { if (__DEV__) logger.debug('Mesh: save queues on background failed:', e); });
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

    // --- ENCRYPTION LAYER ---
    // Encrypt the envelope before transmission. Best-effort: if encryption
    // fails for any reason, fall back to plaintext to guarantee delivery.
    // This is a life-saving app — message delivery MUST NOT break.
    // CRITICAL: When plaintext fallback is used, embed `_unencrypted: true` in the
    // envelope so the receiver knows the message was NOT encrypted. This prevents
    // silently pretending a plaintext message is encrypted.
    let isEncrypted = false;
    const envelopeJson = JSON.stringify(envelope);
    let wirePayload: string = envelopeJson; // default: plaintext fallback

    try {
      if (meshCryptoService.getIsInitialized()) {
        const recipientId = to && to !== 'broadcast' && !to.startsWith('group:') ? to : null;

        if (recipientId && meshCryptoService.isPeerEncryptionReady(recipientId)) {
          // Peer-to-peer encryption (shared secret via ECDH key exchange)
          const encrypted = await meshCryptoService.encryptMessage(recipientId, envelopeJson);
          if (encrypted) {
            wirePayload = JSON.stringify({ _enc: ENC_PEER, ep: encrypted });
            isEncrypted = true;
            logger.debug(`Message encrypted (peer-to-peer) for ${recipientId.slice(0, 8)}`);
          } else {
            logger.debug('Peer encryption returned null, falling back to broadcast encryption');
            // Fall through to broadcast encryption
            const broadcastResult = await meshCryptoService.encryptBroadcast(envelopeJson);
            if (broadcastResult) {
              wirePayload = JSON.stringify({ _enc: ENC_BROADCAST, ct: broadcastResult.ciphertext, k: broadcastResult.key });
              isEncrypted = true;
              logger.debug('Message encrypted (broadcast fallback)');
            }
          }
        } else {
          // Broadcast encryption (symmetric key travels with message)
          const broadcastResult = await meshCryptoService.encryptBroadcast(envelopeJson);
          if (broadcastResult) {
            wirePayload = JSON.stringify({ _enc: ENC_BROADCAST, ct: broadcastResult.ciphertext, k: broadcastResult.key });
            isEncrypted = true;
            logger.debug('Message encrypted (broadcast)');
          }
        }
      }
    } catch (encryptionError) {
      // CRITICAL: Never let encryption failure prevent message delivery
      logger.warn('Encryption failed, sending plaintext (emergency fallback):', encryptionError);
      isEncrypted = false;
    }

    // If encryption was not applied, mark the envelope so the receiver knows
    // this message traveled as plaintext. In emergency situations, plaintext
    // delivery is better than no delivery — but receivers should be informed.
    if (!isEncrypted) {
      logger.warn(`Mesh message ${messageId.substring(0, 8)} sent as PLAINTEXT (encryption ${meshCryptoService.getIsInitialized() ? 'failed' : 'not initialized'})`);
      // Re-serialize envelope with _unencrypted flag for receiver awareness
      const plaintextEnvelope = { ...envelope, _unencrypted: true };
      wirePayload = JSON.stringify(plaintextEnvelope);
    }

    const payload = Buffer.from(wirePayload, 'utf-8');
    // SPRINT 17: Adaptive TTL — SOS = 15 hops, Family = 8, General = 4.
    // Without this, all messages used same MESSAGE_DEFAULT_TTL (5), which under-served
    // SOS reach and over-served general chat (battery/bandwidth waste).
    const adaptiveTtl = getAdaptiveTTL(type);
    const queuePacket: PendingMeshPacket = {
      type,
      payloadBase64: payload.toString('base64'),
      ttl: adaptiveTtl,
      priority: this.getMeshPriority(type),
      messageId: this.toMessageIdUInt32(messageId),
      enqueuedAt: Date.now(),
      originalStringId: messageId, // Preserve UUID for MeshStore ACK status updates
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
          ttl: adaptiveTtl,
          priority: this.getStorePriority(type),
          acks: [],
          retryCount: 0,
          isEncrypted,
          ...(envelope.mediaType ? { mediaType: envelope.mediaType } : {}),
          ...(envelope.mediaUrl ? { mediaUrl: envelope.mediaUrl } : {}),
          ...(typeof envelope.mediaDuration === 'number' ? { mediaDuration: envelope.mediaDuration } : {}),
          ...(envelope.mediaThumbnail ? { mediaThumbnail: envelope.mediaThumbnail } : {}),
          ...(envelope.location ? { location: envelope.location } : {}),
        };
        useMeshStore.getState().addMessage(storeMsg);
      }
    }

    // Add to appropriate queue and trigger immediate processing.
    // Previously only SOS triggered processQueues(); all other types waited
    // up to 1s for the next runLoop tick, adding unnecessary latency.
    if (type === MeshMessageType.SOS) {
      this.criticalQueue.push(queuePacket);
    } else if (queuePacket.priority === MeshPriority.HIGH) {
      this.highQueue.push(queuePacket);
    } else {
      this.normalQueue.push(queuePacket);
    }
    // Force immediate processing for all message types
    this.processQueues();

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
      // CRITICAL FIX: User-scoped storage key to prevent cross-account data leak.
      // Without this, account switch causes the new user to send old user's queued mesh packets.
      const scopedKey = this.myId ? `${STORAGE_KEYS.MESH_QUEUE}_${this.myId}` : STORAGE_KEYS.MESH_QUEUE;
      DirectStorage.setString(scopedKey, data);
    } catch (e) {
      logger.error('Failed to save queues', e);
    }
  }

  private async loadQueues(): Promise<void> {
    try {
      const scopedKey = this.myId ? `${STORAGE_KEYS.MESH_QUEUE}_${this.myId}` : STORAGE_KEYS.MESH_QUEUE;
      const data = DirectStorage.getString(scopedKey) ?? null;
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
        enqueuedAt: (packet as any).enqueuedAt ?? Date.now(),
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
      enqueuedAt: Date.now(),
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
    const identityPublicCode = this.normalizeRecipientId(identity?.publicUserCode);
    const physicalId = this.normalizeRecipientId(this.physicalDeviceId);
    const installationId = this.normalizeRecipientId(this.installationId);

    if (identityUid) aliases.add(identityUid);
    if (identityPublicCode) aliases.add(identityPublicCode);
    if (physicalId) aliases.add(physicalId);
    if (installationId) aliases.add(installationId);

    try {
      const identityAliases = (identityService as any)?.getAliases?.();
      if (Array.isArray(identityAliases)) {
        for (const alias of identityAliases) {
          const normalizedAlias = this.normalizeRecipientId(alias);
          if (normalizedAlias) aliases.add(normalizedAlias);
        }
      }
    } catch {
      // best effort
    }

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
    // CRITICAL FIX: FAMILY_SOS, SOS_CANCEL, SOS_BEACON must all map to 'SOS'
    // so processIncomingPacket's SOS handler triggers for ALL SOS-related types.
    // Previously these fell through to 'CHAT', causing family SOS alerts to be
    // silently treated as regular chat messages — no alert, no map marker, nothing.
    if (normalized === 'SOS' || normalized === 'FAMILY_SOS' || normalized === 'SOS_CANCEL' || normalized === 'SOS_BEACON') return 'SOS';
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
    toAliases?: string[];
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
    let parsedToAliases: string[] | undefined;
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
        if (Array.isArray(parsed.toAliases)) {
          const aliases = parsed.toAliases
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim())
            .filter((item: string) => item.length > 0);
          if (aliases.length > 0) {
            parsedToAliases = Array.from(new Set(aliases));
          }
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
      ...(parsedToAliases && parsedToAliases.length > 0 ? { toAliases: parsedToAliases } : {}),
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
    // CRITICAL FIX: Spread to array before iterating — if a listener callback
    // modifies this.messageListeners (adds/removes), direct forEach can skip callbacks or throw.
    [...this.messageListeners].forEach(listener => listener(storeMsg));
    this.stats.lastPeerActivity = Date.now();
  }

  // ===========================================================================
  // REAL BLE IMPLEMENTATION
  // ===========================================================================

  private async startRealBLE(): Promise<void> {
    this.isRealMode = true;
    logger.info('Starting Real BLE Mesh (GATT + Scan Dual Mode)');

    // Start the main loop
    this.runLoop();

    // Start heartbeat
    this.startHeartbeat();

    // Start GATT server (advertising + accepting writes) + BLE scanner
    await highPerformanceBle.startDualMode();
    // FIX: Remove existing listener before adding to prevent duplicate callbacks
    // on repeated startRealBLE() calls without intervening stopRealBLE()
    highPerformanceBle.removePeerFoundListener(this.handleDiscoveredPeer);
    highPerformanceBle.onPeerFound(this.handleDiscoveredPeer);

    // Listen for incoming GATT data (from both server writes and client notifications)
    if (this.incomingDataUnsubscribe) {
      this.incomingDataUnsubscribe();
    }
    this.incomingDataUnsubscribe = highPerformanceBle.onIncomingData(
      (deviceId, charUUID, data) => {
        this.handleIncomingGATTData(deviceId, data);
      }
    );

    // Start chunk reassembly cleanup timer
    this.startChunkCleanup();
  }

  /**
   * Build an identity advertisement packet for BLE peer discovery.
   * Contains device ID + UID hash for BLE↔Firebase peer routing.
   *
   * Sprint Audit FIX A2: Include Firebase UID hash (first 16 chars of sha-like)
   * so that store-forward delivery, family routing, and mesh DM can match
   * BLE peer IDs to Firebase UIDs. Without this, offline messages addressed
   * by UID never reach the right peer (Session 33-39 memory pattern).
   *
   * Format: `${myId}|${uidHash16}` — pipe-separated for backward-compat parsing.
   * Older receivers see the whole string as their identity (graceful degradation).
   */
  private buildIdentityPacket(): Uint8Array {
    try {
      // Compose composite identity: device ID + UID hash
      let composite = this.myId.substring(0, 48);
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getFirebaseAuth } = require('../../../lib/firebase');
        const uid = getFirebaseAuth()?.currentUser?.uid;
        if (uid && uid.length >= 4) {
          // Lightweight hash — first 16 chars of UID is sufficient for peer matching
          // (Firebase UIDs are already random; no crypto hash needed for routing).
          const uidHash = uid.substring(0, 16);
          composite = `${composite}|${uidHash}`;
        }
      } catch {
        // No auth → device-id only (offline pre-login mesh discovery)
      }

      const idPayload = Buffer.from(composite.substring(0, 64), 'utf-8');
      return MeshProtocol.serialize(
        MeshMessageType.PING,
        this.myId,
        idPayload,
        1,
        100,
      );
    } catch {
      return MeshProtocol.serialize(
        MeshMessageType.PING,
        this.myId,
        Buffer.from('PING'),
        1,
        100,
      );
    }
  }

  private async stopRealBLE(): Promise<void> {
    // FIX: Set isRealMode=false AFTER stopping BLE to prevent in-flight
    // broadcastPacket() calls from returning true (simulation success)
    highPerformanceBle.removePeerFoundListener(this.handleDiscoveredPeer);
    if (this.incomingDataUnsubscribe) {
      this.incomingDataUnsubscribe();
      this.incomingDataUnsubscribe = null;
    }
    await highPerformanceBle.stopDualMode();
    this.isRealMode = false;
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

  private isProcessingQueues = false;

  private async processQueues(): Promise<void> {
    // CRITICAL: Concurrency guard — prevent concurrent queue processing
    // from broadcastMessage SOS (fire-and-forget) racing with runLoop
    if (this.isProcessingQueues) return;
    this.isProcessingQueues = true;
    try {
      await this._processQueuesInternal();
    } finally {
      this.isProcessingQueues = false;
    }
  }

  private async _processQueuesInternal(): Promise<void> {
    const now = Date.now();
    // Max age for queued packets: 10 minutes for normal, 30 minutes for SOS/critical
    const MAX_NORMAL_AGE_MS = 10 * 60 * 1000;
    const MAX_CRITICAL_AGE_MS = 30 * 60 * 1000;

    // Helper: process a queue with max count, skip failed packets instead of blocking
    // CRITICAL FIX: Add retry cooldown to prevent rapid-fire retries when BLE is off.
    // Without cooldown, deferred packets retry every loop cycle (1s) — wasting CPU/battery.
    const DEFERRED_COOLDOWN_MS = 5000; // 5s cooldown between retries for deferred packets
    const processQueue = async (queue: PendingMeshPacket[], maxCount: number, isCritical: boolean): Promise<void> => {
      const deferred: PendingMeshPacket[] = [];
      const maxAge = isCritical ? MAX_CRITICAL_AGE_MS : MAX_NORMAL_AGE_MS;
      let sent = 0;
      while (queue.length > 0 && sent < maxCount) {
        const packet = queue.shift();
        if (!packet) break;

        // Expire stale packets to prevent zombie queue buildup (battery drain)
        if (packet.enqueuedAt && (now - packet.enqueuedAt > maxAge)) {
          logger.debug(`Dropping expired mesh packet (age: ${Math.round((now - packet.enqueuedAt) / 1000)}s)`);
          continue;
        }

        // CRITICAL FIX: Skip deferred packets still in cooldown to prevent rapid-fire retries.
        // When BLE is off, every packet fails and gets re-queued. Without cooldown,
        // processQueues retries all of them every 1s loop cycle — burning CPU and battery.
        if ((packet as any)._lastDeferredAt && (now - (packet as any)._lastDeferredAt < DEFERRED_COOLDOWN_MS)) {
          deferred.push(packet); // Still in cooldown — re-defer without attempting
          continue;
        }

        const ok = await this.broadcastPacket(packet);
        if (ok) {
          sent++;
          // Clear deferred timestamp on success
          delete (packet as any)._lastDeferredAt;
          // Track for ACK if this is an outgoing message (not a relay) that requires delivery confirmation.
          // Without this, processACK never finds a matching pendingACK → delivery status never updates in UI.
          if (!packet.sourceIdOverride && packet.originalStringId && MeshProtocol.requiresACK(packet.type)) {
            const payload = Buffer.from(packet.payloadBase64, 'base64');
            meshStoreForwardService.trackForACK(
              packet.messageId, 'broadcast', payload, packet.priority, packet.originalStringId
            ).catch(() => { /* best-effort ACK tracking */ });
          }
        } else {
          (packet as any)._lastDeferredAt = now; // Record when deferred for cooldown
          deferred.push(packet); // Re-queue at end instead of blocking
        }
      }
      // Put deferred packets back at the FRONT of the queue so original SOS stays at position 0.
      // Previous approach (push to end) buried critical packets behind newer entries.
      if (deferred.length > 0) queue.unshift(...deferred);
    };

    await processQueue(this.criticalQueue, Math.min(this.criticalQueue.length, 5), true); // max 5 per cycle to prevent BLE MTU overflow
    await processQueue(this.highQueue, 5, false);
    await processQueue(this.normalQueue, 2, false);
    await processQueue(this.relayQueue, 2, false);

    // Enforce queue size caps (max 500 per queue, drop oldest relay/normal first)
    const MAX_QUEUE_SIZE = 500;
    if (this.relayQueue.length > MAX_QUEUE_SIZE) this.relayQueue.splice(0, this.relayQueue.length - MAX_QUEUE_SIZE);
    if (this.normalQueue.length > MAX_QUEUE_SIZE) this.normalQueue.splice(0, this.normalQueue.length - MAX_QUEUE_SIZE);
    if (this.highQueue.length > MAX_QUEUE_SIZE) this.highQueue.splice(0, this.highQueue.length - MAX_QUEUE_SIZE);
    // CRITICAL QUEUE: Protect original SOS messages (the initial distress call is most important).
    // Instead of dropping oldest (splice from 0), drop the NEWEST entries first — the original
    // SOS at the front of the queue is the one that MUST be delivered. Higher cap (1000) because
    // SOS messages are life-critical and should rarely be trimmed.
    const CRITICAL_MAX_QUEUE_SIZE = 1000;
    if (this.criticalQueue.length > CRITICAL_MAX_QUEUE_SIZE) {
      // Keep the first CRITICAL_MAX_QUEUE_SIZE entries (oldest = most important)
      // Drop from the end (newest duplicates/beacons)
      this.criticalQueue.splice(CRITICAL_MAX_QUEUE_SIZE);
    }

    // Save queues after processing
    await this.saveQueues();
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
      if (!this.isRunning) return;
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
      _control: true, // Mark as control message — must NOT be rendered in chat
    });
    // Use PING type instead of TEXT to prevent NACK from appearing in chat UI
    // (broadcastMessage with TEXT adds to MeshStore which renders in chat)
    this.broadcastMessage(nackPayload, MeshMessageType.PING, {
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

      // CRITICAL FIX: chunkBuf is already a fully serialized MeshProtocol packet
      // (from chunkForGATT → MeshProtocol.serialize). Re-serializing wraps it in ANOTHER
      // MeshProtocol header, producing a double-wrapped packet that the receiver cannot
      // deserialize — corrupting ALL NACK-triggered chunk retransmissions.
      // Use the cached buffer directly.
      const encoded = chunkBuf;

      // CRITICAL FIX: Use getCharacteristicForType() to match the characteristic used
      // by broadcastPacket() for original transmission. The previous hardcoded check
      // (SOS ? SOS_UUID : CHUNK_UUID) sent TEXT retransmissions on CHUNK_UUID instead of
      // MSG_UUID, causing receivers to process retransmitted chunks on a different channel.
      const charUUID = this.getCharacteristicForType(cached.type);

      // Use GATT write for chunk retransmission (not advertisement — chunks are too large for 31-byte ads)
      let sent = false;
      const connectedPeerIds = highPerformanceBle.getConnectedPeerIds();
      for (const peerId of connectedPeerIds) {
        try {
          const writeOk = await highPerformanceBle.writeToCharacteristic(peerId, charUUID, encoded);
          if (writeOk) sent = true;
        } catch { /* skip peer */ }
      }
      // Fallback to GATT server notification
      if (!sent) {
        highPerformanceBle.notifyGATTClients(charUUID, encoded);
      }

      this.stats.packetsSent++;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // ===========================================================================
  // BROADCAST (with chunking support)
  // ===========================================================================

  private async broadcastPacket(packet: PendingMeshPacket): Promise<boolean> {
    if (!this.isRealMode) {
      this.stats.packetsSent++;
      logger.debug('Simulation mode: skipped BLE for queued packet');
      return true;
    }

    const bluetoothReady = await highPerformanceBle.isBluetoothPoweredOn();
    if (!bluetoothReady) {
      logger.debug('Bluetooth not ready; deferring mesh packet for retry');
      return false;
    }

    try {
      let payloadBuffer = Buffer.from(packet.payloadBase64, 'base64');

      // Compress payload if beneficial
      try {
        const payloadStr = payloadBuffer.toString('utf8');
        if (meshCompressionService.shouldCompress(payloadStr)) {
          const compressed = meshCompressionService.compress(payloadStr);
          const compressedBuf = Buffer.from(compressed, 'utf8');
          if (compressedBuf.length < payloadBuffer.length) {
            logger.debug(`Compression: ${payloadBuffer.length} -> ${compressedBuf.length} bytes`);
            payloadBuffer = compressedBuf;
          }
        }
      } catch {
        // Compression failed; use original payload
      }

      // MeshProtocol serialize (header + payload)
      // For relay packets, use the original sender's ID (sourceIdOverride) instead of this.myId.
      // sourceIdOverride is a hex string from deserialize() — parse back to UInt32 to avoid re-hashing.
      // FIX: Use explicit NaN check — parseInt returning 0 is valid (hash of ""),
      // the fallback `|| this.myId` incorrectly substitutes sender's ID, breaking relay attribution
      const parsedSourceId = packet.sourceIdOverride ? parseInt(packet.sourceIdOverride, 16) : NaN;
      const sourceId = isNaN(parsedSourceId) ? this.myId : parsedSourceId;
      const serialized = MeshProtocol.serialize(
        packet.type,
        sourceId,
        payloadBuffer,
        packet.ttl,
        this.getQScore(packet.priority),
        packet.messageId,
      );

      // Select characteristic based on message type
      const charUUID = this.getCharacteristicForType(packet.type);

      // === STRATEGY 1: Send to all connected peers via GATT write ===
      const connectedPeers = highPerformanceBle.getConnectedPeerIds();
      let sentToAny = false;

      // Sprint 16-17: Adversarial peers blocked + reputation tracking
      const { meshReputationService } = await import('./MeshReputationService');

      for (const peerId of connectedPeers) {
        // Adversarial check: skip peers we've blocked
        if (meshReputationService.isBlocked(peerId)) {
          logger.debug(`Peer ${peerId.slice(0, 8)} BLOCKED (reputation) — skipping`);
          continue;
        }

        const peerMtu = highPerformanceBle.getPeerMTU(peerId);

        if (serialized.length <= peerMtu) {
          // Fits in a single GATT write — send the complete packet directly
          const sent = await highPerformanceBle.writeToCharacteristic(peerId, charUUID, serialized);
          if (sent) {
            sentToAny = true;
            meshReputationService.recordSent(peerId);
          } else {
            meshReputationService.recordFailure(peerId);
          }
        } else {
          // Too large for one write — use MeshProtocol-level chunking.
          // Each chunk is a complete MeshProtocol packet (with 0xCE chunk header in payload)
          // so the receiver's existing deserialize → isChunkedPayload → processIncomingChunk works.
          const chunkPackets = this.chunkForGATT(payloadBuffer, packet, peerMtu, sourceId);
          let allChunksSent = true;

          for (const chunkPkt of chunkPackets) {
            const sent = await highPerformanceBle.writeToCharacteristic(peerId, charUUID, chunkPkt);
            if (!sent) { allChunksSent = false; break; }
          }
          if (allChunksSent) sentToAny = true;
        }
      }

      // === STRATEGY 2: Notify connected GATT clients via server notification ===
      // Send to inbound GATT clients (devices that connected to OUR GATT server).
      // These clients may NOT be in our outbound connectedPeers list — they connected
      // to us but we haven't connected back to them yet (asymmetric connection).
      // Without this path, messages only flow in one direction until both devices
      // have established mutual outbound GATT connections.
      const gattClientCount = highPerformanceBle.getGATTServerClientCount();
      if (gattClientCount > 0) {
        if (serialized.length <= MAX_CHUNK_SIZE) {
          // Small payload — fits in a single GATT notification
          highPerformanceBle.notifyGATTClients(charUUID, serialized);
          sentToAny = true;
        } else {
          // CRITICAL FIX: Large payloads were previously SKIPPED for Strategy 2,
          // meaning inbound-only GATT clients NEVER received chat messages.
          // This caused one-way messaging: Device A could receive from B (via A's
          // outbound connection) but B could NOT receive from A (A only had inbound
          // clients, Strategy 2 was skipped for large payloads).
          // Fix: Chunk the payload and send each chunk as a separate notification.
          const chunkPackets = this.chunkForGATT(payloadBuffer, packet, MAX_CHUNK_SIZE, sourceId);
          if (chunkPackets.length > 0) {
            for (const chunkPkt of chunkPackets) {
              highPerformanceBle.notifyGATTClients(charUUID, chunkPkt);
            }
            sentToAny = true;
            logger.debug(`Strategy 2: sent ${chunkPackets.length} chunks to ${gattClientCount} GATT clients`);
          }
        }
      }

      // === STRATEGY 3: Advertisement fallback for SOS beacon ===
      // SOS payload is small enough to fit in advertisement (max 31 bytes)
      if (serialized.length <= 31 && packet.type === MeshMessageType.SOS) {
        highPerformanceBle.updateAdvertisementData(serialized);
      }

      if (sentToAny) {
        this.stats.packetsSent++;
      }

      // CRITICAL FIX: If no peers received the message but we know of discovered
      // (not yet connected) peers, urgently attempt GATT connections so the next
      // retry cycle can deliver the message. Without this, messages sit in the
      // deferred queue for 5s+ while discovered peers remain unconnected.
      if (!sentToAny) {
        const unconnected = highPerformanceBle.getUnconnectedDiscoveredPeerIds();
        if (unconnected.length > 0) {
          logger.debug(`broadcastPacket: 0 connected peers, urgently connecting to ${unconnected.length} discovered peers`);
          // Fire-and-forget — connections happen async, message will be retried next cycle
          for (const peerId of unconnected.slice(0, 3)) { // Max 3 concurrent connect attempts
            highPerformanceBle.connectToPeer(peerId).catch(() => { /* best-effort */ });
          }
        }
      }

      // Only return true if we actually sent to at least one peer.
      // Returning true with 0 peers causes messages to be silently dropped from the queue.
      // Queue will retain the message and retry when peers are discovered.
      return sentToAny;

    } catch (e) {
      logger.error('Broadcast failed', e);
      return false;
    }
  }

  /**
   * Map message type to the appropriate GATT characteristic UUID
   */
  private getCharacteristicForType(type: MeshMessageType): string {
    switch (type) {
      case MeshMessageType.SOS:
      case MeshMessageType.EMERGENCY_BEACON:
      case MeshMessageType.HEALTH_SOS:
      case MeshMessageType.RESCUE_SIGNAL:
        return AFETNET_CHAR_SOS_UUID;
      case MeshMessageType.LOCATION:
        return AFETNET_CHAR_LOCATION_UUID;
      case MeshMessageType.MEDIA_CHUNK:
      case MeshMessageType.MEDIA_START:
      case MeshMessageType.MEDIA_END:
      case MeshMessageType.VOICE_CLIP:
        return AFETNET_CHAR_CHUNK_UUID;
      default:
        return AFETNET_CHAR_MSG_UUID;
    }
  }

  /**
   * Create MeshProtocol-level chunks for GATT transmission.
   * Unlike raw byte splitting, each chunk is a complete MeshProtocol packet
   * that the receiver can deserialize independently. The PAYLOAD of each packet
   * contains a 0xCE chunk header that the existing processIncomingChunk() reassembles.
   *
   * Returns array of complete MeshProtocol packets (each fits in one GATT write).
   */
  private chunkForGATT(
    payload: Buffer,
    packet: PendingMeshPacket,
    peerMtu: number,
    sourceId?: string | number,
  ): Buffer[] {
    // Each GATT write = MeshProtocol header (13) + chunk header (5) + chunk data
    const chunkDataSize = Math.max(20, peerMtu - BLE_PROTOCOL_HEADER_SIZE - BLE_CHUNK_HEADER_SIZE);
    const totalChunks = Math.ceil(payload.length / chunkDataSize);

    if (totalChunks > 255) {
      logger.warn(`Message too large for GATT chunking: ${payload.length} bytes (${totalChunks} chunks > 255 max)`);
      return [];
    }

    const messageIdShort = packet.messageId & 0xFFFF;
    const packets: Buffer[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const dataStart = i * chunkDataSize;
      const dataEnd = Math.min(dataStart + chunkDataSize, payload.length);
      const dataSlice = payload.subarray(dataStart, dataEnd);

      // Build chunk payload: [0xCE magic:1][messageIdShort:2][chunkIndex:1][totalChunks:1][data:N]
      const chunkPayload = Buffer.alloc(BLE_CHUNK_HEADER_SIZE + dataSlice.length);
      chunkPayload.writeUInt8(BLE_CHUNK_MAGIC, 0);
      chunkPayload.writeUInt16BE(messageIdShort, 1);
      chunkPayload.writeUInt8(i, 3);
      chunkPayload.writeUInt8(totalChunks, 4);
      dataSlice.copy(chunkPayload, BLE_CHUNK_HEADER_SIZE);

      // Wrap chunk in a full MeshProtocol packet (receiver can deserialize independently)
      // CRITICAL FIX: Use sourceId (from sourceIdOverride for relay) instead of this.myId
      // to preserve original sender attribution on multi-chunk relayed messages.
      const serializedChunk = MeshProtocol.serialize(
        packet.type,
        sourceId ?? this.myId,
        chunkPayload,
        packet.ttl,
        this.getQScore(packet.priority),
        packet.messageId,
      );
      packets.push(serializedChunk);
    }

    // CRITICAL FIX: Populate sentChunkCache so NACK-based retransmission works.
    // Without this, handleChunkNack finds nothing in the cache and silently drops
    // all retransmission requests, making chunked message delivery unreliable.
    if (packets.length > 1) {
      const cacheKey = `${sourceId ?? this.myId}:${messageIdShort}`;
      const chunkMap = new Map<number, Buffer>();
      for (let i = 0; i < packets.length; i++) {
        chunkMap.set(i, packets[i]);
      }
      this.sentChunkCache.set(cacheKey, {
        chunks: chunkMap,
        sentAt: Date.now(),
        type: packet.type,
        ttl: packet.ttl,
        priority: packet.priority,
        messageId: packet.messageId,
      });
    }

    return packets;
  }

  /**
   * Handle incoming data received via GATT connection (server write or client notification).
   * This is the GATT equivalent of handleDiscoveredPeer (which handles advertisement data).
   */
  private handleIncomingGATTData(deviceId: string, data: Buffer): void {
    try {
      const packet = MeshProtocol.deserialize(data);
      if (!packet) return;

      const peerId = packet.header.sourceId || deviceId;

      // CRITICAL FIX (Bug 3): Extract full Firebase UID from PING payload.
      // buildIdentityPacket() serializes the sender's full UID (~28 chars) as the payload,
      // but packet.header.sourceId is only a 4-byte djb2 hash (e.g., "a1b2c3d4").
      // Without extracting the payload, store-forward delivery relies on the hash fallback
      // in getMessagesForPeer(), and the peer name is always "Peer a1b2" instead of the UID.
      let fullUid: string | null = null;
      if (packet.header.type === MeshMessageType.PING && packet.payload?.length > 0) {
        try {
          const payloadStr = packet.payload.toString('utf8');
          // Valid Firebase UIDs are alphanumeric, 20-128 chars
          if (payloadStr.length >= 10 && payloadStr.length <= 128 && /^[a-zA-Z0-9]+$/.test(payloadStr)) {
            fullUid = payloadStr;
          }
        } catch { /* invalid payload — use hash peerId */ }
      }

      // Use full UID for store-forward delivery key (direct mailbox match),
      // but keep peerId (hash) as the peer store key for BLE device tracking
      const deliveryKey = fullUid || peerId;
      const peerName = fullUid ? `Peer ${fullUid.substring(0, 8)}` : `Peer ${peerId.substring(0, 4)}`;

      // Update peer in store
      const existingPeer = useMeshStore.getState().peers.find(p => p.id === peerId);
      if (existingPeer) {
        useMeshStore.getState().updatePeer(peerId, { lastSeen: Date.now() });
      } else {
        useMeshStore.getState().addPeer({
          id: peerId,
          name: peerName,
          isSelf: false,
          rssi: -50, // GATT connections don't have RSSI in data
          lastSeen: Date.now(),
          status: 'unknown',
          connections: [],
        });
        logger.debug(`New GATT peer: ${peerId}${fullUid ? ` (UID: ${fullUid.substring(0, 8)}...)` : ''}`);
      }

      // STORE-FORWARD: Deliver stored messages on every identity PING (not just first discovery).
      // Messages may have been stored in the mailbox AFTER the initial peer discovery.
      // For non-PING packets, only deliver on first discovery to avoid redundant checks.
      // Use fullUid (if available) for direct mailbox key match; fall back to hash peerId.
      if (packet.header.type === MeshMessageType.PING || !existingPeer) {
        this.deliverStoredMessagesToPeer(deliveryKey);
        // Also deliver by hash peerId if different from deliveryKey (covers both mailbox key types)
        if (deliveryKey !== peerId) {
          this.deliverStoredMessagesToPeer(peerId);
        }
      }

      this.stats.lastPeerActivity = Date.now();
      this.stats.packetsReceived++;

      if (packet.header.type !== MeshMessageType.PING) {
        // Check if this is a chunked payload
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
            let finalPayload = reassembled;
            try {
              const payloadStr = reassembled.toString('utf8');
              if (payloadStr.startsWith('AFCMP:')) {
                const decompressed = meshCompressionService.decompress(payloadStr);
                finalPayload = Buffer.from(decompressed, 'utf8');
              }
            } catch { /* not compressed */ }

            const fullPacket: MeshPacket = {
              header: { ...packet.header },
              payload: finalPayload,
            };
            this.processIncomingPacket(fullPacket, -50);
          }
        } else {
          // Non-chunked: decompress if needed, then process
          let processPacket = packet;
          try {
            const payloadStr = packet.payload.toString('utf8');
            if (payloadStr.startsWith('AFCMP:')) {
              const decompressed = meshCompressionService.decompress(payloadStr);
              processPacket = {
                header: { ...packet.header },
                payload: Buffer.from(decompressed, 'utf8'),
              };
            }
          } catch { /* not compressed */ }

          this.processIncomingPacket(processPacket, -50);
        }
      }
    } catch (error) {
      logger.warn('handleIncomingGATTData error (packet may be malformed):', error);
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
        // Send identity PING via GATT to all connected peers.
        // This is critical for store-and-forward: peers discovered via service UUID
        // only have a BLE device ID. Without identity exchange, the receiver can't
        // match them to a Firebase UID mailbox key. The identity PING carries our
        // Firebase UID hash in the header (sourceId), enabling hash-based matching
        // in MeshStoreForwardService.getMessagesForPeer().
        //
        // NOTE: Do NOT use advertisement data for this — the identity packet (41+ bytes)
        // exceeds the BLE advertisement limit (31 bytes) and causes Android advertising failures.
        const connectedPeers = highPerformanceBle.getConnectedPeerIds?.() ?? [];
        const gattClientCount = highPerformanceBle.getGATTServerClientCount?.() ?? 0;

        if (connectedPeers.length === 0 && gattClientCount === 0) {
          logger.debug('Heartbeat: no connected peers');
          return;
        }

        const identityPacket = this.buildIdentityPacket();
        const identityBuffer = Buffer.from(identityPacket);

        // Strategy 1: GATT write to all outbound-connected peers
        for (const peerId of connectedPeers) {
          await highPerformanceBle.writeToCharacteristic(
            peerId, AFETNET_CHAR_MSG_UUID, identityBuffer
          ).catch(() => { /* dead peer — writeToCharacteristic cleans up */ });
        }

        // Strategy 2: Notify all inbound GATT server clients
        if (gattClientCount > 0) {
          highPerformanceBle.notifyGATTClients(AFETNET_CHAR_MSG_UUID, identityBuffer);
        }

        logger.debug(`Heartbeat: identity PING sent to ${connectedPeers.length} outbound + ${gattClientCount} inbound peers`);
      } catch (e) {
        logger.debug('Heartbeat error:', e);
      }
    }, this.currentHeartbeatInterval);
  }

  /**
   * Handle discovered BLE device
   */
  private handleDiscoveredPeer = async (blePeer: BlePeer): Promise<void> => {
    // GATT-based discovery: peers may not always have manufacturer data.
    // If they advertise our service UUID, they'll be connected via GATT auto-connect
    // in HighPerformanceBle.processDiscoveredDevice().
    // Still process manufacturer data when available for backward compatibility.
    if (!blePeer.manufacturerData) {
      // Peer discovered via service UUID only — track it but skip packet parsing
      const peerId = blePeer.id;
      const existingPeer = useMeshStore.getState().peers.find(p => p.id === peerId);
      if (!existingPeer) {
        useMeshStore.getState().addPeer({
          id: peerId,
          name: `Peer ${peerId.substring(0, 4)}`,
          isSelf: false,
          rssi: blePeer.rssi,
          lastSeen: Date.now(),
          status: 'unknown',
          connections: [],
        });
        logger.debug(`Found new GATT Mesh Peer: ${peerId}`);

        // STORE-FORWARD: Deliver stored messages to newly discovered peer
        this.deliverStoredMessagesToPeer(peerId);
      } else {
        useMeshStore.getState().updatePeer(peerId, {
          rssi: blePeer.rssi,
          lastSeen: Date.now(),
        });

        // STORE-FORWARD (Bug 8 fix): Also check stored messages on re-discovery,
        // throttled to avoid flooding (scan fires many times per second per peer).
        // Between PINGs (15-60s), new messages may have been stored for this peer.
        const now = Date.now();
        const lastCheck = this.lastDeliveryCheckAt.get(peerId) || 0;
        if (now - lastCheck >= MeshNetworkService.DELIVERY_CHECK_THROTTLE_MS) {
          this.lastDeliveryCheckAt.set(peerId, now);
          this.deliverStoredMessagesToPeer(peerId);
        }
      }
      this.stats.lastPeerActivity = Date.now();
      return;
    }

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

        // STORE-FORWARD: Deliver stored messages to newly discovered peer
        this.deliverStoredMessagesToPeer(peerId);
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
                const decompressed = meshCompressionService.decompress(payloadStr);
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
            await this.processIncomingPacket(fullPacket, blePeer.rssi);
          }
          // else: still waiting for more chunks, do nothing
        } else {
          // Non-chunked packet: decompress if needed, then process normally
          let processPacket = packet;
          try {
            const payloadStr = packet.payload.toString('utf8');
            if (payloadStr.startsWith('AFCMP:')) {
              const decompressed = meshCompressionService.decompress(payloadStr);
              processPacket = {
                header: { ...packet.header },
                payload: Buffer.from(decompressed, 'utf8'),
                receivedRssi: blePeer.rssi,
              };
            }
          } catch {
            // Not compressed; use original
          }
          await this.processIncomingPacket(processPacket, blePeer.rssi);
        }
      }

    } catch (error) {
      // Silent fail for malformed packets
    }
  };

  private async processIncomingPacket(packet: MeshPacket, rssi: number): Promise<void> {
    // Deduplication - checkAndAdd returns true if ID was NEW (added), false if duplicate
    // Skip if duplicate (checkAndAdd returns false when ID already existed)
    const transportMsgId = `${packet.header.sourceId}:${packet.header.messageId}`;
    if (!this.seenMessageIds.checkAndAdd(transportMsgId)) {
      // This is correct! If checkAndAdd returns false, it was already seen
      return;
    }

    // STORE-FORWARD FIX 2: Handle ACK packets — wire to meshStoreForwardService + DeliveryManager
    if (packet.header.type === MeshMessageType.ACK) {
      try {
        const ackData = MeshProtocol.parseACKPayload(packet.payload);
        if (ackData) {
          // Wire to store-forward ACK system
          await meshStoreForwardService.processACK(
            ackData.originalMessageId,
            ackData.ackType as 'received' | 'delivered' | 'read',
            ackData.receiverIdHash
          );
          // Wire to DeliveryManager ACK system
          try {
            const { deliveryManager } = require('../DeliveryManager');
            deliveryManager.onAckReceived(ackData.originalMessageId.toString());
          } catch { /* best-effort */ }
        }
      } catch (ackError) {
        if (__DEV__) logger.debug('ACK processing failed:', ackError);
      }
      return; // ACK packets are fully handled — do not relay or process further
    }

    // SOS MULTI-HOP RELAY flag: set to true when SOS/SOS_CANCEL/SOS_BEACON handlers
    // explicitly relay the packet, so the generic Q-Mesh relay at the bottom doesn't double-relay.
    let sosRelayHandled = false;

    // Process chat-capable messages (TEXT / STATUS / SOS)
    if (
      packet.header.type === MeshMessageType.TEXT ||
      packet.header.type === MeshMessageType.STATUS ||
      packet.header.type === MeshMessageType.SOS
    ) {
      // --- DECRYPTION LAYER ---
      // Attempt to decrypt the incoming payload. If the payload is an encrypted
      // envelope (has `_enc` marker), decrypt it. If decryption fails or the
      // payload is plaintext, use it as-is (backward compatibility).
      // CRITICAL: Never let decryption failure prevent message processing.
      // Track encryption status so receiver knows if message was encrypted in transit.
      const rawPayloadStr = packet.payload.toString('utf8');
      let decryptedContent: string = rawPayloadStr;
      let incomingIsEncrypted = false; // true only if we successfully decrypted an encrypted payload

      try {
        const maybeParsed = JSON.parse(rawPayloadStr);
        if (maybeParsed && typeof maybeParsed === 'object' && typeof maybeParsed._enc === 'number') {
          let plaintext: string | null = null;

          if (maybeParsed._enc === ENC_BROADCAST && typeof maybeParsed.ct === 'string' && typeof maybeParsed.k === 'string') {
            // Broadcast encryption: key is included in the envelope
            if (meshCryptoService.getIsInitialized()) {
              plaintext = await meshCryptoService.decryptBroadcast(maybeParsed.ct, maybeParsed.k);
            }
            if (plaintext) {
              decryptedContent = plaintext;
              incomingIsEncrypted = true;
              logger.debug('Message decrypted (broadcast)');
            } else {
              logger.warn('Broadcast decryption failed, treating as opaque payload');
              // Cannot recover — the original plaintext is not available
              // Still set decryptedContent to rawPayloadStr so the envelope parsing
              // below treats it as an unparseable payload rather than crashing
            }
          } else if (maybeParsed._enc === ENC_PEER && maybeParsed.ep && typeof maybeParsed.ep === 'object') {
            // Peer-to-peer encryption: requires shared secret from key exchange
            const encPayload = maybeParsed.ep;
            const epSenderId = typeof encPayload.senderId === 'string' ? encPayload.senderId : packet.header.sourceId;
            if (meshCryptoService.getIsInitialized()) {
              plaintext = await meshCryptoService.decryptMessage(epSenderId, encPayload);
            }
            if (plaintext) {
              decryptedContent = plaintext;
              incomingIsEncrypted = true;
              logger.debug(`Message decrypted (peer-to-peer) from ${epSenderId.slice(0, 8)}`);
            } else {
              logger.warn('Peer decryption failed (no shared secret or tampered), treating as opaque payload');
            }
          } else {
            // Unknown encryption version — treat as plaintext (forward compatibility)
            logger.debug(`Unknown encryption version: ${maybeParsed._enc}, treating as plaintext`);
          }
        }
        // else: no _enc marker — plaintext message (backward compatibility or sender's _unencrypted flag)
      } catch {
        // JSON parse failed — payload is raw plaintext (legacy), use as-is
      }

      const rawContent = sanitizeMessage(decryptedContent);

      // Default routing for legacy/plain payloads
      let to = 'broadcast';
      let toAliases: string[] = [];
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
          if (Array.isArray(parsed.toAliases)) {
            toAliases = parsed.toAliases
              .filter((item: unknown): item is string => typeof item === 'string')
              .map((item: string) => item.trim())
              .filter((item: string) => item.length > 0);
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
      const normalizedAliasTargets = toAliases
        .map((alias) => this.normalizeRecipientId(alias))
        .filter((alias) => alias.length > 0);
      const isGroupRecipient = normalizedTo.startsWith('group:')
        || normalizedAliasTargets.some((alias) => alias.startsWith('group:'));
      const isLocalAliasTarget = normalizedAliasTargets.some((alias) =>
        alias !== 'broadcast'
        && !alias.startsWith('group:')
        && this.isLocalRecipient(alias),
      );
      if (
        normalizedTo !== 'broadcast'
        && !isGroupRecipient
        && !this.isLocalRecipient(to)
        && !isLocalAliasTarget
      ) {
        if (packet.header.ttl > 0) {
          this.relayPacket(packet).catch(e => logger.warn('Relay failed:', e));
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
        // Determine encryption status for the received message:
        // 1. If we successfully decrypted an encrypted payload → encrypted
        // 2. If the plaintext envelope has `_unencrypted: true` → sender explicitly marked it as unencrypted
        // 3. Otherwise → legacy plaintext (no encryption marker either way)
        const senderMarkedUnencrypted = parsedEnvelope && parsedEnvelope._unencrypted === true;
        const receivedIsEncrypted = incomingIsEncrypted && !senderMarkedUnencrypted;

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
          isEncrypted: receivedIsEncrypted,
          ...(mediaType ? { mediaType } : {}),
          ...(mediaUrl ? { mediaUrl } : {}),
          ...(typeof mediaDuration === 'number' ? { mediaDuration } : {}),
          ...(mediaThumbnail ? { mediaThumbnail } : {}),
          ...(location ? { location } : {}),
        };

        // CRITICAL FIX: Only persist chat-renderable messages to MeshStore.
        // STATUS & LOCATION are system payloads consumed by FamilyScreen via
        // onMessage callbacks — they must NOT appear in the chat message store.
        // SOS_CANCEL and SOS_BEACON are control messages — they update existing SOS state
        // but should NOT create new chat messages in the message list.
        const envelopeTypeUpper = (parsedEnvelope?.type || '').toString().trim().toUpperCase();
        const isSosControlMessage = envelopeTypeUpper === 'SOS_CANCEL' || envelopeTypeUpper === 'SOS_BEACON';
        const isChatRenderable = !isSosControlMessage && (messageType === 'CHAT' || messageType === 'SOS' ||
          messageType === 'IMAGE' || messageType === 'VOICE');
        if (isChatRenderable) {
          useMeshStore.getState().addMessage(message);
        }
        // CRITICAL: Do NOT emit SOS control messages (CANCEL, BEACON) to messageListeners.
        // They are handled inline below. Emitting them would cause MeshMessageBridge to
        // persist them in messageStore as regular chat/SOS messages, polluting the conversation.
        if (!isSosControlMessage) {
          // CRITICAL FIX: Spread to array — listener may modify the set during iteration
          [...this.messageListeners].forEach(listener => listener(message));
        }

        // STORE-FORWARD FIX 3: Send ACK back to sender for messages that require it.
        // This completes the delivery confirmation loop — without this, the sender's
        // meshStoreForwardService never learns the message was delivered and keeps retrying.
        if (MeshProtocol.requiresACK(packet.header.type) && !this.isLocalRecipient(senderId)) {
          try {
            const ackPacket = meshStoreForwardService.createACKPacket(packet);
            // Use broadcastPacket to send via all available channels (GATT + notifications)
            const ackQueuePacket: PendingMeshPacket = {
              type: MeshMessageType.ACK,
              payloadBase64: ackPacket.subarray(BLE_PROTOCOL_HEADER_SIZE).toString('base64'),
              ttl: 1, // ACK is direct response, no multi-hop
              priority: MeshPriority.HIGH,
              messageId: (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0,
              enqueuedAt: Date.now(),
            };
            this.broadcastPacket(ackQueuePacket).catch(() => { /* ACK send is best-effort */ });
          } catch { /* ACK send is best-effort */ }
        }

        // MESH SOS CANCEL HANDLER: Process SOS cancellation received via mesh.
        // Without this, mesh peers never learn that an SOS was cancelled — the alert
        // stays active on their screens indefinitely until Firestore timeout (30min).
        if (envelopeTypeUpper === 'SOS_CANCEL' && !this.isLocalRecipient(senderId)) {
          try {
            const { useSOSStore } = require('../sos/SOSStateManager');
            const originalSignalId = parsedEnvelope?.originalSignalId || parsedEnvelope?.signalId || messageId;
            const store = useSOSStore.getState();

            // Remove from incoming SOS alerts (map marker)
            store.removeIncomingSOSAlertBySignalId(originalSignalId);
            logger.warn(`🚫 MESH SOS CANCEL: Removed alert for signal ${originalSignalId} from map`);

            // Emit cancel event to dismiss fullscreen alert
            try {
              const { DeviceEventEmitter } = require('react-native');
              DeviceEventEmitter.emit('SOS_FULLSCREEN_CANCEL', { signalId: originalSignalId });
            } catch { /* DeviceEventEmitter always available */ }

            logger.warn(`🚫 MESH SOS CANCEL received from ${senderName || senderId} for signal ${originalSignalId}`);
          } catch (cancelError) {
            logger.error('Failed to process mesh SOS cancel:', cancelError);
          }

          // SOS MULTI-HOP RELAY: Re-broadcast SOS_CANCEL to extend range
          if (packet.header.ttl > 0) {
            sosRelayHandled = true;
            this.relayPacket(packet).catch(e => logger.debug('SOS_CANCEL relay failed:', e));
            logger.debug(`📡 SOS_CANCEL RELAY: Forwarding cancel from ${senderName || senderId} (TTL: ${packet.header.ttl} → ${packet.header.ttl - 1})`);
          }
        }

        // MESH SOS BEACON HANDLER: Process periodic SOS beacons received via mesh.
        // These carry updated location and battery data from the trapped person.
        // Without this, rescuers cannot track the person's latest position.
        if (envelopeTypeUpper === 'SOS_BEACON' && !this.isLocalRecipient(senderId)) {
          try {
            const { useSOSStore } = require('../sos/SOSStateManager');
            const beaconSignalId = parsedEnvelope?.signalId || parsedEnvelope?.id || messageId;
            const envLocation = parsedEnvelope?.location as { latitude?: number; longitude?: number } | undefined;
            const beaconLat = envLocation?.latitude ?? (parsedEnvelope as any)?.latitude ?? location?.lat;
            const beaconLng = envLocation?.longitude ?? (parsedEnvelope as any)?.longitude ?? location?.lng;
            const beaconBattery = typeof parsedEnvelope?.battery === 'number' ? parsedEnvelope.battery : undefined;
            const store = useSOSStore.getState();

            // Update existing map marker with latest location by remove+re-add
            // (SOSStateManager has no in-place update method)
            const hasValidBeaconLocation = typeof beaconLat === 'number' && typeof beaconLng === 'number' && isFinite(beaconLat) && isFinite(beaconLng);
            if (hasValidBeaconLocation) {
              const existingAlert = store.incomingSOSAlerts?.find?.((a: { signalId: string }) => a.signalId === beaconSignalId);
              // Remove old entry if exists, then add updated one
              if (existingAlert) {
                store.removeIncomingSOSAlertBySignalId(beaconSignalId);
              }
              store.addIncomingSOSAlert({
                id: `mesh_${beaconSignalId}`,
                signalId: beaconSignalId,
                senderDeviceId: senderId,
                senderUid: (typeof parsedEnvelope?.senderUid === 'string' && parsedEnvelope.senderUid) || existingAlert?.senderUid || senderId,
                senderName: senderName || existingAlert?.senderName || `Mesh Peer ${senderId.substring(0, 6)}`,
                latitude: beaconLat!,
                longitude: beaconLng!,
                timestamp: Date.now(),
                message: existingAlert?.message || content || 'SOS Beacon — konum güncellendi',
                trapped: parsedEnvelope?.trapped === true || existingAlert?.trapped || false,
                battery: beaconBattery ?? existingAlert?.battery,
              });
              logger.debug(`📡 MESH SOS BEACON: ${existingAlert ? 'Updated' : 'Created'} alert for signal ${beaconSignalId} (battery: ${beaconBattery ?? 'N/A'}%)`);
            }
          } catch (beaconError) {
            logger.error('Failed to process mesh SOS beacon:', beaconError);
          }

          // SOS MULTI-HOP RELAY: Re-broadcast SOS_BEACON to extend range
          if (packet.header.ttl > 0) {
            sosRelayHandled = true;
            this.relayPacket(packet).catch(e => logger.debug('SOS_BEACON relay failed:', e));
            logger.debug(`📡 SOS_BEACON RELAY: Forwarding beacon from ${senderName || senderId} (TTL: ${packet.header.ttl} → ${packet.header.ttl - 1})`);
          }
        }

        // MESH SOS HANDLER: When receiving an SOS via mesh, also add to incomingSOSAlerts
        // so the DisasterMapScreen shows a marker for the nearby trapped/emergency user
        if (messageType === 'SOS' && !isSosControlMessage && !this.isLocalRecipient(senderId)) {
          try {
            const { useSOSStore } = require('../sos/SOSStateManager');
            const sosLat = location?.lat;
            const sosLng = location?.lng;

            // Extract trapped status from the SOS envelope boolean (primary), with text fallback
            const isTrapped = parsedEnvelope?.trapped === true
              || content?.toLowerCase().includes('enkaz')
              || content?.toLowerCase().includes('trapped')
              || false;

            const hasValidLocation = typeof sosLat === 'number' && isFinite(sosLat) && sosLat !== 0
              && typeof sosLng === 'number' && isFinite(sosLng) && sosLng !== 0;

            // Only add map marker when valid location exists — 0,0 (Gulf of Guinea) is not valid
            if (hasValidLocation) {
              useSOSStore.getState().addIncomingSOSAlert({
                id: `mesh_${messageId}`,
                signalId: messageId,
                senderDeviceId: senderId,
                senderUid: (typeof parsedEnvelope?.senderUid === 'string' && parsedEnvelope.senderUid) || (typeof parsedEnvelope?.userId === 'string' && parsedEnvelope.userId) || senderId,
                senderName: senderName || `Mesh Peer ${senderId.substring(0, 6)}`,
                latitude: sosLat,
                longitude: sosLng,
                timestamp,
                message: content || 'Acil yardım gerekiyor! (Mesh)',
                trapped: isTrapped,
              });
              logger.warn(`🚨 MESH SOS received from ${senderName || senderId} — added to map markers`);
            } else {
              logger.warn(`🚨 MESH SOS received from ${senderName || senderId} — no valid location, notification only (no map marker)`);
            }

            // ELITE V4: Direct full-screen alert for offline SOS
            // Direct emit guarantees the alert shows even if expo-notifications isn't initialized.
            let meshSosFullScreenEmitted = false;
            try {
              const { DeviceEventEmitter } = require('react-native');
              const directName = senderName || `Yakındaki Kullanıcı (${senderId.substring(0, 6)})`;
              DeviceEventEmitter.emit('SOS_FULLSCREEN_ALERT', {
                signalId: messageId,
                senderDeviceId: senderId,
                senderUid: (typeof parsedEnvelope?.senderUid === 'string' && parsedEnvelope.senderUid) || (typeof parsedEnvelope?.userId === 'string' && parsedEnvelope.userId) || senderId,
                senderName: directName,
                message: content || 'Acil yardım gerekiyor! (BLE Mesh)',
                latitude: typeof sosLat === 'number' && isFinite(sosLat) ? sosLat : undefined,
                longitude: typeof sosLng === 'number' && isFinite(sosLng) ? sosLng : undefined,
                trapped: isTrapped,
              });
              meshSosFullScreenEmitted = true;
            } catch { /* DeviceEventEmitter is always available in RN */ }

            // Show local notification ONLY if full-screen alert was NOT shown
            // (prevents double alarm sound from notification + full-screen alert)
            if (!meshSosFullScreenEmitted) {
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
            }
          } catch (sosError) {
            logger.error('Failed to add mesh SOS to incoming alerts:', sosError);
          }

          // SOS MULTI-HOP RELAY: Re-broadcast received SOS to extend range
          // This is the most critical relay — initial distress call must propagate
          if (packet.header.ttl > 0) {
            sosRelayHandled = true;
            this.relayPacket(packet).catch(e => logger.debug('SOS relay failed:', e));
            logger.debug(`📡 SOS RELAY: Forwarding SOS from ${senderName || senderId} (TTL: ${packet.header.ttl} → ${packet.header.ttl - 1})`);
          }
        }

        // MESH RESCUE ACK HANDLER: When receiving a rescue ACK via mesh,
        // update SOSStore so the SOS sender sees help is coming
        // PERF: Only parse if content looks like a RESCUE_ACK JSON
        if (content && typeof content === 'string' && content.includes('"RESCUE_ACK"') && !this.isLocalRecipient(senderId)) {
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
      await this.processLocationPacket(packet);
    }

    // Q-Mesh Relay — only relay BROADCAST messages, NOT privately-addressed ones
    // A message addressed specifically to us should NOT be forwarded to the entire mesh (privacy leak)
    // Skip if SOS handlers above already explicitly relayed this packet (prevents double-relay)
    if (packet.header.ttl > 0 && !sosRelayHandled) {
      // Check if this packet was addressed to us specifically (not broadcast)
      let to: string | undefined;
      try {
        const payloadStr = packet.payload.toString('utf8');
        const parsed = JSON.parse(payloadStr);
        to = typeof parsed.to === 'string' ? parsed.to : undefined;
      } catch { /* not JSON — relay as broadcast */ }

      const isDirectedToMe = to && this.isLocalRecipient(to);
      if (!isDirectedToMe) {
        this.relayPacket(packet).catch(e => logger.warn('Relay failed:', e));
      }
    }
  }

  private async processLocationPacket(packet: MeshPacket): Promise<void> {
    try {
      const payloadStr = packet.payload.toString('utf8');

      // --- DECRYPTION LAYER (location packets) ---
      // Location packets may be encrypted if sent via broadcastMessage().
      // Attempt decryption with same logic as chat messages.
      let decryptedStr = payloadStr;
      try {
        const maybeParsed = JSON.parse(payloadStr);
        if (maybeParsed && typeof maybeParsed === 'object' && typeof maybeParsed._enc === 'number') {
          let plaintext: string | null = null;
          if (maybeParsed._enc === ENC_BROADCAST && typeof maybeParsed.ct === 'string' && typeof maybeParsed.k === 'string') {
            if (meshCryptoService.getIsInitialized()) {
              plaintext = await meshCryptoService.decryptBroadcast(maybeParsed.ct, maybeParsed.k);
            }
          } else if (maybeParsed._enc === ENC_PEER && maybeParsed.ep && typeof maybeParsed.ep === 'object') {
            const epSenderId = typeof maybeParsed.ep.senderId === 'string' ? maybeParsed.ep.senderId : packet.header.sourceId;
            if (meshCryptoService.getIsInitialized()) {
              plaintext = await meshCryptoService.decryptMessage(epSenderId, maybeParsed.ep);
            }
          }
          if (plaintext) {
            decryptedStr = plaintext;
          }
        }
      } catch {
        // Not JSON or decryption failed — use raw payload
      }

      const locationData = JSON.parse(decryptedStr);

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

    // Sprint 16-17: Mesh hierarchy v2 — Backbone/Leaf gate.
    // Leaf cihazlar relay yapmaz (pil + bandwidth korunmasi).
    // Backbone cihazlar tum paketleri relay eder.
    // EXCEPTION: SOS variant'lar her zaman relay edilir — leaf mode'da bile, cunku life-safety.
    const isLifeSafetyPacket =
      originalPacket.header.type === MeshMessageType.SOS ||
      originalPacket.header.type === MeshMessageType.EMERGENCY_BEACON ||
      originalPacket.header.type === MeshMessageType.RESCUE_SIGNAL ||
      originalPacket.header.type === MeshMessageType.HEALTH_SOS;

    if (!isLifeSafetyPacket) {
      try {
        const { meshBackbonePeerService } = await import('./MeshBackbonePeerService');
        if (meshBackbonePeerService.isLeaf()) {
          logger.debug(`Leaf mode: skipping relay of non-life-safety packet type ${originalPacket.header.type}`);
          return;
        }
      } catch {
        // Service not available → relay anyway (graceful degradation)
      }
    }

    // CRITICAL FIX: Pass the ORIGINAL PAYLOAD (not a re-serialized full packet) to broadcastPacket.
    // broadcastPacket() will call MeshProtocol.serialize() internally — passing an already-serialized
    // packet as payloadBase64 causes DOUBLE-WRAPPING: the receiver deserializes once and gets
    // another MeshProtocol header as "payload" → garbled data.
    //
    // Use sourceIdOverride so broadcastPacket uses the original sender's ID, not this.myId.
    const relayMeshPacket: PendingMeshPacket = {
      type: originalPacket.header.type,
      payloadBase64: originalPacket.payload.toString('base64'),
      ttl: newTtl,
      priority: originalPacket.header.type === MeshMessageType.SOS ? MeshPriority.CRITICAL : MeshPriority.NORMAL,
      messageId: originalPacket.header.messageId,
      enqueuedAt: Date.now(),
      sourceIdOverride: originalPacket.header.sourceId, // Keep original sender's hex ID
    };
    const relayed = await this.broadcastPacket(relayMeshPacket);
    if (!relayed) {
      this.relayQueue.push({
        type: originalPacket.header.type,
        payloadBase64: originalPacket.payload.toString('base64'),
        ttl: newTtl,
        priority: originalPacket.header.type === MeshMessageType.SOS ? MeshPriority.CRITICAL : MeshPriority.NORMAL,
        messageId: originalPacket.header.messageId,
        enqueuedAt: Date.now(),
        sourceIdOverride: originalPacket.header.sourceId,
      });
      logger.debug('Relay deferred: added to relay queue for retry');
      return;
    }

    this.stats.packetsRelayed++;
  }

  // ===========================================================================
  // STORE-FORWARD: Deliver stored messages to a newly discovered peer
  // ===========================================================================

  /**
   * When a new peer is discovered, check if we have stored messages for them
   * and deliver them via GATT write. This is the core of store-and-forward:
   * messages queued while the peer was offline are delivered when they come
   * back into BLE range.
   */
  private deliverStoredMessagesToPeer(peerId: string): void {
    // Fire-and-forget async delivery — do not block peer discovery
    (async () => {
      try {
        const storedMessages = meshStoreForwardService.getMessagesForPeer(peerId);
        if (storedMessages.length === 0) return;

        logger.info(`📬 Delivering ${storedMessages.length} stored messages to peer ${peerId}`);
        for (const stored of storedMessages) {
          try {
            const payload = Buffer.from(stored.payload, 'base64');
            const packet = MeshProtocol.serialize(
              stored.type,
              stored.senderId,
              payload,
              stored.ttl,
              100,
              stored.messageId,
            );

            // Try GATT write to the specific peer first
            const charUUID = this.getCharacteristicForType(stored.type);
            let sent = false;
            try {
              sent = await highPerformanceBle.writeToCharacteristic(peerId, charUUID, packet);
            } catch {
              // Peer may not be GATT-connected yet — fall back to broadcast
            }

            // Fallback: broadcast via all connected peers + GATT server notification
            if (!sent) {
              const connectedPeers = highPerformanceBle.getConnectedPeerIds();
              for (const connPeerId of connectedPeers) {
                try {
                  const writeOk = await highPerformanceBle.writeToCharacteristic(connPeerId, charUUID, packet);
                  if (writeOk) { sent = true; break; }
                } catch { /* skip peer */ }
              }
              if (!sent && packet.length <= MAX_CHUNK_SIZE) {
                highPerformanceBle.notifyGATTClients(charUUID, packet);
                const gattClientCount = highPerformanceBle.getGATTServerClientCount();
                if (gattClientCount > 0) sent = true;
              }
            }

            if (sent) {
              await meshStoreForwardService.markDelivered(stored.id, peerId);
              logger.debug(`📬 Store-forward: delivered ${stored.id} to ${peerId}`);
            }
          } catch (e) {
            if (__DEV__) logger.debug('Store-forward delivery failed for message:', e);
          }
        }
      } catch (e) {
        if (__DEV__) logger.debug('Store-forward retrieval failed:', e);
      }
    })().catch((e) => { if (__DEV__) logger.debug('Store-forward IIFE error:', e); });
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

  getDiagnostics(): {
    isInitialized: boolean;
    isRunning: boolean;
    isRealMode: boolean;
    isActive: boolean;
    myDeviceId: string;
    queueDepth: {
      critical: number;
      high: number;
      normal: number;
      relay: number;
    };
    peerCount: number;
    recipientAliasCount: number;
    stats: typeof this.stats;
  } {
    const peerCount = useMeshStore.getState().peers.length;
    return {
      isInitialized: this.initialized,
      isRunning: this.isRunning,
      isRealMode: this.isRealMode,
      isActive: this.isActive,
      myDeviceId: this.myId,
      queueDepth: {
        critical: this.criticalQueue.length,
        high: this.highQueue.length,
        normal: this.normalQueue.length,
        relay: this.relayQueue.length,
      },
      peerCount,
      recipientAliasCount: this.recipientAliases.size,
      stats: { ...this.stats },
    };
  }

  // ===========================================================================
  // FULL DESTROY (for app shutdown / account switch)
  // ===========================================================================

  /**
   * Full teardown — call on app shutdown or account switch.
   * Unlike stop(), this resets all internal state so the singleton can be
   * re-initialized cleanly. stop() preserves messageListeners and initialized
   * flag for stop/start cycles; destroy() clears everything.
   */
  async destroy(): Promise<void> {
    await this.stop();

    // Reset initialized flag so initialize() can run again
    this.initialized = false;
    this.initializePromise = null;

    // Clear message listeners (stop() intentionally preserves them)
    this.messageListeners = [];

    // Clear identity state
    this.recipientAliases.clear();
    this.recipientAliases.add('me');

    // Clear all queues
    this.criticalQueue = [];
    this.highQueue = [];
    this.normalQueue = [];
    this.relayQueue = [];

    // Clear dedup
    this.seenMessageIds.clear();

    // Clear delivery check throttle map
    this.lastDeliveryCheckAt.clear();

    // Clean up ACK listener subscription
    if (this.ackReceivedUnsubscribe) {
      this.ackReceivedUnsubscribe();
      this.ackReceivedUnsubscribe = null;
    }

    // CRITICAL FIX: Destroy/cleanup sub-services to prevent resource leaks.
    // Previously, destroy() only called stop() which doesn't tear down sub-services.
    // Sub-services retain timers, BLE connections, SecureStore refs, and event listeners.
    // NOTE: Use module-level imports (not this.*) — these are singleton services.
    try { meshStoreForwardService?.destroy?.(); } catch { /* ignore */ }
    try { meshEmergencyService?.cleanup?.(); } catch { /* ignore */ }
    try { await meshCryptoService?.destroy?.(); } catch { /* ignore */ }
    try { await highPerformanceBle?.destroy?.(); } catch { /* ignore */ }

    logger.info('MeshNetworkService fully destroyed');
  }

  // Helpers
  private hasPendingCritical(): boolean { return this.criticalQueue.length > 0; }
  private hasPendingHigh(): boolean { return this.highQueue.length > 0; }
  private hasPendingNormal(): boolean { return this.normalQueue.length > 0; }
  private hasPendingRelay(): boolean { return this.relayQueue.length > 0; }
}

export const meshNetworkService = new MeshNetworkService();
export default meshNetworkService;
