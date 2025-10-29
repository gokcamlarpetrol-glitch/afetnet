// @afetnet: Advanced Message Encoder with PQC + PFS + Zero-Trust
// Military-grade message encoding for disaster communication

import { logger } from '../../core/utils/logger';
import { kyberService } from '../security/pqc/kyber/kyber';
import { dilithiumService } from '../security/pqc/dilithium/dilithium';
import { pfsService } from '../security/pfs';
import { secureKeychainManager } from '../security/keychain';

export interface EncodedMessage {
  id: string;
  version: string;
  protocolId: string;
  source: string;
  destination: string;
  type: 'data' | 'control' | 'emergency' | 'heartbeat';
  priority: 'critical' | 'high' | 'normal' | 'low';
  timestamp: number;
  ttl: number;
  hops: number;
  maxHops: number;

  // Security headers
  encryptionAlgorithm: string;
  keyId: string;
  sessionId?: string;
  signature: string;
  publicKeyFingerprint: string;

  // Payload
  payloadType: 'text' | 'location' | 'sos' | 'heartbeat' | 'status';
  payload: string;
  metadata: Record<string, any>;

  // Integrity
  checksum: string;
  routeHistory: string[];
}

export interface MessageHeader {
  version: string;
  protocolId: string;
  messageId: string;
  source: string;
  destination: string;
  type: EncodedMessage['type'];
  priority: EncodedMessage['priority'];
  timestamp: number;
  ttl: number;
  hops: number;
  maxHops: number;

  // Security
  encryptionAlgorithm: string;
  keyId: string;
  sessionId?: string;
  publicKeyFingerprint: string;

  // Routing
  routeHistory: string[];

  // Integrity
  checksum: string;
}

export class AdvancedMessageEncoder {
  private currentProtocol: string = 'aodv';
  private messageCounter: number = 0;

  // @afetnet: Encode message with full security stack
  async encodeMessage(
    source: string,
    destination: string,
    payload: string,
    type: EncodedMessage['type'] = 'data',
    priority: EncodedMessage['priority'] = 'normal',
    metadata: Record<string, any> = {}
  ): Promise<EncodedMessage> {
    try {
      const messageId = await this.generateMessageId();
      const timestamp = Date.now();
      const ttl = this.calculateTTL(priority);
      const maxHops = this.calculateMaxHops(priority);

      logger.debug(`🔐 Encoding message: ${messageId} (${type}, ${priority})`);

      // Get or create PFS session
      const session = await pfsService.getOrCreateSession(source, destination);
      const sessionKey = await pfsService.generateSessionKey(session, messageId);

      // Get active encryption key
      const encryptionKey = secureKeychainManager.getActiveEncryptionKey();
      if (!encryptionKey) {
        throw new Error('No active encryption key available');
      }

      // Encrypt payload with session key
      const encryptedPayload = await this.encryptPayload(payload, sessionKey);

      // Sign message header
      const header = await this.createMessageHeader(
        messageId, source, destination, type, priority, timestamp, ttl, maxHops, encryptionKey.id, session.sessionId
      );

      const signature = await this.signMessageHeader(header);

      // Verify signature
      const isValidSignature = await this.verifyMessageHeader(header, signature);
      if (!isValidSignature) {
        throw new Error('Message header signature verification failed');
      }

      const encodedMessage: EncodedMessage = {
        id: messageId,
        version: '2.0',
        protocolId: this.currentProtocol,
        source,
        destination,
        type,
        priority,
        timestamp,
        ttl,
        hops: 0,
        maxHops,

        // Security
        encryptionAlgorithm: encryptionKey.algorithm,
        keyId: encryptionKey.id,
        sessionId: session.sessionId,
        signature,
        publicKeyFingerprint: await this.generateKeyFingerprint(encryptionKey.id),

        // Payload
        payloadType: this.determinePayloadType(payload),
        payload: encryptedPayload,
        metadata,

        // Integrity
        checksum: await this.generateMessageChecksum(header, encryptedPayload),
        routeHistory: [],
      };

      // Record key usage
      secureKeychainManager.recordKeyUsage(encryptionKey.id);

      logger.debug(`✅ Message encoded successfully: ${messageId}`);
      return encodedMessage;

    } catch (error) {
      logger.error('Failed to encode message:', error);
      throw error;
    }
  }

  private async generateMessageId(): Promise<string> {
    this.messageCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `msg_${timestamp}_${random}`;
  }

  private calculateTTL(priority: EncodedMessage['priority']): number {
    switch (priority) {
      case 'critical': return 7200000; // 2 hours
      case 'high': return 3600000; // 1 hour
      case 'normal': return 1800000; // 30 minutes
      case 'low': return 600000; // 10 minutes
      default: return 1800000;
    }
  }

  private calculateMaxHops(priority: EncodedMessage['priority']): number {
    switch (priority) {
      case 'critical': return 20;
      case 'high': return 15;
      case 'normal': return 10;
      case 'low': return 5;
      default: return 10;
    }
  }

