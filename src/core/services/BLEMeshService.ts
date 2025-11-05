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

      // Check BLE state
      const state = await manager.state();
      if (state !== State.PoweredOn) {
        if (__DEV__) logger.warn('Bluetooth is not powered on');
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
    if (!this.myDeviceId) {
      logger.error('Cannot send message: no device ID');
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

    // Sanitize 'to' field if provided
    const sanitizedTo = to ? sanitizeString(to, 50) : undefined;

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
    };

    // Add to queue
    this.messageQueue.push(message);

    // Add to store
    useMeshStore.getState().addMessage(message);
    useMeshStore.getState().incrementStat('messagesSent');

    // Save to Firestore (backup)
    try {
      const { firebaseDataService } = await import('./FirebaseDataService');
      if (firebaseDataService.isInitialized) {
      await firebaseDataService.saveMessage({
        id: message.id,
        from: message.from,
        to: message.to,
        content: message.content,
        type: (message.type === 'sos' || message.type === 'status' || message.type === 'location' || message.type === 'text') ? message.type : 'text',
        timestamp: message.timestamp,
        priority: message.type === 'sos' ? 'critical' : 'normal',
      });
      }
    } catch (error) {
      logger.error('Failed to save message to Firestore:', error);
    }

    if (__DEV__) logger.info('Message queued:', message.id);
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
    };

    this.messageQueue.push(message);
    useMeshStore.getState().addMessage(message);
    useMeshStore.getState().incrementStat('messagesSent');

    if (__DEV__) logger.info('SOS sent:', message.id);
  }

  /**
   * Broadcast a message to all nearby devices (for beacon)
   */
  async broadcastMessage(message: Partial<MeshMessage> | string) {
    if (!this.myDeviceId) return;

    // Handle string payload (for beacon)
    if (typeof message === 'string') {
      const fullMessage: MeshMessage = {
        id: await Crypto.randomUUID(),
        from: this.myDeviceId,
        content: message,
        type: 'broadcast',
        timestamp: Date.now(),
        ttl: 5,
        hops: 0,
        delivered: false,
      };
      this.messageQueue.push(fullMessage);
      useMeshStore.getState().incrementStat('messagesSent');
      if (__DEV__) logger.info('Broadcast message queued (string)');
      return;
    }

    // Handle object payload
    const fullMessage: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      content: message.content || '',
      type: message.type || 'broadcast',
      timestamp: message.timestamp || Date.now(),
      ttl: 5, // Lower TTL for broadcasts
      hops: 0,
      delivered: false,
      ...message,
    };

    this.messageQueue.push(fullMessage);
    useMeshStore.getState().incrementStat('messagesSent');

    if (__DEV__) logger.info('Broadcast message queued:', fullMessage.type);
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

  /**
   * Handle received beacon message
   */
  private async handleBeaconMessage(message: MeshMessage, rssi?: number | null) {
    try {
      // Parse beacon payload
      const payload = JSON.parse(message.content);
      
      // Forward to rescue beacon service
      const { rescueBeaconService } = await import('./RescueBeaconService');
      await rescueBeaconService.handleReceivedBeacon(payload, rssi || undefined);
    } catch (error) {
      logger.error('Failed to handle beacon message:', error);
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

      // Stop scan after duration
      setTimeout(() => {
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
        this.connectToPeers(Array.from(discoveredDevices.values()));
      }, SCAN_DURATION);
    } catch (error) {
      logger.error('Scan start error:', error);
      useMeshStore.getState().setScanning(false);
    }
  }

  private async connectToPeers(devices: Device[]) {
    for (const device of devices.slice(0, 3)) { // Connect to max 3 peers
      try {
        if (__DEV__) logger.info('Connecting to', device.name);
        
        const connected = await device.connect({ timeout: 5000 });
        await connected.discoverAllServicesAndCharacteristics();

        // Exchange messages
        await this.exchangeMessages(connected);

        // Disconnect after message exchange
        await connected.cancelConnection();
        
        // Keep mesh as connected since service is still running
        // Only set to false when service stops

      } catch (error) {
        logger.error('Connection error:', error);
      }
    }
  }

  private async exchangeMessages(device: Device) {
    try {
      // Send queued messages
      for (const message of this.messageQueue) {
        const payload = JSON.stringify(message);
        
        try {
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
        } catch (writeError) {
          logger.error('Write error:', writeError);
          // Keep in queue for retry
          continue;
        }
      }

      // Clear successfully sent messages
      this.messageQueue = this.messageQueue.filter(msg => !msg.delivered);

      // Read incoming messages
      try {
        const services = await device.services();
        if (services && services.length > 0) {
          const characteristics = await services[0].characteristics();
          if (characteristics && characteristics.length > 0) {
            const char = characteristics[0];
            const value = await char.read();
            
            if (value && value.value) {
              const payload = Buffer.from(value.value, 'base64').toString('utf-8');
              const incomingMessage = JSON.parse(payload) as MeshMessage;
              
              // Handle beacon messages
              if (incomingMessage.type === 'SOS_BEACON') {
                await this.handleBeaconMessage(incomingMessage, device.rssi);
              }
              
              // Add to store if not duplicate
              useMeshStore.getState().addMessage(incomingMessage);
              useMeshStore.getState().incrementStat('messagesReceived');
              
              // Notify callbacks
              this.notifyMessageCallbacks(incomingMessage);
              
              if (__DEV__) logger.info('Message received:', incomingMessage.id);
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

