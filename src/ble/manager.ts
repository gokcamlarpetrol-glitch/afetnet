// import { Platform } from "react-native"; // Not used
import { logger } from '../utils/productionLogger';
// import Constants from "expo-constants"; // Not used
// import { AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID } from "./constants"; // Not used

// Mock BLE Manager for Expo Go compatibility
class MockBleManager {
  async state() {
    return 'PoweredOn';
  }
  
  onStateChange() {
    return { remove: () => {} };
  }
  
  startDeviceScan() {}
  
  stopDeviceScan() {}
  
  connectToDevice() {
    return Promise.reject(new Error('BLE not available in Expo Go'));
  }
}

// Check if we're in Expo Go (no native modules available)
const isExpoGo = () => {
  // Simplified check without Constants
  return typeof globalThis !== 'undefined' && (globalThis as any).location?.hostname === 'localhost';
};

class AfetBle {
  private static _instance: AfetBle;
  public manager: any;
  
  private constructor() {
    if (isExpoGo()) {
      logger.debug('🔧 BLE Mock Mode: Expo Go detected');
      this.manager = new MockBleManager();
    } else {
      try {
        // Dynamic import for development builds
        const { BleManager } = require('react-native-ble-plx');
        this.manager = new BleManager({
          restoreStateIdentifier: "afetnet-ble",
          restoreStateFunction: () => {},
        });
        logger.debug('🔧 BLE Native Mode: Development build detected');
      } catch (error) {
        logger.debug('🔧 BLE Mock Mode: Native module not available', error);
        this.manager = new MockBleManager();
      }
    }
  }
  
  static get instance() {
    if (!this._instance) this._instance = new AfetBle();
    return this._instance;
  }
  
  isMock() {
    return isExpoGo();
  }
}

export const ble = AfetBle.instance.manager;
export const isBleMock = () => AfetBle.instance.isMock();
