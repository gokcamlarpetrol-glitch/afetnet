/**
 * BLE MESH PROTOCOL - ELITE V3
 * Ultra-compact binary protocol for offline disaster communication.
 * 
 * V3 FEATURES:
 * - ACK system with delivery tracking
 * - Media chunk transfer
 * - Emergency broadcast priority
 * - Store & Forward markers
 * - Encryption flag support
 */

import { Buffer } from 'buffer';

// ELITE V3: Extended message types for full disaster-ready functionality
export enum MeshMessageType {
  // Core Messages
  SOS = 0x01,           // Emergency SOS (max priority)
  STATUS = 0x02,        // User status update
  TEXT = 0x03,          // Chat message
  PING = 0x04,          // Heartbeat/discovery
  ACK = 0x05,           // Delivery acknowledgment
  LOCATION = 0x06,      // GPS coordinates

  // V3: Media Messages
  MEDIA_CHUNK = 0x10,   // Media file chunk
  MEDIA_START = 0x11,   // Start of media transfer
  MEDIA_END = 0x12,     // End of media transfer
  VOICE_CLIP = 0x13,    // Short voice message

  // V3: Store & Forward
  STORE_REQUEST = 0x20, // Request stored messages
  STORE_DELIVERY = 0x21, // Deliver stored message
  MAILBOX_QUERY = 0x22, // Query peer mailbox

  // V3: Emergency Features
  EMERGENCY_BEACON = 0x30, // Auto emergency beacon
  FAMILY_SEARCH = 0x31,    // Search for family member
  RESCUE_SIGNAL = 0x32,    // Professional rescue signal

  // V3: Key Exchange (for encryption)
  KEY_EXCHANGE = 0x40,  // Public key exchange
  ENCRYPTED = 0x41,     // Encrypted payload marker
}

// Priority levels for queue management
export enum MeshPriority {
  CRITICAL = 0,  // SOS, Emergency - Always sent first
  HIGH = 1,      // Status, Family search
  NORMAL = 2,    // Chat, media
  LOW = 3,       // Maintenance, heartbeat
  RELAY = 4,     // Forwarded messages
}

export interface MeshPacket {
  header: {
    magic: number;      // 0xAF (1 byte)
    version: number;    // 0x01 (1 byte)
    type: MeshMessageType; // (1 byte)
    ttl: number;        // Time To Live (hops) (1 byte)
    qScore: number;     // Quality Score (0-100) (1 byte) - NEW
    sourceId: string;   // Device ID partial hash (4 bytes)
    messageId: number;  // Unique msg ID (4 bytes)
  };
  payload: Buffer;
  receivedRssi?: number; // Local property, not transmitted
}

const MAGIC_BYTE = 0xAF;
const PROTOCOL_VERSION = 0x02; // Bump version
const HEADER_SIZE = 13; // 1+1+1+1+1(Q)+4+4

export class MeshProtocol {
  /**
     * Serialize a packet into a binary buffer
     */
  static serialize(type: MeshMessageType, sourceId: string | number, payload: Buffer, ttl: number = 3, qScore: number = 100, messageId?: number): Buffer {
    const msgId = messageId !== undefined ? messageId : Math.floor(Math.random() * 0xFFFFFFFF);
    const buffer = Buffer.alloc(HEADER_SIZE + payload.length);
    let offset = 0;

    // Header
    buffer.writeUInt8(MAGIC_BYTE, offset++);
    buffer.writeUInt8(PROTOCOL_VERSION, offset++);
    buffer.writeUInt8(type, offset++);
    buffer.writeUInt8(ttl, offset++);
    buffer.writeUInt8(qScore, offset++); // Q-Score

    // Source ID
    // Source ID
    let sourceIdHash: number;
    if (typeof sourceId === 'number') {
      sourceIdHash = sourceId;
    } else {
      sourceIdHash = this.hashString(sourceId);
    }

    buffer.writeUInt32BE(sourceIdHash, offset);
    offset += 4;

    // Message ID
    buffer.writeUInt32BE(msgId, offset);
    offset += 4;


    // Payload
    payload.copy(buffer, offset);

    return buffer;
  }

