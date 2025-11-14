/**
 * NATIVE MODULE AVAILABILITY CHECK
 * Safely check if native modules are available before using them
 */

import { createLogger } from './logger';

const logger = createLogger('NativeModuleCheck');

/**
 * ELITE: Check if a native module is available (async to prevent bundling-time loading)
 * @param moduleName - The name of the module to check
 * @returns true if the module is available, false otherwise
 */
export async function isNativeModuleAvailableAsync(moduleName: string): Promise<boolean> {
  try {
    // ELITE: Use eval to prevent static analysis for expo-notifications
    // CRITICAL: Never use string literal 'expo-notifications' - Metro bundler detects it
    const expoPart = 'expo';
    const notificationsPart = 'notifications';
    const expoNotificationsName = expoPart + '-' + notificationsPart;
    
    if (moduleName === expoNotificationsName || moduleName.includes('notification')) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // ELITE: Build module name dynamically to prevent Metro static analysis
      const moduleNameEval = expoPart + '-' + notificationsPart;
      const module = eval(`require('${moduleNameEval}')`);
      return module !== null && module !== undefined;
    }
    const module = require(moduleName);
    return module !== null && module !== undefined;
  } catch (error) {
    if (__DEV__) {
      logger.warn(`Native module '${moduleName}' not available:`, error);
    }
    return false;
  }
}

/**
 * ELITE: Pre-checked native modules availability (lazy initialization)
 * CRITICAL: NOTIFICATIONS is set to false initially to prevent bundling-time loading
 * Use isNativeModuleAvailableAsync() for runtime checks
 */
export const NATIVE_MODULES = {
  BLE: false, // Will be checked at runtime
  SENSORS: false,
  LOCATION: false,
  NOTIFICATIONS: false, // CRITICAL: Set to false to prevent bundling-time loading
  HAPTICS: false,
  BATTERY: false,
  DEVICE: false,
  CRYPTO: false,
  SECURE_STORE: false,
  FILE_SYSTEM: false,
};

// Initialize modules at runtime (not at module load time)
let modulesInitialized = false;
export async function initializeNativeModules() {
  if (modulesInitialized) return;
  
  try {
    NATIVE_MODULES.BLE = await isNativeModuleAvailableAsync('react-native-ble-plx');
    NATIVE_MODULES.SENSORS = await isNativeModuleAvailableAsync('expo-sensors');
    NATIVE_MODULES.LOCATION = await isNativeModuleAvailableAsync('expo-location');
    // ELITE: Build module name dynamically to prevent Metro static analysis
    const expoPart = 'expo';
    const notificationsPart = 'notifications';
    const expoNotificationsName = expoPart + '-' + notificationsPart;
    NATIVE_MODULES.NOTIFICATIONS = await isNativeModuleAvailableAsync(expoNotificationsName);
    NATIVE_MODULES.HAPTICS = await isNativeModuleAvailableAsync('expo-haptics');
    NATIVE_MODULES.BATTERY = await isNativeModuleAvailableAsync('expo-battery');
    NATIVE_MODULES.DEVICE = await isNativeModuleAvailableAsync('expo-device');
    NATIVE_MODULES.CRYPTO = await isNativeModuleAvailableAsync('expo-crypto');
    NATIVE_MODULES.SECURE_STORE = await isNativeModuleAvailableAsync('expo-secure-store');
    NATIVE_MODULES.FILE_SYSTEM = await isNativeModuleAvailableAsync('expo-file-system');
    
    modulesInitialized = true;
  } catch (error) {
    logger.error('Failed to initialize native modules:', error);
  }
}

/**
 * Log all native module availability (useful for debugging)
 */
export function logNativeModuleStatus() {
  if (__DEV__) {
    logger.info('Native Module Availability:');
    Object.entries(NATIVE_MODULES).forEach(([name, available]) => {
      logger.info(`  ${name}: ${available ? '✅' : '❌'}`);
    });
  }
}

/**
 * Check if all critical native modules are available (async)
 * @returns true if all critical modules are available
 */
export async function areCriticalModulesAvailable(): Promise<boolean> {
  await initializeNativeModules();
  const critical = [
    NATIVE_MODULES.NOTIFICATIONS,
    NATIVE_MODULES.LOCATION,
    NATIVE_MODULES.CRYPTO,
  ];
  
  const allAvailable = critical.every(available => available);
  
  if (!allAvailable && __DEV__) {
    logger.warn('Some critical native modules are not available');
  }
  
  return allAvailable;
}

/**
 * Get a list of unavailable modules
 * @returns Array of module names that are not available
 */
export function getUnavailableModules(): string[] {
  return Object.entries(NATIVE_MODULES)
    .filter(([_, available]) => !available)
    .map(([name]) => name);
}

