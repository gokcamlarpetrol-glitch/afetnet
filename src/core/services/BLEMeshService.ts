/**
 * BLE MESH SERVICE - Offline Peer-to-Peer Communication
 * Simple BLE mesh implementation for offline messaging
 */

import { BleManager, Device, State, ScanMode } from 'react-native-ble-plx';
import type {
  BleError,
  Characteristic,
  Subscription,
  BleRestoredState,
  ScanOptions,
} from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { useMeshStore, MeshPeer, MeshMessage } from '../stores/meshStore';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';
import { validateMessageContent, sanitizeString } from '../utils/validation';
import { getDeviceId as getDeviceIdFromLib } from '../../lib/device';
import { SafeBLE } from '../../ble/SafeBLE';
import { AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID } from '../../ble/constants';

const logger = createLogger('BLEMeshService');

const SERVICE_UUID = AFETNET_SERVICE_UUID.toLowerCase();
const SERVICE_UUID_UPPER = AFETNET_SERVICE_UUID.toUpperCase();
const CHARACTERISTIC_UUID = AFETNET_CHAR_MSG_UUID.toLowerCase();
const CHARACTERISTIC_UUID_UPPER = AFETNET_CHAR_MSG_UUID.toUpperCase();
const SCAN_FILTER_UUIDS = [AFETNET_SERVICE_UUID];
const SCAN_DURATION = 5000; // 5 seconds
const SCAN_INTERVAL = 10000; // 10 seconds
const QUEUE_STORAGE_KEY = '@afetnet:ble_mesh_queue'; // CRITICAL: Persistent storage for message queue
const QUEUE_SAVE_INTERVAL = 5000; // Save queue every 5 seconds
const MESH_MANUFACTURER_ID = 0xffff; // Matches SafeBLE advertiser

// ELITE: Performance and reliability constants
const MAX_QUEUE_SIZE = 1000; // CRITICAL: Prevent memory exhaustion
const MAX_MESSAGE_AGE_HOURS = 24; // CRITICAL: Auto-expire old messages
const MAX_PEERS_CONNECT = 3; // CRITICAL: Limit concurrent connections
const CRITICAL_PRIORITY_SCAN_INTERVAL = 5000; // CRITICAL: Faster scan for critical messages (5s)
const NORMAL_PRIORITY_SCAN_INTERVAL = 10000; // Normal scan interval (10s)
const MAX_MESSAGE_RATE_PER_MINUTE = 30; // CRITICAL: Rate limiting to prevent spam
const BASE_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 60000;

type MessageCallback = (message: MeshMessage) => void;

class BLEMeshService {
  private manager: BleManager | null = null;
  private isRunning = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  private advertisingTimer: NodeJS.Timeout | null = null;
  private scanTimeoutId: NodeJS.Timeout | null = null; // CRITICAL: Store scan timeout for cleanup
  private myDeviceId: string | null = null;
  private messageQueue: MeshMessage[] = [];
  private messageCallbacks: MessageCallback[] = [];
  private deviceSubscriptions: Map<string, Subscription | null> = new Map();
  private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map(); // CRITICAL: Store connection timeouts
  private queueSaveTimer: NodeJS.Timeout | null = null; // CRITICAL: Timer for saving queue to storage
  private messageRateLimiter: Map<number, number> = new Map(); // ELITE: Rate limiting (minute -> count)
  private connectedPeers: Set<string> = new Set(); // ELITE: Track connected peers for connection pooling
  private stateChangeSubscription: any = null; // CRITICAL: Store state change listener for cleanup
  private restoredState: BleRestoredState | null = null;
  private advertisingActive = false;

  constructor() {
    // Don't initialize BleManager here - wait for start() to be called
    // CRITICAL: Load message queue from persistent storage on startup
    this.loadQueueFromStorage().catch((error) => {
      logger.error('Failed to load message queue from storage:', error);
    });
  }

  // CRITICAL: Load message queue from AsyncStorage (persistent across app restarts)
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MeshMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // CRITICAL: Filter out old messages (older than MAX_MESSAGE_AGE_HOURS)
          const maxAge = Date.now() - (MAX_MESSAGE_AGE_HOURS * 3600000);
          const validMessages = parsed.filter(msg => 
            msg && msg.timestamp && msg.timestamp > maxAge && !msg.delivered
          );
          
          // CRITICAL: Limit queue size to prevent memory exhaustion
          const limitedMessages = validMessages.slice(0, MAX_QUEUE_SIZE);
          
          if (limitedMessages.length > 0) {
            this.messageQueue = limitedMessages;
            if (__DEV__) {
              logger.info(`Loaded ${limitedMessages.length} messages from persistent queue (${validMessages.length - limitedMessages.length} expired)`);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load queue from storage:', error);
    }
  }

