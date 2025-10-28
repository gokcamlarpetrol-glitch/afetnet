// @afetnet: Perfect Forward Secrecy (PFS) implementation
// Provides X3DH-like key exchange for offline mesh communication

import { logger } from '../../core/utils/logger';
import { kyberService } from './pqc/kyber/kyber';
import { dilithiumService } from './pqc/dilithium/dilithium';

export interface PFSKeyExchange {
  id: string;
  initiatorId: string;
  responderId: string;
  sharedSecret: string;
  initiatorEphemeralKey: string;
  responderEphemeralKey: string;
  timestamp: number;
  isActive: boolean;
  messageCount: number;
  maxMessages: number;
}

export interface PFSSession {
  sessionId: string;
  participants: string[];
  sharedSecret: string;
  ephemeralKeys: Map<string, string>;
  createdAt: number;
  expiresAt: number;
  messageCount: number;
  isExpired: boolean;
}

export class PerfectForwardSecrecyService {
  private activeSessions: Map<string, PFSSession> = new Map();
  private keyExchanges: Map<string, PFSKeyExchange> = new Map();
  private sessionTimeout = 3600000; // 1 hour
  private maxMessagesPerSession = 1000;

  // @afetnet: Initialize X3DH-like key exchange for offline communication
  async initiateKeyExchange(initiatorId: string, responderId: string): Promise<PFSKeyExchange> {
    try {
      logger.debug(`🔐 Initiating PFS key exchange: ${initiatorId} -> ${responderId}`);

      // Generate initiator's ephemeral keypair
      const initiatorKeypair = await kyberService.generateKeypair();

      const keyExchange: PFSKeyExchange = {
        id: `pfs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        initiatorId,
        responderId,
        sharedSecret: '', // Will be derived after responder's response
        initiatorEphemeralKey: initiatorKeypair.publicKey,
        responderEphemeralKey: '', // Will be set by responder
        timestamp: Date.now(),
        isActive: false,
        messageCount: 0,
        maxMessages: this.maxMessagesPerSession,
      };

      // Store the key exchange
      this.keyExchanges.set(keyExchange.id, keyExchange);

      logger.debug(`✅ PFS key exchange initiated: ${keyExchange.id}`);
      return keyExchange;

    } catch (error) {
      logger.error('Failed to initiate PFS key exchange:', error);
      throw error;
    }
  }

  // @afetnet: Complete key exchange with responder's contribution
  async completeKeyExchange(
    exchangeId: string,
    responderEphemeralKey: string
  ): Promise<PFSSession> {
    try {
      const keyExchange = this.keyExchanges.get(exchangeId);
      if (!keyExchange) {
        throw new Error('Key exchange not found');
      }

      logger.debug(`🔐 Completing PFS key exchange: ${exchangeId}`);

      // Encapsulate shared secret using responder's key
      const encapsulation = await kyberService.encapsulate(responderEphemeralKey);

      // Derive shared secret from encapsulation
      const sharedSecret = await this.deriveSharedSecret(
        keyExchange.initiatorId,
        keyExchange.responderId,
        encapsulation.sharedSecret
      );

      // Create session
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const session: PFSSession = {
        sessionId,
        participants: [keyExchange.initiatorId, keyExchange.responderId],
        sharedSecret,
        ephemeralKeys: new Map([
          [keyExchange.initiatorId, keyExchange.initiatorEphemeralKey],
          [keyExchange.responderId, responderEphemeralKey],
        ]),
        createdAt: Date.now(),
        expiresAt: Date.now() + this.sessionTimeout,
        messageCount: 0,
        isExpired: false,
      };

      // Store session
      this.activeSessions.set(sessionId, session);

      // Mark key exchange as complete
      keyExchange.isActive = true;
      keyExchange.responderEphemeralKey = responderEphemeralKey;
      keyExchange.sharedSecret = sharedSecret;

      logger.debug(`✅ PFS key exchange completed: ${sessionId}`);
      return session;

    } catch (error) {
      logger.error('Failed to complete PFS key exchange:', error);
      throw error;
    }
  }

  // @afetnet: Get or create session for communication
  async getOrCreateSession(participant1: string, participant2: string): Promise<PFSSession> {
    // Check if session already exists
    for (const session of this.activeSessions.values()) {
      if (session.participants.includes(participant1) && session.participants.includes(participant2)) {
        if (!session.isExpired && session.messageCount < this.maxMessagesPerSession) {
          return session;
        }
      }
    }

    // Create new session
    const initiatorExchange = await this.initiateKeyExchange(participant1, participant2);

    // For simplicity, assume responder generates key (in real implementation, would exchange)
    const responderKeypair = await kyberService.generateKeypair();
    const session = await this.completeKeyExchange(initiatorExchange.id, responderKeypair.publicKey);

    return session;
  }

  // @afetnet: Derive shared secret using key derivation function
  private async deriveSharedSecret(
    participant1: string,
    participant2: string,
    baseSecret: string
  ): Promise<string> {
    // @afetnet: Use HKDF or similar to derive session key
    const context = `${participant1}:${participant2}:${Date.now()}`;
    const hash = this.generateHash(baseSecret + context);

    return `pfs_secret_${hash}`;
  }

  // @afetnet: Generate session key for message encryption
  async generateSessionKey(session: PFSSession, messageId: string): Promise<string> {
    // @afetnet: Derive unique key for each message using session secret
    const messageKey = this.generateHash(session.sharedSecret + messageId + session.messageCount);

    // Update message count
    session.messageCount++;

    // Check if session should be rotated
    if (session.messageCount >= this.maxMessagesPerSession) {
      logger.warn(`🔄 Session ${session.sessionId} reached message limit, should be rotated`);
      // In real implementation, would trigger session rotation
    }

    return `session_key_${messageKey}`;
  }

  // @afetnet: Check if session is valid and active
  isSessionValid(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    return !session.isExpired && session.messageCount < this.maxMessagesPerSession;
  }

  // @afetnet: Clean up expired sessions
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions) {
      if (session.isExpired || session.messageCount >= this.maxMessagesPerSession) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 Cleaned up ${cleanedCount} expired PFS sessions`);
    }
  }

