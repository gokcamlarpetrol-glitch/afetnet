import { Platform } from "react-native";
import Constants from "expo-constants";
import { AFETNET_SERVICE_UUID, AFETNET_CHAR_MSG_UUID } from "./constants";

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
  return Constants.executionEnvironment === "storeClient";
};

class AfetBle {
  private static _instance: AfetBle;
  public manager: any;
  
  private constructor() {
    if (isExpoGo()) {
      console.log('🔧 BLE Mock Mode: Expo Go detected');
      this.manager = new MockBleManager();
    } else {
      try {
        // Dynamic import for development builds
        const { BleManager } = require('react-native-ble-plx');
        this.manager = new BleManager({
          restoreStateIdentifier: "afetnet-ble",
          restoreStateFunction: () => {},
        });
        console.log('🔧 BLE Native Mode: Development build detected');
      } catch (error) {
        console.log('🔧 BLE Mock Mode: Native module not available', error);
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
