/** Global shim for RN/Expo environment */
declare var DEV: boolean;
declare var global: typeof globalThis & {
  RNDeviceInfoSDK_INT?: string;
  EXPO_DEVICE_OWNER?: string;
  ExpoDeviceInfoSDK_INT?: string;
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_DEV_SIM?: string;
  [key: string]: any;
};

// React Native specific globals
declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.jpg' {
  const value: any;
  export default value;
}

declare module '*.jpeg' {
  const value: any;
  export default value;
}

declare module '*.gif' {
  const value: any;
  export default value;
}

declare module '*.svg' {
  const value: any;
  export default value;
}

// Expo FileSystem extended types
declare module 'expo-file-system' {
  export * from 'expo-file-system/build/index';
  export const bundleDirectory: string | null;
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  
  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }
  
  export type EncodingTypeString = 'utf8' | 'base64';
}

// Global browser APIs for React Native
declare module '*.json' {
  const value: any;
  export default value;
}

declare global {
  const atob: (input: string) => string;
  const btoa: (input: string) => string;

  class TextEncoder {
    encode(input: string): Uint8Array;
  }

  class TextDecoder {
    decode(input: Uint8Array): string;
  }

  interface Bluetooth {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  }

  interface RequestDeviceOptions {
    filters?: BluetoothFilter[];
    optionalServices?: string[];
  }

  interface BluetoothFilter {
    services?: string[];
    name?: string;
    namePrefix?: string;
  }

  interface BluetoothDevice {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
  }

  interface BluetoothRemoteGATTServer {
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    connected: boolean;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTCharacteristic {
    readValue(): Promise<DataView>;
    writeValue(value: ArrayBuffer): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
  }

  const fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  const AbortController: typeof AbortController;
  const URL: typeof URL;
  const crypto: Crypto;
  const NodeJS: typeof NodeJS;
  const require: (id: string) => any;
  const __DEV__: boolean;
  
  // Jest globals
  const describe: (name: string, fn: () => void) => void;
  const it: (name: string, fn: () => void) => void;
  const beforeEach: (fn: () => void) => void;
  const afterEach: (fn: () => void) => void;
  const beforeAll: (fn: () => void) => void;
  const afterAll: (fn: () => void) => void;
  const expect: (actual: any) => any;
  const jest: any;
  const ErrorUtils: {
    getGlobalHandler(): (error: Error, isFatal?: boolean) => void;
    setGlobalHandler(handler: (error: Error, isFatal?: boolean) => void): void;
  };
  
  namespace globalThis {
    const NodeJS: typeof NodeJS;
    const ErrorUtils: {
      getGlobalHandler(): (error: Error, isFatal?: boolean) => void;
      setGlobalHandler(handler: (error: Error, isFatal?: boolean) => void): void;
    };
  }
  
  namespace NodeJS {
    interface Global {
      atob: (input: string) => string;
      btoa: (input: string) => string;
      TextEncoder: typeof TextEncoder;
      TextDecoder: typeof TextDecoder;
    }
    
    type Timeout = number;
  }

  // React Native specific types
  interface PlatformStatic {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    Version: string | number;
    select<T>(obj: { ios?: T; android?: T; default?: T }): T;
    constants: {
      [key: string]: any;
    };
  }

  interface PermissionsAndroidStatic {
    request(permission: string, rationale?: any): Promise<string>;
    requestMultiple(permissions: string[]): Promise<{[key: string]: string}>;
    check(permission: string): Promise<boolean>;
  }

  interface DimensionsStatic {
    get(dimension: 'window' | 'screen'): { width: number; height: number };
    addEventListener(type: string, handler: () => void): void;
    removeEventListener(type: string, handler: () => void): void;
  }

  interface StatusBarStatic {
    setBarStyle(style: 'default' | 'light-content' | 'dark-content'): void;
    setBackgroundColor(color: string): void;
    setTranslucent(translucent: boolean): void;
  }

  const Platform: PlatformStatic;
  const PermissionsAndroid: PermissionsAndroidStatic;
  const Dimensions: DimensionsStatic;
  const StatusBar: StatusBarStatic;

  // Node.js Timer types for React Native
  interface Timer {
    ref(): void;
    unref(): void;
  }

  const setTimeout: (handler: (...args: any[]) => void, timeout: number, ...args: any[]) => number;
  const clearTimeout: (timeoutId: number) => void;
  const setInterval: (handler: (...args: any[]) => void, timeout: number, ...args: any[]) => number;
  const clearInterval: (intervalId: number) => void;
  const setImmediate: (callback: (...args: any[]) => void, ...args: any[]) => number;
  const clearImmediate: (immediateId: number) => void;

  // BLE specific types
  interface BLEState {
    state: 'unknown' | 'resetting' | 'unsupported' | 'unauthorized' | 'poweredOff' | 'poweredOn';
  }

  interface BLEDevice {
    id: string;
    name?: string;
    rssi?: number;
    advertising?: any;
    serviceUUIDs?: string[];
    isConnectable?: boolean;
  }

  interface BLECharacteristic {
    uuid: string;
    value?: string;
    isReadable?: boolean;
    isWritableWithResponse?: boolean;
    isWritableWithoutResponse?: boolean;
    isNotifiable?: boolean;
    isNotifying?: boolean;
    isIndicatable?: boolean;
  }

  interface BLEService {
    uuid: string;
    isPrimary?: boolean;
    characteristics?: BLECharacteristic[];
  }

  interface BLEManager {
    state(): Promise<BLEState['state']>;
    startDeviceScan(UUIDs?: string[], options?: any, listener?: (error: any, device: BLEDevice) => void): void;
    stopDeviceScan(): void;
    connect(deviceId: string): Promise<void>;
    disconnect(deviceId: string): Promise<void>;
    discoverAllServicesAndCharacteristics(deviceId: string): Promise<void>;
    services(deviceId: string): Promise<string[]>;
    characteristics(deviceId: string, serviceUUID: string): Promise<string[]>;
    readCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string): Promise<any>;
    writeCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string, value: any): Promise<void>;
    onStateChange(listener: (state: BLEState['state']) => void): any;
  }
}