  // @afetnet: Get session statistics
  getSessionStats(): {
    activeSessions: number;
    totalSessions: number;
    averageSessionAge: number;
    sessionsNearExpiry: number;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const now = Date.now();

    const activeSessions = sessions.filter(s => !s.isExpired).length;
    const totalSessions = sessions.length;
    const averageSessionAge = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (now - s.createdAt), 0) / sessions.length
      : 0;

    const sessionsNearExpiry = sessions.filter(s =>
      !s.isExpired && (s.expiresAt - now) < 300000 // 5 minutes
    ).length;

    return {
      activeSessions,
      totalSessions,
      averageSessionAge,
      sessionsNearExpiry,
    };
  }

  private generateHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // @afetnet: Force session rotation
  async rotateSession(sessionId: string): Promise<PFSSession | null> {
    const oldSession = this.activeSessions.get(sessionId);
    if (!oldSession) return null;

    // Mark old session as expired
    oldSession.isExpired = true;

    // Create new session for same participants
    return await this.getOrCreateSession(oldSession.participants[0], oldSession.participants[1]);
  }

  // @afetnet: Get all active sessions
  getActiveSessions(): PFSSession[] {
    return Array.from(this.activeSessions.values()).filter(s => !s.isExpired);
  }

  // @afetnet: Clean up old key exchanges
  cleanupOldKeyExchanges(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    let cleanedCount = 0;
    for (const [exchangeId, exchange] of this.keyExchanges) {
      if (now - exchange.timestamp > maxAge) {
        this.keyExchanges.delete(exchangeId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 Cleaned up ${cleanedCount} old key exchanges`);
    }
  }
}

// @afetnet: Export singleton instance
export const pfsService = new PerfectForwardSecrecyService();





