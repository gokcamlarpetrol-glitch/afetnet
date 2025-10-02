import { BleManager, Device, State } from 'react-native-ble-plx';
import { MessageData, MessageEncoder } from './message';
import { EventEmitter } from '../utils/events';

export interface BLEConfig {
  serviceUUID: string;
  characteristicUUID: string;
  scanTimeout: number;
  advertiseTimeout: number;
  maxRetries: number;
}

export interface BLEPeer {
  id: string;
  name?: string;
  rssi: number;
  lastSeen: number;
  isConnected: boolean;
}

export class BLEMeshManager {
  private static instance: BLEMeshManager;
  private manager: BleManager;
  private config: BLEConfig;
  private eventEmitter: EventEmitter;
  private isScanning: boolean = false;
  private isAdvertising: boolean = false;
  private peers: Map<string, BLEPeer> = new Map();
  private connectedDevices: Map<string, Device> = new Map();

  private constructor() {
    this.manager = new BleManager();
    this.config = {
      serviceUUID: '12345678-1234-1234-1234-123456789ABC',
      characteristicUUID: '87654321-4321-4321-4321-CBA987654321',
      scanTimeout: 30000, // 30 seconds
      advertiseTimeout: 30000, // 30 seconds
      maxRetries: 3,
    };
    this.eventEmitter = new EventEmitter();
    this.setupBLE();
  }

  static getInstance(): BLEMeshManager {
    if (!BLEMeshManager.instance) {
      BLEMeshManager.instance = new BLEMeshManager();
    }
    return BLEMeshManager.instance;
  }

  private setupBLE(): void {
    this.manager.onStateChange((state: State) => {
      console.log('BLE State changed:', state);
      
      if (state === 'PoweredOn') {
        this.eventEmitter.emit('bleReady');
      } else if (state === 'PoweredOff') {
        this.eventEmitter.emit('bleUnavailable');
        this.stopScanning();
        this.stopAdvertising();
      }
    }, true);
  }

