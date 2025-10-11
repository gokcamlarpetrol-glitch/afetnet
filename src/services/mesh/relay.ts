import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { decodeBase64 } from 'tweetnacl-util';
import { decryptGroupMessage, encryptGroupMessage } from '../../lib/cryptoGroup';
import { usePairing } from '../../store/pairing';
import { clampTTL, decodeMeshMsg, encodeMeshMsg, generateMsgId, MeshMsg } from './codec';
import { meshQueue, Priority } from './priorityQueue';

export interface MeshEvents {
  onSOS: (msg: Extract<MeshMsg, { t: 'SOS' }>) => void;
  onACK: (msg: Extract<MeshMsg, { t: 'ACK' }>) => void;
  onDM: (msg: Extract<MeshMsg, { t: 'DM' }>, decrypted?: string) => void;
  onVP: (msg: Extract<MeshMsg, { t: 'VP' }>) => void;
  onStats: (stats: { high: number; normal: number; low: number }) => void;
}

class MeshRelay {
  private seenIds: Set<string> = new Set();
  private events: Partial<MeshEvents> = {};
  private storageKey = 'afn/mesh/seen';
  private messageQueue: MeshMsg[] = [];

  constructor() {
    this.loadSeenIds();
  }

  enqueue(message: MeshMsg, priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM') {
    this.messageQueue.push(message);
    this.processQueue();
  }