  /**
     * Deserialize a binary buffer into a packet
     */
  static deserialize(buffer: Buffer): MeshPacket | null {
    if (buffer.length < HEADER_SIZE) return null;
    let offset = 0;

    const magic = buffer.readUInt8(offset++);
    if (magic !== MAGIC_BYTE) return null;

    const version = buffer.readUInt8(offset++);
    // Allow version 1 and 2 compat if needed, but for now enforce 2
    // if (version !== PROTOCOL_VERSION) return null;

    const type = buffer.readUInt8(offset++) as MeshMessageType;
    const ttl = buffer.readUInt8(offset++);
    const qScore = version >= 0x02 ? buffer.readUInt8(offset++) : 50; // Q-Score reading

    const sourceIdHash = buffer.readUInt32BE(offset);
    offset += 4;

    const messageId = buffer.readUInt32BE(offset);
    offset += 4;

    const payload = buffer.slice(offset);

    return {
      header: {
        magic,
        version,
        type,
        ttl,
        qScore,
        sourceId: sourceIdHash.toString(16),
        messageId,
      },
      payload,
    };
  }

  /**
     * Create an SOS payload (Lat, Lon, Status Code)
     * Compacts location into 8 bytes (4 lat, 4 lon)
     */
  static createSOSPayload(lat: number, lon: number, status: number): Buffer {
    const buffer = Buffer.alloc(9);
    buffer.writeFloatBE(lat, 0);
    buffer.writeFloatBE(lon, 4);
    buffer.writeUInt8(status, 8);
    return buffer;
  }

  /**
   * Parse SOS payload
   */
  static parseSOSPayload(buffer: Buffer) {
    if (buffer.length < 9) return null;
    return {
      latitude: buffer.readFloatBE(0),
      longitude: buffer.readFloatBE(4),
      status: buffer.readUInt8(8),
    };
  }

  // ===========================================================================
  // V3: ACK SYSTEM
  // ===========================================================================

  /**
   * Create ACK payload for delivery confirmation
   * Format: [originalMsgId:4][ackType:1][receiverIdHash:4]
   */
  static createACKPayload(originalMessageId: number, ackType: 'received' | 'delivered' | 'read', receiverId: string): Buffer {
    const buffer = Buffer.alloc(9);
    buffer.writeUInt32BE(originalMessageId, 0);

    const ackTypeByte = ackType === 'received' ? 0x01 : ackType === 'delivered' ? 0x02 : 0x03;
    buffer.writeUInt8(ackTypeByte, 4);

    buffer.writeUInt32BE(this.hashString(receiverId), 5);
    return buffer;
  }

  /**
   * Parse ACK payload
   */
  static parseACKPayload(buffer: Buffer) {
    if (buffer.length < 9) return null;
    const ackTypeByte = buffer.readUInt8(4);
    return {
      originalMessageId: buffer.readUInt32BE(0),
      ackType: ackTypeByte === 0x01 ? 'received' : ackTypeByte === 0x02 ? 'delivered' : 'read',
      receiverIdHash: buffer.readUInt32BE(5).toString(16),
    };
  }

  // ===========================================================================
  // V3: MEDIA CHUNK SYSTEM
  // ===========================================================================

  /**
   * Create media chunk header
   * Format: [totalChunks:2][chunkIndex:2][mediaId:4][data...N]
   */
  static createMediaChunkPayload(mediaId: number, chunkIndex: number, totalChunks: number, data: Buffer): Buffer {
    const header = Buffer.alloc(8);
    header.writeUInt16BE(totalChunks, 0);
    header.writeUInt16BE(chunkIndex, 2);
    header.writeUInt32BE(mediaId, 4);
    return Buffer.concat([header, data]);
  }

  /**
   * Parse media chunk payload
   */
  static parseMediaChunkPayload(buffer: Buffer) {
    if (buffer.length < 8) return null;
    return {
      totalChunks: buffer.readUInt16BE(0),
      chunkIndex: buffer.readUInt16BE(2),
      mediaId: buffer.readUInt32BE(4),
      data: buffer.slice(8),
    };
  }

  /**
   * Create media start payload
   * Format: [mediaId:4][mediaType:1][totalSize:4][filename...N]
   */
  static createMediaStartPayload(mediaId: number, mediaType: 'image' | 'voice' | 'file', totalSize: number, filename?: string): Buffer {
    const typeMap = { image: 0x01, voice: 0x02, file: 0x03 };
    const filenameBytes = filename ? Buffer.from(filename, 'utf-8') : Buffer.alloc(0);

    const buffer = Buffer.alloc(9 + filenameBytes.length);
    buffer.writeUInt32BE(mediaId, 0);
    buffer.writeUInt8(typeMap[mediaType], 4);
    buffer.writeUInt32BE(totalSize, 5);
    filenameBytes.copy(buffer, 9);

    return buffer;
  }

