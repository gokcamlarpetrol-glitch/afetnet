// import { Platform } from 'react-native'; // Not used
import { logger } from '../utils/productionLogger';
import { Envelope, PeerInfo, MeshStats, MeshConfig } from './types';
import { meshStore } from './store';
import { qosManager } from './qos';
import { signEnvelope, verifyEnvelope } from './crypto';
import * as Sim from './transport/Sim';
import { payloadSchemas } from './types';

class OffMeshRouter {
  private isRunning = false;
  private topic = '';
  private startTime: number | null = null;
  private config: MeshConfig;
  private messageHandlers = new Set<(envelope: Envelope) => void>();
  private peerHandlers = new Set<(peers: PeerInfo[]) => void>();
  private peers = new Map<string, PeerInfo>();
  private transports = new Map<string, any>();
  private unsubscribeFunctions: (() => void)[] = [];

  constructor() {
    this.config = this.getDefaultConfig();
    this.initializeTransports();
  }

  private getDefaultConfig(): MeshConfig {
    return {
      topic: 'public',
      transports: {
        sim: { enabled: true, maxPeers: 10, heartbeatInterval: 20000, reconnectDelay: 5000 },
        mciOS: { enabled: false, maxPeers: 8, heartbeatInterval: 20000, reconnectDelay: 5000 },
        bleiOS: { enabled: false, maxPeers: 5, heartbeatInterval: 30000, reconnectDelay: 10000 },
        wifiP2P: { enabled: false, maxPeers: 8, heartbeatInterval: 20000, reconnectDelay: 5000 },
        bleAndroid: { enabled: false, maxPeers: 5, heartbeatInterval: 30000, reconnectDelay: 10000 },
      },
      qos: {
        rateLimits: {
          sos: 1,
          chat: 10,
          pos: 2,
        },
        batteryThreshold: 10,
        maxQueueSize: 200,
        maxDedupSize: 2000,
      },
    };
  }

  private initializeTransports(): void {
    // Register simulator transport
    this.transports.set('sim', Sim);
    
    // TODO: Register other transports when available
    // this.transports.set('mciOS', mciOSTransport);
    // this.transports.set('bleiOS', bleiOSTransport);
    // this.transports.set('wifiP2P', wifiP2PTransport);
    // this.transports.set('bleAndroid', bleAndroidTransport);
  }

  async startMesh(topic: string): Promise<void> {
    if (this.isRunning) {
      logger.debug('Mesh already running');
      return;
    }

    this.topic = topic;
    this.isRunning = true;
    this.startTime = Date.now();

    // Start enabled transports
    for (const [name, transport] of this.transports.entries()) {
      const transportConfig = this.config.transports[name as keyof typeof this.config.transports];
      
      if (transportConfig?.enabled) {
        try {
          await transport.start(topic);
          
          // Subscribe to messages
          const unsubscribe = transport.subscribe((envelope: Envelope) => {
            this.handleIncomingMessage(envelope, name);
          });
          
          this.unsubscribeFunctions.push(unsubscribe);
          
          logger.debug(`Transport ${name} started`);
        } catch (error) {
          logger.warn(`Failed to start transport ${name}:`, error);
        }
      }
    }

    // Start message processing loop
    this.startMessageProcessing();

    logger.debug('OffMesh router started for topic:', topic);
  }

  async stopMesh(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.startTime = null;

    // Stop all transports
    for (const [name, transport] of this.transports.entries()) {
      try {
        await transport.stop();
        logger.debug(`Transport ${name} stopped`);
      } catch (error) {
        logger.warn(`Failed to stop transport ${name}:`, error);
      }
    }

    // Unsubscribe from all transports
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    this.unsubscribeFunctions = [];

    // Clear state
    this.peers.clear();
    this.messageHandlers.clear();
    this.peerHandlers.clear();

    logger.debug('OffMesh router stopped');
  }