  // CRITICAL: Save message queue to AsyncStorage (persistent across app restarts)
  private async saveQueueToStorage(): Promise<void> {
    try {
      // CRITICAL: Only save undelivered messages
      const undeliveredMessages = this.messageQueue.filter(msg => !msg.delivered);
      if (undeliveredMessages.length > 0) {
        await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(undeliveredMessages));
        if (__DEV__) {
          logger.debug(`Saved ${undeliveredMessages.length} messages to persistent queue`);
        }
      } else {
        // CRITICAL: Clear storage if queue is empty
        await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      }
    } catch (error) {
      logger.error('Failed to save queue to storage:', error);
    }
  }

  // CRITICAL: Start periodic queue saving
  private startQueueSaving(): void {
    // CRITICAL: Clear existing timer (use clearInterval, not clearTimeout!)
    if (this.queueSaveTimer) {
      clearInterval(this.queueSaveTimer);
      this.queueSaveTimer = null;
    }
    
    // Save queue periodically
    this.queueSaveTimer = setInterval(() => {
      this.saveQueueToStorage().catch((error) => {
        logger.error('Periodic queue save failed:', error);
      });
    }, QUEUE_SAVE_INTERVAL);
  }

  // CRITICAL: Stop periodic queue saving
  private stopQueueSaving(): void {
    if (this.queueSaveTimer) {
      clearInterval(this.queueSaveTimer);
      this.queueSaveTimer = null;
    }
  }

  private getScanOptions(): ScanOptions {
    const options: ScanOptions = { allowDuplicates: true };
    if (Platform.OS === 'android') {
      options.scanMode = ScanMode.LowLatency;
      options.legacyScan = false;
    }
    return options;
  }

  private normalizeUuid(uuid?: string | null): string {
    return (uuid || '').toLowerCase();
  }

  private hasMeshManufacturerData(device: Device): boolean {
    if (!device?.manufacturerData) {
      return false;
    }
    try {
      const buffer = Buffer.from(device.manufacturerData, 'base64');
      if (buffer.length < 2) {
        return false;
      }
      const companyId = buffer.readUInt16LE(0);
      return companyId === MESH_MANUFACTURER_ID;
    } catch (error) {
      logger.warn('Failed to parse manufacturer data', error);
      return false;
    }
  }

  private isMeshDevice(device?: Device | null): boolean {
    if (!device) {
      return false;
    }
    const serviceMatch = (device.serviceUUIDs || []).some(
      uuid => this.normalizeUuid(uuid) === SERVICE_UUID,
    );
    return serviceMatch || this.hasMeshManufacturerData(device);
  }

  private createAdvertisementPayload(): Uint8Array {
    const sourceId = (this.myDeviceId || 'afetnet-mesh').slice(-16);
    return Uint8Array.from(Buffer.from(sourceId, 'utf8'));
  }

  private async startAdvertisingBeacon(): Promise<void> {
    if (!SafeBLE.isAvailable()) {
      useMeshStore.getState().setAdvertising(false);
      if (__DEV__) {
        logger.debug('BLE peripheral APIs are not available on this build');
      }
      return;
    }

    if (this.advertisingActive) {
      return;
    }

    try {
      await SafeBLE.advertise(this.createAdvertisementPayload());
      this.advertisingActive = true;
      useMeshStore.getState().setAdvertising(true);
      if (__DEV__) {
        logger.info('BLE advertising started');
      }
    } catch (error) {
      logger.warn('BLE advertising failed:', error);
      this.advertisingActive = false;
    }
  }

  private async stopAdvertisingBeacon(): Promise<void> {
    if (!this.advertisingActive) {
      return;
    }
    this.advertisingActive = false;
    try {
      await SafeBLE.stopAdvertise();
    } catch (error) {
      logger.warn('BLE advertising stop failed:', error);
    }
    useMeshStore.getState().setAdvertising(false);
  }

  private getDeviceDisplayName(device: Device): string {
    if (device.name && device.name.trim().length > 0) {
      return device.name;
    }
    return `AfetNet-${device.id.slice(-4)}`;
  }

  private subscribeToDevice(device: Device): void {
    if (!device?.id) {
      return;
    }

    const existing = this.deviceSubscriptions.get(device.id);
    if (existing) {
      try {
        existing.remove();
      } catch (error) {
        logger.warn('Failed to remove previous subscription:', error);
      }
    }

    try {
      const subscription = device.monitorCharacteristicForService(
        SERVICE_UUID_UPPER,
        CHARACTERISTIC_UUID_UPPER,
        (error: BleError | null, characteristic: Characteristic | null) => {
          if (error) {
            logger.warn(`Monitor error for ${device.id}:`, error);
            return;
          }
          if (characteristic?.value) {
            this.handleIncomingPayload(characteristic.value, device.id);
          }
        },
      );
      this.deviceSubscriptions.set(device.id, subscription);
    } catch (error) {
      logger.warn('Failed to subscribe to incoming messages:', error);
      this.deviceSubscriptions.delete(device.id);
    }
  }

  private handleIncomingPayload(base64Value: string, sourceDeviceId: string): void {
    if (!base64Value) {
      logger.warn('Empty payload received, ignoring');
      return;
    }

    try {
      const payload = Buffer.from(base64Value, 'base64').toString('utf-8');
      if (!payload || payload.length === 0) {
        logger.warn('Empty decoded payload received, ignoring');
        return;
      }

      const incomingMessage = JSON.parse(payload) as MeshMessage;

      if (!incomingMessage || typeof incomingMessage !== 'object') {
        logger.warn('Invalid message object received, ignoring');
        return;
      }

      if (!incomingMessage.id || typeof incomingMessage.id !== 'string') {
        logger.warn('Invalid message ID received, ignoring');
        return;
      }

      if (!incomingMessage.content || typeof incomingMessage.content !== 'string') {
        logger.warn('Invalid message content received, ignoring');
        return;
      }

      const existingInQueue = this.messageQueue.find(m => m.id === incomingMessage.id);
      const existingInStore = useMeshStore.getState().messages.find(m => m.id === incomingMessage.id);
      if (existingInQueue || existingInStore) {
        if (__DEV__) {
          logger.debug('Duplicate message received, ignoring:', incomingMessage.id);
        }
        return;
      }

      if (incomingMessage.content.length > 5000) {
        logger.warn('Message content too large, ignoring:', incomingMessage.id);
        return;
      }

      useMeshStore.getState().addMessage(incomingMessage);
      useMeshStore.getState().incrementStat('messagesReceived');

      const selfId = this.myDeviceId;
      const shouldForward =
        incomingMessage.ttl > 0 &&
        !!selfId &&
        incomingMessage.from !== selfId &&
        (!incomingMessage.to || incomingMessage.to !== selfId);

      if (shouldForward && selfId) {
        const route = incomingMessage.route || [];
        if (!route.includes(selfId)) {
          const forwardedMessage: MeshMessage = {
            ...incomingMessage,
            ttl: incomingMessage.ttl - 1,
            hops: incomingMessage.hops + 1,
            route: [...route, selfId],
          };
          const existingForward = this.messageQueue.find(msg => msg.id === forwardedMessage.id);
          if (!existingForward) {
            if (forwardedMessage.priority === 'critical') {
              this.messageQueue.unshift(forwardedMessage);
            } else {
              this.messageQueue.push(forwardedMessage);
            }
            useMeshStore.getState().recordHopForwarded();
            this.saveQueueToStorage().catch(error => {
              logger.error('Failed to save queue after forwarding:', error);
            });
          }
        }
      }

      this.notifyMessageCallbacks(incomingMessage);

      if (__DEV__) {
        logger.info(`Message received from ${sourceDeviceId}:`, incomingMessage.id);
      }
    } catch (parseError) {
      logger.error('Failed to parse incoming message:', parseError);
    }
  }

  private getRetryDelay(attempts: number): number {
    const exponent = Math.max(0, attempts - 1);
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, exponent);
    return Math.min(delay, MAX_RETRY_DELAY_MS);
  }

  private getManager(): BleManager | null {
    try {
      if (!this.manager) {
        this.manager = new BleManager({
          restoreStateIdentifier: 'afetnet-ble-mesh',
          restoreStateFunction: (restoredState: BleRestoredState | null) => {
            this.restoredState = restoredState;
            if (restoredState?.connectedPeripherals?.length) {
              restoredState.connectedPeripherals.forEach(peripheral => {
                this.connectedPeers.add(peripheral.id);
              });
              if (__DEV__) {
                logger.info(`Restored ${restoredState.connectedPeripherals.length} BLE connections`);
              }
            }
          },
        });
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
    // CRITICAL: Prevent multiple simultaneous starts (race condition protection)
    if (this.isRunning) {
      if (__DEV__) {
        logger.debug('Service already running, skipping start');
      }
      return;
    }

    // CRITICAL: Set isRunning early to prevent race conditions, but reset on error
    this.isRunning = true;

    if (__DEV__) logger.info('Starting...');

    try {
      // Get or create BLE manager
      const manager = this.getManager();
      if (!manager) {
        logger.warn('BLE not available - mesh networking disabled');
        this.isRunning = false; // CRITICAL: Reset flag on failure
        return;
      }

      // Request permissions
      await this.requestPermissions();

      // CRITICAL: Cleanup existing state change listener before creating new one
      if (this.stateChangeSubscription) {
        try {
          if (typeof this.stateChangeSubscription.remove === 'function') {
            this.stateChangeSubscription.remove();
          }
        } catch (error) {
          logger.error('Error removing old state change listener:', error);
        }
        this.stateChangeSubscription = null;
      }

      // ELITE: Set up Bluetooth state listener for automatic restart
      this.stateChangeSubscription = manager.onStateChange((state) => {
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
        this.isRunning = false; // CRITICAL: Reset flag - service will auto-start when Bluetooth is enabled
        return;
      }

      // CRITICAL: Generate device ID with validation
      this.myDeviceId = await this.getDeviceId();
      if (!this.myDeviceId || this.myDeviceId.length === 0) {
        logger.error('CRITICAL: Failed to generate device ID - cannot start mesh service');
        this.isRunning = false; // CRITICAL: Reset flag on failure
        return;
      }
      
      useMeshStore.getState().setMyDeviceId(this.myDeviceId);
      
      if (__DEV__) logger.info('Device ID:', this.myDeviceId);

      // CRITICAL: isRunning already set at start of function (race condition protection)

      // CRITICAL: Mark mesh as connected (active) - service is running
      useMeshStore.getState().setConnected(true);
      await this.startAdvertisingBeacon();

      // CRITICAL: Start scanning cycle
      this.startScanCycle();

      // CRITICAL: Start periodic queue saving
      this.startQueueSaving();

      // CRITICAL: Process any queued messages from previous session
      // This ensures messages survive service restarts (Bluetooth off/on, app restart)
      if (this.messageQueue.length > 0) {
        if (__DEV__) {
          logger.info(`Resuming ${this.messageQueue.length} queued messages from previous session`);
        }
        // Messages will be sent during next scan cycle
      }

      if (__DEV__) logger.info('Started successfully - Mesh network active');
    } catch (error) {
      logger.error('Start error:', error);
      // CRITICAL: Reset flag on error to allow retry
      this.isRunning = false;
      useMeshStore.getState().setConnected(false);
      useMeshStore.getState().setAdvertising(false);
      // Don't throw - allow app to continue without BLE
    }
  }

  stop() {
    if (!this.isRunning) return;

    if (__DEV__) logger.info('Stopping...');

    this.isRunning = false;
    this.stopAdvertisingBeacon().catch((error) => {
      logger.warn('Failed to stop BLE advertising:', error);
    });

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

    // CRITICAL: Cleanup scan timeout
    if (this.scanTimeoutId) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }

    // CRITICAL: Cleanup all connection timeouts (including disconnect timeouts and cleanup timeouts)
    this.connectionTimeouts.forEach((timeout, key) => {
      try {
        clearTimeout(timeout);
      } catch (error) {
        logger.error(`Error clearing connection timeout (${key}):`, error);
      }
    });
    this.connectionTimeouts.clear();

    // CRITICAL: Stop queue saving and save final state
    this.stopQueueSaving();
    this.saveQueueToStorage().catch((error) => {
      logger.error('Failed to save queue on stop:', error);
    });

    // CRITICAL: Clear connection pooling tracking
    this.connectedPeers.clear();
    
    // CRITICAL: Clear rate limiter
    this.messageRateLimiter.clear();

    // CRITICAL: Cleanup state change listener
    if (this.stateChangeSubscription) {
      try {
        if (typeof this.stateChangeSubscription.remove === 'function') {
          this.stateChangeSubscription.remove();
        }
      } catch (error) {
        logger.error('Error removing state change listener:', error);
      }
      this.stateChangeSubscription = null;
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
    // CRITICAL: Validate service is running - but queue message anyway for retry
    if (!this.isRunning) {
      logger.warn('Cannot send message: BLE Mesh service is not running - will queue for when service starts');
      this.start().catch((error) => {
        logger.error('Failed to auto-start BLE mesh service for outgoing message:', error);
      });
    }

    if (!this.myDeviceId) {
      logger.error('CRITICAL: Cannot send message: no device ID');
      // CRITICAL: Try to get device ID before giving up
      try {
        this.myDeviceId = await this.getDeviceId();
        if (!this.myDeviceId) {
          logger.error('CRITICAL: Device ID generation failed - message cannot be sent');
          return;
        }
        useMeshStore.getState().setMyDeviceId(this.myDeviceId);
      } catch (error) {
        logger.error('CRITICAL: Device ID generation error:', error);
        return;
      }
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
      nextAttempt: Date.now(),
    };

    if (!this.enqueueOutgoingMessage(message)) {
      return;
    }

    if (__DEV__) logger.info('Message queued:', message.id);
    return message;
  }

  private enqueueOutgoingMessage(message: MeshMessage, options: { rateLimit?: boolean } = {}): boolean {
    const { rateLimit = true } = options;
    const existingInQueue = this.messageQueue.find(msg => msg.id === message.id);
    const existingInStore = useMeshStore.getState().messages.find(msg => msg.id === message.id);
    
    if (existingInQueue || existingInStore) {
      if (__DEV__) {
        logger.debug('Duplicate message detected, skipping:', message.id);
      }
      return false;
    }

    if (rateLimit) {
      const currentMinute = Math.floor(Date.now() / 60000);
      const currentRate = this.messageRateLimiter.get(currentMinute) || 0;
      if (currentRate >= MAX_MESSAGE_RATE_PER_MINUTE) {
        logger.warn(`Rate limit exceeded: ${currentRate} messages in current minute, dropping message`);
        return false;
      }
      this.messageRateLimiter.set(currentMinute, currentRate + 1);
      const fiveMinutesAgo = currentMinute - 5;
      this.messageRateLimiter.forEach((_, minute) => {
        if (minute < fiveMinutesAgo) {
          this.messageRateLimiter.delete(minute);
        }
      });
    }

    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      const criticalMessages = this.messageQueue.filter(msg => msg.priority === 'critical');
      const nonCriticalMessages = this.messageQueue.filter(msg => msg.priority !== 'critical');
      
      if (nonCriticalMessages.length > 0) {
        nonCriticalMessages.sort((a, b) => a.timestamp - b.timestamp);
        const oldestId = nonCriticalMessages[0].id;
        this.messageQueue = this.messageQueue.filter(msg => msg.id !== oldestId);
        useMeshStore.getState().recordDrop();
        logger.warn(`Queue full, dropped oldest non-critical message: ${oldestId}`);
      } else if (criticalMessages.length >= MAX_QUEUE_SIZE) {
        criticalMessages.sort((a, b) => a.timestamp - b.timestamp);
        const oldestId = criticalMessages[0].id;
        this.messageQueue = this.messageQueue.filter(msg => msg.id !== oldestId);
        useMeshStore.getState().recordDrop();
        logger.warn(`Queue full (only critical), dropped oldest critical message: ${oldestId}`);
      }
    }

    if (message.priority === 'critical') {
      this.messageQueue.unshift(message);
    } else {
      this.messageQueue.push(message);
    }

    useMeshStore.getState().addMessage(message);

    this.saveQueueToStorage().catch((error) => {
      logger.error('Failed to save queue after adding message:', error);
    });

    return true;
  }

  async broadcastMessage(message: Omit<MeshMessage, 'id' | 'from' | 'timestamp' | 'hops' | 'delivered'>) {
    // CRITICAL: Validate service is running - but queue message anyway for retry
    if (!this.isRunning) {
      logger.warn('Cannot broadcast: BLE Mesh service is not running - will queue for when service starts');
      // CRITICAL: Still queue message - it will be sent when service starts
    }

    if (!this.myDeviceId) {
      logger.error('CRITICAL: Cannot broadcast: no device ID');
      // CRITICAL: Try to get device ID before giving up
      try {
        this.myDeviceId = await this.getDeviceId();
        if (!this.myDeviceId) {
          logger.error('CRITICAL: Device ID generation failed - broadcast cannot be sent');
          return;
        }
        useMeshStore.getState().setMyDeviceId(this.myDeviceId);
      } catch (error) {
        logger.error('CRITICAL: Device ID generation error for broadcast:', error);
        return;
      }
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

    if (message.content.length > 5000) {
      logger.error('Invalid broadcast message: content too long (max 5000 chars)');
      return;
    }

    const sanitizedContent = sanitizeString(message.content, 5000);
    if (!sanitizedContent) {
      logger.error('Broadcast message content empty after sanitization');
      return;
    }

    const fullMessage: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      timestamp: Date.now(),
      hops: 0,
      delivered: false,
      content: sanitizedContent,
      type: message.type || 'text',
      ttl: message.ttl || 5,
      priority: message.priority || 'normal',
      sequence: message.sequence || 0,
      ackRequired: message.ackRequired || false,
      attempts: message.attempts || 0,
      nextAttempt: Date.now(),
    };

    if (!this.enqueueOutgoingMessage(fullMessage)) {
      return;
    }

    if (__DEV__) logger.info('Broadcast message queued:', fullMessage.id);
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  async sendSOS() {
    if (!this.myDeviceId) {
      // CRITICAL: Try to get device ID before giving up
      try {
        this.myDeviceId = await this.getDeviceId();
        if (!this.myDeviceId) {
          logger.error('CRITICAL: Cannot send SOS: no device ID');
          return;
        }
        useMeshStore.getState().setMyDeviceId(this.myDeviceId);
      } catch (error) {
        logger.error('CRITICAL: Device ID generation error for SOS:', error);
        return;
      }
    }

    const message: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      content: 'SOS - Acil yardım gerekiyor!',
      type: 'sos',
      timestamp: Date.now(),
      ttl: 15, // CRITICAL: Higher TTL for SOS (15 hops = ~150m range with multi-hop)
      hops: 0,
      delivered: false,
      priority: 'critical',
      sequence: 0,
      ackRequired: false,
      attempts: 0,
    };

    // CRITICAL: Check for duplicates
    const existingInQueue = this.messageQueue.find(msg => msg.id === message.id);
    const existingInStore = useMeshStore.getState().messages.find(msg => msg.id === message.id);
    
    if (existingInQueue || existingInStore) {
      if (__DEV__) {
        logger.debug('Duplicate SOS message detected, skipping:', message.id);
      }
      return;
    }

    // ELITE: Rate limiting for SOS (but allow critical messages through)
    const currentMinute = Math.floor(Date.now() / 60000);
    const currentRate = this.messageRateLimiter.get(currentMinute) || 0;
    // CRITICAL: Allow SOS even if rate limit exceeded (emergency override)
    if (currentRate >= MAX_MESSAGE_RATE_PER_MINUTE * 2) {
      logger.warn(`Rate limit exceeded for SOS: ${currentRate} messages in current minute, but allowing SOS`);
    } else {
      this.messageRateLimiter.set(currentMinute, currentRate + 1);
    }

    // CRITICAL: Queue size limit check (but prioritize SOS)
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      // ELITE: Remove oldest non-critical messages first
      const nonCriticalMessages = this.messageQueue.filter(msg => msg.priority !== 'critical');
      if (nonCriticalMessages.length > 0) {
        nonCriticalMessages.sort((a, b) => a.timestamp - b.timestamp);
        const oldestId = nonCriticalMessages[0].id;
        this.messageQueue = this.messageQueue.filter(msg => msg.id !== oldestId);
        useMeshStore.getState().recordDrop();
        logger.warn(`Queue full, dropped oldest non-critical message for SOS: ${oldestId}`);
      } else {
        // If only critical messages, remove oldest critical (but not this SOS)
        const criticalMessages = this.messageQueue.filter(msg => msg.priority === 'critical' && msg.id !== message.id);
        if (criticalMessages.length > 0) {
          criticalMessages.sort((a, b) => a.timestamp - b.timestamp);
          const oldestId = criticalMessages[0].id;
          this.messageQueue = this.messageQueue.filter(msg => msg.id !== oldestId);
          useMeshStore.getState().recordDrop();
          logger.warn(`Queue full (only critical), dropped oldest critical message for SOS: ${oldestId}`);
        }
      }
    }

    // CRITICAL: Add to queue (priority-based insertion - critical at front)
    this.messageQueue.unshift(message);
    
    useMeshStore.getState().addMessage(message);
    useMeshStore.getState().incrementStat('messagesSent');

    // CRITICAL: Save queue immediately for SOS
    this.saveQueueToStorage().catch((error) => {
      logger.error('Failed to save SOS queue:', error);
    });

    // CRITICAL: If service is not running, try to start it
    if (!this.isRunning) {
      this.start().catch((error) => {
        logger.error('Failed to start service for SOS:', error);
      });
    }

    if (__DEV__) logger.info('SOS sent:', message.id);
  }

  async broadcastEmergency(data: { type: string; magnitude?: number; timestamp: number }) {
    if (!this.myDeviceId) {
      // CRITICAL: Try to get device ID before giving up
      try {
        this.myDeviceId = await this.getDeviceId();
        if (!this.myDeviceId) {
          logger.error('CRITICAL: Cannot broadcast emergency: no device ID');
          return;
        }
        useMeshStore.getState().setMyDeviceId(this.myDeviceId);
      } catch (error) {
        logger.error('CRITICAL: Device ID generation error for emergency:', error);
        return;
      }
    }

    const message: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      content: JSON.stringify(data),
      type: 'sos',
      timestamp: Date.now(),
      ttl: 15, // CRITICAL: Higher TTL for emergency broadcasts (multi-hop)
      hops: 0,
      delivered: false,
      priority: 'critical',
      sequence: 0,
      ackRequired: false,
      attempts: 0,
    };

    // CRITICAL: Check for duplicates
    const existingInQueue = this.messageQueue.find(msg => msg.id === message.id);
    const existingInStore = useMeshStore.getState().messages.find(msg => msg.id === message.id);
    
    if (!existingInQueue && !existingInStore) {
      this.messageQueue.push(message);
      useMeshStore.getState().addMessage(message);
      useMeshStore.getState().incrementStat('messagesSent');

      // CRITICAL: Save queue immediately for emergency
      this.saveQueueToStorage().catch((error) => {
        logger.error('Failed to save emergency queue:', error);
      });

      // CRITICAL: If service is not running, try to start it
      if (!this.isRunning) {
        this.start().catch((error) => {
          logger.error('Failed to start service for emergency:', error);
        });
      }

      if (__DEV__) logger.info('Emergency broadcast sent:', message.id);
    }
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

    // ELITE: Adaptive scan interval based on message priority
    // Critical messages get faster scanning (5s), normal messages (10s)
    const hasCriticalMessages = this.messageQueue.some(msg => msg.priority === 'critical');
    const scanInterval = hasCriticalMessages ? CRITICAL_PRIORITY_SCAN_INTERVAL : NORMAL_PRIORITY_SCAN_INTERVAL;

    // Start scan
    this.scan();

    // Schedule next scan with adaptive interval
    this.scanTimer = setTimeout(() => {
      this.startScanCycle();
    }, scanInterval);
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
        SCAN_FILTER_UUIDS,
        this.getScanOptions(),
        (error: BleError | null, device: Device | null) => {
          if (error) {
            logger.error('Scan error:', error);
            return;
          }

          if (!device || !this.isMeshDevice(device)) {
            return;
          }

          discoveredDevices.set(device.id, device);

          const peer: MeshPeer = {
            id: device.id,
            name: this.getDeviceDisplayName(device),
            rssi: device.rssi || -100,
            lastSeen: Date.now(),
          };

          useMeshStore.getState().addPeer(peer);
        },
      );

      // CRITICAL: Stop scan after duration - STORE TIMEOUT ID FOR CLEANUP
      this.scanTimeoutId = setTimeout(() => {
        this.scanTimeoutId = null; // Clear reference after execution
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
    } catch (error) {
      logger.error('Scan start error:', error);
      useMeshStore.getState().setScanning(false);
    }
  }

  private async connectToPeers(devices: Device[]) {
    // ELITE: Sort devices by RSSI (strongest signal first) for better reliability
    const sortedDevices = [...devices].sort((a, b) => (b.rssi || -100) - (a.rssi || -100));
    
    // CRITICAL: Process connections sequentially to avoid overwhelming BLE stack
    // ELITE: Prioritize devices we haven't connected to recently
    const newDevices = sortedDevices.filter(d => !this.connectedPeers.has(d.id));
    const knownDevices = sortedDevices.filter(d => this.connectedPeers.has(d.id));
    const prioritizedDevices = [...newDevices, ...knownDevices].slice(0, MAX_PEERS_CONNECT);
    
    for (const device of prioritizedDevices) {
      if (!this.isRunning) {
        // Service stopped during connection attempt
        break;
      }

      if (!this.isMeshDevice(device)) {
        continue;
      }

      let connectionTimeout: NodeJS.Timeout | null = null;
      try {
        if (__DEV__) logger.info('Connecting to', device.name);
        
        // CRITICAL: Add timeout protection for connection with cleanup
        const connectionPromise = device.connect({ timeout: 5000 });
        const timeoutPromise = new Promise<Device>((_, reject) => {
          connectionTimeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 6000);
          // CRITICAL: Store timeout for cleanup
          this.connectionTimeouts.set(device.id, connectionTimeout);
        });
        
        const connected = await Promise.race([connectionPromise, timeoutPromise]) as Device;
        
        // CRITICAL: Clear timeout after successful connection
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          this.connectionTimeouts.delete(device.id);
          connectionTimeout = null;
        }
        
        await connected.discoverAllServicesAndCharacteristics();

        this.subscribeToDevice(connected);

        // ELITE: Track connected peer for connection pooling
        this.connectedPeers.add(device.id);

        // CRITICAL: Exchange messages with comprehensive error handling
        await this.exchangeMessages(connected).catch((error) => {
          logger.error('Message exchange error:', error);
        });

        // ELITE: Keep connection alive for a short time (connection pooling)
        // This allows multiple message exchanges without reconnecting
        // CRITICAL: Store timeout ID for cleanup
        const disconnectTimeoutId = setTimeout(() => {
          this.connectedPeers.delete(device.id);
          const subscription = this.deviceSubscriptions.get(device.id);
          if (subscription) {
            try {
              subscription.remove();
            } catch (error) {
              logger.warn('Failed to remove characteristic monitor:', error);
            }
          }
          this.deviceSubscriptions.delete(device.id);
          // CRITICAL: Disconnect after delay with error handling
          connected.cancelConnection().catch((error) => {
            // CRITICAL: Don't log as error if device already disconnected
            if (!error?.message?.includes('already') && !error?.message?.includes('disconnected')) {
              logger.error('Disconnect error:', error);
            }
          });
        }, 2000); // Keep connection for 2 seconds
        
        // CRITICAL: Store timeout ID in connectionTimeouts for cleanup if service stops
        // This ensures timeout is cleaned up even if service stops during connection pooling
        this.connectionTimeouts.set(`disconnect-${device.id}`, disconnectTimeoutId);
        
        // CRITICAL: Auto-cleanup timeout reference after it executes (prevent memory leak)
        // Note: The timeout itself will execute and cleanup, but we remove the reference
        // CRITICAL: Store cleanup timeout ID for potential cleanup if service stops
        const cleanupTimeoutId = setTimeout(() => {
          // Only delete if timeout hasn't been cleaned up by stop() method
          if (this.connectionTimeouts.has(`disconnect-${device.id}`)) {
            this.connectionTimeouts.delete(`disconnect-${device.id}`);
          }
        }, 2000);
        
        // CRITICAL: Store cleanup timeout in connectionTimeouts for cleanup if service stops
        // Use a different key to avoid conflicts
        this.connectionTimeouts.set(`cleanup-disconnect-${device.id}`, cleanupTimeoutId);
        
        // Keep mesh as connected since service is still running
        // Only set to false when service stops

      } catch (error) {
        // CRITICAL: Cleanup timeout on error
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          this.connectionTimeouts.delete(device.id);
        }
        const subscription = this.deviceSubscriptions.get(device.id);
        if (subscription) {
          try {
            subscription.remove();
          } catch (subError) {
            logger.warn('Failed to remove subscription after connection error:', subError);
          }
          this.deviceSubscriptions.delete(device.id);
        }
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
      // ELITE: Sort messages by priority (critical first) and timestamp (oldest first)
      // This ensures critical messages are sent first, and oldest messages don't get stuck
      const sortedMessages = [...this.messageQueue].sort((a, b) => {
        // Critical messages first
        if (a.priority === 'critical' && b.priority !== 'critical') return -1;
        if (a.priority !== 'critical' && b.priority === 'critical') return 1;
        // Then by timestamp (oldest first)
        return a.timestamp - b.timestamp;
      });
      const now = Date.now();
      
      // ELITE: Send queued messages with comprehensive error handling
      for (const message of sortedMessages) {
        if (!this.isRunning) {
          break; // Service stopped during message sending
        }

        // Skip already delivered or not yet scheduled
        if (message.delivered) {
          continue;
        }
        if (message.nextAttempt && message.nextAttempt > now) {
          continue;
        }

        // CRITICAL: Verify message still exists in queue (may have been removed by another operation)
        const currentMessageInQueue = this.messageQueue.find(msg => msg.id === message.id);
        if (!currentMessageInQueue) {
          // Message was removed from queue (delivered, expired, or dropped)
          if (__DEV__) {
            logger.debug('Message no longer in queue, skipping:', message.id);
          }
          continue;
        }

        try {
          // ELITE: Validate message before sending
          if (!message || !message.id || !message.content) {
            logger.warn('Invalid message in queue, skipping:', message);
            continue;
          }

          const payload = JSON.stringify(message);
          
          // CRITICAL: Validate payload size AFTER base64 encoding (BLE has MTU limits)
          // Base64 encoding increases size by ~33%, so we need to account for that
          const base64Payload = Buffer.from(payload).toString('base64');
          const estimatedSize = base64Payload.length;
          
          // CRITICAL: BLE MTU is typically 20-512 bytes, we use conservative 400 byte limit
          // This ensures message fits even on devices with smaller MTU
          if (estimatedSize > 400) {
            logger.warn(`Message too large for BLE (${estimatedSize} bytes), skipping:`, message.id);
            // CRITICAL: Remove from queue if too large (won't fit anyway)
            this.messageQueue = this.messageQueue.filter(msg => msg.id !== message.id);
            useMeshStore.getState().recordDrop();
            continue;
          }
          
          // Try to write to characteristic
          await device.writeCharacteristicWithResponseForService(
            SERVICE_UUID_UPPER,
            CHARACTERISTIC_UUID_UPPER,
            base64Payload,
          );

          const queueMessageIndex = this.messageQueue.findIndex(msg => msg.id === message.id);
          if (queueMessageIndex >= 0) {
            this.messageQueue[queueMessageIndex].delivered = true;
            this.messageQueue[queueMessageIndex].nextAttempt = undefined;
            this.messageQueue[queueMessageIndex].lastError = undefined;
          } else {
            logger.warn('Message removed from queue during send:', message.id);
          }
          useMeshStore.getState().markMessageDelivered(message.id);
          useMeshStore.getState().incrementStat('messagesSent');

          if (__DEV__) logger.info('Message sent successfully:', message.id);
        } catch (writeError: any) {
          logger.error('Write error:', writeError);
          // CRITICAL: Increment attempts and update queue
          const messageIndex = this.messageQueue.findIndex(msg => msg.id === message.id);
          if (messageIndex >= 0) {
            this.messageQueue[messageIndex].attempts = (this.messageQueue[messageIndex].attempts || 0) + 1;
            const attempts = this.messageQueue[messageIndex].attempts;
            this.messageQueue[messageIndex].lastError = writeError?.message || 'Unknown error';
            this.messageQueue[messageIndex].nextAttempt = Date.now() + this.getRetryDelay(attempts);
            
            // CRITICAL: Remove if max attempts reached (5 attempts for reliability)
            if (attempts >= 5) {
              logger.warn(`Message failed after ${attempts} attempts, removing from queue:`, message.id);
              this.messageQueue = this.messageQueue.filter(msg => msg.id !== message.id);
              useMeshStore.getState().recordDrop();
            } else {
              // CRITICAL: Record retry for statistics
              useMeshStore.getState().recordRetry();
              if (__DEV__) {
                logger.debug(`Message will retry (attempt ${attempts}/5):`, message.id);
              }
            }
          }
          // Continue to next message
          continue;
        }
      }

      // CRITICAL: Clear successfully sent messages from queue
      // Only remove messages that are marked as delivered
      const beforeCount = this.messageQueue.length;
      const now = Date.now();
      const maxAge = MAX_MESSAGE_AGE_HOURS * 3600000;
      
      this.messageQueue = this.messageQueue.filter(msg => {
        // CRITICAL: Check both delivered flag and store state
        const storeMessage = useMeshStore.getState().messages.find(m => m.id === msg.id);
        const isDelivered = msg.delivered || storeMessage?.delivered || false;
        
        // ELITE: Also remove expired messages (older than MAX_MESSAGE_AGE_HOURS)
        const isExpired = msg.timestamp && (now - msg.timestamp) > maxAge;
        
        if (isExpired && !isDelivered) {
          useMeshStore.getState().recordDrop();
          if (__DEV__) {
            logger.debug(`Removed expired message from queue: ${msg.id}`);
          }
        }
        
        return !isDelivered && !isExpired;
      });
      
      if (__DEV__ && beforeCount !== this.messageQueue.length) {
        logger.info(`Cleaned ${beforeCount - this.messageQueue.length} messages from queue`);
      }

      // CRITICAL: Save queue after cleanup (persistent storage)
      this.saveQueueToStorage().catch((error) => {
        logger.error('Failed to save queue after cleanup:', error);
      });

      // ELITE: Read incoming messages with validation
      if (!this.isRunning) {
        return; // Service stopped
      }

      // CRITICAL: Read incoming messages with comprehensive error handling
      try {
        const readPromise = device.readCharacteristicForService(
          SERVICE_UUID_UPPER,
          CHARACTERISTIC_UUID_UPPER,
        );
        let readTimeoutId: NodeJS.Timeout | null = null;
        const readTimeoutPromise = new Promise<never>((_, reject) => {
          readTimeoutId = setTimeout(() => {
            readTimeoutId = null;
            reject(new Error('Read timeout'));
          }, 5000);
        });

        try {
          const value = await Promise.race([readPromise, readTimeoutPromise]);
          if (readTimeoutId) {
            clearTimeout(readTimeoutId);
            readTimeoutId = null;
          }
          if (value?.value) {
            this.handleIncomingPayload(value.value, device.id);
          }
        } catch (readError: any) {
          if (readTimeoutId) {
            clearTimeout(readTimeoutId);
          }
          if (readError?.message?.includes('timeout')) {
            if (__DEV__) {
              logger.debug('Read operation timed out (non-critical)');
            }
          } else {
            logger.error('Read error:', readError);
          }
        }
      } catch (serviceError) {
        logger.error('Characteristic read error:', serviceError);
      }

    } catch (error) {
      logger.error('Message exchange error:', error);
    }
  }
}

export const bleMeshService = new BLEMeshService();
