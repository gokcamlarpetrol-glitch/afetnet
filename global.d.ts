/** Global shim for RN/Expo environment */
declare var DEV: boolean;
declare var global: any;

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
    requestDevice(options?: any): Promise<any>;
  }
  
  const Bluetooth: Bluetooth | undefined;
  
  namespace NodeJS {
    interface Global {
      atob: (input: string) => string;
      btoa: (input: string) => string;
      TextEncoder: typeof TextEncoder;
      TextDecoder: typeof TextDecoder;
    }
  }
}