  private async processQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        await this.onReceive(msg as any);
      }
    }
  }

  private async loadSeenIds() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        this.seenIds = new Set(JSON.parse(stored));
      }
    } catch (error) {
      logger.warn('Failed to load seen IDs:', error);
    }
  }

  private async saveSeenIds() {
    try {
      const ids = Array.from(this.seenIds);
      // Keep only recent IDs
      const recentIds = ids.slice(-1000);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(recentIds));
      this.seenIds = new Set(recentIds);
    } catch (error) {
      logger.warn('Failed to save seen IDs:', error);
    }
  }

  setEvents(events: Partial<MeshEvents>) {
    this.events = events;
  }

  async onReceive(data: string): Promise<boolean> {
    const msg = decodeMeshMsg(data);
    if (!msg) return false;

    // Check if already seen
    if (this.seenIds.has(msg.id)) {
      return false;
    }

    // Check TTL
    if (msg.ttl <= 0) {
      return false;
    }

    // Mark as seen
    this.seenIds.add(msg.id);
    this.saveSeenIds();

    // Decrement TTL for relay
    msg.ttl = clampTTL(msg.ttl - 1);
    msg.hop = (msg.hop || 0) + 1;

    // Emit to UI
    this.emitToUI(msg);

    // Re-broadcast based on priority and TTL
    if (msg.ttl > 0) {
      await this.reBroadcast(msg);
    }

    return true;
  }

  private emitToUI(msg: MeshMsg) {
    switch (msg.t) {
      case 'SOS':
        this.events.onSOS?.(msg);
        break;
      case 'ACK':
        this.events.onACK?.(msg);
        break;
      case 'DM':
        // Try to decrypt
        const decrypted = this.decryptDM(msg);
        this.events.onDM?.(msg, decrypted);
        break;
      case 'VP':
        this.events.onVP?.(msg);
        break;
    }
  }

  private async reBroadcast(msg: MeshMsg) {
    // Determine priority for re-broadcast
    let priority: Priority = 'NORMAL';
    
    if (msg.t === 'SOS' || msg.t === 'ACK') {
      priority = 'HIGH';
    } else if (msg.t === 'VP') {
      priority = 'LOW';
    }

    // Only relay VP for 1 hop (near-only)
    if (msg.t === 'VP' && msg.hop && msg.hop > 1) {
      return;
    }

    // Add backoff for NORMAL/LOW messages
    const backoff = priority === 'HIGH' ? 0 : Math.random() * 1000;
    
    setTimeout(() => {
      const encoded = encodeMeshMsg(msg);
      this.sendToBLE(encoded);
    }, backoff);
  }

  private decryptDM(msg: Extract<MeshMsg, { t: 'DM' }>): string | null {
    try {
      if (!msg.enc) return msg.bodyB64;

      const pairing = usePairing.getState();
      
      if (msg.to) {
        // Direct message to specific contact
        const sharedKey = pairing.getSharedFor(msg.to);
        if (!sharedKey) return null;
        
        const decrypted: any = decryptGroupMessage as any;
        return decrypted(sharedKey, msg.nonceB64, msg.bodyB64);
      } else if (msg.group) {
        // Group message
        const group = pairing.groups.find(g => g.id === msg.group);
        if (!group?.sharedKeyB64) return null;
        
        return decryptGroupMessage(group.sharedKeyB64, msg.nonceB64, msg.bodyB64) as any;
      }
      
      return null;
    } catch (error) {
      logger.warn('Failed to decrypt DM:', error);
      return null;
    }
  }

  private sendToBLE(data: string) {
    // This would integrate with the existing BLE layer
    // For now, we'll emit to a global event system
    if ((global as typeof globalThis).bleRelay) {
      (global as typeof globalThis).bleRelay.broadcastText(data);
    }
  }

  async sendDM(toPubKey: string | undefined, groupId: string | undefined, plaintext: string): Promise<string> {
    const msgId = generateMsgId();
    const pairing = usePairing.getState();
    
    let encrypted = false;
    let bodyB64 = plaintext;
    let nonceB64 = '';

    if (toPubKey) {
      // Encrypt for specific contact
      const sharedKey = pairing.getSharedFor(toPubKey);
      if (sharedKey) {
        const nonce = new Uint8Array(24);
        crypto.getRandomValues(nonce);
        const encryptedData = encryptGroupMessage(plaintext, sharedKey);
        bodyB64 = encryptedData.boxB64;
        nonceB64 = encryptedData.nonceB64;
        encrypted = true;
      }
    } else if (groupId) {
      // Encrypt for group
      const group = pairing.groups.find(g => g.id === groupId);
      if (group?.sharedKeyB64) {
        const groupKey = decodeBase64(group.sharedKeyB64);
        const encryptedData = encryptGroupMessage(plaintext, groupKey);
        bodyB64 = encryptedData.boxB64;
        nonceB64 = encryptedData.nonceB64;
        encrypted = true;
      }
    }

    const msg: Extract<MeshMsg, { t: 'DM' }> = {
      t: 'DM',
      id: msgId,
      to: toPubKey,
      group: groupId,
      enc: encrypted as true,
      bodyB64,
      nonceB64,
      ttl: 3
    };

    meshQueue.enqueue(msg, 'NORMAL');
    return msgId;
  }

  async sendVoicePing(toPubKey: string | undefined, chunks: string[]): Promise<string> {
    const msgId = generateMsgId();
    
    for (let i = 0; i < chunks.length; i++) {
      const msg: Extract<MeshMsg, { t: 'VP' }> = {
        t: 'VP',
        id: `${msgId}_${i}`,
        to: toPubKey,
        enc: false, // Voice ping is not encrypted for simplicity
        idx: i,
        total: chunks.length,
        bytesB64: chunks[i],
        ttl: 1 // Only 1 hop for voice ping (near-only)
      };

      meshQueue.enqueue(msg, 'LOW');
    }

    return msgId;
  }

  async ack(refId: string): Promise<string> {
    const msgId = generateMsgId();
    
    const msg: Extract<MeshMsg, { t: 'ACK' }> = {
      t: 'ACK',
      id: msgId,
      ref: refId,
      ttl: 3
    };

    meshQueue.enqueue(msg, 'HIGH');
    return msgId;
  }

  async sendSOS(lat?: number, lon?: number, statuses?: string[]): Promise<string> {
    const msgId = generateMsgId();
    
    const msg: Extract<MeshMsg, { t: 'SOS' }> = {
      t: 'SOS',
      id: msgId,
      ts: Date.now(),
      lat,
      lon,
      statuses,
      ttl: 5
    };

    meshQueue.enqueue(msg, 'HIGH');
    return msgId;
  }

  getQueueStats() {
    return meshQueue.getStats();
  }

  isSeen(msgId: string): boolean {
    return this.seenIds.has(msgId);
  }
}

export const meshRelay = new MeshRelay();
