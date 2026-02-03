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
    // ELITE: Use safe dynamic imports for all Expo modules
    // Map module names to dynamic imports (eliminates eval security risk)
    const moduleLoaders: Record<string, () => Promise<unknown>> = {
      'expo-notifications': () => import('expo-notifications'),
      'expo-sensors': () => import('expo-sensors'),
      'expo-location': () => import('expo-location'),
      'expo-haptics': () => import('expo-haptics'),
      'expo-battery': () => import('expo-battery'),
      'expo-device': () => import('expo-device'),
      'expo-crypto': () => import('expo-crypto'),
      'expo-secure-store': () => import('expo-secure-store'),
      'expo-file-system': () => import('expo-file-system'),
      'react-native-ble-plx': () => import('react-native-ble-plx'),
    };

    const loader = moduleLoaders[moduleName];
    if (loader) {
      const module = await loader();
      return module !== null && module !== undefined;
    }

    // Fallback for other modules (require is still needed for some npm modules)
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

