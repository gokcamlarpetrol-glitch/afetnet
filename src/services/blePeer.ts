import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/productionLogger';
import { Platform } from 'react-native';

// Safe BLE imports with fallbacks for Expo Go
let BleManager: any = null;
let State: any = null;
let isExpoGo = false;

try {
  const blePlx = (globalThis as any).require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
  State = blePlx.State;
} catch {
  logger.warn('react-native-ble-plx not available, using fallback');
  isExpoGo = true;
}

// Detect Expo Go environment
try {
  const Constants = (globalThis as any).require('expo-constants');
  isExpoGo = Constants.default?.executionEnvironment === 'storeClient' || isExpoGo;
} catch (e) {
  // Ignore
}

// Message schema - minimal JSON payload
export interface BleMessage {
  id: string;                    // Unique message ID
  fromPub: string;              // Sender's public key (base64)
  timestamp: number;            // Unix timestamp
  type: 'SOS' | 'MSG' | 'PING'; // Message type
  lat?: number;                 // Latitude if location-based
  lon?: number;                 // Longitude if location-based
  rssi?: number;                // Signal strength
  ttl: number;                  // Time to live (hop count)
  payload?: string;             // Encrypted payload (base64)
  signature?: string;           // Message signature (base64)
}

// BLE service configuration
const SERVICE_UUID = '12345678-1234-1234-1234-123456789ABC';
const DEVICE_NAME_PREFIX = 'AfetNet';

class BlePeerService {
  private manager: any = null;
  private isAdvertising = false;
  private isScanning = false;
  // @ts-expect-error - Device type from react-native-ble-plx
  private connectedDevices = new Map<string, Device>();
  private messageQueue: BleMessage[] = [];
  private seenMessageIds = new Set<string>();
  private relayTimer: NodeJS.Timeout | null = null;
  private identityPublicKey = '';
  private deviceName = '';

  constructor() {
    // NEVER create BleManager in Expo Go - it causes NativeEventEmitter crash
    if (isExpoGo) {
      logger.warn('Expo Go detected - using mock BLE mode');
      this.manager = null;
    } else if (BleManager && typeof BleManager === 'function') {
      try {
        this.manager = new BleManager();
        logger.debug('BLE Peer Manager created successfully');
      } catch (e) {
        logger.warn('Failed to create BleManager:', e);
        this.manager = null;
        isExpoGo = true; // Fall back to mock mode
      }
    } else {
      logger.warn('BleManager not available - using mock mode');
      this.manager = null;
      isExpoGo = true;
    }
    this.initializeService();
  }

  private async initializeService() {
    // Load persisted data
    await this.loadSeenMessageIds();
    await this.loadMessageQueue();
    await this.loadIdentity();
    
    // Start relay timer for periodic message forwarding
    this.startRelayTimer();
  }

  private async loadSeenMessageIds() {
    try {
      const stored = await AsyncStorage.getItem('ble_seen_message_ids');
      if (stored) {
        this.seenMessageIds = new Set(JSON.parse(stored));
      }
    } catch (error) {
      logger.warn('Failed to load seen message IDs:', error);
    }
  }

  private async saveSeenMessageIds() {
    try {
      await AsyncStorage.setItem('ble_seen_message_ids', JSON.stringify([...this.seenMessageIds]));
    } catch (error) {
      logger.warn('Failed to save seen message IDs:', error);
    }
  }

