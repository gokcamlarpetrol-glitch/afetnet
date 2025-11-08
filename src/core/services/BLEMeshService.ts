/**
 * BLE MESH SERVICE - Offline Peer-to-Peer Communication
 * Simple BLE mesh implementation for offline messaging
 */

import { BleManager, Device, State, Characteristic } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { useMeshStore, MeshPeer, MeshMessage, MeshPriority } from '../stores/meshStore';
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
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private myDeviceId: string | null = null;
  private messageQueue: MeshMessage[] = [];
  private messageCallbacks: MessageCallback[] = [];
  private deviceSubscriptions: Map<string, any> = new Map();
  private readonly priorityRank: Record<MeshPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
  };
  private readonly MAX_RETRY = 3;
  private sessionSecrets: Record<string, string> = {};
  // Elite Security: Rate limiting storage for messages
  private messageRateLimitStore: Map<string, number> = new Map();

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

  private getSessionSecret(peerId?: string): string | null {
    if (!this.myDeviceId || !peerId) {
      return null;
    }
    if (this.sessionSecrets[peerId]) {
      return this.sessionSecrets[peerId];
    }
    const [a, b] = [this.myDeviceId, peerId].sort();
    const combined = `${a}|${b}`;
    const secret = Buffer.from(combined).toString('base64');
    this.sessionSecrets[peerId] = secret;
    return secret;
  }

  private xorCipher(data: string, secret: string): string {
    const dataBuffer = Buffer.from(data, 'utf-8');
    const secretBuffer = Buffer.from(secret, 'utf-8');
    const result = Buffer.alloc(dataBuffer.length);
    for (let i = 0; i < dataBuffer.length; i += 1) {
      result[i] = dataBuffer[i] ^ secretBuffer[i % secretBuffer.length];
    }
    return result.toString('base64');
  }

  private xorDecipher(payload: string, secret: string): string {
    const payloadBuffer = Buffer.from(payload, 'base64');
    const secretBuffer = Buffer.from(secret, 'utf-8');
    const result = Buffer.alloc(payloadBuffer.length);
    for (let i = 0; i < payloadBuffer.length; i += 1) {
      result[i] = payloadBuffer[i] ^ secretBuffer[i % secretBuffer.length];
    }
    return result.toString('utf-8');
  }

  private async serializeMessage(message: MeshMessage): Promise<string> {
    const secret = this.getSessionSecret(message.to);
    if (secret && message.type !== 'ack' && message.type !== 'broadcast' && message.type !== 'heartbeat') {
      const iv = Math.random().toString(36).slice(2, 10);
      const payload = this.xorCipher(`${iv}:${message.content}`, secret);
      const signature = Buffer.from(`${secret}:${message.sequence}:${iv}`).toString('base64');
      return JSON.stringify({ ...message, content: payload, signature, iv });
    }
    return JSON.stringify(message);
  }

  private deserializeMessage(raw: MeshMessage): MeshMessage {
    const secret = this.getSessionSecret(raw.from);
    if (secret && raw.signature && raw.type !== 'ack' && raw.type !== 'broadcast' && raw.type !== 'heartbeat') {
      const iv = raw.iv ?? '';
      const expectedSignature = Buffer.from(`${secret}:${raw.sequence}:${iv}`).toString('base64');
      if (raw.signature === expectedSignature) {
        try {
          const decrypted = this.xorDecipher(raw.content, secret);
          const separatorIndex = decrypted.indexOf(':');
          const content = separatorIndex >= 0 ? decrypted.slice(separatorIndex + 1) : decrypted;
          return { ...raw, content };
        } catch (error) {
          logger.error('Failed to decrypt payload:', error);
          return raw;
        }
      }
    }
    return raw;
  }

  private enqueueMessage(message: MeshMessage) {
    if (!this.myDeviceId) return;
    if (!message.route || message.route.length === 0) {
      message.route = [this.myDeviceId];
    }
    const exists = this.messageQueue.find(
      (item) => item.id === message.id && item.from === message.from && item.sequence === message.sequence
    );
    if (exists) {
      return;
    }
    this.messageQueue.push(message);
    this.sortQueue();
  }

  private sortQueue() {
    this.messageQueue.sort((a, b) => {
      const priorityDiff = this.priorityRank[a.priority] - this.priorityRank[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.sequence - b.sequence;
    });
  }

  private cleanupQueue() {
    // CRITICAL: Safe store access
    const state = useMeshStore?.getState?.();
    if (!state) {
      logger.warn('⚠️ MeshStore not available for cleanup');
      return;
    }
    
    this.messageQueue = this.messageQueue.filter((msg) => {
      if (msg.type === 'ack') {
        return !msg.delivered;
      }
      const waitingAck = msg.ackRequired && !!state.pendingAcks?.[msg.id];
      if (msg.delivered && !waitingAck) {
        return false;
      }
      if (msg.attempts >= this.MAX_RETRY && !waitingAck) {
        return false;
      }
      return true;
    });
  }

  private hasPendingAck(messageId: string): boolean {
    // CRITICAL: Safe store access
    const state = useMeshStore?.getState?.();
    if (!state || !state.pendingAcks) {
      return false;
    }
    return !!state.pendingAcks[messageId];
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

  /**
   * Elite: Send notification for received BLE mesh messages
   */
  private async sendMessageNotification(message: MeshMessage) {
    try {
      // Check if app is in foreground (don't notify if user is actively using app)
      const { AppState } = require('react-native');
      if (AppState.currentState === 'active') {
        // User is actively using app - notification might be redundant
        // But still send for important messages
        if (message.priority !== 'critical' && message.priority !== 'high') {
          return;
        }
      }

      const { notificationService } = await import('./NotificationService');
      const { useMessageStore } = await import('../stores/messageStore');
      
      // Get sender name from peers or use device ID - safe access
      const meshState = useMeshStore?.getState?.();
      const peer = meshState?.peers?.[message.from];
      const senderName = peer?.name || `Mesh-${message.from.slice(-4)}`;
      
      // ELITE: Parse message content with security validation
      let content = message.content;
      try {
        // ELITE: Validate content is string and not too large (prevent DoS)
        if (typeof content !== 'string' || content.length > 10000) {
          logger.warn('Invalid message content length or type');
          content = typeof content === 'string' ? content.substring(0, 1000) : String(content || '');
        }
        
        // ELITE: Use safe JSON parsing with depth limit
        const { sanitizeJSON } = await import('../utils/inputSanitizer');
        const parsed = sanitizeJSON(content);
        
        if (parsed && typeof parsed === 'object' && parsed !== null) {
          // ELITE: Validate parsed object structure
          const messageType = typeof parsed.type === 'string' ? parsed.type : null;
          
          if (messageType === 'SOS' || messageType === 'EARTHQUAKE_EMERGENCY') {
            // ELITE: Sanitize message body before displaying
            const { sanitizeString } = await import('../utils/validation');
            const messageBody = sanitizeString(
              parsed.message || parsed.signal?.message || content || '',
              500
            );
            
            // Critical messages - use multi-channel alert
            const { multiChannelAlertService } = await import('./MultiChannelAlertService');
            await multiChannelAlertService.sendAlert({
              title: messageType === 'SOS' ? '🆘 Acil Yardım Çağrısı' : '🚨 Deprem Acil Durumu',
              body: messageBody,
              priority: 'critical',
              channels: {
                pushNotification: true,
                fullScreenAlert: true,
                alarmSound: true,
                vibration: true,
                tts: true,
              },
              data: { type: 'mesh_message', messageId: message.id, from: message.from },
            });
            return;
          }
          
          // ELITE: Extract content safely
          if (typeof parsed.message === 'string') {
            const { sanitizeString } = await import('../utils/validation');
            content = sanitizeString(parsed.message, 5000);
          } else if (typeof parsed.content === 'string') {
            const { sanitizeString } = await import('../utils/validation');
            content = sanitizeString(parsed.content, 5000);
          }
        }
      } catch (error) {
        // ELITE: Not JSON or parse failed - sanitize as plain text
        logger.debug('Message content is not JSON, using as plain text:', error);
        const { sanitizeString } = await import('../utils/validation');
        content = sanitizeString(typeof content === 'string' ? content : String(content || ''), 5000);
      }

      // Regular message notification
      await notificationService.showMessageNotification(senderName, content);
      
      // Update message store conversation - safe access
      const messageStore = useMessageStore?.getState?.();
      if (messageStore && typeof messageStore.addMessage === 'function') {
        messageStore.addMessage({
          id: message.id,
          from: message.from,
          to: 'me',
          content,
          timestamp: message.timestamp,
          delivered: true,
          read: false,
        });
      } else {
        logger.warn('⚠️ MessageStore not available for message update');
      }
    } catch (error) {
      logger.error('Failed to send message notification:', error);
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
      this.startHeartbeat();

      if (__DEV__) logger.info('Started successfully - Mesh network active');
    } catch (error) {
      logger.error('Start error:', error);
      // Don't throw - allow app to continue without BLE
    }
  }

  /**
   * Elite Security: Rate limiting helpers for messages
   */
  private getMessageRateLimit(key: string): number | null {
    return this.messageRateLimitStore.get(key) || null;
  }

  private setMessageRateLimit(key: string, time: number): void {
    this.messageRateLimitStore.set(key, time);
    // Cleanup old entries (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60 * 1000;
    // CRITICAL: Use Array.from() for Map iteration compatibility
    for (const [k, v] of Array.from(this.messageRateLimitStore.entries())) {
      if (v < oneMinuteAgo) {
        this.messageRateLimitStore.delete(k);
      }
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
    this.stopHeartbeat();
    
    // Elite Security: Clear rate limit store
    this.messageRateLimitStore.clear();
  }

  getMyDeviceId(): string | null {
    return this.myDeviceId;
  }

  /**
   * Elite Security: Send message with input validation and rate limiting
   */
  async sendMessage(content: string, to?: string) {
    if (!this.myDeviceId) {
      logger.error('Cannot send message: no device ID');
      return;
    }

    // Elite Security: Validate and sanitize input
    if (typeof content !== 'string' || content.length === 0) {
      logger.error('Message content cannot be empty');
      return;
    }
    
    // Elite: Validate and sanitize content
    if (!validateMessageContent(content)) {
      logger.error('Invalid message content');
      return;
    }

    // Elite: Sanitize message content (prevent XSS, injection)
    const sanitizedContent = sanitizeString(content, 10000); // Max 10KB
    if (!sanitizedContent || sanitizedContent.length === 0) {
      logger.error('Message content is empty after sanitization');
      return;
    }
    
    // Elite: Validate recipient device ID format
    if (to && !to.match(/^afn-[a-zA-Z0-9]{8}$/)) {
      logger.error('Invalid recipient device ID');
      return;
    }
    
    // Elite: Rate limiting per recipient (prevent spam)
    if (to) {
      const rateLimitKey = `message_${to}`;
      const lastSent = this.getMessageRateLimit(rateLimitKey);
      const now = Date.now();
      const RATE_LIMIT_MS = 1000; // 1 second between messages to same recipient
      
      if (lastSent && (now - lastSent) < RATE_LIMIT_MS) {
        logger.warn('Rate limit exceeded for recipient');
        return;
      }
      this.setMessageRateLimit(rateLimitKey, now);
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
      priority: 'normal',
      sequence: useMeshStore.getState().nextSequence(),
      route: [this.myDeviceId],
      ackRequired: false,
      attempts: 0,
      delivered: false,
    };

    // Add to queue
    this.enqueueMessage(message);

    // Add to store
    useMeshStore.getState().addMessage(message);
    if (message.ackRequired) {
      useMeshStore.getState().trackPendingAck(message);
    }
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
      ttl: 12, // Higher TTL for SOS
      hops: 0,
      priority: 'critical',
      sequence: useMeshStore.getState().nextSequence(),
      route: [this.myDeviceId],
      ackRequired: true,
      attempts: 0,
      delivered: false,
    };

    this.enqueueMessage(message);
    useMeshStore.getState().addMessage(message);
    if (message.ackRequired) {
      useMeshStore.getState().trackPendingAck(message);
    }
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
        priority: 'normal',
        sequence: useMeshStore.getState().nextSequence(),
        route: [this.myDeviceId],
        ackRequired: false,
        attempts: 0,
        delivered: false,
      };
      this.enqueueMessage(fullMessage);
      if (fullMessage.ackRequired) {
        useMeshStore.getState().trackPendingAck(fullMessage);
      }
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
      ttl: message.ttl ?? 5,
      hops: 0,
      priority: message.priority ?? 'normal',
      sequence: useMeshStore.getState().nextSequence(),
      route: [this.myDeviceId],
      ackRequired: message.ackRequired ?? false,
      attempts: 0,
      delivered: false,
    };

    this.enqueueMessage(fullMessage);
    if (fullMessage.ackRequired) {
      useMeshStore.getState().trackPendingAck(fullMessage);
    }
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
    const interval = this.getAdaptiveScanInterval();
    this.scanTimer = setTimeout(() => {
      this.startScanCycle();
    }, interval);
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

  private getAdaptiveScanInterval(): number {
    const { networkHealth } = useMeshStore.getState();
    let baseInterval = SCAN_INTERVAL;
    
    if (!networkHealth.lastUpdated) {
      baseInterval = SCAN_INTERVAL;
    } else if (networkHealth.nodeCount <= 1) {
      baseInterval = Math.max(5000, SCAN_INTERVAL / 2);
    } else if (networkHealth.nodeCount >= 6) {
      baseInterval = SCAN_INTERVAL * 1.5;
    }
    
    // ELITE: Apply battery-aware multiplier (lazy import to avoid circular dependency)
    try {
      // Use synchronous check - BatteryMonitoringService should be initialized by now
      const batteryModule = require('./BatteryMonitoringService');
      if (batteryModule?.batteryMonitoringService) {
        const multiplier = batteryModule.batteryMonitoringService.getPollingIntervalMultiplier();
        baseInterval = Math.round(baseInterval * multiplier);
        
        // CRITICAL: Never go below 5 seconds (BLE scanning minimum)
        baseInterval = Math.max(baseInterval, 5000);
      }
    } catch {
      // BatteryMonitoringService not available - use base interval
    }
    
    return baseInterval;
  }

  private cleanupPeers(maxAgeMs = SCAN_INTERVAL * 3) {
    const now = Date.now();
    const peers = useMeshStore.getState().peers;
    Object.values(peers).forEach((peer) => {
      if (now - peer.lastSeen > maxAgeMs) {
        useMeshStore.getState().removePeer(peer.id);
      }
    });
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
    this.cleanupPeers();
    useMeshStore.getState().updateNetworkHealth({});
  }

  private async exchangeMessages(device: Device) {
    try {
      const services = await device.services();
      if (!services?.length) {
        return;
      }
      const characteristics = await services[0].characteristics();
      if (!characteristics?.length) {
        return;
      }
      const characteristic = characteristics[0];

      await this.processOutgoingMessages(characteristic);
      await this.readIncomingMessage(characteristic, device);

      this.cleanupQueue();
      useMeshStore.getState().updateNetworkHealth({});
    } catch (error) {
      logger.error('Message exchange error:', error);
    }
  }

  private async processOutgoingMessages(characteristic: Characteristic) {
    this.sortQueue();
    for (const message of [...this.messageQueue]) {
      if (message.type !== 'ack' && message.ackRequired && this.hasPendingAck(message.id)) {
        continue; // waiting for ack
      }

      if (message.delivered) {
        continue;
      }

      if (message.attempts >= this.MAX_RETRY) {
        useMeshStore.getState().recordDrop();
        this.removeFromQueue(message.id);
        continue;
      }

      message.attempts += 1;

      try {
        const payload = await this.serializeMessage(message);
        const base64Payload = Buffer.from(payload).toString('base64');
        await characteristic.writeWithResponse(base64Payload);
        useMeshStore.getState().incrementStat('messagesSent');

        if (message.type === 'ack') {
          message.delivered = true;
          this.removeFromQueue(message.id);
        } else if (message.ackRequired) {
          useMeshStore.getState().trackPendingAck(message);
        } else {
          message.delivered = true;
          useMeshStore.getState().markMessageDelivered(message.id);
          useMeshStore.getState().markSequenceDelivered(message.from, message.sequence);
          this.removeFromQueue(message.id);
        }

        if (__DEV__) {
          logger.info('Message sent:', message.id);
        }
      } catch (error) {
        logger.error('Write error:', error);
        useMeshStore.getState().recordRetry();
      }
    }
  }

  private async readIncomingMessage(characteristic: Characteristic, device: Device) {
    try {
      const value = await characteristic.read();
      if (!value?.value) {
        return;
      }

      const payload = Buffer.from(value.value, 'base64').toString('utf-8');
      const incomingRaw = JSON.parse(payload) as MeshMessage;
      const incomingMessage = this.deserializeMessage(incomingRaw);
      await this.processIncomingMessage(incomingMessage, device);
    } catch (error) {
      logger.error('Read error:', error);
    }
  }

  private async processIncomingMessage(message: MeshMessage, device: Device) {
    if (!this.myDeviceId) return;

    // Handle ACK messages first (early return)
    if (message.type === 'ack') {
      try {
        const payload = JSON.parse(message.content);
        const ackId = payload?.ack || message.content;
        if (ackId) {
          useMeshStore.getState().resolvePendingAck(ackId);
          useMeshStore.getState().markMessageDelivered(ackId);
          this.removeFromQueue(ackId);
        }
      } catch (error) {
        logger.error('Failed to process ack payload:', error);
      }
      return; // ACK messages are handled here, don't continue
    }
    
    // Handle heartbeat messages (early return)
    if (message.type === 'heartbeat') {
      try {
        const payload = JSON.parse(message.content);
        const { timestamp } = payload;
        const state = useMeshStore.getState();
        const existing = state.peers[message.from];
        if (existing) {
          state.updatePeer(message.from, {
            lastSeen: timestamp || Date.now(),
            rssi: device.rssi ?? existing.rssi,
          });
        } else {
          state.addPeer({
            id: message.from,
            name: device.name || `Mesh-${message.from.slice(-4)}`,
            lastSeen: timestamp || Date.now(),
            rssi: device.rssi ?? -85,
          });
        }
        state.updateNetworkHealth({ avgHopCount: message.hops });
      } catch (error) {
        logger.error('Failed to process heartbeat payload:', error);
      }
      // Still forward heartbeat to extend visibility
    }

    // Check for duplicate message (loop prevention)
    const isFresh = useMeshStore.getState().registerReceipt(message.from, message.sequence);
    if (!isFresh) {
      if (message.ackRequired && message.to === this.myDeviceId) {
        await this.enqueueAck(message);
      }
      if (__DEV__) logger.info('Duplicate message ignored:', message.id);
      return;
    }

    // Check if this device is already in route (loop prevention)
    if (!message.route) {
      message.route = [];
    }
    if (message.route.includes(this.myDeviceId)) {
      // Already processed this message - prevent loop
      if (__DEV__) logger.info('Message loop detected, ignoring:', message.id);
      return;
    }

    // Add this device to route
    message.route = [...message.route, this.myDeviceId];

    const isTargeted = !message.to || message.to === this.myDeviceId;

    if (message.ttl <= 0) {
      useMeshStore.getState().recordDrop();
      return;
    }

    if (message.type === 'SOS_BEACON') {
      await this.handleBeaconMessage(message, device.rssi);
    }

    if (isTargeted) {
      useMeshStore.getState().addMessage(message);
      useMeshStore.getState().incrementStat('messagesReceived');
      useMeshStore.getState().updateNetworkHealth({ avgHopCount: message.hops });
      this.notifyMessageCallbacks(message);
      
      // Elite: Send notification for received messages (except SOS_BEACON which has its own notification)
      if (message.type !== 'SOS_BEACON') {
        this.sendMessageNotification(message);
      }
    }

    if (message.ackRequired && message.to === this.myDeviceId) {
      await this.enqueueAck(message);
    }

    // Forward message if not targeted or is broadcast
    if (!isTargeted || !message.to) {
      await this.forwardMessage(message);
    }
  }

  private removeFromQueue(messageId: string) {
    this.messageQueue = this.messageQueue.filter((msg) => msg.id !== messageId);
  }

  private async enqueueAck(originalMessage: MeshMessage) {
    if (!this.myDeviceId) return;
    const ackPayload = {
      ack: originalMessage.id,
      seq: originalMessage.sequence,
      from: this.myDeviceId,
    };
    const ack: MeshMessage = {
      id: `ack_${originalMessage.id}_${Date.now()}`,
      from: this.myDeviceId,
      to: originalMessage.from,
      content: JSON.stringify(ackPayload),
      type: 'ack',
      timestamp: Date.now(),
      ttl: 4,
      hops: 0,
      priority: 'high',
      sequence: useMeshStore.getState().nextSequence(),
      route: [this.myDeviceId],
      ackRequired: false,
      attempts: 0,
      delivered: false,
    };
    this.enqueueMessage(ack);
  }

  private forwardMessage(message: MeshMessage) {
    if (!this.myDeviceId) return;
    
    // TTL check - don't forward if TTL is exhausted
    if (message.ttl <= 1) {
      useMeshStore.getState().recordDrop();
      return;
    }

    // Route check already done in processIncomingMessage
    // This device is already in route, so we can safely forward
    
    const forwarded: MeshMessage = {
      ...message,
      ttl: message.ttl - 1,
      hops: message.hops + 1,
      // Route already includes this device from processIncomingMessage
      route: message.route || [this.myDeviceId],
      attempts: 0,
      delivered: false,
    };

    this.enqueueMessage(forwarded);
    useMeshStore.getState().recordHopForwarded();
    useMeshStore.getState().updateNetworkHealth({ avgHopCount: forwarded.hops });
    
    if (__DEV__) logger.info(`Forwarding message ${message.id} (TTL: ${forwarded.ttl}, Hops: ${forwarded.hops})`);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = setInterval(() => {
      this.broadcastHeartbeat();
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private broadcastHeartbeat() {
    if (!this.myDeviceId) return;
    const heartbeat: MeshMessage = {
      id: `hb_${Date.now()}`,
      from: this.myDeviceId,
      content: JSON.stringify({ timestamp: Date.now() }),
      type: 'heartbeat',
      timestamp: Date.now(),
      ttl: 3,
      hops: 0,
      priority: 'normal',
      sequence: useMeshStore.getState().nextSequence(),
      route: [this.myDeviceId],
      ackRequired: false,
      attempts: 0,
      delivered: false,
    };
    this.enqueueMessage(heartbeat);
  }
}

export const bleMeshService = new BLEMeshService();

