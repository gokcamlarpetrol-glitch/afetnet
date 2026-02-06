import { createLogger } from './logger';
import {
  getDeviceId as getSharedDeviceId,
  setDeviceId as setSharedDeviceId,
  clearDeviceId as clearSharedDeviceId,
} from '../../lib/device';

const logger = createLogger('Device');

/**
 * Single source of truth for device ID.
 * This wrapper keeps backward compatibility for older imports under core/utils.
 */
export async function getDeviceId(): Promise<string> {
  try {
    return await getSharedDeviceId();
  } catch (error) {
    logger.error('Error getting device ID:', error);
    // Fallback to random ID (not persisted)
    return `AFN-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Manually set the Device ID (e.g. link to User Account)
 */
export async function setDeviceId(id: string): Promise<void> {
  try {
    await setSharedDeviceId(id);
    logger.info(`Device ID updated to: ${id.toUpperCase()}`);
  } catch (error) {
    logger.error('Error setting device ID:', error);
  }
}

/**
 * Clear device ID (for testing)
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await clearSharedDeviceId();
  } catch (error) {
    logger.error('Error clearing device ID:', error);
  }
}