  private async loadMessageQueue() {
    try {
      const stored = await AsyncStorage.getItem('ble_message_queue');
      if (stored) {
        this.messageQueue = JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('Failed to load message queue:', error);
    }
  }

  private async saveMessageQueue() {
    try {
      await AsyncStorage.setItem('ble_message_queue', JSON.stringify(this.messageQueue));
    } catch (error) {
      logger.warn('Failed to save message queue:', error);
    }
  }

  private async loadIdentity() {
    try {
      const publicKey = await AsyncStorage.getItem('ble_identity_public_key');
      const deviceName = await AsyncStorage.getItem('ble_device_name');
      if (publicKey) {
        this.identityPublicKey = publicKey;
      }
      if (deviceName) {
        this.deviceName = deviceName;
      }
    } catch (error) {
      logger.warn('Failed to load identity:', error);
    }
  }

  private async saveIdentity() {
    try {
      if (this.identityPublicKey) {
        await AsyncStorage.setItem('ble_identity_public_key', this.identityPublicKey);
      }
      if (this.deviceName) {
        await AsyncStorage.setItem('ble_device_name', this.deviceName);
      }
    } catch (error) {
      logger.warn('Failed to save identity:', error);
    }
  }

  // Initialize with device identity
  async initialize(identityPublicBase64: string, deviceName?: string) {
    this.identityPublicKey = identityPublicBase64;
    this.deviceName = deviceName || `${DEVICE_NAME_PREFIX}_${Date.now()}`;
    await this.saveIdentity();
  }

  // Start advertising device presence (iOS background limitations apply)
  async startAdvertising(): Promise<void> {
    if (this.isAdvertising) return;
    
    if (!this.manager) {
      logger.warn('BLE Manager not available - cannot start advertising');
      return;
    }

    try {
      // Check BLE state
      const state = await this.manager.state();
      if (state !== State.PoweredOn) {
        throw new Error('BLE not powered on');
      }

      // iOS background advertising limitations
      if (Platform.OS === 'ios') {
        logger.warn('iOS background advertising is limited. Consider foreground-only mode for production.');
      }

      // Create minimal advertisement payload (just presence + short ID)

      await this.manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: true });
      this.isAdvertising = true;

      logger.debug('Started BLE advertising');

    } catch (error) {
      logger.error('Failed to start advertising:', error);
      throw error;
    }
  }

  // Stop advertising
  async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) return;

    if (!this.manager) {
      logger.warn('BLE Manager not available - cannot stop advertising');
      return;
    }

    try {
      // Note: This should stop advertising, not scanning - implementation depends on BLE library
      this.isAdvertising = false;
      logger.debug('Stopped BLE advertising');
    } catch (error) {
      logger.error('Failed to stop advertising:', error);
    }
  }

  // Start scanning for nearby devices
  // @ts-expect-error - Device type from react-native-ble-plx
  async startScanning(onDeviceFound?: (device: any) => void): Promise<void> {
    if (this.isScanning) return;
    
    if (!this.manager) {
      logger.warn('BLE Manager not available - cannot start scanning');
      return;
    }

    try {
      const state = await this.manager.state();
      if (state !== State.PoweredOn) {
        throw new Error('BLE not powered on');
      }

      this.manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: true }, (error, device) => {
        if (error) {
          logger.error('BLE scan error:', error);
          return;
        }

        if (device && device.name?.startsWith(DEVICE_NAME_PREFIX)) {
          onDeviceFound?.(device);
          this.handleDiscoveredDevice(device);
        }
      });

      this.isScanning = true;
      logger.debug('Started BLE scanning');

    } catch (error) {
      logger.error('Failed to start scanning:', error);
      throw error;
    }
  }

  // Stop scanning
  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;

    if (!this.manager) {
      logger.warn('BLE Manager not available - cannot stop scanning');
      return;
    }

    try {
      this.manager.stopDeviceScan();
      this.isScanning = false;
      logger.debug('Stopped BLE scanning');
    } catch (error) {
      logger.error('Failed to stop scanning:', error);
    }
  }

  // Handle discovered device and attempt connection
  // @ts-expect-error - Device type from react-native-ble-plx
  private async handleDiscoveredDevice(device: Device) {
    try {
      // Connect to device
      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      // Store connected device
      this.connectedDevices.set(device.id, connectedDevice);
      
      // Subscribe to characteristic changes
      const service = await connectedDevice.services();
      const characteristic = await service[0]?.characteristics();
      
      if (characteristic?.[0]) {
        characteristic[0].monitor((error, char) => {
          if (error) {
            logger.error('Characteristic monitor error:', error);
            return;
          }
          
          if (char?.value) {
            this.handleReceivedMessage(char.value);
          }
        });
      }

    } catch (error) {
      logger.error('Failed to handle device:', error);
    }
  }

  // Send message to specific peer or broadcast
  async sendMessage(message: Omit<BleMessage, 'id' | 'fromPub' | 'timestamp'>, peerId?: string): Promise<void> {
    const fullMessage: BleMessage = {
      ...message,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromPub: this.identityPublicKey,
      timestamp: Date.now(),
    };

    // Add to seen messages to prevent loops
    this.seenMessageIds.add(fullMessage.id);
    await this.saveSeenMessageIds();

    if (peerId && this.connectedDevices.has(peerId)) {
      // Direct send to connected peer
      await this.sendDirectMessage(fullMessage, peerId);
    } else {
      // Broadcast via advertisement and scan
      await this.broadcastMessage(fullMessage);
    }

    // Add to queue for relay
    this.messageQueue.push(fullMessage);
    await this.saveMessageQueue();
  }

  // Send message directly to connected device
  private async sendDirectMessage(message: BleMessage, deviceId: string): Promise<void> {
    try {
      const device = this.connectedDevices.get(deviceId);
      if (!device) return;

      const service = await device.services();
      const characteristic = await service[0]?.characteristics();
      
      if (characteristic?.[0]) {
        const messageData = JSON.stringify(message);
        const base64Data = (globalThis as any).Buffer.from(messageData).toString('base64');
        
        await characteristic[0].writeWithResponse(base64Data);
      }
    } catch (error) {
      logger.error('Failed to send direct message:', error);
    }
  }

  // Broadcast message via advertisement payload
  private async broadcastMessage(message: BleMessage): Promise<void> {
    // For now, add to relay queue - in production, encode in advertisement payload
    this.messageQueue.push(message);
    await this.saveMessageQueue();
  }

  // Handle received message
  private handleReceivedMessage(base64Data: string): void {
    try {
      const messageData = (globalThis as any).Buffer.from(base64Data, 'base64').toString('utf8');
      const message: BleMessage = JSON.parse(messageData);
      
      // Validate message signature (placeholder - implement with tweetnacl)
      if (!this.validateMessage(message)) {
        logger.warn('Invalid message signature');
        return;
      }

      // Check if message already seen
      if (this.seenMessageIds.has(message.id)) {
        return;
      }

      // Add to seen messages
      this.seenMessageIds.add(message.id);
      this.saveSeenMessageIds();

      // Process message
      this.processMessage(message);

      // Relay if TTL > 0
      if (message.ttl > 0) {
        const relayMessage = { ...message, ttl: message.ttl - 1 };
        this.messageQueue.push(relayMessage);
        this.saveMessageQueue();
      }

    } catch (error) {
      logger.error('Failed to handle received message:', error);
    }
  }

  // Validate message signature (placeholder)
  private validateMessage(message: BleMessage): boolean {
    // TODO: Implement tweetnacl signature validation
    // For now, accept all messages
    return true;
  }

  // Process received message
  private processMessage(message: BleMessage): void {
    logger.debug('Received message', { type: message.type, id: message.id });
    
    // Emit event or callback for UI handling
    // TODO: Implement event system or callback
  }

  // Start relay timer for periodic message forwarding
  private startRelayTimer(): void {
    this.relayTimer = (globalThis as any).setInterval(async () => {
      await this.processRelayQueue();
    }, 5000); // Relay every 5 seconds
  }

  // Process messages in relay queue
  private async processRelayQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    const messagesToRelay = this.messageQueue.filter(msg => msg.ttl > 0);
    this.messageQueue = this.messageQueue.filter(msg => msg.ttl <= 0);

    for (const message of messagesToRelay) {
      // Attempt to send to connected devices
      for (const [deviceId] of this.connectedDevices) {
        try {
          await this.sendDirectMessage(message, deviceId);
        } catch (error) {
          logger.error('Failed to relay message:', error);
        }
      }
    }

    await this.saveMessageQueue();
  }

  // Cleanup resources
  async cleanup(): Promise<void> {
    await this.stopAdvertising();
    await this.stopScanning();
    
    if (this.relayTimer) {
      (globalThis as any).clearInterval(this.relayTimer);
      this.relayTimer = null;
    }

    // Disconnect all devices
    for (const device of this.connectedDevices.values()) {
      try {
        await device.cancelConnection();
      } catch (error) {
        logger.error('Failed to disconnect device:', error);
      }
    }
    
    this.connectedDevices.clear();
  }
}

// Singleton instance
export const blePeerService = new BlePeerService();
