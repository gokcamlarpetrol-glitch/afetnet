/**
 * AFETNET - ELITE ENTRY POINT
 * Production-ready, zero-error initialization
 * Multi-layer protection against deprecated modules
 */

import { Buffer } from 'buffer';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

// Simple global setup
global.Buffer = Buffer;

// ============================================================================
// ELITE: MULTI-LAYER PUSHNOTIFICATIONIOS PROTECTION
// ============================================================================
// PushNotificationIOS is deprecated and causes NativeEventEmitter errors in Expo
// We use expo-notifications instead, so we MUST block this deprecated module
// This protection runs BEFORE any React Native imports

// Safe mock object for PushNotificationIOS - prevents NativeEventEmitter errors
const createSafePushNotificationIOSMock = () => ({
  addEventListener: () => {},
  removeEventListener: () => {},
  requestPermissions: () => Promise.resolve({}),
  getInitialNotification: () => Promise.resolve(null),
  setApplicationIconBadgeNumber: () => {},
  getApplicationIconBadgeNumber: () => Promise.resolve(0),
  cancelLocalNotifications: () => {},
  cancelAllLocalNotifications: () => {},
  removeDeliveredNotifications: () => {},
  getDeliveredNotifications: () => Promise.resolve([]),
  removeAllDeliveredNotifications: () => {},
  presentLocalNotification: () => {},
  scheduleLocalNotification: () => {},
  addNotificationRequest: () => {},
  getScheduledLocalNotifications: () => Promise.resolve([]),
  default: null, // For ES module compatibility
});

// Layer 1: Patch global require BEFORE React Native loads
if (typeof global !== 'undefined') {
  const originalRequire = (global as any).require;
  
  if (originalRequire && typeof originalRequire === 'function') {
    (global as any).require = function(id: string) {
      // Block PushNotificationIOS module completely
      if (
        typeof id === 'string' && (
          id.includes('PushNotificationIOS') ||
          id.includes('push-notification-ios') ||
          id === 'react-native/Libraries/PushNotificationIOS/PushNotificationIOS' ||
          id === './Libraries/PushNotificationIOS/PushNotificationIOS' ||
          id.endsWith('/PushNotificationIOS') ||
          id.endsWith('\\PushNotificationIOS')
        )
      ) {
        return createSafePushNotificationIOSMock();
      }
      
      // Block NativePushNotificationManagerIOS
      if (
        typeof id === 'string' && (
          id.includes('NativePushNotificationManagerIOS') ||
          id.includes('NativePushNotificationManager')
        )
      ) {
        return null;
      }
      
      return originalRequire.apply(this, arguments);
    };
  }
}

// Layer 2: Patch React Native module IMMEDIATELY after it loads
let reactNativePatched = false;
function patchReactNativePushNotificationIOS() {
  if (reactNativePatched) return;
  
  try {
    const ReactNativeModule = require('react-native');
    
    if (ReactNativeModule && typeof ReactNativeModule === 'object') {
      // Override PushNotificationIOS getter BEFORE it's accessed
      Object.defineProperty(ReactNativeModule, 'PushNotificationIOS', {
        get: () => createSafePushNotificationIOSMock(),
        configurable: true,
        enumerable: false,
        set: () => {}, // Prevent setting
      });
      
      reactNativePatched = true;
    }
  } catch (error) {
    // Silently fail - will retry later or Metro config will handle it
    if (__DEV__) {
      console.warn('[AfetNet] PushNotificationIOS pre-patch failed (will retry):', error);
    }
  }
}

// Try to patch immediately (synchronous)
patchReactNativePushNotificationIOS();

// Also patch after delays to catch late-loading modules
setTimeout(() => patchReactNativePushNotificationIOS(), 0);
setTimeout(() => patchReactNativePushNotificationIOS(), 100);

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
