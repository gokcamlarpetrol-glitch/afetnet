/**
 * MESH SERVICES INDEX - ELITE V4
 * Centralized exports for all mesh network services.
 */

// Core Store
export { useMeshStore } from './MeshStore';
export type { MeshNode, MeshMessage, MessageReaction, MeshMessageReaction, TypingUser } from './MeshStore';

// Protocol
export { MeshProtocol, MeshMessageType, MeshPriority } from './MeshProtocol';
export type { MeshPacket } from './MeshProtocol';

// Network Service
export { meshNetworkService } from './MeshNetworkService';

// Store & Forward
export { meshStoreForwardService } from './MeshStoreForwardService';
export type { StoredMessage, PendingACK, Mailbox } from './MeshStoreForwardService';

// Emergency Service
export { meshEmergencyService, EmergencyReasonCode } from './MeshEmergencyService';
export type { FamilyMember, EmergencySettings } from './MeshEmergencyService';

// Q-Mesh Protocol (Low-Level)
export { QMeshProtocol, PacketType, PacketPriority } from './QMeshProtocol';
export type { QMeshPacket } from './QMeshProtocol';

// Message Bridge
export { meshMessageBridge } from './MeshMessageBridge';
export type { BridgedMessage, MessageSource } from './MeshMessageBridge';

// Media Service
export { meshMediaService } from './MeshMediaService';
export type { MediaTransfer, MediaChunk, LocationPayload, MediaType } from './MeshMediaService';

// Crypto Service
export { meshCryptoService } from './MeshCryptoService';
export type { EncryptedPayload, PeerKey, KeyPair } from './MeshCryptoService';

// Battery Optimization
export { batteryOptimizedScanner, SCAN_PROFILES, BATTERY_THRESHOLDS } from './BatteryOptimizedScanner';
export type { ScanProfile } from './BatteryOptimizedScanner';

// Background Service
export { backgroundMeshService, TASK_NAMES } from './BackgroundMeshService';

// Power Manager
export { meshPowerManager } from './MeshPowerManager';
export type { PowerMode, PowerState } from './MeshPowerManager';

// Constants
export {
    BLE_SCAN_DURATION_MS,
    BLE_ADVERTISE_DURATION_MS,
    BLE_HEARTBEAT_INTERVAL_MS,
    BLE_LOOP_INTERVAL_MS,
    PEER_STALE_TIMEOUT_MS,
    MESSAGE_DEFAULT_TTL,
    MAX_SEEN_MESSAGE_IDS,
    STORAGE_KEYS,
} from '../messaging/constants';

