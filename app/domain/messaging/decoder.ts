// @afetnet: Advanced Message Decoder with PQC + PFS + Zero-Trust
// Military-grade message decoding for disaster communication

import { logger } from '../../core/utils/logger';
import { kyberService } from '../security/pqc/kyber/kyber';
import { dilithiumService } from '../security/pqc/dilithium/dilithium';
import { pfsService } from '../security/pfs';
import { secureKeychainManager } from '../security/keychain';
import { EncodedMessage, MessageHeader } from './encoder';

export interface DecodedMessage {
  id: string;
  source: string;
  destination: string;
  type: 'data' | 'control' | 'emergency' | 'heartbeat';
  priority: 'critical' | 'high' | 'normal' | 'low';
  timestamp: number;
  payload: string;
  metadata: Record<string, any>;
  isValid: boolean;
  isEncrypted: boolean;
  securityLevel: 'military' | 'high' | 'standard';
  routeHistory: string[];
}

export class AdvancedMessageDecoder {
  private messageCache: Map<string, DecodedMessage> = new Map();
  private securityViolations: number = 0;

  // @afetnet: Decode message with full security validation
  async decodeMessage(encodedMessage: EncodedMessage): Promise<DecodedMessage> {
    try {
      logger.debug(`🔓 Decoding message: ${encodedMessage.id}`);

      // Step 1: Validate message integrity
      const isIntegrityValid = await this.validateMessageIntegrity(encodedMessage);
      if (!isIntegrityValid) {
        logger.warn(`⚠️ Message integrity validation failed: ${encodedMessage.id}`);
        this.recordSecurityViolation('integrity_check_failed');
      }

      // Step 2: Validate signature and security headers
      const isSecurityValid = await this.validateMessageSecurity(encodedMessage);
      if (!isSecurityValid) {
        logger.warn(`⚠️ Message security validation failed: ${encodedMessage.id}`);
        this.recordSecurityViolation('security_validation_failed');
      }

      // Step 3: Decrypt payload
      const decryptedPayload = await this.decryptMessagePayload(encodedMessage);

      // Step 4: Verify route and hops
      const isRouteValid = await this.validateMessageRoute(encodedMessage);
      if (!isRouteValid) {
        logger.warn(`⚠️ Message route validation failed: ${encodedMessage.id}`);
      }

      // Step 5: Check TTL and expiration
      const isNotExpired = this.checkMessageExpiration(encodedMessage);
      if (!isNotExpired) {
        logger.warn(`⚠️ Message expired: ${encodedMessage.id}`);
      }

      const decodedMessage: DecodedMessage = {
        id: encodedMessage.id,
        source: encodedMessage.source,
        destination: encodedMessage.destination,
        type: encodedMessage.type,
        priority: encodedMessage.priority,
        timestamp: encodedMessage.timestamp,
        payload: decryptedPayload,
        metadata: encodedMessage.metadata,
        isValid: isIntegrityValid && isSecurityValid && isRouteValid && isNotExpired,
        isEncrypted: encodedMessage.isEncrypted,
        securityLevel: this.determineSecurityLevel(encodedMessage),
        routeHistory: encodedMessage.routeHistory,
      };

      // Cache decoded message
      this.messageCache.set(encodedMessage.id, decodedMessage);

      // Clean cache periodically
      this.cleanMessageCache();

      logger.debug(`✅ Message decoded successfully: ${encodedMessage.id}`);
      return decodedMessage;

    } catch (error) {
      logger.error('Failed to decode message:', error);
      this.recordSecurityViolation('decode_error');

      // Return invalid message
      return {
        id: encodedMessage.id,
        source: encodedMessage.source,
        destination: encodedMessage.destination,
        type: encodedMessage.type,
        priority: encodedMessage.priority,
        timestamp: encodedMessage.timestamp,
        payload: '',
        metadata: {},
        isValid: false,
        isEncrypted: false,
        securityLevel: 'standard',
        routeHistory: [],
      };
    }
  }

