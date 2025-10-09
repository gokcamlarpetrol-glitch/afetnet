// Safe BLE wrapper to prevent crashes when native modules are not available
let BleManager: any = null;
let BlePeripheral: any = null;

try {
  // Try to import BLE modules
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
} catch (e) {
  console.warn('react-native-ble-plx not available');
}

try {
  BlePeripheral = require('react-native-ble-peripheral').default;
} catch (e) {
  console.warn('react-native-ble-peripheral not available');
}

// Safe manager instance
let manager: any = null;
if (BleManager) {
  try {
    manager = new BleManager();
  } catch (e) {
    console.warn('Failed to create BleManager instance');
  }
}

export const SafeBLE = {
  isAvailable: () => BleManager !== null && BlePeripheral !== null,
  
  startScan: async (onFrame: (from: string, frame: any) => void) => {
    if (!manager) {
      console.warn('BLE not available, scan not started');
      return;
    }
    try {
      manager.startDeviceScan(['0000ffff-0000-1000-8000-00805f9b34fb'], { allowDuplicates: true }, (_e: any, device: any) => {
        if (!device) {return;}
        const data = (device.serviceData && device.serviceData['0000ffff-0000-1000-8000-00805f9b34fb']) || device.manufacturerData;
        if (!data) {return;}
        try {
          const buf = Buffer.from(data, "base64");
          // Simple frame decode - you can implement your own logic here
          const frame = { data: buf.toString() };
          if (frame) {onFrame(device.id, frame);}
        } catch {}
      });
    } catch (e) {
      console.warn('BLE scan failed:', e);
    }
  },

  stopScan: async () => {
    if (!manager) {return;}
    try {
      manager.stopDeviceScan();
    } catch (e) {
      console.warn('BLE stop scan failed:', e);
    }
  },

  advertise: async (data: Uint8Array) => {
    if (!BlePeripheral) {
      console.warn('BLE peripheral not available, advertising not started');
      return;
    }
    try {
      await BlePeripheral.setName("AfetNet");
      await BlePeripheral.addService('0000ffff-0000-1000-8000-00805f9b34fb', true);
      await BlePeripheral.addCharacteristicToService(
        '0000ffff-0000-1000-8000-00805f9b34fb', "AF02",
        BlePeripheral.properties.READ, BlePeripheral.permissions.READABLE, []
      );
      await BlePeripheral.startAdvertising({
        serviceUuids: ['0000ffff-0000-1000-8000-00805f9b34fb'],
        manufacturerData: { companyId: 0xffff, bytes: Array.from(data) }
      });
    } catch (e) {
      console.warn('BLE advertising failed:', e);
    }
  },

  stopAdvertise: async () => {
    if (!BlePeripheral) {return;}
    try {
      await BlePeripheral.stopAdvertising();
    } catch (e) {
      console.warn('BLE stop advertising failed:', e);
    }
  }
};



