// Safe Barcode Scanner wrapper to prevent crashes when native modules are not available
let BarcodeScanner: any = null;
let isExpoGo = false;

// Detect Expo Go environment FIRST
try {
  const Constants = require('expo-constants');
  isExpoGo = Constants.default?.executionEnvironment === 'storeClient';
} catch (e) {
  // Ignore
}

// Only try to import barcode scanner if NOT in Expo Go
if (!isExpoGo) {
  try {
    BarcodeScanner = require('expo-barcode-scanner');
  } catch (e) {
    console.warn('expo-barcode-scanner not available');
  }
} else {
  console.warn('Expo Go detected - skipping barcode scanner import');
}

export const SafeBarcodeScanner = {
  isAvailable: () => BarcodeScanner !== null,
  
  requestPermissionsAsync: async () => {
    if (!BarcodeScanner) {
      console.warn('Barcode scanner not available, returning denied permission');
      return { status: 'denied' };
    }
    try {
      return await BarcodeScanner.requestPermissionsAsync();
    } catch (e) {
      console.warn('Barcode scanner permission request failed:', e);
      return { status: 'denied' };
    }
  },

  getPermissionsAsync: async () => {
    if (!BarcodeScanner) {
      console.warn('Barcode scanner not available, returning denied permission');
      return { status: 'denied' };
    }
    try {
      return await BarcodeScanner.getPermissionsAsync();
    } catch (e) {
      console.warn('Barcode scanner permission check failed:', e);
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
      upc_a: 'upc_a'
    }
  }
};



