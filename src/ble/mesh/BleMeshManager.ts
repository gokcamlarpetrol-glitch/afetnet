import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { logger } from '../../utils/productionLogger';

// Safe BLE imports with fallbacks for Expo Go
let BleManager: any = null;
// let Device: any = null; // Not used
// let State: any = null; // Not used
// let Characteristic: any = null; // Not used
// let Service: any = null; // Not used

try {
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
  // Device = blePlx.Device; // Not used
  // State = blePlx.State; // Not used
  // Characteristic = blePlx.Characteristic; // Not used
  // Service = blePlx.Service; // Not used
} catch (e) {
  logger.warn('react-native-ble-plx not available, using fallback');
}

export interface MeshMessage {
  id: string;
  type: 'SOS' | 'ACK' | 'DM' | 'HEARTBEAT';
  payload: any;
  timestamp: number;
  ttl: number;
  hopCount: number;
}

export interface MeshDevice {
  id: string;
  name: string;
  device: any;
  lastSeen: number;
  rssi: number;
  services?: unknown[];
}

export interface MeshConfig {
  serviceUUID: string;
  characteristicUUID: string;
  scanTimeout: number;
  connectTimeout: number;
  heartbeatInterval: number;
  maxPayloadSize: number;
}

export class BleMeshManager extends SimpleEventEmitter {
  private manager: any = null;
  private config: MeshConfig;
  private isScanning: boolean = false;
  private isConnected: boolean = false;
  private connectedDevices: Map<string, MeshDevice> = new Map();
  private messageQueue: MeshMessage[] = [];
  private heartbeatInterval?: NodeJS.Timeout;
  private messageHistory: Map<string, number> = new Map(); // Prevent message loops
  private isExpoGo: boolean = !BleManager;

  // Default AfetNet BLE mesh configuration
  private defaultConfig: MeshConfig = {
    serviceUUID: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E', // Nordic UART Service
    characteristicUUID: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E', // Nordic UART TX
    scanTimeout: 30000, // 30 seconds
    connectTimeout: 10000, // 10 seconds
    heartbeatInterval: 15000, // 15 seconds
    maxPayloadSize: 244, // BLE MTU limit
  };

