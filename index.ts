/**
 * AFETNET - ELITE ENTRY POINT
 * Production-ready, zero-error initialization
 * Multi-layer protection against deprecated modules
 */

import { Buffer } from 'buffer';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

// CRITICAL: Setup mocks BEFORE any other imports to prevent NativeEventEmitter crashes
// This must run before any library that uses NativeEventEmitter is imported
import { setupNativeModuleMocks } from './src/core/utils/mockNativeModules';
setupNativeModuleMocks();

// Simple global setup
global.Buffer = Buffer;


// ============================================================================
// SIMPLIFIED PUSHNOTIFICATIONIOS PROTECTION
// ============================================================================
// Block deprecated PushNotificationIOS to prevent NativeEventEmitter errors

// Safe mock for PushNotificationIOS
const pushNotifMock = {
  addEventListener: () => { },
  removeEventListener: () => { },
  requestPermissions: () => Promise.resolve({}),
  getInitialNotification: () => Promise.resolve(null),
  setApplicationIconBadgeNumber: () => { },
  getApplicationIconBadgeNumber: () => Promise.resolve(0),
};

// Patch React Native module after it loads
try {
  const RN = require('react-native');
  if (RN && typeof RN === 'object') {
    Object.defineProperty(RN, 'PushNotificationIOS', {
      get: () => pushNotifMock,
      configurable: true,
      enumerable: false,
    });
  }
} catch (e) {
  // Silently fail
}


// ============================================================================
// ELITE: APP INITIALIZATION
// ============================================================================

// Import CoreApp from src/core/App
import CoreApp from './src/core/App';

// Use Expo's registerRootComponent for compatibility
import { registerRootComponent } from 'expo';

// ELITE: Production-ready error handling - no crashes, graceful degradation
try {
  registerRootComponent(CoreApp);
} catch (error) {
  // CRITICAL: Use logger instead of console.error for production
  try {
    const logger = require('./src/core/utils/logger').createLogger('AppEntry');
    logger.error('Failed to register root component:', error);

    // Fallback for React Native
    try {
      const { AppRegistry } = require('react-native');
      AppRegistry.registerComponent('main', () => CoreApp);
      logger.info('Fallback registration successful');
    } catch (fallbackError) {
      logger.error('Fallback registration also failed:', fallbackError);
      // CRITICAL: Don't throw - allow app to continue
    }
  } catch (loggerError) {
    // Last resort: use console
    console.error('[AfetNet] Failed to register root component:', error);
    try {
      const { AppRegistry } = require('react-native');
      AppRegistry.registerComponent('main', () => CoreApp);
    } catch (e) {
      // Absolute last resort - app will still try to load
    }
  }
}
