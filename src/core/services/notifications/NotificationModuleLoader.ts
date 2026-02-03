/**
 * NOTIFICATION MODULE LOADER - ELITE EDITION
 * Zero bundling-time dependencies for native modules
 * 
 * CRITICAL: This module handles all expo-notifications loading
 * with proper error handling and retry logic
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('NotificationModuleLoader');

// Module state management
let NotificationsModule: any = null;
let isModuleLoading = false;
let moduleLoadPromise: Promise<any> | null = null;
let loadAttempts = 0;

const MAX_LOAD_ATTEMPTS = 5;
const INITIAL_DELAY = 2000;
const RETRY_DELAY_BASE = 1000;

/**
 * ELITE: Check if React Native bridge is ready
 */
async function isNativeBridgeReady(): Promise<boolean> {
  try {
    const RN = require('react-native');
    if (!RN || typeof RN !== 'object') return false;

    const NativeModules = RN.NativeModules;
    if (!NativeModules || typeof NativeModules !== 'object') return false;

    const moduleKeys = Object.keys(NativeModules);
    if (moduleKeys.length === 0) return false;

    const hasExpoModules = moduleKeys.some(key =>
      key.includes('Expo') ||
            key.includes('Location') ||
            key.includes('Camera'),
    );

    return hasExpoModules;
  } catch (e) {
    return false;
  }
}

/**
 * ELITE: Wait for native bridge with timeout
 */
async function waitForNativeBridge(maxWaitMs: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 200;

  while (Date.now() - startTime < maxWaitMs) {
    if (await isNativeBridgeReady()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (await isNativeBridgeReady()) {
        return true;
      }
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  return false;
}

/**
 * ELITE: Load notifications module dynamically
 */
async function loadNotificationsModule(): Promise<any> {
  if (NotificationsModule) {
    return NotificationsModule;
  }

  if (isModuleLoading && moduleLoadPromise) {
    return moduleLoadPromise;
  }

  if (loadAttempts >= MAX_LOAD_ATTEMPTS) {
    if (__DEV__ && loadAttempts === MAX_LOAD_ATTEMPTS) {
      logger.debug('Max load attempts reached - notifications disabled');
    }
    return null;
  }

  isModuleLoading = true;
  loadAttempts++;

  moduleLoadPromise = (async () => {
    try {
      const bridgeReady = await waitForNativeBridge(INITIAL_DELAY + (loadAttempts * 500));
      if (!bridgeReady && loadAttempts < MAX_LOAD_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * loadAttempts));
        isModuleLoading = false;
        moduleLoadPromise = null;
        return loadNotificationsModule();
      }

      if (!bridgeReady) {
        if (__DEV__) {
          logger.debug('Native bridge not ready - notifications disabled');
        }
        return null;
      }

      // Dynamic import
      let module: any = null;
      try {
        const moduleName = 'expo-notifications';
        const importedModule = await import(moduleName);
        module = importedModule.default || importedModule;

        if (!module || typeof module !== 'object') {
          throw new Error('Module loaded but invalid structure');
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (importError: unknown) {
        if (loadAttempts < MAX_LOAD_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * loadAttempts));
          isModuleLoading = false;
          moduleLoadPromise = null;
          return loadNotificationsModule();
        }
        throw importError;
      }

      // Validate module structure
      const requiredMethods = ['scheduleNotificationAsync', 'getPermissionsAsync'];
      for (const method of requiredMethods) {
        if (typeof module[method] !== 'function') {
          throw new Error(`Missing required method: ${method}`);
        }
      }

      NotificationsModule = module;
      isModuleLoading = false;

      if (__DEV__) {
        logger.debug('✅ Notifications module loaded successfully');
      }

      return module;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';

      const isNativeEventEmitterError =
                errorMsg.includes('NativeEventEmitter') ||
                errorMsg.includes('requires a non-null argument') ||
                (errorStack && errorStack.includes('NativeEventEmitter'));

      if (isNativeEventEmitterError && loadAttempts < MAX_LOAD_ATTEMPTS) {
        const retryDelay = RETRY_DELAY_BASE * Math.pow(2, loadAttempts - 1);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        isModuleLoading = false;
        moduleLoadPromise = null;
        return loadNotificationsModule();
      }

      if (loadAttempts < MAX_LOAD_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * loadAttempts));
        isModuleLoading = false;
        moduleLoadPromise = null;
        return loadNotificationsModule();
      }

      logger.error('Failed to load notifications module:', error);
      isModuleLoading = false;
      return null;
    }
  })();

  return moduleLoadPromise;
}

/**
 * ELITE: Get notifications module (async - ensures loading)
 */
export async function getNotificationsAsync(): Promise<any> {
  return loadNotificationsModule();
}

/**
 * ELITE: Check if notifications are available
 */
export async function isNotificationsAvailable(): Promise<boolean> {
  const module = await getNotificationsAsync();
  return module !== null;
}

/**
 * ELITE: Reset module state (for testing)
 */
export function resetModuleState(): void {
  NotificationsModule = null;
  isModuleLoading = false;
  moduleLoadPromise = null;
  loadAttempts = 0;
}
