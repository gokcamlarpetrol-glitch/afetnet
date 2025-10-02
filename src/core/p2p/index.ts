import { BLEMeshManager } from './ble';
import { MessageQueue } from './queue';
import { MessageEncoder, MessageData } from './message';
import { database } from '../data/db';
import { HelpRequestRepository, StatusPingRepository, ResourcePostRepository } from '../data/repositories';
import { TriageService } from '../logic/triage';
import { AdaptiveScheduler } from './scheduler';

export interface P2PMessage {
  id: string;
  type: 'HELP_REQUEST' | 'STATUS_PING' | 'RESOURCE_POST' | 'DAMAGE_REPORT';
  payload: any;
  ttl: number;
  hops: number;
  timestamp: number;
  signature: string;
  source: 'self' | 'p2p' | 'server';
}

export class P2PManager {
  private static instance: P2PManager;
  private bleManager: BLEMeshManager;
  private messageQueue: MessageQueue;
  private scheduler: AdaptiveScheduler;
  private helpRequestRepository: HelpRequestRepository;
  private statusPingRepository: StatusPingRepository;
  private resourcePostRepository: ResourcePostRepository;
  private triageService: TriageService;

  private constructor() {
    this.bleManager = BLEMeshManager.getInstance();
    this.messageQueue = new MessageQueue();
    this.scheduler = AdaptiveScheduler.getInstance();
    this.helpRequestRepository = new HelpRequestRepository();
    this.statusPingRepository = new StatusPingRepository();
    this.resourcePostRepository = new ResourcePostRepository();
    this.triageService = TriageService.getInstance();
  }