  // ===========================================================================
  // V3: EMERGENCY SYSTEM
  // ===========================================================================

  /**
   * Create Emergency Beacon payload
   * Format: [lat:4][lon:4][batteryLevel:1][timestamp:4][reasonCode:1][userName...N]
   */
  static createEmergencyBeaconPayload(
    lat: number,
    lon: number,
    batteryLevel: number,
    reasonCode: number,
    userName?: string
  ): Buffer {
    const nameBytes = userName ? Buffer.from(userName.substring(0, 20), 'utf-8') : Buffer.alloc(0);
    const buffer = Buffer.alloc(14 + nameBytes.length);

    buffer.writeFloatBE(lat, 0);
    buffer.writeFloatBE(lon, 4);
    buffer.writeUInt8(Math.min(100, batteryLevel), 8);
    buffer.writeUInt32BE(Math.floor(Date.now() / 1000), 9); // Unix timestamp
    buffer.writeUInt8(reasonCode, 13);
    nameBytes.copy(buffer, 14);

    return buffer;
  }

  /**
   * Parse Emergency Beacon payload
   */
  static parseEmergencyBeaconPayload(buffer: Buffer) {
    if (buffer.length < 14) return null;
    return {
      latitude: buffer.readFloatBE(0),
      longitude: buffer.readFloatBE(4),
      batteryLevel: buffer.readUInt8(8),
      timestamp: buffer.readUInt32BE(9) * 1000,
      reasonCode: buffer.readUInt8(13),
      userName: buffer.length > 14 ? buffer.slice(14).toString('utf-8') : undefined,
    };
  }

  /**
   * Create Location Update payload (compact)
   * Format: [lat:4][lon:4][accuracy:2][speed:1][heading:2]
   */
  static createLocationPayload(lat: number, lon: number, accuracy: number = 0, speed: number = 0, heading: number = 0): Buffer {
    const buffer = Buffer.alloc(13);
    buffer.writeFloatBE(lat, 0);
    buffer.writeFloatBE(lon, 4);
    buffer.writeUInt16BE(Math.min(65535, accuracy), 8);
    buffer.writeUInt8(Math.min(255, speed), 10);
    buffer.writeUInt16BE(Math.min(360, heading), 11);
    return buffer;
  }

  /**
   * Parse Location payload
   */
  static parseLocationPayload(buffer: Buffer) {
    if (buffer.length < 13) return null;
    return {
      latitude: buffer.readFloatBE(0),
      longitude: buffer.readFloatBE(4),
      accuracy: buffer.readUInt16BE(8),
      speed: buffer.readUInt8(10),
      heading: buffer.readUInt16BE(11),
    };
  }

  // ===========================================================================
  // V3: STORE & FORWARD
  // ===========================================================================

  /**
   * Create Store Request payload
   * Format: [targetDeviceIdHash:4][lastKnownMsgId:4]
   */
  static createStoreRequestPayload(targetDeviceId: string, lastKnownMsgId: number = 0): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(this.hashString(targetDeviceId), 0);
    buffer.writeUInt32BE(lastKnownMsgId, 4);
    return buffer;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Get priority for message type
   */
  static getPriorityForType(type: MeshMessageType): MeshPriority {
    switch (type) {
      case MeshMessageType.SOS:
      case MeshMessageType.EMERGENCY_BEACON:
      case MeshMessageType.RESCUE_SIGNAL:
        return MeshPriority.CRITICAL;
      case MeshMessageType.STATUS:
      case MeshMessageType.FAMILY_SEARCH:
      case MeshMessageType.ACK:
        return MeshPriority.HIGH;
      case MeshMessageType.PING:
        return MeshPriority.LOW;
      default:
        return MeshPriority.NORMAL;
    }
  }

  /**
   * Check if message type requires ACK
   */
  static requiresACK(type: MeshMessageType): boolean {
    return [
      MeshMessageType.TEXT,
      MeshMessageType.SOS,
      MeshMessageType.MEDIA_END,
      MeshMessageType.FAMILY_SEARCH,
    ].includes(type);
  }

  private static hashString(str: string): number {
    let hash = 5381;
    let i = str.length;
    while (i) {
      hash = (hash * 33) ^ str.charCodeAt(--i);
    }
    return hash >>> 0;
  }
}
