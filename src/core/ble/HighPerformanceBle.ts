import { BleManager, Device } from 'react-native-ble-plx';
import BlePeripheral from 'react-native-ble-peripheral';
import { Platform, PermissionsAndroid } from 'react-native';
import { AFETNET_SERVICE_UUID, MANUFACTURER_ID } from './constants';
import { createLogger } from '../utils/logger';
import { Buffer } from 'buffer';

const logger = createLogger('HighPerformanceBle');

export interface BlePeer {
  id: string;
  rssi: number;
  manufacturerData?: string;
  lastSeen: number;
}

class HighPerformanceBle {
  private manager: BleManager;
  private isScanning = false;
  private isAdvertising = false;
  private hasLoggedAdvertiseUnavailable = false;
  private foundPeers: Map<string, BlePeer> = new Map();
  private scanListeners: ((peer: BlePeer) => void)[] = [];

  constructor() {
    this.manager = new BleManager();
  }

  /**
     * Start Dual Mode (Scanning + Advertising)
     */
  async startDualMode(payload: Uint8Array): Promise<void> {
    await this.requestPermissions();

    // 1. Start Advertising (Be visible)
    await this.startAdvertising(payload);

    // 2. Start Scanning (See others)
    await this.startScanning();
  }

  async stopDualMode() {
    await this.stopAdvertising();
    this.stopScanning();
  }

  /**
     * Start Advertising using BlePeripheral
     */
  async startAdvertising(payload: Uint8Array): Promise<void> {
    if (this.isAdvertising) return;

    if (!BlePeripheral || typeof BlePeripheral.startAdvertising !== 'function') {
      if (!this.hasLoggedAdvertiseUnavailable) {
        logger.warn('BLE advertising unavailable: native peripheral module missing');
        this.hasLoggedAdvertiseUnavailable = true;
      }
      this.isAdvertising = false;
      return;
    }

    try {
      // ELITE: Guard against null BlePeripheral (simulator/no BLE hardware)
      if (typeof BlePeripheral.isAdvertising === 'function' && await BlePeripheral.isAdvertising()) {
        await BlePeripheral.stopAdvertising();
      }

      const manufacturerData = Buffer.from(payload).toString('hex');

      await BlePeripheral.startAdvertising({
        name: 'AfetNet',
        serviceUuids: [AFETNET_SERVICE_UUID],
        manufacturerData: {
          manufacturerId: MANUFACTURER_ID,
          data: manufacturerData,
        },
      });

      this.isAdvertising = true;
      logger.info('BLE Advertising Started');
    } catch (error) {
      logger.warn('BLE Advertising Failed:', error);
      this.isAdvertising = false;
    }
  }

  async stopAdvertising() {
    if (!BlePeripheral || typeof BlePeripheral.stopAdvertising !== 'function') {
      this.isAdvertising = false;
      return;
    }

    try {
      await BlePeripheral.stopAdvertising();
      this.isAdvertising = false;
      logger.info('BLE Advertising Stopped');
    } catch (error) {
      // Ignore errors during stop
    }
  }

  /**
     * Start Scanning using BleManager (ble-plx)
     */
  async startScanning() {
    if (this.isScanning) return;

    const state = await this.manager.state();
    if (state !== 'PoweredOn') {
      logger.warn('Bluetooth not powered on');
      return;
    }

    this.isScanning = true;
    logger.info('BLE Scanning Started');

    this.manager.startDeviceScan(
      [AFETNET_SERVICE_UUID],
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          logger.warn('Scan error:', error);
          return;
        }
        if (device) this.processDiscoveredDevice(device);
      },
    );
  }

  stopScanning() {
    this.manager.stopDeviceScan();
    this.isScanning = false;
    logger.info('BLE Scanning Stopped');
  }

  private processDiscoveredDevice(device: Device) {
    // Extract manufacturer data if available. 
    // Note: ble-plx returns base64 manufacturer data in device.manufacturerData

    const now = Date.now();
    const peer: BlePeer = {
      id: device.id,
      rssi: device.rssi || -100,
      manufacturerData: device.manufacturerData ? Buffer.from(device.manufacturerData, 'base64').toString('hex') : undefined,
      lastSeen: now,
    };

    this.foundPeers.set(device.id, peer);

    // Notify listeners
    this.scanListeners.forEach(listener => listener(peer));
  }

  onPeerFound(callback: (peer: BlePeer) => void) {
    this.scanListeners.push(callback);
  }

  removePeerFoundListener(callback: (peer: BlePeer) => void) {
    this.scanListeners = this.scanListeners.filter(l => l !== callback);
  }

  private async requestPermissions() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
    }
  }
}

export const highPerformanceBle = new HighPerformanceBle();
export default highPerformanceBle;
