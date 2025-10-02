import { BleManager, Device, State } from 'react-native-ble-plx';
import { Curve25519Crypto } from '../crypto/curve25519';
import { CBOREncoder, MessagePayload } from '../crypto/cbor';
import { MessageDeduplicator } from '../crypto/dedup';

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  lastSeen: number;
  services: string[];
}

export interface MeshMessage {
  id: string;
  payload: MessagePayload;
  timestamp: number;
  ttl: number;
  hops: number;
  signature: string;
}

export class BLEMeshManager {
  private static instance: BLEMeshManager;
  private bleManager: BleManager;
  private crypto: Curve25519Crypto;
  private deduplicator: MessageDeduplicator;
  private discoveredDevices: Map<string, BLEDevice>;
  private messageQueue: MeshMessage[];
  private isScanning: boolean = false;
  private isAdvertising: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private advertiseInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly SERVICE_UUID = '12345678-1234-1234-1234-123456789ABC';
  private readonly CHARACTERISTIC_UUID = '12345678-1234-1234-1234-123456789ABD';
  private readonly MAX_MESSAGE_SIZE = 200; // bytes
  private readonly MAX_HOPS = 8;
  private readonly ADAPTIVE_INTERVAL_MIN = 30000; // 30 seconds
  private readonly ADAPTIVE_INTERVAL_MAX = 300000; // 5 minutes
  private readonly PEER_DENSITY_THRESHOLD_LOW = 3;
  private readonly PEER_DENSITY_THRESHOLD_HIGH = 20;

  private constructor() {
    this.bleManager = new BleManager();
    this.crypto = Curve25519Crypto.getInstance();
    this.deduplicator = MessageDeduplicator.getInstance();
    this.discoveredDevices = new Map();
    this.messageQueue = [];
  }