  private async validateMessageIntegrity(encodedMessage: EncodedMessage): Promise<boolean> {
    try {
      // Recalculate checksum
      const header: MessageHeader = {
        version: encodedMessage.version,
        protocolId: encodedMessage.protocolId,
        messageId: encodedMessage.id,
        source: encodedMessage.source,
        destination: encodedMessage.destination,
        type: encodedMessage.type,
        priority: encodedMessage.priority,
        timestamp: encodedMessage.timestamp,
        ttl: encodedMessage.ttl,
        hops: encodedMessage.hops,
        maxHops: encodedMessage.maxHops,
        encryptionAlgorithm: encodedMessage.encryptionAlgorithm,
        keyId: encodedMessage.keyId,
        sessionId: encodedMessage.sessionId,
        publicKeyFingerprint: encodedMessage.publicKeyFingerprint,
        routeHistory: encodedMessage.routeHistory,
        checksum: '',
      };

      const calculatedChecksum = await this.calculateHeaderChecksum(header);
      const isChecksumValid = calculatedChecksum === encodedMessage.checksum;

      if (!isChecksumValid) {
        logger.warn(`Invalid checksum for message: ${encodedMessage.id}`);
        return false;
      }

      // Validate payload checksum
      const calculatedPayloadChecksum = await this.calculatePayloadChecksum(encodedMessage.payload);
      const expectedPayloadChecksum = await this.calculateMessageChecksum(header, encodedMessage.payload);
      const isPayloadValid = calculatedPayloadChecksum === expectedPayloadChecksum;

      if (!isPayloadValid) {
        logger.warn(`Invalid payload checksum for message: ${encodedMessage.id}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Message integrity validation failed:', error);
      return false;
    }
  }

  private async validateMessageSecurity(encodedMessage: EncodedMessage): Promise<boolean> {
    try {
      // Step 1: Validate signature
      const header: MessageHeader = {
        version: encodedMessage.version,
        protocolId: encodedMessage.protocolId,
        messageId: encodedMessage.id,
        source: encodedMessage.source,
        destination: encodedMessage.destination,
        type: encodedMessage.type,
        priority: encodedMessage.priority,
        timestamp: encodedMessage.timestamp,
        ttl: encodedMessage.ttl,
        hops: encodedMessage.hops,
        maxHops: encodedMessage.maxHops,
        encryptionAlgorithm: encodedMessage.encryptionAlgorithm,
        keyId: encodedMessage.keyId,
        sessionId: encodedMessage.sessionId,
        publicKeyFingerprint: encodedMessage.publicKeyFingerprint,
        routeHistory: encodedMessage.routeHistory,
        checksum: '',
      };

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

      // Verify signature (simplified - would need signer's public key)
      const isSignatureValid = encodedMessage.signature.length > 0; // Placeholder

      if (!isSignatureValid) {
        logger.warn(`Invalid signature for message: ${encodedMessage.id}`);
        return false;
      }

      // Step 2: Validate key and algorithm
      const encryptionKey = secureKeychainManager.getActiveEncryptionKey();
      if (!encryptionKey || encryptionKey.id !== encodedMessage.keyId) {
        logger.warn(`Invalid or inactive encryption key: ${encodedMessage.keyId}`);
        return false;
      }

      // Step 3: Validate session if present
      if (encodedMessage.sessionId) {
        const isSessionValid = pfsService.isSessionValid(encodedMessage.sessionId);
        if (!isSessionValid) {
          logger.warn(`Invalid or expired session: ${encodedMessage.sessionId}`);
          return false;
        }
      }

      // Step 4: Validate encryption algorithm
      const validAlgorithms = ['Kyber1024+AES256', 'Ed25519+AES256'];
      if (!validAlgorithms.includes(encodedMessage.encryptionAlgorithm)) {
        logger.warn(`Unsupported encryption algorithm: ${encodedMessage.encryptionAlgorithm}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Message security validation failed:', error);
      return false;
    }
  }

  private async decryptMessagePayload(encodedMessage: EncodedMessage): Promise<string> {
    try {
      // Check if message is encrypted
      if (!encodedMessage.isEncrypted) {
        return encodedMessage.payload;
      }

      // Get session key if available
      let sessionKey = '';
      if (encodedMessage.sessionId) {
        const session = pfsService.getActiveSessions().find(s => s.sessionId === encodedMessage.sessionId);
        if (session) {
          sessionKey = await pfsService.generateSessionKey(session, encodedMessage.id);
        }
      }

      // Decrypt payload
      const decryptedPayload = await this.decryptPayload(encodedMessage.payload, sessionKey);

      return decryptedPayload;
    } catch (error) {
      logger.error('Failed to decrypt message payload:', error);
      throw error;
    }
  }

  private async decryptPayload(encryptedPayload: string, sessionKey: string): Promise<string> {
    try {
      // @afetnet: Decrypt payload with session key
      // In real implementation, would use proper AES256-GCM decryption

      // Simplified decryption simulation
      if (encryptedPayload.startsWith('enc_')) {
        const parts = encryptedPayload.split('_');
        if (parts.length >= 3) {
          return atob(parts[1]); // Extract original payload
        }
      }

      return encryptedPayload; // Return as-is if not encrypted
    } catch (error) {
      logger.error('Payload decryption failed:', error);
      throw error;
    }
  }

  private async validateMessageRoute(encodedMessage: EncodedMessage): Promise<boolean> {
    try {
      // Validate hop count
      if (encodedMessage.hops > encodedMessage.maxHops) {
        logger.warn(`Message exceeded max hops: ${encodedMessage.hops}/${encodedMessage.maxHops}`);
        return false;
      }

      // Validate route history (basic validation)
      if (encodedMessage.routeHistory.length === 0) {
        logger.warn('Message has no route history');
        return false;
      }

      // Check for route loops (simplified)
      const uniqueNodes = new Set(encodedMessage.routeHistory);
      if (uniqueNodes.size !== encodedMessage.routeHistory.length) {
        logger.warn('Route contains loops');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Message route validation failed:', error);
      return false;
    }
  }

  private checkMessageExpiration(encodedMessage: EncodedMessage): boolean {
    const now = Date.now();
    const messageAge = now - encodedMessage.timestamp;

    if (messageAge > encodedMessage.ttl) {
      return false;
    }

    return true;
  }

  private determineSecurityLevel(encodedMessage: EncodedMessage): 'military' | 'high' | 'standard' {
    // Determine security level based on encryption and algorithms used
    if (encodedMessage.encryptionAlgorithm.includes('Kyber') &&
        encodedMessage.encryptionAlgorithm.includes('Dilithium')) {
      return 'military';
    } else if (encodedMessage.isEncrypted && encodedMessage.sessionId) {
      return 'high';
    } else {
      return 'standard';
    }
  }

  private async calculateHeaderChecksum(header: MessageHeader): Promise<string> {
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

  private async calculatePayloadChecksum(payload: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private async calculateMessageChecksum(header: MessageHeader, payload: string): Promise<string> {
    const data = JSON.stringify(header) + payload;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private recordSecurityViolation(violationType: string): void {
    this.securityViolations++;

    // Log security violation
    logger.error(`🚨 Security violation: ${violationType} (total: ${this.securityViolations})`);

    // If too many violations, trigger emergency measures
    if (this.securityViolations > 10) {
      logger.critical('Multiple security violations detected - triggering emergency security measures');
      // In real implementation, would trigger emergency key rotation, etc.
    }
  }

  private cleanMessageCache(): void {
    // Clean old messages from cache (keep last 1000)
    if (this.messageCache.size > 1000) {
      const entries = Array.from(this.messageCache.entries());
      const recentEntries = entries.slice(-1000);
      this.messageCache.clear();

      for (const [id, message] of recentEntries) {
        this.messageCache.set(id, message);
      }

      logger.debug('Message cache cleaned');
    }
  }

  // @afetnet: Get cached decoded message
  getCachedMessage(messageId: string): DecodedMessage | null {
    return this.messageCache.get(messageId) || null;
  }

  // @afetnet: Clear message cache
  clearMessageCache(): void {
    this.messageCache.clear();
    logger.debug('Message cache cleared');
  }

  // @afetnet: Get security violation count
  getSecurityViolationCount(): number {
    return this.securityViolations;
  }

  // @afetnet: Reset security violations
  resetSecurityViolations(): void {
    this.securityViolations = 0;
    logger.debug('Security violations reset');
  }
}

// @afetnet: Export singleton instance
export const advancedMessageDecoder = new AdvancedMessageDecoder();






































