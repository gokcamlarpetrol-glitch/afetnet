// Safe Barcode Scanner wrapper using expo-camera (modern API)
import { logger } from '../utils/productionLogger';

// Import expo-camera modules
let Camera: any = null;
let useCameraPermissions: any = null;
let isExpoGo = false;

// Detect Expo Go environment
try {
  const Constants = (globalThis as any).require('expo-constants');
  isExpoGo = Constants.default?.executionEnvironment === 'storeClient';
} catch {
  // Ignore
}

// Only try to import camera if NOT in Expo Go
if (!isExpoGo) {
  try {
    const cameraModule = require('expo-camera');
    Camera = cameraModule;
    useCameraPermissions = cameraModule.useCameraPermissions;
  } catch {
    logger.warn('expo-camera not available');
  }
} else {
  logger.warn('Expo Go detected - skipping camera import');
}

export const SafeBarcodeScanner = {
  isAvailable: () => Camera !== null,
  
  // Expose CameraView component for modern API
  CameraView: Camera?.CameraView || null,
  
  // Legacy BarCodeScanner compatibility wrapper
  Component: Camera?.CameraView || null, // For backward compatibility
  
  // Permission hook for modern API
  useCameraPermissions: useCameraPermissions || null,
  
  requestPermissionsAsync: async () => {
    if (!Camera) {
      logger.warn('Camera not available, returning denied permission');
      return { status: 'denied' };
    }
    try {
      // Modern expo-camera API
      if (Camera.useCameraPermissions) {
        logger.warn('Use useCameraPermissions hook instead');
        return { status: 'undetermined' };
      }
      return { status: 'granted' };
    } catch (error) {
      logger.warn('Camera permission request failed:', error);
      return { status: 'denied' };
    }
  },

  getPermissionsAsync: async () => {
    if (!Camera) {
      logger.warn('Camera not available, returning denied permission');
      return { status: 'denied' };
    }
    try {
      return { status: 'granted' };
    } catch (error) {
      logger.warn('Camera permission check failed:', error);
      return { status: 'denied' };
    }
  },

  Constants: {
    BarCodeType: {
      qr: 'qr',
      pdf417: 'pdf417',
      aztec: 'aztec',
      codabar: 'codabar',
      code39: 'code39',
      code93: 'code93',
      code128: 'code128',
      ean8: 'ean8',
      ean13: 'ean13',
      itf14: 'itf14',
      upc_e: 'upc_e',
      upc_a: 'upc_a',
    },
  },
};