  static getInstance(): BLEMeshManager {
    if (!BLEMeshManager.instance) {
      BLEMeshManager.instance = new BLEMeshManager();
    }
    return BLEMeshManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      const state = await this.bleManager.state();
      if (state !== State.PoweredOn) {
        throw new Error(`Bluetooth not ready. State: ${state}`);
      }

      console.log('BLE Mesh Manager initialized');
    } catch (error) {
      console.error('Failed to initialize BLE Mesh Manager:', error);
      throw error;
    }
  }

  async startScanning(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    try {
      this.isScanning = true;
      
      await this.bleManager.startDeviceScan(
        [this.SERVICE_UUID],
        { allowDuplicates: true },
        (error, device) => {
          if (error) {
            console.error('BLE scan error:', error);
            return;
          }

          if (device) {
            this.handleDiscoveredDevice(device);
          }
        }
      );

      console.log('BLE scanning started');
    } catch (error) {
      console.error('Failed to start BLE scanning:', error);
      this.isScanning = false;
      throw error;
    }
  }

  async stopScanning(): Promise<void> {
    if (!this.isScanning) {
      return;
    }

    try {
      this.bleManager.stopDeviceScan();
      this.isScanning = false;
      console.log('BLE scanning stopped');
    } catch (error) {
      console.error('Failed to stop BLE scanning:', error);
    }
  }

  async startAdvertising(): Promise<void> {
    if (this.isAdvertising) {
      return;
    }

    try {
      // Note: In a real implementation, you'd need to create a BLE peripheral service
      // For now, we'll simulate advertising with periodic beacon messages
      this.isAdvertising = true;
      this.scheduleAdaptiveAdvertising();
      console.log('BLE advertising started');
    } catch (error) {
      console.error('Failed to start BLE advertising:', error);
      this.isAdvertising = false;
      throw error;
    }
  }

  async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) {
      return;
    }

    if (this.advertiseInterval) {
      clearInterval(this.advertiseInterval);
      this.advertiseInterval = null;
    }

    this.isAdvertising = false;
    console.log('BLE advertising stopped');
  }

  private scheduleAdaptiveAdvertising(): void {
    const interval = this.calculateAdaptiveInterval();
    
    this.advertiseInterval = setInterval(async () => {
      await this.broadcastBeacon();
    }, interval);
  }

  private calculateAdaptiveInterval(): number {
    const peerDensity = this.getPeerDensity();
    
    if (peerDensity > this.PEER_DENSITY_THRESHOLD_HIGH) {
      return this.ADAPTIVE_INTERVAL_MAX;
    } else if (peerDensity < this.PEER_DENSITY_THRESHOLD_LOW) {
      return this.ADAPTIVE_INTERVAL_MIN;
    } else {
      // Linear interpolation between min and max
      const ratio = (peerDensity - this.PEER_DENSITY_THRESHOLD_LOW) / 
                   (this.PEER_DENSITY_THRESHOLD_HIGH - this.PEER_DENSITY_THRESHOLD_LOW);
      return this.ADAPTIVE_INTERVAL_MIN + 
             ratio * (this.ADAPTIVE_INTERVAL_MAX - this.ADAPTIVE_INTERVAL_MIN);
    }
  }

  private getPeerDensity(): number {
    const now = Date.now();
    const recentThreshold = 10 * 60 * 1000; // 10 minutes
    
    let recentPeers = 0;
    for (const device of this.discoveredDevices.values()) {
      if (now - device.lastSeen < recentThreshold) {
        recentPeers++;
      }
    }
    
    return recentPeers;
  }

  private async handleDiscoveredDevice(device: Device): Promise<void> {
    const bleDevice: BLEDevice = {
      id: device.id,
      name: device.name || 'Unknown',
      rssi: device.rssi || -100,
      lastSeen: Date.now(),
      services: device.serviceUUIDs || [],
    };

    this.discoveredDevices.set(device.id, bleDevice);
    
    // Attempt to connect and exchange messages
    try {
      await this.connectAndExchangeMessages(device);
    } catch (error) {
      console.error(`Failed to connect to device ${device.id}:`, error);
    }
  }

  private async connectAndExchangeMessages(device: Device): Promise<void> {
    try {
      await device.connect();
      await device.discoverAllServicesAndCharacteristics();
      
      // Exchange queued messages
      await this.exchangeMessages(device);
      
      await device.cancelConnection();
    } catch (error) {
      console.error('Connection error:', error);
    }
  }

  private async exchangeMessages(device: Device): Promise<void> {
    // Send our queued messages
    for (const message of this.messageQueue) {
      if (message.ttl > Date.now()) {
        await this.sendMessage(device, message);
      }
    }

    // Listen for incoming messages
    // Note: In a real implementation, you'd set up characteristic notifications
    // For now, we'll simulate message reception
  }

  private async sendMessage(device: Device, message: MeshMessage): Promise<void> {
    try {
      const encodedPayload = CBOREncoder.encode(message.payload);
      
      if (encodedPayload.length > this.MAX_MESSAGE_SIZE) {
        console.warn('Message too large for BLE transmission');
        return;
      }

      // In a real implementation, you'd write to a characteristic
      // For now, we'll simulate the transmission
      console.log(`Sending message ${message.id} to device ${device.id}`);
      
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  async queueMessage(payload: MessagePayload): Promise<void> {
    const ephemeralId = this.crypto.getCurrentEphemeralId();
    if (!ephemeralId) {
      throw new Error('No ephemeral ID available');
    }

    const message: MeshMessage = {
      id: this.crypto.generateMessageId(CBOREncoder.encode(payload)),
      payload,
      timestamp: Date.now(),
      ttl: payload.ttl,
      hops: 0,
      signature: this.crypto.encodeBase64(
        this.crypto.sign(CBOREncoder.encode(payload))
      ),
    };

    // Check if message is duplicate
    if (this.deduplicator.isDuplicate(message.id)) {
      console.log('Dropping duplicate message:', message.id);
      return;
    }

    this.messageQueue.push(message);
    this.deduplicator.markAsSeen(message.id);
    
    console.log(`Queued message ${message.id} for transmission`);
  }

  private async broadcastBeacon(): Promise<void> {
    const ephemeralId = this.crypto.getCurrentEphemeralId();
    if (!ephemeralId) {
      return;
    }

    // Create a beacon message with device info
    const beaconPayload: MessagePayload = {
      t: 'PING',
      id: ephemeralId.id,
      ts: Date.now(),
      loc: [0, 0, 0], // Will be filled with actual location
      ttl: 300000, // 5 minutes
      sig: '',
    };

    // In a real implementation, this would be advertised via BLE
    console.log('Broadcasting beacon:', ephemeralId.id);
  }

  async processIncomingMessage(messageData: Uint8Array): Promise<void> {
    try {
      const payload = CBOREncoder.decode(messageData);
      
      // Verify signature (simplified - in reality you'd need the sender's public key)
      // For now, we'll skip verification in this stub
      
      // Check if message is duplicate
      const messageId = this.crypto.generateMessageId(messageData);
      if (this.deduplicator.isDuplicate(messageId)) {
        console.log('Dropping duplicate incoming message:', messageId);
        return;
      }

      // Check TTL and hop count
      if (payload.ttl <= Date.now() || payload.ttl > this.MAX_HOPS) {
        console.log('Dropping expired or over-hopped message');
        return;
      }

      // Increment hop count and queue for forwarding
      const meshMessage: MeshMessage = {
        id: messageId,
        payload: {
          ...payload,
          ttl: payload.ttl - 1, // Decrement hop count
        },
        timestamp: Date.now(),
        ttl: payload.ttl,
        hops: (payload as any).hops || 0 + 1,
        signature: payload.sig,
      };

      this.messageQueue.push(meshMessage);
      this.deduplicator.markAsSeen(messageId);
      
      console.log(`Processed incoming message ${messageId}`);
      
    } catch (error) {
      console.error('Failed to process incoming message:', error);
    }
  }

  getDiscoveredDevices(): BLEDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  getQueueStats(): { queueSize: number; oldestMessage: number | null } {
    const now = Date.now();
    const activeMessages = this.messageQueue.filter(m => m.ttl > now);
    
    return {
      queueSize: activeMessages.length,
      oldestMessage: activeMessages.length > 0 
        ? Math.min(...activeMessages.map(m => m.timestamp))
        : null,
    };
  }

  async cleanup(): Promise<void> {
    await this.stopScanning();
    await this.stopAdvertising();
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    this.discoveredDevices.clear();
    this.messageQueue.length = 0;
    
    console.log('BLE Mesh Manager cleaned up');
  }
}