  async send(envelope: Envelope): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Mesh not running');
    }

    // Validate payload
    const schema = payloadSchemas[envelope.type];
    if (schema) {
      const result = schema.safeParse(envelope.payload);
      if (!result.success) {
        throw new Error(`Invalid payload for ${envelope.type}: ${result.error.message}`);
      }
    }

    // Check rate limits
    if (!qosManager.canSend(envelope.type)) {
      const timeUntilNext = qosManager.getTimeUntilNextToken(envelope.type);
      throw new Error(`Rate limit exceeded for ${envelope.type}. Try again in ${Math.ceil(timeUntilNext / 1000)}s`);
    }

    // Check if mesh should be active
    if (!qosManager.shouldActivateMesh() && envelope.type !== 'sos') {
      throw new Error('Mesh inactive due to battery/temperature constraints');
    }

    // Sign envelope
    const signedEnvelope = await signEnvelope(envelope);

    // Add to store
    meshStore.addToDedup(signedEnvelope);
    meshStore.enqueue(signedEnvelope);

    // Consume rate limit token
    qosManager.consumeToken(envelope.type);

    // Log event
    meshStore.logEvent({
      id: envelope.id,
      ts: Date.now(),
      type: 'send',
      msgType: envelope.type,
      size: JSON.stringify(envelope.payload).length,
      hop: envelope.hop,
    });

    logger.debug(`Message queued: ${envelope.type} (${envelope.id})`);
  }

  subscribe(callback: (envelope: Envelope) => void): () => void {
    this.messageHandlers.add(callback);
    
    return () => {
      this.messageHandlers.delete(callback);
    };
  }

  subscribeToPeers(callback: (peers: PeerInfo[]) => void): () => void {
    this.peerHandlers.add(callback);
    
    return () => {
      this.peerHandlers.delete(callback);
    };
  }

  setKey(key: string): void {
    // TODO: Implement key setting for crypto
    logger.debug('Key set for mesh encryption');
  }

  getStats(): MeshStats {
    const queueStats = meshStore.getQueueStats();
    const dedupStats = meshStore.getDedupStats();
    
    return {
      peers: this.peers.size,
      queued: queueStats.count,
      dedup: dedupStats.count,
      lastHop: this.getLastHopTime(),
      uptime: this.isRunning && this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  private async handleIncomingMessage(envelope: Envelope, transportName: string): Promise<void> {
    try {
      // Check if duplicate
      if (meshStore.isDuplicate(envelope)) {
        logger.debug(`Duplicate message ignored: ${envelope.id}`);
        return;
      }

      // Verify signature
      const isValid = await verifyEnvelope(envelope);
      if (!isValid) {
        logger.warn(`Invalid signature for message: ${envelope.id}`);
        return;
      }

      // Check if expired
      if (meshStore.isExpired(envelope)) {
        logger.debug(`Expired message ignored: ${envelope.id}`);
        return;
      }

      // Add to dedup
      meshStore.addToDedup(envelope);

      // Log event
      meshStore.logEvent({
        id: envelope.id,
        ts: Date.now(),
        type: 'recv',
        msgType: envelope.type,
        size: JSON.stringify(envelope.payload).length,
        hop: envelope.hop,
        transport: transportName,
      });

      // Forward if TTL allows
      if (envelope.hop < envelope.ttl) {
        const forwardedEnvelope = meshStore.incrementHop(envelope);
        await this.forwardMessage(forwardedEnvelope);
      }

      // Notify handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(envelope);
        } catch (error) {
          logger.warn('Message handler error:', error);
        }
      });

    } catch (error) {
      logger.warn('Error handling incoming message:', error);
      
      meshStore.logEvent({
        id: envelope.id,
        ts: Date.now(),
        type: 'error',
        msgType: envelope.type,
        size: JSON.stringify(envelope.payload).length,
        hop: envelope.hop,
        transport: transportName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async forwardMessage(envelope: Envelope): Promise<void> {
    // Broadcast to all active transports
    for (const [name, transport] of this.transports.entries()) {
      const transportConfig = this.config.transports[name as keyof typeof this.config.transports];
      
      if (transportConfig?.enabled && (transport.isConnected?.() || transport.isRunning?.())) {
        try {
          const bytesEstimate = JSON.stringify(envelope).length;
          await transport.broadcast(envelope, bytesEstimate);
        } catch (error) {
          logger.warn(`Failed to forward via ${name}:`, error);
        }
      }
    }
  }

  private startMessageProcessing(): void {
    const processLoop = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        const nextMessage = meshStore.getNextToSend();
        if (nextMessage) {
          await this.forwardMessage(nextMessage);
          meshStore.markSent(nextMessage);
        }
      } catch (error) {
        logger.warn('Message processing error:', error);
      }

      // Schedule next processing
      (globalThis as any).setTimeout(processLoop, 1000);
    };

    processLoop();
  }

  private getLastHopTime(): string {
    const events = meshStore.getRecentEvents(1);
    if (events.length === 0) {
      return 'never';
    }

    const lastEvent = events[0];
    const age = Date.now() - lastEvent.ts;
    
    if (age < 60000) {
      return `${Math.floor(age / 1000)}s ago`;
    } else if (age < 3600000) {
      return `${Math.floor(age / 60000)}m ago`;
    } else {
      return `${Math.floor(age / 3600000)}h ago`;
    }
  }
}

// Singleton instance
export const offMeshRouter = new OffMeshRouter();

// Export convenience functions
export async function startMesh(topic: string): Promise<void> {
  return offMeshRouter.startMesh(topic);
}

export async function stopMesh(): Promise<void> {
  return offMeshRouter.stopMesh();
}

export async function send(envelope: Envelope): Promise<void> {
  return offMeshRouter.send(envelope);
}

export function subscribe(callback: (envelope: Envelope) => void): () => void {
  return offMeshRouter.subscribe(callback);
}

export function setKey(key: string): void {
  offMeshRouter.setKey(key);
}
