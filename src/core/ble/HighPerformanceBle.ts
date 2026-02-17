// CRITICAL: Lazy-load BLE native modules with try-catch to prevent app crash
// These modules require native code and will crash if unavailable
let BleManagerClass: any = null;
let BlePeripheralModule: any = null;
let BleManagerAvailable = false;

try {
  const blePlx = require('react-native-ble-plx');
  BleManagerClass = blePlx.BleManager;
  BleManagerAvailable = true;
} catch (e) {
  // BLE PLX not available — graceful degradation
}

try {
  BlePeripheralModule = require('react-native-ble-peripheral').default;
} catch (e) {
  // BLE Peripheral not available — graceful degradation
}

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
  private manager: any; // BleManager | null
  private isScanning = false;
  private isAdvertising = false;
  private hasLoggedAdvertiseUnavailable = false;
  private foundPeers: Map<string, BlePeer> = new Map();
  private scanListeners: ((peer: BlePeer) => void)[] = [];

  constructor() {
    try {
      if (BleManagerAvailable && BleManagerClass) {
        this.manager = new BleManagerClass();
      } else {
        logger.warn('BleManager not available — BLE features disabled');
        this.manager = null;
      }
    } catch (error) {
      logger.warn('BleManager initialization failed — BLE features disabled:', error);
      this.manager = null;
    }
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

    if (!BlePeripheralModule || typeof BlePeripheralModule.startAdvertising !== 'function') {
      if (!this.hasLoggedAdvertiseUnavailable) {
        logger.warn('BLE advertising unavailable: native peripheral module missing');
        this.hasLoggedAdvertiseUnavailable = true;
      }
      this.isAdvertising = false;
      return;
    }

    try {
      // ELITE: Guard against null BlePeripheral (simulator/no BLE hardware)
      if (typeof BlePeripheralModule.isAdvertising === 'function' && await BlePeripheralModule.isAdvertising()) {
        await BlePeripheralModule.stopAdvertising();
      }

      const manufacturerData = Buffer.from(payload).toString('hex');

      await BlePeripheralModule.startAdvertising({
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
    if (!BlePeripheralModule || typeof BlePeripheralModule.stopAdvertising !== 'function') {
      this.isAdvertising = false;
      return;
    }

    try {
      await BlePeripheralModule.stopAdvertising();
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
    if (this.isScanning || !this.manager) return;

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
    if (this.manager) {
      this.manager.stopDeviceScan();
    }
    this.isScanning = false;
    logger.info('BLE Scanning Stopped');
  }

  private processDiscoveredDevice(device: any) {
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
