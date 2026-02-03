/**
 * Q-MESH PROTOCOL V2
 * Low-level packet structure and encoding/decoding logic.
 * Optimized for BLE MTU limits (expected 512 bytes, min 23 bytes).
 */

import { Buffer } from 'buffer';

// Protocol Constants
export const PROTOCOL_VERSION = 1;

export enum PacketType {
    HELLO = 0x01,
    MESSAGE = 0x02,
    ACK = 0x03,
    HEARTBEAT = 0x04,
    SYNC_REQ = 0x05,
}

export enum PacketPriority {
    CRITICAL = 0, // SOS
    HIGH = 1,     // Status / Location
    NORMAL = 2,   // Chat
    LOW = 3,      // Maintenance
}

export interface QMeshHeader {
    version: number;        // 1 byte
    type: PacketType;       // 1 byte
    ttl: number;            // 1 byte (Time To Live / Hops)
    priority: PacketPriority; // 1 byte
    senderIdShort: string;  // 8 bytes (First 8 chars of Device ID)
    packetIdShort: string;  // 8 bytes (First 8 chars of Message ID)
}

export interface QMeshPacket {
    header: QMeshHeader;
    payload: Buffer;
    originalSize: number;
}

export class QMeshProtocol {
  private myDeviceId: string;

  constructor(deviceId: string) {
    this.myDeviceId = deviceId;
  }

  /**
     * Encode a packet into a Buffer ready for BLE transmission
     */
  encode(
    type: PacketType,
    payload: string | Buffer,
    ttl: number = 3,
    priority: PacketPriority = PacketPriority.NORMAL,
    packetId?: string,
  ): Buffer {

    // 1. Prepare Header Data
    const senderBytes = Buffer.from(this.myDeviceId.substring(0, 8), 'utf-8'); // Simple hash/truncate
    const pId = packetId || Math.random().toString(36).substring(2, 10);
    const packetIdBytes = Buffer.from(pId.substring(0, 8), 'utf-8');

    // 2. Prepare Payload
    const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');

    // 3. Construct Buffer
    // Header Size: 1 + 1 + 1 + 1 + 8 + 8 = 20 bytes
    const buffer = Buffer.alloc(20 + payloadBuffer.length);

    let offset = 0;

    // [0] Version
    buffer.writeUInt8(PROTOCOL_VERSION, offset++);

    // [1] Type
    buffer.writeUInt8(type, offset++);

    // [2] TTL
    buffer.writeUInt8(ttl, offset++);

    // [3] Priority
    buffer.writeUInt8(priority, offset++);

    // [4-11] Sender ID Short
    senderBytes.copy(buffer, offset, 0, 8);
    offset += 8;

    // [12-19] Packet ID Short
    packetIdBytes.copy(buffer, offset, 0, 8);
    offset += 8;

    // [20+] Payload
    payloadBuffer.copy(buffer, offset);

    return buffer;
  }

  /**
     * Decode a received Buffer into a QMeshPacket
     */
  decode(buffer: Buffer): QMeshPacket | null {
    if (buffer.length < 20) return null; // Header too short

    let offset = 0;

    const version = buffer.readUInt8(offset++);
    if (version !== PROTOCOL_VERSION) return null; // Version mismatch

    const type = buffer.readUInt8(offset++);
    const ttl = buffer.readUInt8(offset++);
    const priority = buffer.readUInt8(offset++);

    const senderIdShort = buffer.toString('utf-8', offset, offset + 8);
    offset += 8;

    const packetIdShort = buffer.toString('utf-8', offset, offset + 8);
    offset += 8;

    const payload = buffer.subarray(offset);

    return {
      header: {
        version,
        type,
        ttl,
        priority,
        senderIdShort,
        packetIdShort,
      },
      payload,
      originalSize: buffer.length,
    };
  }

  /**
     * Helper: Generate ACK Packet
     */
  createAck(targetPacketIdShort: string): Buffer {
    return this.encode(PacketType.ACK, targetPacketIdShort, 1, PacketPriority.HIGH);
  }
}
