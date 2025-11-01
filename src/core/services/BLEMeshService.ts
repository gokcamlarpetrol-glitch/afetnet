/**
 * BLE MESH SERVICE - Offline Peer-to-Peer Communication
 * Simple BLE mesh implementation for offline messaging
 */

import { BleManager, Device, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { useMeshStore, MeshPeer, MeshMessage } from '../stores/meshStore';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

const SERVICE_UUID = '0000180A-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '00002A29-0000-1000-8000-00805F9B34FB';
const SCAN_DURATION = 5000; // 5 seconds
const SCAN_INTERVAL = 10000; // 10 seconds

class BLEMeshService {
  private manager: BleManager;
  private isRunning = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private myDeviceId: string | null = null;
  private messageQueue: MeshMessage[] = [];

  constructor() {
    this.manager = new BleManager();
  }

  async start() {
    if (this.isRunning) return;

    console.log('[BLEMeshService] Starting...');

    try {
      // Request permissions
      await this.requestPermissions();

      // Check BLE state
      const state = await this.manager.state();
      if (state !== State.PoweredOn) {
        console.warn('[BLEMeshService] Bluetooth is not powered on');
        return;
      }

      // Generate device ID
      this.myDeviceId = await this.getDeviceId();
      useMeshStore.getState().setMyDeviceId(this.myDeviceId);

      this.isRunning = true;

      // Start scanning cycle
      this.startScanCycle();

      console.log('[BLEMeshService] Started successfully');
    } catch (error) {
      console.error('[BLEMeshService] Start error:', error);
    }
  }

  stop() {
    if (!this.isRunning) return;

    console.log('[BLEMeshService] Stopping...');

    this.isRunning = false;

    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    this.manager.stopDeviceScan();
    useMeshStore.getState().setScanning(false);
  }

  async sendMessage(content: string, to?: string) {
    if (!this.myDeviceId) {
      console.error('[BLEMeshService] Cannot send message: no device ID');
      return;
    }

    const message: MeshMessage = {
      id: await Crypto.randomUUID(),
      from: this.myDeviceId,
      to,
      content,
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

    console.log('[BLEMeshService] Message queued:', message.id);
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

    console.log('[BLEMeshService] SOS sent:', message.id);
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
    // Generate or retrieve device ID
    const uuid = await Crypto.randomUUID();
    return `AFN-${uuid.slice(0, 8)}`;
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
    console.log('[BLEMeshService] Starting scan...');
    useMeshStore.getState().setScanning(true);

    const discoveredDevices = new Map<string, Device>();

    this.manager.startDeviceScan(
      null, // Scan for all devices
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          console.error('[BLEMeshService] Scan error:', error);
          return;
        }

        if (device && device.name && device.name.startsWith('AFN-')) {
          discoveredDevices.set(device.id, device);

          const peer: MeshPeer = {
            id: device.id,
            name: device.name,
            rssi: device.rssi || -100,
            lastSeen: Date.now(),
            connected: false,
          };

          useMeshStore.getState().addPeer(peer);
        }
      }
    );

    // Stop scan after duration
    setTimeout(() => {
      this.manager.stopDeviceScan();
      useMeshStore.getState().setScanning(false);
      console.log('[BLEMeshService] Scan stopped. Found', discoveredDevices.size, 'peers');

      // Try to connect to discovered devices
      this.connectToPeers(Array.from(discoveredDevices.values()));
    }, SCAN_DURATION);
  }

  private async connectToPeers(devices: Device[]) {
    for (const device of devices.slice(0, 3)) { // Connect to max 3 peers
      try {
        console.log('[BLEMeshService] Connecting to', device.name);
        
        const connected = await device.connect({ timeout: 5000 });
        await connected.discoverAllServicesAndCharacteristics();

        useMeshStore.getState().updatePeer(device.id, { connected: true });

        // Exchange messages
        await this.exchangeMessages(connected);

        // Disconnect
        await connected.cancelConnection();
        useMeshStore.getState().updatePeer(device.id, { connected: false });

      } catch (error) {
        console.error('[BLEMeshService] Connection error:', error);
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
              
              console.log('[BLEMeshService] Message sent:', message.id);
            }
          }
        } catch (writeError) {
          console.error('[BLEMeshService] Write error:', writeError);
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
              
              // Add to store if not duplicate
              useMeshStore.getState().addMessage(incomingMessage);
              useMeshStore.getState().incrementStat('messagesReceived');
              
              console.log('[BLEMeshService] Message received:', incomingMessage.id);
            }
          }
        }
      } catch (readError) {
        console.error('[BLEMeshService] Read error:', readError);
      }

    } catch (error) {
      console.error('[BLEMeshService] Message exchange error:', error);
    }
  }
}

export const bleMeshService = new BLEMeshService();

