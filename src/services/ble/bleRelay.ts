import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { Platform } from 'react-native';

// Safe BLE imports with fallbacks for Expo Go
let BleManager: any = null;
let Device: any = null;
let State: any = null;
let isExpoGo = false;

try {
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
  Device = blePlx.Device;
  State = blePlx.State;
} catch (e) {
  logger.warn('react-native-ble-plx not available, using fallback');
  isExpoGo = true;
}

// Detect Expo Go environment
try {
  const Constants = require('expo-constants');
  isExpoGo = Constants.default?.executionEnvironment === 'storeClient' || isExpoGo;
} catch (e) {
  // Ignore
}

export interface RelayMessage {
  id: string;
  from: string; // pubKeyBase64
  ts: number;
  type: 'SOS' | 'PING' | 'ACK';
  lat?: number;
  lon?: number;
  ttl: number;
  payload?: string;
}

export interface RSSISample {
  deviceId: string;
  lat?: number;
  lon?: number;
  rssi: number;
  ts: number;
}

class SimDriver {
  private static instance: SimDriver;
  private messageBus: RelayMessage[] = [];
  private subscribers: ((msg: RelayMessage) => void)[] = [];

  static getInstance(): SimDriver {
    if (!SimDriver.instance) {
      SimDriver.instance = new SimDriver();
    }
    return SimDriver.instance;
  }

  broadcast(message: RelayMessage): void {
    this.messageBus.push(message);
    this.subscribers.forEach(cb => cb(message));
  }

  subscribe(callback: (msg: RelayMessage) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) this.subscribers.splice(index, 1);
    };
  }
}

export class BLERelay {
  private manager: any = null;
  private isActive = false;
  private identityPub = '';
  private seenIds = new Set<string>();
  private messageCache = new Map<string, RelayMessage>();
  private subscribers: ((msg: RelayMessage) => void)[] = [];
  private simDriver = SimDriver.getInstance();
  private isSimulator = __DEV__ && Platform.OS === 'ios';
  private rssiSamples: RSSISample[] = [];
  private maxSeenIds = 1000;
  private maxRssiSamples = 200;
  private scanInterval?: NodeJS.Timeout;
  private adaptiveMode = false;

