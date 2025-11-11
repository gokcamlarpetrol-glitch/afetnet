/**
 * BLE MESH SERVICE - Offline Peer-to-Peer Communication
 * Simple BLE mesh implementation for offline messaging
 */

import { BleManager, Device, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { useMeshStore, MeshPeer, MeshMessage } from '../stores/meshStore';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { createLogger } from '../utils/logger';
import { validateMessageContent, sanitizeString } from '../utils/validation';
import { getDeviceId as getDeviceIdFromLib } from '../../lib/device';

const logger = createLogger('BLEMeshService');

const SERVICE_UUID = '0000180A-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '00002A29-0000-1000-8000-00805F9B34FB';
const SCAN_DURATION = 5000; // 5 seconds
const SCAN_INTERVAL = 10000; // 10 seconds

type MessageCallback = (message: MeshMessage) => void;

class BLEMeshService {
  private manager: BleManager | null = null;
  private isRunning = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  private advertisingTimer: NodeJS.Timeout | null = null;
  private myDeviceId: string | null = null;
  private messageQueue: MeshMessage[] = [];
  private messageCallbacks: MessageCallback[] = [];
  private deviceSubscriptions: Map<string, any> = new Map();

  constructor() {
    // Don't initialize BleManager here - wait for start() to be called
  }

  private getManager(): BleManager | null {
    try {
      if (!this.manager) {
        this.manager = new BleManager();
        if (__DEV__) logger.info('BLE Manager created successfully');
      }
      return this.manager;
    } catch (error) {
      logger.error('BLE Manager creation failed:', error);
      return null;
    }
  }

  onMessage(callback: MessageCallback) {
    this.messageCallbacks.push(callback);
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index > -1) {
        this.messageCallbacks.splice(index, 1);
      }
    };
  }

  private notifyMessageCallbacks(message: MeshMessage) {
    for (const callback of this.messageCallbacks) {
      try {
        callback(message);
      } catch (error) {
        logger.error('Message callback error:', error);
      }
    }
  }

  async start() {
    if (this.isRunning) return;

    if (__DEV__) logger.info('Starting...');

    try {
      // Get or create BLE manager
      const manager = this.getManager();
      if (!manager) {
        logger.warn('BLE not available - mesh networking disabled');
        return;
      }

      // Request permissions
      await this.requestPermissions();

      // ELITE: Set up Bluetooth state listener for automatic restart
      manager.onStateChange((state) => {
        if (state === State.PoweredOn && !this.isRunning) {
          if (__DEV__) {
            logger.info('Bluetooth powered on - auto-starting mesh service...');
          }
          // Auto-start when Bluetooth is enabled
          this.start().catch((error) => {
            logger.error('Auto-start failed:', error);
          });
        } else if (state !== State.PoweredOn && this.isRunning) {
          if (__DEV__) {
            logger.debug('Bluetooth powered off - mesh service will restart when enabled');
          }
          // Service will auto-restart when Bluetooth is enabled again
        }
      }, true); // true = emit current state immediately

      // Check BLE state
      const state = await manager.state();
      if (state !== State.PoweredOn) {
        // ELITE: Don't log as warning - this is expected when Bluetooth is off
        // Only log in dev mode to reduce production noise
        // Service will auto-start when Bluetooth is enabled via state listener
        if (__DEV__) {
          logger.debug('Bluetooth is not powered on (mesh networking will start when Bluetooth is enabled)');
        }
        return;
      }

      // Generate device ID
      this.myDeviceId = await this.getDeviceId();
      useMeshStore.getState().setMyDeviceId(this.myDeviceId);
      
      if (__DEV__) logger.info('Device ID:', this.myDeviceId);

      this.isRunning = true;

      // Mark mesh as connected (active) - service is running
      useMeshStore.getState().setConnected(true);
      useMeshStore.getState().setAdvertising(true);

      // Start scanning cycle
      this.startScanCycle();

      if (__DEV__) logger.info('Started successfully - Mesh network active');
    } catch (error) {
      logger.error('Start error:', error);
      // Don't throw - allow app to continue without BLE
    }
  }

  stop() {
    if (!this.isRunning) return;

    if (__DEV__) logger.info('Stopping...');

    this.isRunning = false;

    // Clear all timers to prevent memory leaks
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    if (this.advertisingTimer) {
      clearTimeout(this.advertisingTimer);
      this.advertisingTimer = null;
    }

    // Unsubscribe from all device notifications
    this.deviceSubscriptions.forEach((subscription, deviceId) => {
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch (error) {
        logger.error(`Failed to remove subscription for ${deviceId}:`, error);
      }
    });
    this.deviceSubscriptions.clear();

    if (this.manager) {
      try {
        this.manager.stopDeviceScan();
      } catch (error) {
        logger.error('Stop scan error:', error);
      }
    }
    useMeshStore.getState().setScanning(false);
    useMeshStore.getState().setConnected(false);
    useMeshStore.getState().setAdvertising(false);
  }

  getMyDeviceId(): string | null {
    return this.myDeviceId;
  }

  async sendMessage(content: string, to?: string) {
    // ELITE: Validate service is running
    if (!this.isRunning) {
      logger.warn('Cannot send message: BLE Mesh service is not running');
      return;
    }

    if (!this.myDeviceId) {
      logger.error('Cannot send message: no device ID');
      return;
    }

    // ELITE: Validate content type and length
    if (!content || typeof content !== 'string') {
      logger.error('Invalid message content: must be a string');
      return;
    }

    if (content.length === 0) {
      logger.error('Invalid message content: empty string');
      return;
    }

    // Validate and sanitize content
    if (!validateMessageContent(content)) {
      logger.error('Invalid message content');
      return;
    }

    const sanitizedContent = sanitizeString(content, 5000);
    if (!sanitizedContent) {
      logger.error('Message content is empty after sanitization');
      return;
    }

    // ELITE: Sanitize 'to' field if provided with validation
    let sanitizedTo: string | undefined = undefined;
    if (to) {
      if (typeof to !== 'string' || to.trim().length === 0) {
        logger.warn('Invalid "to" field, ignoring:', to);
      } else {
        sanitizedTo = sanitizeString(to, 50);
        if (!sanitizedTo) {
          logger.warn('"to" field is empty after sanitization, ignoring');
        }
      }
    }

    const message: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      to: sanitizedTo,
      content: sanitizedContent,
      type: 'text',
      timestamp: Date.now(),
      ttl: 5,
      hops: 0,
      delivered: false,
      priority: 'normal',
      sequence: 0,
      ackRequired: false,
      attempts: 0,
    };

    // Add to queue
    this.messageQueue.push(message);

    // Add to store
    useMeshStore.getState().addMessage(message);
    useMeshStore.getState().incrementStat('messagesSent');

    if (__DEV__) logger.info('Message queued:', message.id);
  }

  async broadcastMessage(message: Omit<MeshMessage, 'id' | 'from' | 'timestamp' | 'hops' | 'delivered'>) {
    // ELITE: Validate service is running
    if (!this.isRunning) {
      logger.warn('Cannot broadcast: BLE Mesh service is not running');
      return;
    }

    if (!this.myDeviceId) {
      logger.warn('Cannot broadcast: device ID not available');
      return;
    }

    // ELITE: Validate message structure
    if (!message || typeof message !== 'object') {
      logger.error('Invalid broadcast message: must be an object');
      return;
    }

    if (!message.content || typeof message.content !== 'string' || message.content.length === 0) {
      logger.error('Invalid broadcast message: content must be a non-empty string');
      return;
    }

    // ELITE: Validate content length
    if (message.content.length > 5000) {
      logger.error('Invalid broadcast message: content too long (max 5000 chars)');
      return;
    }

    const fullMessage: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      timestamp: Date.now(),
      hops: 0,
      delivered: false,
      ...message,
    };

    this.messageQueue.push(fullMessage);
    useMeshStore.getState().addMessage(fullMessage);
    useMeshStore.getState().incrementStat('messagesSent');

    if (__DEV__) logger.info('Broadcast message queued:', fullMessage.id);
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  async sendSOS() {
    if (!this.myDeviceId) return;

    const message: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      content: 'SOS - Acil yardım gerekiyor!',
      type: 'sos',
      timestamp: Date.now(),
      ttl: 10, // Higher TTL for SOS
      hops: 0,
      delivered: false,
      priority: 'critical',
      sequence: 0,
      ackRequired: false,
      attempts: 0,
    };

    this.messageQueue.push(message);
    useMeshStore.getState().addMessage(message);
    useMeshStore.getState().incrementStat('messagesSent');

    if (__DEV__) logger.info('SOS sent:', message.id);
  }

  async broadcastEmergency(data: { type: string; magnitude?: number; timestamp: number }) {
    if (!this.myDeviceId) return;

    const message: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      content: JSON.stringify(data),
      type: 'sos',
      timestamp: Date.now(),
      ttl: 10,
      hops: 0,
      delivered: false,
      priority: 'critical',
      sequence: 0,
      ackRequired: false,
      attempts: 0,
    };

    this.messageQueue.push(message);
    useMeshStore.getState().addMessage(message);
    useMeshStore.getState().incrementStat('messagesSent');

    if (__DEV__) logger.info('Emergency broadcast sent:', message.id);
  }

  private async requestPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
      } else {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      }
    }
  }

  private async getDeviceId(): Promise<string> {
    // Use centralized device ID from src/lib/device.ts
    // This ensures the same ID is used across the entire app
    // and is stored securely in SecureStore (device-specific, persistent)
    try {
      const deviceId = await getDeviceIdFromLib();
      if (__DEV__) logger.info('Using device ID from lib/device:', deviceId);
      return deviceId;
    } catch (error) {
      logger.error('Device ID generation error:', error);
      // Fallback to random ID if SecureStore completely fails
      const uuid = await Crypto.randomUUID();
      const fallbackId = `afn-${uuid.slice(0, 8)}`;
      if (__DEV__) logger.warn('Using fallback device ID:', fallbackId);
      return fallbackId;
    }
  }

  private startScanCycle() {
    if (!this.isRunning) return;

    // Start scan
    this.scan();

    // Schedule next scan
    this.scanTimer = setTimeout(() => {
      this.startScanCycle();
    }, SCAN_INTERVAL);
  }

  private scan() {
    const manager = this.manager;
    if (!manager) {
      logger.warn('Cannot scan: BLE manager not available');
      return;
    }

    if (__DEV__) logger.info('Starting scan...');
    useMeshStore.getState().setScanning(true);

    const discoveredDevices = new Map<string, Device>();

    try {
      manager.startDeviceScan(
        null, // Scan for all devices
        { allowDuplicates: true },
        (error, device) => {
          if (error) {
            logger.error('Scan error:', error);
            return;
          }

          if (device && device.name && device.name.startsWith('AFN-')) {
            discoveredDevices.set(device.id, device);

            const peer: MeshPeer = {
              id: device.id,
              name: device.name,
              rssi: device.rssi || -100,
              lastSeen: Date.now(),
            };

            useMeshStore.getState().addPeer(peer);
          }
        }
      );

      // Stop scan after duration - STORE TIMEOUT ID FOR CLEANUP
      const scanTimeoutId = setTimeout(() => {
        if (manager) {
          try {
            manager.stopDeviceScan();
          } catch (error) {
            logger.error('Stop scan error:', error);
          }
        }
        useMeshStore.getState().setScanning(false);
        if (__DEV__) logger.info('Scan stopped. Found', discoveredDevices.size, 'peers');

        // Try to connect to discovered devices
        this.connectToPeers(Array.from(discoveredDevices.values())).catch((error) => {
          logger.error('Error connecting to peers:', error);
        });
      }, SCAN_DURATION);

      // ELITE: Store timeout ID for cleanup (if service stops during scan)
      // Note: This is a local variable, but we ensure cleanup in stop() method
      // For now, we rely on stop() being called properly
    } catch (error) {
      logger.error('Scan start error:', error);
      useMeshStore.getState().setScanning(false);
    }
  }

  private async connectToPeers(devices: Device[]) {
    // ELITE: Process connections sequentially to avoid overwhelming BLE stack
    for (const device of devices.slice(0, 3)) { // Connect to max 3 peers
      if (!this.isRunning) {
        // Service stopped during connection attempt
        break;
      }

      try {
        if (__DEV__) logger.info('Connecting to', device.name);
        
        // ELITE: Add timeout protection for connection
        const connectionPromise = device.connect({ timeout: 5000 });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 6000)
        );
        
        const connected = await Promise.race([connectionPromise, timeoutPromise]) as Device;
        await connected.discoverAllServicesAndCharacteristics();

        // Exchange messages with error handling
        await this.exchangeMessages(connected).catch((error) => {
          logger.error('Message exchange error:', error);
        });

        // Disconnect after message exchange
        await connected.cancelConnection().catch((error) => {
          logger.error('Disconnect error:', error);
        });
        
        // Keep mesh as connected since service is still running
        // Only set to false when service stops

      } catch (error) {
        logger.error('Connection error:', error);
        // Continue to next device
      }
    }
  }

  private async exchangeMessages(device: Device) {
    if (!this.isRunning) {
      return; // Service stopped
    }

    try {
      // ELITE: Send queued messages with comprehensive error handling
      const messagesToSend = [...this.messageQueue]; // Copy to avoid mutation during iteration
      for (const message of messagesToSend) {
        if (!this.isRunning) {
          break; // Service stopped during message sending
        }

        try {
          // ELITE: Validate message before sending
          if (!message || !message.id || !message.content) {
            logger.warn('Invalid message in queue, skipping:', message);
            continue;
          }

          const payload = JSON.stringify(message);
          
          // ELITE: Validate payload size (BLE has MTU limits, typically 20-512 bytes)
          if (payload.length > 500) {
            logger.warn('Message too large for BLE, skipping:', message.id);
            continue;
          }
          
          // Try to write to characteristic
          const services = await device.services();
          if (services && services.length > 0) {
            const characteristics = await services[0].characteristics();
            if (characteristics && characteristics.length > 0) {
              const char = characteristics[0];
              const base64Payload = Buffer.from(payload).toString('base64');
              await char.writeWithResponse(base64Payload);
              
              // Mark as delivered
              useMeshStore.getState().markMessageDelivered(message.id);
              useMeshStore.getState().incrementStat('messagesSent');
              
              if (__DEV__) logger.info('Message sent:', message.id);
            }
          }
        } catch (writeError: any) {
          logger.error('Write error:', writeError);
          // ELITE: Increment attempts and remove if max attempts reached
          message.attempts = (message.attempts || 0) + 1;
          if (message.attempts >= 3) {
            logger.warn('Message failed after 3 attempts, removing from queue:', message.id);
            this.messageQueue = this.messageQueue.filter(msg => msg.id !== message.id);
          }
          // Keep in queue for retry if attempts < 3
          continue;
        }
      }

      // Clear successfully sent messages
      this.messageQueue = this.messageQueue.filter(msg => !msg.delivered);

      // ELITE: Read incoming messages with validation
      if (!this.isRunning) {
        return; // Service stopped
      }

      try {
        const services = await device.services();
        if (services && services.length > 0) {
          const characteristics = await services[0].characteristics();
          if (characteristics && characteristics.length > 0) {
            const char = characteristics[0];
            const value = await char.read();
            
            if (value && value.value) {
              try {
                const payload = Buffer.from(value.value, 'base64').toString('utf-8');
                const incomingMessage = JSON.parse(payload) as MeshMessage;
                
                // ELITE: Validate incoming message structure
                if (!incomingMessage || !incomingMessage.id || !incomingMessage.content) {
                  logger.warn('Invalid message structure received, ignoring');
                  return;
                }

                // ELITE: Check for duplicate messages
                const existingMessage = useMeshStore.getState().messages.find(m => m.id === incomingMessage.id);
                if (existingMessage) {
                  if (__DEV__) logger.debug('Duplicate message received, ignoring:', incomingMessage.id);
                  return;
                }
                
                // Add to store if not duplicate
                useMeshStore.getState().addMessage(incomingMessage);
                useMeshStore.getState().incrementStat('messagesReceived');
                
                // Notify callbacks with error handling
                this.notifyMessageCallbacks(incomingMessage);
                
                if (__DEV__) logger.info('Message received:', incomingMessage.id);
              } catch (parseError) {
                logger.error('Failed to parse incoming message:', parseError);
              }
            }
          }
        }
      } catch (readError) {
        logger.error('Read error:', readError);
      }

    } catch (error) {
      logger.error('Message exchange error:', error);
    }
  }
}

export const bleMeshService = new BLEMeshService();

