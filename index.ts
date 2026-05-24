/**
 * AFETNET - ELITE ENTRY POINT
 * Production-ready, zero-error initialization
 * Multi-layer protection against deprecated modules
 */

// CRITICAL: Buffer polyfill MUST use dynamic require, NOT static import
// Static import of 'buffer' crashes Hermes on iOS with:
// "Cannot read property 'prototype' of undefined"
try {
  const { Buffer: BufferPolyfill } = require('buffer');
  if (BufferPolyfill) {
    (global as any).Buffer = BufferPolyfill;
  }
} catch (e) {
  // Buffer polyfill failed — app continues without it
}

import 'react-native-gesture-handler';
import 'react-native-get-random-values';

// ============================================================================
// EARLY TASK MANAGER DEFINITIONS (CRITICAL - must be defined before app starts)
// ============================================================================
// Background tasks MUST be defined at top-level, outside of any component,
// before the app is registered. Otherwise iOS will execute tasks before they're defined.

import * as TaskManager from 'expo-task-manager';

const TASK_EEW_FETCH = 'AFETNET_EEW_BACKGROUND_FETCH';
const TASK_EEW_LOCATION = 'AFETNET_EEW_LOCATION_TASK';

// Define EEW background tasks with full implementations
// These MUST be defined at top-level before app registration for iOS background execution
try {
  const { backgroundEEWService } = require('./src/core/services/BackgroundEEWService');
  backgroundEEWService.defineBackgroundTasksEarly();
} catch {
  // Fallback stubs if BackgroundEEWService fails to load
  if (!TaskManager.isTaskDefined(TASK_EEW_FETCH)) {
    TaskManager.defineTask(TASK_EEW_FETCH, async () => 2);
  }
  if (!TaskManager.isTaskDefined(TASK_EEW_LOCATION)) {
    TaskManager.defineTask(TASK_EEW_LOCATION, async () => {});
  }
}


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

// FAZ 1 TIER1-06: Background FCM handler — killed-app data-only push delivery.
// Without this, FCM data-only push (no `notification` block, `content-available:1`
// only) silently drops on killed Android; iOS throttles after a few attempts.
// MUST be registered BEFORE registerRootComponent — Firebase JS layer requires
// this for the handler to fire on subsequent killed-app push events.
//
// Conservative: headless JS context can't write Firestore (no auth), can't mutate
// React stores. ONLY safe action = schedule local notification → user gets banner +
// emergency-alert.wav → on tap, app opens and processes the SOS data normally.
//
// try/catch wrapped: if messaging module missing (older binary, simulator), the
// app continues without background handler — no crash, foreground push path
// (expo-notifications) still works.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messaging = require('@react-native-firebase/messaging').default;
  if (messaging && typeof messaging === 'function') {
    messaging().setBackgroundMessageHandler(async (remoteMessage: {
      data?: Record<string, string>;
      notification?: { title?: string; body?: string };
      messageId?: string;
    }) => {
      try {
        const data = remoteMessage?.data ?? {};
        const type = String(data.type ?? '').toLowerCase();
        const messageId = remoteMessage.messageId ?? String(data.signalId ?? '');

        // SOS types — show emergency local notif immediately
        if (['sos', 'sos_family', 'family_sos', 'sos_proximity', 'nearby_sos'].includes(type)) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { scheduleNotificationAsync } = require('expo-notifications');
          await scheduleNotificationAsync({
            content: {
              title: `SOS: ${String(data.senderName ?? data.from ?? 'Bilinmeyen')}`,
              body: String(data.message ?? 'Acil yardım gerekiyor!'),
              data: { type, signalId: String(data.signalId ?? messageId), ...data },
              sound: 'emergency-alert.wav',
              priority: 'max',
            },
            trigger: null,
          });
        } else if (['eew', 'earthquake'].includes(type)) {
          // EEW types — show critical local notif
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { scheduleNotificationAsync } = require('expo-notifications');
          const mag = data.magnitude ? `M${String(data.magnitude)}` : '';
          const loc = data.location ? String(data.location) : '';
          await scheduleNotificationAsync({
            content: {
              title: `Deprem Uyarısı ${mag}`.trim(),
              body: loc || 'Deprem erken uyarı sistemi tetiklendi',
              data: { type, ...data },
              sound: 'emergency-alert.wav',
              priority: 'max',
            },
            trigger: null,
          });
        }
        // chat/message/family/news: NO action — display notification (sent with
        // top-level notification block) already shows banner via OS path; app
        // processes data on tap.
      } catch {
        // Headless handler swallows errors — fall through to OS default.
      }
    });
  }
} catch {
  // @react-native-firebase/messaging unavailable (simulator, older binary) —
  // foreground path (expo-notifications) handles all received pushes normally.
}

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