  static getInstance(): P2PManager {
    if (!P2PManager.instance) {
      P2PManager.instance = new P2PManager();
    }
    return P2PManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.bleManager.initialize();
      await this.scheduler.initialize();
      await this.messageQueue.initialize();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      console.log('P2PManager initialized');
    } catch (error) {
      console.error('Failed to initialize P2PManager:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Handle incoming BLE messages
    this.bleManager.onMessageReceived((data) => {
      this.handleIncomingMessage(data);
    });

    // Handle peer connections
    this.bleManager.onPeerConnected((peer) => {
      console.log('Peer connected:', peer.id);
    });

    // Handle peer disconnections
    this.bleManager.onPeerDisconnected((peer) => {
      console.log('Peer disconnected:', peer.id);
    });
  }

  async start(): Promise<void> {
    try {
      await this.bleManager.startAdvertising();
      await this.bleManager.startScanning();
      await this.scheduler.start();
      
      console.log('P2PManager started');
    } catch (error) {
      console.error('Failed to start P2PManager:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.bleManager.stopAdvertising();
      await this.bleManager.stopScanning();
      await this.scheduler.stop();
      
      console.log('P2PManager stopped');
    } catch (error) {
      console.error('Failed to stop P2PManager:', error);
    }
  }

  async enqueueMessage(message: P2PMessage): Promise<void> {
    try {
      // Convert to MessageData format
      const messageData = this.convertToMessageData(message);
      
      // Apply lean frame configuration if in ultra low-power mode
      const leanConfig = this.scheduler.getLeanFrameConfig();
      if (leanConfig.stripNote) {
        messageData.note = undefined;
      }
      if (leanConfig.coarseLocation) {
        messageData.loc.lat = Math.round(messageData.loc.lat * 100) / 100;
        messageData.loc.lon = Math.round(messageData.loc.lon * 100) / 100;
      }
      messageData.ttl = leanConfig.ttl;

      // Bump triage priority if battery is critical
      if (this.scheduler.shouldBumpTriageForBattery()) {
        messageData.prio = Math.min(2, messageData.prio + 1);
      }

      // Add to queue with priority
      await this.messageQueue.enqueue(messageData, messageData.prio);
      
      console.log('Message enqueued:', message.id);
    } catch (error) {
      console.error('Failed to enqueue message:', error);
      throw error;
    }
  }

  private convertToMessageData(message: P2PMessage): MessageData {
    const payload = message.payload;
    
    switch (message.type) {
      case 'HELP_REQUEST':
        return {
          t: 0,
          id: message.id,
          ts: message.timestamp,
          loc: {
            lat: payload.lat,
            lon: payload.lon,
            acc: payload.accuracy || 0,
          },
          prio: payload.priority || 0,
          flags: {
            underRubble: payload.underRubble || false,
            injured: payload.injured || false,
            anonymity: payload.anonymity || false,
          },
          ppl: payload.peopleCount || 1,
          note: payload.note,
          batt: payload.battery,
          ttl: message.ttl,
          sig: message.signature,
        };
      
      case 'STATUS_PING':
        return {
          t: 1,
          id: message.id,
          ts: message.timestamp,
          loc: {
            lat: payload.lat,
            lon: payload.lon,
            acc: payload.accuracy || 0,
          },
          prio: 0,
          flags: {
            underRubble: false,
            injured: false,
            anonymity: false,
          },
          ppl: 1,
          note: payload.note,
          batt: payload.battery,
          ttl: message.ttl,
          sig: message.signature,
        };
      
      case 'RESOURCE_POST':
        return {
          t: 2,
          id: message.id,
          ts: message.timestamp,
          loc: {
            lat: payload.lat,
            lon: payload.lon,
            acc: payload.accuracy || 0,
          },
          prio: 0,
          flags: {
            underRubble: false,
            injured: false,
            anonymity: false,
          },
          ppl: 1,
          note: `${payload.type}: ${payload.quantity}`,
          ttl: message.ttl,
          sig: message.signature,
        };
      
      case 'DAMAGE_REPORT':
        return {
          t: 2, // Use resource post type for damage reports
          id: message.id,
          ts: message.timestamp,
          loc: {
            lat: payload.lat,
            lon: payload.lon,
            acc: payload.accuracy || 0,
          },
          prio: payload.severity || 0,
          flags: {
            underRubble: false,
            injured: false,
            anonymity: false,
          },
          ppl: 1,
          note: `DAMAGE: ${payload.type} - ${payload.severity}`,
          ttl: message.ttl,
          sig: message.signature,
        };
      
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  async handleIncomingMessage(data: { from: string; message: MessageData }): Promise<void> {
    try {
      const { from, message } = data;
      
      // Verify message signature (would need device key management)
      // For now, we'll trust the message
      
      // Save to appropriate repository based on message type
      switch (message.t) {
        case 0: // Help request
          await this.helpRequestRepository.create({
            ts: message.ts,
            lat: message.loc.lat,
            lon: message.loc.lon,
            accuracy: message.loc.acc,
            priority: message.prio,
            underRubble: message.flags.underRubble,
            injured: message.flags.injured,
            peopleCount: message.ppl,
            note: message.note,
            battery: message.batt,
            anonymity: message.flags.anonymity,
            ttl: message.ttl,
            signature: message.sig,
            delivered: false,
            hops: 0,
            source: 'p2p',
          });
          break;
        
        case 1: // Status ping
          await this.statusPingRepository.create({
            ts: message.ts,
            lat: message.loc.lat,
            lon: message.loc.lon,
            battery: message.batt,
            note: message.note,
          });
          break;
        
        case 2: // Resource post or damage report
          if (message.note?.startsWith('DAMAGE:')) {
            // Handle as damage report
            // Would need damage report repository
          } else {
            // Handle as resource post
            await this.resourcePostRepository.create({
              ts: message.ts,
              type: message.note?.split(':')[0] || 'unknown',
              qty: message.note?.split(':')[1] || '1',
              lat: message.loc.lat,
              lon: message.loc.lon,
              desc: message.note,
            });
          }
          break;
      }
      
      // Forward message if TTL > 0
      if (message.ttl > 0) {
        const forwardMessage: MessageData = {
          ...message,
          ttl: message.ttl - 1,
          sig: '', // Would need to re-sign
        };
        
        await this.messageQueue.enqueue(forwardMessage, message.prio);
      }
      
      console.log('Message processed from peer:', from);
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
    }
  }

  async executeBeaconCycle(): Promise<void> {
    try {
      // Get lean frame configuration
      const leanConfig = this.scheduler.getLeanFrameConfig();
      
      // Create beacon message with current status
      const beaconMessage: MessageData = {
        t: 1, // Status ping
        id: `beacon_${Date.now()}`,
        ts: Date.now(),
        loc: {
          lat: 41.0082, // Would get from location service
          lon: 28.9784,
          acc: leanConfig.coarseLocation ? 100 : 10,
        },
        prio: 0,
        flags: {
          underRubble: false,
          injured: false,
          anonymity: false,
        },
        ppl: 1,
        note: leanConfig.stripNote ? undefined : 'Beacon',
        batt: this.scheduler.getBatteryLevel(),
        ttl: leanConfig.ttl,
        sig: '', // Would be signed
      };
      
      // Broadcast beacon
      await this.bleManager.broadcastMessage(beaconMessage);
      
      console.log('Beacon cycle executed');
    } catch (error) {
      console.error('Beacon cycle failed:', error);
    }
  }

  getDatabase() {
    return database;
  }

  getStats(): {
    bleConnected: boolean;
    peerCount: number;
    queueLength: number;
    batteryLevel: number;
    isUltraLowPower: boolean;
  } {
    return {
      bleConnected: this.bleManager.isBLEAvailable(),
      peerCount: this.bleManager.getPeerCount(),
      queueLength: this.messageQueue.getQueueLength(),
      batteryLevel: this.scheduler.getBatteryLevel(),
      isUltraLowPower: this.scheduler.isUltraLowPowerMode(),
    };
  }

  async cleanup(): Promise<void> {
    await this.stop();
    await this.bleManager.cleanup();
    await this.scheduler.cleanup();
    console.log('P2PManager cleaned up');
  }
}