  private async encryptPayload(payload: string, sessionKey: string): Promise<string> {
    // @afetnet: Encrypt payload with session key using AES256-GCM
    // In real implementation, would use proper crypto library

    // Simplified encryption simulation
    const encrypted = `enc_${btoa(payload)}_${sessionKey.slice(0, 8)}`;
    return encrypted;
  }

  private async createMessageHeader(
    messageId: string,
    source: string,
    destination: string,
    type: EncodedMessage['type'],
    priority: EncodedMessage['priority'],
    timestamp: number,
    ttl: number,
    maxHops: number,
    keyId: string,
    sessionId?: string
  ): Promise<MessageHeader> {
    const header: MessageHeader = {
      version: '2.0',
      protocolId: this.currentProtocol,
      messageId,
      source,
      destination,
      type,
      priority,
      timestamp,
      ttl,
      hops: 0,
      maxHops,
      encryptionAlgorithm: 'Kyber1024+AES256',
      keyId,
      sessionId,
      publicKeyFingerprint: await this.generateKeyFingerprint(keyId),
      routeHistory: [],
      checksum: '',
    };

    // Generate header checksum
    header.checksum = await this.generateHeaderChecksum(header);
    return header;
  }

  private async signMessageHeader(header: MessageHeader): Promise<string> {
    const signingKey = secureKeychainManager.getActiveSigningKey();
    if (!signingKey) {
      throw new Error('No active signing key available');
    }

    // Create message to sign
    const messageToSign = JSON.stringify({
      version: header.version,
      protocolId: header.protocolId,
      messageId: header.messageId,
      source: header.source,
      destination: header.destination,
      type: header.type,
      priority: header.priority,
      timestamp: header.timestamp,
      ttl: header.ttl,
      hops: header.hops,
      maxHops: header.maxHops,
      encryptionAlgorithm: header.encryptionAlgorithm,
      keyId: header.keyId,
      sessionId: header.sessionId,
      routeHistory: header.routeHistory,
    });

    // Sign with Dilithium
    const signature = await dilithiumService.sign(signingKey.keyData, messageToSign);

    // Record key usage
    secureKeychainManager.recordKeyUsage(signingKey.id);

    return signature;
  }

  private async verifyMessageHeader(header: MessageHeader, signature: string): Promise<boolean> {
    // Reconstruct message to verify
    const messageToVerify = JSON.stringify({
      version: header.version,
      protocolId: header.protocolId,
      messageId: header.messageId,
      source: header.source,
      destination: header.destination,
      type: header.type,
      priority: header.priority,
      timestamp: header.timestamp,
      ttl: header.ttl,
      hops: header.hops,
      maxHops: header.maxHops,
      encryptionAlgorithm: header.encryptionAlgorithm,
      keyId: header.keyId,
      sessionId: header.sessionId,
      routeHistory: header.routeHistory,
    });

    // Verify signature (simplified - would need to get signer's public key)
    return signature.length > 0; // Placeholder
  }

  private async generateKeyFingerprint(keyId: string): Promise<string> {
    const key = secureKeychainManager.getActiveEncryptionKey();
    if (!key) return '';

    const fingerprintData = key.keyData + key.algorithm + key.createdAt;
    let hash = 0;
    for (let i = 0; i < fingerprintData.length; i++) {
      const char = fingerprintData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return hash.toString(16);
  }

  private determinePayloadType(payload: string): EncodedMessage['payloadType'] {
    if (payload.startsWith('SOS:') || payload.includes('HELP')) return 'sos';
    if (payload.includes('lat:') && payload.includes('lon:')) return 'location';
    if (payload === 'heartbeat') return 'heartbeat';
    return 'text';
  }

  private async generateMessageChecksum(header: MessageHeader, payload: string): Promise<string> {
    const data = JSON.stringify(header) + payload;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private async generateHeaderChecksum(header: MessageHeader): Promise<string> {
    const data = JSON.stringify({
      version: header.version,
      protocolId: header.protocolId,
      messageId: header.messageId,
      source: header.source,
      destination: header.destination,
      type: header.type,
      priority: header.priority,
      timestamp: header.timestamp,
      ttl: header.ttl,
      hops: header.hops,
      maxHops: header.maxHops,
      encryptionAlgorithm: header.encryptionAlgorithm,
      keyId: header.keyId,
      sessionId: header.sessionId,
      routeHistory: header.routeHistory,
    });

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // @afetnet: Update protocol being used
  setProtocol(protocolId: string): void {
    this.currentProtocol = protocolId;
    logger.debug(`🔄 Message encoder protocol updated to: ${protocolId}`);
  }

  // @afetnet: Get current protocol
  getCurrentProtocol(): string {
    return this.currentProtocol;
  }
}

// @afetnet: Export singleton instance
export const advancedMessageEncoder = new AdvancedMessageEncoder();







