/**
 * NATIVE MODULE AVAILABILITY CHECK
 * Safely check if native modules are available before using them
 */

import { createLogger } from './logger';

const logger = createLogger('NativeModuleCheck');

/**
 * Check if a native module is available
 * @param moduleName - The name of the module to check
 * @returns true if the module is available, false otherwise
 */
export function isNativeModuleAvailable(moduleName: string): boolean {
  try {
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
 * Pre-checked native modules availability
 * Use these constants to avoid repeated checks
 */
export const NATIVE_MODULES = {
  BLE: isNativeModuleAvailable('react-native-ble-plx'),
  SENSORS: isNativeModuleAvailable('expo-sensors'),
  LOCATION: isNativeModuleAvailable('expo-location'),
  NOTIFICATIONS: isNativeModuleAvailable('expo-notifications'),
  HAPTICS: isNativeModuleAvailable('expo-haptics'),
  BATTERY: isNativeModuleAvailable('expo-battery'),
  DEVICE: isNativeModuleAvailable('expo-device'),
  CRYPTO: isNativeModuleAvailable('expo-crypto'),
  SECURE_STORE: isNativeModuleAvailable('expo-secure-store'),
  FILE_SYSTEM: isNativeModuleAvailable('expo-file-system'),
};

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
 * Check if all critical native modules are available
 * @returns true if all critical modules are available
 */
export function areCriticalModulesAvailable(): boolean {
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

