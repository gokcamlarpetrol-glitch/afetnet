import { Platform, PermissionsAndroid } from "react-native";
import { logger } from '../utils/productionLogger';
import { NEARBY_SERVICE_UUID } from "./constants";

// Safe BLE manager to prevent crashes when native modules are not available
let BleManager: any = null;
let manager: any = null;

try {
  const blePlx = require("react-native-ble-plx");
  BleManager = blePlx.BleManager;
  // Don't create manager immediately, create it when needed
} catch (e) {
  logger.warn("react-native-ble-plx not available, using fallback");
}

export async function ensureBlePermissions() {
  if (Platform.OS === "android") {
    const perms = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    ];
    for (const p of perms){
      await PermissionsAndroid.request(p);
    }
  }
}

export type NearbyEntry = {
  id: string;
  name?: string | null;
  rssi?: number | null;
  proximity: "yakın" | "orta" | "uzak" | "bilinmiyor";
};

export function rssiToBucket(rssi?: number | null): NearbyEntry["proximity"] {
  if (rssi == null) {return "bilinmiyor";}
  if (rssi >= -60) {return "yakın";}
  if (rssi >= -80) {return "orta";}
  return "uzak";
}

export function scan(callback:(d:NearbyEntry)=>void) {
  if (!BleManager) {
    logger.warn("BLE Manager not available, cannot start scan");
    return () => {};
  }
  
  // Create manager if not exists
  if (!manager) {
    try {
      manager = new BleManager();
    } catch (e) {
      logger.warn("Failed to create BLE manager:", e);
      return () => {};
    }
  }
  
  try {
    const { ScanMode } = require("react-native-ble-plx");
    manager.startDeviceScan([NEARBY_SERVICE_UUID], { scanMode: ScanMode.LowLatency }, (error: Error | unknown, device: any) => {
      if (error) {return;}
      if (!device) {return;}
      const entry: NearbyEntry = {
        id: device.id,
        name: device.name,
        rssi: device.rssi,
        proximity: rssiToBucket(device.rssi)
      };
      callback(entry);
    });
    return () => {
      try {
        manager.stopDeviceScan();
      } catch (e) {
        logger.warn("Failed to stop BLE scan:", e);
      }
    };
  } catch (e) {
    logger.warn("Failed to start BLE scan:", e);
    return () => {};
  }
}

// NOTE: Advertising from JS is limited; react-native-ble-plx is central-only on iOS.
// For Android we rely on the config plugin enabling peripheral; actual advertising can be added later with a native helper.
// For now, we expose a stub to reflect platform limits.
export async function startAdvertisingStub() {
  // TODO: implement with react-native-ble-peripheral (native) in later phase for Android.
  throw new Error(Platform.OS === "ios"
    ? "iOS: Uygulama ön planda yalnızca tarama desteklenir."
    : "Android: Reklam (advertise) ileriki fazda etkinleştirilecek.");
}

