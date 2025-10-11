import { Platform } from 'react-native';
import { logger } from '../utils/productionLogger';

export interface LocationData {
  lat: number;
  lon: number;
  ts: number;
  acc?: number;
}

export async function getCurrentPositionSafe(): Promise<LocationData | null> {
  try {
    // In simulator mode, return fixed coordinates for Beşiktaş, Istanbul
    if (Platform.OS === 'ios' && Platform.isPad === false && Platform.isTV === false) {
      return {
        lat: 41.043,
        lon: 29.009,
        ts: Date.now(),
        acc: 10, // 10 meter accuracy
      };
    }

    // For real devices, try to get actual location
    const { getCurrentPositionAsync, requestForegroundPermissionsAsync } = await import('expo-location');
    
    const { status } = await requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      logger.warn('Location permission not granted');
      return null;
    }

    const location = await getCurrentPositionAsync({});
    return {
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      ts: location.timestamp,
      acc: location.coords.accuracy || undefined,
    };
  } catch (error) {
    logger.warn('Failed to get location:', error);
    return null;
  }
}

export function getSimulatorLocation(): LocationData {
  return {
    lat: 41.043, // Beşiktaş, Istanbul
    lon: 29.009,
    ts: Date.now(),
    acc: 10,
  };
}