  constructor(config?: Partial<MeshConfig>) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    
    // Only create BleManager if available (not in Expo Go)
    if (BleManager && !this.isExpoGo) {
      this.manager = new BleManager();
      this.setupEventListeners();
    } else {
      logger.warn('BLE Mesh Manager: Using mock mode (Expo Go)');
    }
  }

  private setupEventListeners(): void {
    if (!this.manager) return;
    
    this.manager.onStateChange((state: any) => {
      logger.debug('BLE State changed:', state);
      this.emit('stateChanged', state);
      
      if (state === 'PoweredOn') {
        this.startHeartbeat();
      } else {
        this.stopHeartbeat();
      }
    }, true);
  }

  async initialize(): Promise<boolean> {
    if (!this.manager) {
      logger.warn('BLE Mesh Manager: Not available in Expo Go');
      return false;
    }
    
    try {
      const state = await this.manager.state();
      logger.debug('Initial BLE state:', state);
      
      if (state !== 'PoweredOn') {
        logger.warn('Bluetooth is not powered on. Current state:', state);
        return false;
      }

      await this.startScanning();
      return true;
    } catch (error) {
      logger.error('Failed to initialize BLE mesh:', error);
      return false;
    }
  }

  async startScanning(): Promise<void> {
    if (!this.manager) {
      logger.warn('BLE Mesh Manager: Not available in Expo Go');
      return;
    }
    
    if (this.isScanning) {
      logger.debug('Already scanning');
      return;
    }

    try {
      this.isScanning = true;
      logger.debug('Starting BLE scan...');

      this.manager.startDeviceScan(
        [this.config.serviceUUID],
        { allowDuplicates: true },
        (error: any, device: any) => {
          if (error) {
            logger.error('Scan error:', error);
            this.isScanning = false;
            return;
          }

          if (device) {
            this.handleDeviceFound(device);
          }
        }
      );

      // Stop scanning after timeout
      setTimeout(() => {
        if (this.isScanning) {
          this.stopScanning();
        }
      }, this.config.scanTimeout);

    } catch (error) {
      logger.error('Failed to start scanning:', error);
      this.isScanning = false;
    }
  }

  async stopScanning(): Promise<void> {
    if (!this.manager) return;
    if (!this.isScanning) return;

    try {
      this.manager.stopDeviceScan();
      this.isScanning = false;
      logger.debug('BLE scan stopped');
    } catch (error) {
      logger.error('Failed to stop scanning:', error);
    }
  }

  private async handleDeviceFound(device: any): Promise<void> {
    try {
      const meshDevice: MeshDevice = {
        id: device.id,
        name: device.name || `Unknown-${device.id.slice(-4)}`,
        device,
        lastSeen: Date.now(),
        rssi: device.rssi || -100,
      };

      logger.debug(`Found device: ${meshDevice.name} (${device.id}) RSSI: ${device.rssi}`);

      // Check if we should connect to this device
      if (this.shouldConnectToDevice(meshDevice)) {
        await this.connectToDevice(meshDevice);
      }

      this.emit('deviceFound', meshDevice);

    } catch (error) {
      logger.error('Error handling found device:', error);
    }
  }

  private shouldConnectToDevice(device: MeshDevice): boolean {
    // Connect to nearby devices with good signal strength
    return device.rssi > -80 && !this.connectedDevices.has(device.id);
  }

  private async connectToDevice(meshDevice: MeshDevice): Promise<void> {
    try {
      logger.debug(`Connecting to device: ${meshDevice.name}`);
      
      const connectedDevice = await meshDevice.device.connect();
      logger.debug(`Connected to: ${meshDevice.name}`);

      // Discover services
      const services = await connectedDevice.discoverAllServicesAndCharacteristics();
      logger.debug(`Discovered ${services.length} services for ${meshDevice.name}`);

      meshDevice.device = connectedDevice;
      meshDevice.services = services;
      this.connectedDevices.set(meshDevice.id, meshDevice);

      this.isConnected = true;
      this.emit('deviceConnected', meshDevice);

      // Start listening for messages
      this.setupMessageListener(meshDevice);

    } catch (error) {
      logger.error(`Failed to connect to ${meshDevice.name}:`, error);
    }
  }

  private async setupMessageListener(meshDevice: MeshDevice): Promise<void> {
    try {
      const service = meshDevice.services?.find((s: any) => s.uuid === this.config.serviceUUID);
      if (!service) {
        logger.warn(`Service ${this.config.serviceUUID} not found on ${meshDevice.name}`);
        return;
      }

      const characteristic = (service as any).characteristics.find((c: any) => c.uuid === this.config.characteristicUUID);
      if (!characteristic) {
        logger.warn(`Characteristic ${this.config.characteristicUUID} not found on ${meshDevice.name}`);
        return;
      }

      // Monitor for incoming messages
      meshDevice.device.monitorCharacteristicForService(
        this.config.serviceUUID,
        this.config.characteristicUUID,
        (error: any, characteristic: any) => {
          if (error) {
            logger.error(`Monitor error for ${meshDevice.name}:`, error);
            return;
          }

          if (characteristic?.value) {
            this.handleIncomingMessage(characteristic.value, meshDevice);
          }
        }
      );

    } catch (error) {
      logger.error(`Failed to setup message listener for ${meshDevice.name}:`, error);
    }
  }

  private handleIncomingMessage(data: string, fromDevice: MeshDevice): void {
    try {
      const message: MeshMessage = JSON.parse(data);
      
      // Check if we've already processed this message (prevent loops)
      if (this.messageHistory.has(message.id)) {
        return;
      }

      // Mark message as processed
      this.messageHistory.set(message.id, Date.now());

      // Clean old message history
      this.cleanMessageHistory();

      logger.debug(`Received message from ${fromDevice.name}:`, message);

      // Decrement TTL and hop count
      message.ttl--;
      message.hopCount++;

      // Emit the message for the app to handle
      this.emit('messageReceived', message);

      // Forward message to other connected devices if TTL > 0
      if (message.ttl > 0) {
        this.forwardMessage(message, fromDevice.id);
      }

    } catch (error) {
      logger.error('Failed to parse incoming message:', error);
    }
  }

  private async forwardMessage(message: MeshMessage, excludeDeviceId: string): Promise<void> {
    const forwardPromises = Array.from(this.connectedDevices.values())
      .filter(device => device.id !== excludeDeviceId)
      .map(device => this.sendMessageToDevice(message, device));

    await Promise.allSettled(forwardPromises);
  }

  async sendMessage(message: Omit<MeshMessage, 'id' | 'timestamp'>): Promise<boolean> {
    const fullMessage: MeshMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now(),
    };

    logger.debug('Sending message:', fullMessage);

    // Add to queue for reliability
    this.messageQueue.push(fullMessage);

    // Send to all connected devices
    const sendPromises = Array.from(this.connectedDevices.values())
      .map(device => this.sendMessageToDevice(fullMessage, device));

    const results = await Promise.allSettled(sendPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;

    logger.debug(`Message sent to ${successCount}/${this.connectedDevices.size} devices`);

    this.emit('messageSent', fullMessage);

    return successCount > 0;
  }

  private async sendMessageToDevice(message: MeshMessage, device: MeshDevice): Promise<boolean> {
    try {
      const data = JSON.stringify(message);
      
      if (data.length > this.config.maxPayloadSize) {
        logger.warn(`Message too large (${data.length} > ${this.config.maxPayloadSize}):`, message);
        return false;
      }

      await device.device.writeCharacteristicWithResponseForService(
        this.config.serviceUUID,
        this.config.characteristicUUID,
        Buffer.from(data).toString('base64')
      );

      logger.debug(`Message sent to ${device.name}`);
      return true;

    } catch (error) {
      logger.error(`Failed to send message to ${device.name}:`, error);
      return false;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    logger.debug('Heartbeat started');
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined as any;
      logger.debug('Heartbeat stopped');
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (this.connectedDevices.size === 0) return;

    const heartbeat: Omit<MeshMessage, 'id' | 'timestamp'> = {
      type: 'HEARTBEAT',
      payload: {
        deviceCount: this.connectedDevices.size,
        connectedDevices: Array.from(this.connectedDevices.keys()),
      },
      ttl: 2, // Limited TTL for heartbeat
      hopCount: 0,
    };

    await this.sendMessage(heartbeat);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanMessageHistory(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [messageId, timestamp] of this.messageHistory.entries()) {
      if (now - timestamp > maxAge) {
        this.messageHistory.delete(messageId);
      }
    }
  }

  getConnectedDevices(): MeshDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  getConnectionCount(): number {
    return this.connectedDevices.size;
  }

  isMeshActive(): boolean {
    return this.isConnected && this.connectedDevices.size > 0;
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    await this.stopScanning();

    const disconnectPromises = Array.from(this.connectedDevices.values())
      .map(device => device.device.cancelConnection());

    await Promise.allSettled(disconnectPromises);
    this.connectedDevices.clear();
    this.isConnected = false;

    logger.debug('BLE mesh disconnected');
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
  }
}