  async startScanning(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    try {
      await this.manager.startDeviceScan(
        [this.config.serviceUUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('BLE scan error:', error);
            return;
          }

          if (device) {
            this.handleDeviceFound(device);
          }
        }
      );

      this.isScanning = true;
      console.log('BLE scanning started');

      // Stop scanning after timeout
      setTimeout(() => {
        this.stopScanning();
      }, this.config.scanTimeout);

    } catch (error) {
      console.error('Failed to start BLE scanning:', error);
      throw error;
    }
  }

  async stopScanning(): Promise<void> {
    if (!this.isScanning) {
      return;
    }

    try {
      this.manager.stopDeviceScan();
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
      // Note: react-native-ble-plx doesn't support advertising on iOS
      // This is a placeholder for future implementation
      this.isAdvertising = true;
      console.log('BLE advertising started (placeholder)');
      
      // Stop advertising after timeout
      setTimeout(() => {
        this.stopAdvertising();
      }, this.config.advertiseTimeout);

    } catch (error) {
      console.error('Failed to start BLE advertising:', error);
      throw error;
    }
  }

  async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) {
      return;
    }

    try {
      // Placeholder implementation
      this.isAdvertising = false;
      console.log('BLE advertising stopped');
    } catch (error) {
      console.error('Failed to stop BLE advertising:', error);
    }
  }

  async sendMessage(deviceId: string, message: MessageData): Promise<boolean> {
    try {
      const encodedMessage = MessageEncoder.encode(message);
      
      // Find the device
      const device = this.connectedDevices.get(deviceId);
      if (!device) {
        console.error('Device not connected:', deviceId);
        return false;
      }

      // Write to characteristic
      await device.writeCharacteristicWithResponseForService(
        this.config.serviceUUID,
        this.config.characteristicUUID,
        Buffer.from(encodedMessage.data).toString('base64')
      );

      console.log('Message sent to device:', deviceId);
      return true;

    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  async broadcastMessage(message: MessageData): Promise<number> {
    let sentCount = 0;
    
    try {
      for (const [deviceId, peer] of this.peers) {
        if (peer.isConnected) {
          const success = await this.sendMessage(deviceId, message);
          if (success) {
            sentCount++;
          }
        }
      }
      
      console.log(`Message broadcasted to ${sentCount} devices`);
      return sentCount;
      
    } catch (error) {
      console.error('Failed to broadcast message:', error);
      return sentCount;
    }
  }

  private async handleDeviceFound(device: Device): Promise<void> {
    try {
      const peer: BLEPeer = {
        id: device.id,
        name: device.name || device.id,
        rssi: device.rssi || 0,
        lastSeen: Date.now(),
        isConnected: false,
      };

      this.peers.set(device.id, peer);
      this.eventEmitter.emit('peerFound', peer);

      // Try to connect and discover services
      await this.connectToDevice(device);

    } catch (error) {
      console.error('Failed to handle device found:', error);
    }
  }

  private async connectToDevice(device: Device): Promise<void> {
    try {
      await device.connect();
      await device.discoverAllServicesAndCharacteristics();
      
      // Update peer status
      const peer = this.peers.get(device.id);
      if (peer) {
        peer.isConnected = true;
        this.peers.set(device.id, peer);
      }

      this.connectedDevices.set(device.id, device);
      this.eventEmitter.emit('peerConnected', peer);

      // Set up message reception
      this.setupMessageReception(device);

    } catch (error) {
      console.error('Failed to connect to device:', error);
      
      // Update peer status
      const peer = this.peers.get(device.id);
      if (peer) {
        peer.isConnected = false;
        this.peers.set(device.id, peer);
      }
    }
  }

  private setupMessageReception(device: Device): void {
    device.monitorCharacteristicForService(
      this.config.serviceUUID,
      this.config.characteristicUUID,
      (error, characteristic) => {
        if (error) {
          console.error('Characteristic monitoring error:', error);
          return;
        }

        if (characteristic?.value) {
          try {
            const messageData = Buffer.from(characteristic.value, 'base64');
            const message = MessageEncoder.decode(messageData);
            
            console.log('Message received from device:', device.id);
            this.eventEmitter.emit('messageReceived', {
              from: device.id,
              message,
            });
          } catch (error) {
            console.error('Failed to decode received message:', error);
          }
        }
      }
    );
  }

  // Event handling
  onMessageReceived(callback: (data: { from: string; message: MessageData }) => void): () => void {
    return this.eventEmitter.on('messageReceived', callback);
  }

  onPeerFound(callback: (peer: BLEPeer) => void): () => void {
    return this.eventEmitter.on('peerFound', callback);
  }

  onPeerConnected(callback: (peer: BLEPeer) => void): () => void {
    return this.eventEmitter.on('peerConnected', callback);
  }

  onPeerDisconnected(callback: (peer: BLEPeer) => void): () => void {
    return this.eventEmitter.on('peerDisconnected', callback);
  }

  onBLEReady(callback: () => void): () => void {
    return this.eventEmitter.on('bleReady', callback);
  }

  onBLEUnavailable(callback: () => void): () => void {
    return this.eventEmitter.on('bleUnavailable', callback);
  }

  // Utility methods
  getPeers(): BLEPeer[] {
    return Array.from(this.peers.values());
  }

  getConnectedPeers(): BLEPeer[] {
    return Array.from(this.peers.values()).filter(peer => peer.isConnected);
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  isBLEAvailable(): boolean {
    return this.manager.state() === 'PoweredOn';
  }

  getBLEState(): State {
    return this.manager.state();
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    try {
      const device = this.connectedDevices.get(deviceId);
      if (device) {
        await device.cancelConnection();
        this.connectedDevices.delete(deviceId);
        
        const peer = this.peers.get(deviceId);
        if (peer) {
          peer.isConnected = false;
          this.peers.set(deviceId, peer);
          this.eventEmitter.emit('peerDisconnected', peer);
        }
      }
    } catch (error) {
      console.error('Failed to disconnect device:', error);
    }
  }

  async disconnectAll(): Promise<void> {
    const deviceIds = Array.from(this.connectedDevices.keys());
    
    for (const deviceId of deviceIds) {
      await this.disconnectDevice(deviceId);
    }
  }

  async cleanup(): Promise<void> {
    await this.stopScanning();
    await this.stopAdvertising();
    await this.disconnectAll();
    this.peers.clear();
    this.connectedDevices.clear();
    this.eventEmitter.removeAllListeners();
    await this.manager.destroy();
    console.log('BLE Mesh Manager cleaned up');
  }
}