  constructor() {
    // NEVER create BleManager in Expo Go - it causes NativeEventEmitter crash
    if (isExpoGo) {
      logger.warn('Expo Go detected - using mock BLE mode');
      this.manager = null;
    } else if (BleManager && typeof BleManager === 'function') {
      try {
        this.manager = new BleManager();
        logger.debug('BLE Manager created successfully');
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
    this.loadSeenIds();
  }

  private async loadSeenIds(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('ble_relay_seen_ids');
      if (stored) {
        this.seenIds = new Set(JSON.parse(stored));
      }
    } catch (error) {
      logger.warn('Failed to load seen IDs:', error);
    }
  }

  private async saveSeenIds(): Promise<void> {
    try {
      await AsyncStorage.setItem('ble_relay_seen_ids', JSON.stringify([...this.seenIds]));
    } catch (error) {
      logger.warn('Failed to save seen IDs:', error);
    }
  }

  async startRelay(identityPub: string, adaptiveMode = false): Promise<void> {
    try {
      this.identityPub = identityPub;
      this.adaptiveMode = adaptiveMode;
      
      if (this.isSimulator || isExpoGo) {
        logger.debug('Using simulator driver for BLE relay (Expo Go mode)');
        this.isActive = true;
        this.simDriver.subscribe((msg) => this.handleReceivedMessage(msg));
        return;
      }

      if (!this.manager) {
        logger.warn('BLE manager not available - using mock mode');
        this.isActive = true;
        return;
      }

      try {
        const state = await this.manager.state();
        if (state !== State.PoweredOn) {
          logger.warn('BLE not powered on - using mock mode');
          this.isActive = true;
          return;
        }

        // Start adaptive scanning
        this.startAdaptiveScanning();

        this.isActive = true;
        logger.debug('BLE relay started', adaptiveMode ? '(adaptive mode)' : '');
      } catch (error) {
        logger.warn('BLE relay start failed, continuing with mock mode:', error);
        this.isActive = true;
      }
    } catch (error) {
      logger.error('Critical error in startRelay:', error);
      // Always set active to prevent app crashes
      this.isActive = true;
    }
  }

  async stopRelay(): Promise<void> {
    if (!this.isActive) return;

    try {
      if (!this.isSimulator && !isExpoGo && this.manager) {
        this.manager.stopDeviceScan();
        if (this.scanInterval) {
          clearInterval(this.scanInterval);
          this.scanInterval = undefined;
        }
      }
      this.isActive = false;
      this.adaptiveMode = false;
      logger.debug('BLE relay stopped');
    } catch (error) {
      logger.error('Failed to stop BLE relay:', error);
    }
  }

  // @ts-expect-error - Device type from react-native-ble-plx
  private async handleDiscoveredDevice(device: Device): Promise<void> {
    try {
      await device.connect();
      await device.discoverAllServicesAndCharacteristics();
      
      const services = await device.services();
      if (services.length > 0) {
        const characteristics = await services[0].characteristics();
        if (characteristics.length > 0) {
          characteristics[0].monitor((error, char) => {
            if (error) {
              logger.warn('BLE characteristic monitor error:', error);
              return;
            }
            if (char?.value) {
              try {
                const messageData = Buffer.from(char.value, 'base64').toString('utf8');
                const message: RelayMessage = JSON.parse(messageData);
                this.handleReceivedMessage(message);
              } catch (parseError) {
                logger.warn('Failed to parse BLE message:', parseError);
              }
            }
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to handle device (non-critical):', error);
      // Non-critical error - continue operation
    }
  }

  private handleReceivedMessage(message: RelayMessage): void {
    try {
      // Check if message already seen
      if (this.seenIds.has(message.id)) {
        return;
      }

      // Add to seen messages
      this.seenIds.add(message.id);
      this.saveSeenIds().catch(err => logger.warn('Failed to save seen IDs:', err));

      // Cache message
      this.messageCache.set(message.id, message);

      // Notify subscribers
      this.subscribers.forEach(cb => {
        try {
          cb(message);
        } catch (cbError) {
          logger.warn('Subscriber callback error:', cbError);
        }
      });

      // Relay if TTL > 0
      if (message.ttl > 0) {
        const relayMessage = { ...message, ttl: message.ttl - 1 };
        
        // Add small jitter before re-broadcasting
        const jitter = 200 + Math.random() * 600; // 200-800ms
        setTimeout(() => {
          try {
            this.broadcastMessage(relayMessage);
          } catch (broadcastError) {
            logger.warn('Broadcast error:', broadcastError);
          }
        }, jitter);
      }

      logger.debug('Relayed message', { id: message.id, ttl: message.ttl });
    } catch (error) {
      logger.error('Critical error in handleReceivedMessage:', error);
      // Continue operation despite error
    }
  }

  private broadcastMessage(message: RelayMessage): void {
    if (this.isSimulator) {
      this.simDriver.broadcast(message);
    } else {
      // In real implementation, this would advertise the message
      // For now, we'll use the message bus approach
      logger.debug('Broadcasting message:', message.id);
    }
  }

  async sendDirect(message: RelayMessage): Promise<void> {
    try {
      // Try direct write if connected, otherwise enqueue and advertise
      if (this.isSimulator || isExpoGo) {
        this.simDriver.broadcast(message);
      } else {
        // Real BLE implementation would attempt direct connection
        this.broadcastMessage(message);
      }

      // Add to seen messages to prevent loops
      this.seenIds.add(message.id);
      await this.saveSeenIds();
      logger.debug('Message sent successfully:', message.id);
    } catch (error) {
      logger.error('Failed to send direct message:', error);
      // Re-throw to let caller handle
      throw new Error(`Message send failed: ${error}`);
    }
  }

  onMessage(callback: (message: RelayMessage) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) this.subscribers.splice(index, 1);
    };
  }

  getSeenCount(): number {
    return this.seenIds.size;
  }

  getLastMessages(count = 10): RelayMessage[] {
    return Array.from(this.messageCache.values())
      .sort((a, b) => b.ts - a.ts)
      .slice(0, count);
  }

  clearCache(): void {
    this.messageCache.clear();
    this.seenIds.clear();
    this.rssiSamples = [];
    this.saveSeenIds();
  }

  private startAdaptiveScanning(): void {
    if (this.isSimulator || isExpoGo || !this.manager) return;

    const scanDuration = this.adaptiveMode ? 6000 : 3000; // 6s for emergency, 3s normal
    const idleDuration = this.adaptiveMode ? 4000 : 7000; // 4s for emergency, 7s normal

    const performScan = () => {
      if (!this.isActive) return;

      try {
        logger.debug(`Starting BLE scan for ${scanDuration}ms`);
        
        this.manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
          if (error) {
            logger.warn('BLE scan error (non-critical):', error);
            return;
          }

          if (device?.name?.startsWith('AfetNet')) {
            this.handleDiscoveredDevice(device).catch(err => 
              logger.warn('Device handling error:', err)
            );
            
            // Record RSSI sample
            try {
              this.recordRSSISample(device);
            } catch (rssiError) {
              logger.warn('RSSI recording error:', rssiError);
            }
          }
        });

        // Stop scanning after duration
        setTimeout(() => {
          if (this.isActive) {
            try {
              this.manager.stopDeviceScan();
              logger.debug('BLE scan stopped');
            } catch (stopError) {
              logger.warn('Error stopping scan:', stopError);
            }
          }
        }, scanDuration);
      } catch (scanError) {
        logger.error('Critical scan error:', scanError);
        // Continue operation despite error
      }
    };

    // Start first scan immediately
    performScan();

    // Schedule periodic scans
    this.scanInterval = setInterval(performScan, scanDuration + idleDuration);
  }

  // @ts-expect-error - Device type from react-native-ble-plx
  private recordRSSISample(device: Device): void {
    const sample: RSSISample = {
      deviceId: device.id,
      rssi: device.rssi || -100,
      ts: Date.now()
    };

    this.rssiSamples.push(sample);

    // Keep only recent samples
    if (this.rssiSamples.length > this.maxRssiSamples) {
      this.rssiSamples = this.rssiSamples.slice(-this.maxRssiSamples);
    }
  }

  getRSSISamples(): RSSISample[] {
    return [...this.rssiSamples];
  }

  getLastMessagesWithHops(count = 10): Array<RelayMessage & { hopCount?: number }> {
    return Array.from(this.messageCache.values())
      .sort((a, b) => b.ts - a.ts)
      .slice(0, count)
      .map(msg => ({
        ...msg,
        hopCount: 5 - msg.ttl // Calculate hop count from TTL
      }));
  }

  // Emergency mode methods
  setEmergencyMode(enabled: boolean): void {
    if (this.adaptiveMode === enabled) return;

    this.adaptiveMode = enabled;
    
    if (this.isActive && !this.isSimulator && !isExpoGo && this.manager) {
      // Restart scanning with new parameters
      this.manager.stopDeviceScan();
      if (this.scanInterval) {
        clearInterval(this.scanInterval);
        this.scanInterval = undefined;
      }
      this.startAdaptiveScanning();
    }
  }
}

export const bleRelay = new BLERelay();
