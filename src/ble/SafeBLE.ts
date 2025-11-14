// Safe BLE wrapper to prevent crashes when native modules are not available
import { logger } from '../utils/productionLogger';
import { AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID } from './constants';
let BleManager: any = null;
let BlePeripheral: any = null;

try {
  // Try to import BLE modules
  const blePlx = (globalThis as any).require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
} catch {
  logger.warn('react-native-ble-plx not available');
}

try {
  BlePeripheral = (globalThis as any).require('react-native-ble-peripheral').default;
} catch {
  logger.warn('react-native-ble-peripheral not available');
}

// Safe manager instance
let manager: any = null;
if (BleManager) {
  try {
    manager = new BleManager();
  } catch {
    logger.warn('Failed to create BleManager instance');
  }
}

const SERVICE_UUID = AFETNET_SERVICE_UUID.toLowerCase();
const CHARACTERISTIC_UUID = AFETNET_CHAR_MSG_UUID.toLowerCase();
let peripheralConfigured = false;

const getPermissionMask = () => {
  const perms = BlePeripheral?.permissions || {};
  const readable = perms.READABLE ?? 0x01;
  const writeable = perms.WRITEABLE ?? 0x10;
  return readable | writeable;
};

const getPropertyMask = () => {
  const props = BlePeripheral?.properties || {};
  const read = props.READ ?? 0x02;
  const write = props.WRITE ?? 0x08;
  const writeNoResponse = props.WRITE_NO_RESPONSE ?? 0x04;
  const notify = props.NOTIFY ?? 0x10;
  return read | write | writeNoResponse | notify;
};

const ensurePeripheralConfigured = async (): Promise<boolean> => {
  if (!BlePeripheral) {
    return false;
  }
  if (peripheralConfigured) {
    return true;
  }

  try {
    await BlePeripheral.setName('AfetNet');
  } catch (error) {
    logger.warn('Failed to set BLE peripheral name:', error);
  }

  try {
    await BlePeripheral.addService(SERVICE_UUID, true);
    await BlePeripheral.addCharacteristicToService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      getPermissionMask(),
      getPropertyMask(),
    );
    peripheralConfigured = true;
    return true;
  } catch (error) {
    logger.warn('Failed to configure BLE peripheral service:', error);
    return false;
  }
};

export const SafeBLE = {
  isAvailable: () => BleManager !== null && BlePeripheral !== null,
  
   
  startScan: async (onFrame: (from: string, frame: any) => void) => {
    if (!manager) {
      logger.warn('BLE not available, scan not started');
      return;
    }
    try {
      manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: true }, (_e: any, device: any) => {
        if (!device) {return;}
        const data =
          (device.serviceData && device.serviceData[SERVICE_UUID]) ||
          device.manufacturerData;
        if (!data) {return;}
        try {
          const buf = (globalThis as any).Buffer.from(data, 'base64');
          const frame = { data: buf.toString() };
          if (frame) {onFrame(device.id, frame);}
        } catch {
          // Ignore frame decode errors
        }
      });
    } catch {
      logger.warn('BLE scan failed');
    }
  },

  stopScan: async () => {
    if (!manager) {return;}
    try {
      manager.stopDeviceScan();
    } catch {
      logger.warn('BLE stop scan failed');
    }
  },

  advertise: async (data: Uint8Array) => {
    if (!BlePeripheral) {
      logger.warn('BLE peripheral not available, advertising not started');
      return;
    }
    try {
      const configured = await ensurePeripheralConfigured();
      if (!configured) {
        return;
      }
      if (__DEV__ && data?.length) {
        logger.debug('Starting BLE advertising with payload bytes:', Array.from(data).slice(0, 8));
      }
      await BlePeripheral.start();
    } catch (error) {
      logger.warn('BLE advertising failed:', error);
    }
  },

  stopAdvertise: async () => {
    if (!BlePeripheral) {return;}
    try {
      await BlePeripheral.stop();
    } catch (error) {
      logger.warn('BLE stop advertising failed:', error);
    }
  },
};


