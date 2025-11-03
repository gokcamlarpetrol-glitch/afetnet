import { Platform, PermissionsAndroid } from 'react-native';
import { logger } from '../utils/productionLogger';
import { NEARBY_SERVICE_UUID } from './constants';
import { BleManager } from 'react-native-ble-plx';

let manager: BleManager | null = null;
let isScanning = false;

export async function ensureBlePermissions() {
  logger.debug('🔐 BLE permissions requested');

  if (Platform.OS === 'android') {
    const perms = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];

    for (const p of perms) {
      try {
        const result = await PermissionsAndroid.request(p);
        logger.debug(`Permission ${p}: ${result}`);
      } catch (error) {
        logger.error(`Permission error for ${p}:`, error);
      }
    }
  }

  logger.debug('✅ BLE permissions completed');
}

export type NearbyEntry = {
  id: string;
  name?: string | null;
  rssi?: number | null;
  proximity: 'yakın' | 'orta' | 'uzak' | 'bilinmiyor';
  lastSeen: number;
};

export function rssiToBucket(rssi?: number | null): NearbyEntry['proximity'] {
  if (rssi == null) return 'bilinmiyor';
  if (rssi >= -60) return 'yakın';
  if (rssi >= -80) return 'orta';
  return 'uzak';
}

export function scan(callback: (d: NearbyEntry) => void) {
  logger.debug('🔍 Starting BLE scan...');

  if (!manager) {
    try {
      manager = new BleManager();
      logger.debug('✅ BLE Manager created');
    } catch (error) {
      logger.error('Failed to create BLE manager:', error);
      return () => {};
    }
  }

  if (isScanning) {
    logger.warn('BLE scan already running');
    return () => {};
  }

  try {
    isScanning = true;
    manager.startDeviceScan(
      [NEARBY_SERVICE_UUID],
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          logger.error('BLE scan error:', error);
          return;
        }

        if (!device) return;

        const entry: NearbyEntry = {
          id: device.id,
          name: device.name || `Device_${device.id.slice(-4)}`,
          rssi: device.rssi,
          proximity: rssiToBucket(device.rssi),
          lastSeen: Date.now(),
        };

        callback(entry);
      }
    );

    logger.debug('✅ BLE scan started');

    return () => {
      try {
        isScanning = false;
        manager.stopDeviceScan();
        logger.debug('🛑 BLE scan stopped');
      } catch (error) {
        logger.error('Failed to stop BLE scan:', error);
      }
    };
  } catch (error) {
    logger.error('Failed to start BLE scan:', error);
    isScanning = false;
    return () => {};
  }
}
