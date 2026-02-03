/**
 * USE COMPASS HOOK
 * React hook for device compass/magnetometer
 */

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('useCompass');

interface CompassData {
    heading: number; // 0-360 degrees (0 = North)
    accuracy: number;
    isAvailable: boolean;
    error: string | null;
}

interface UseCompassOptions {
    updateInterval?: number; // ms
    enabled?: boolean;
}

export function useCompass(options: UseCompassOptions = {}): CompassData {
  const { updateInterval = 100, enabled = true } = options;

  const [compassData, setCompassData] = useState<CompassData>({
    heading: 0,
    accuracy: 0,
    isAvailable: false,
    error: null,
  });

  const updateHeading = useCallback(async () => {
    try {
      // Dynamic import to prevent bundling issues
      const Magnetometer = await import('expo-sensors').then(m => m.Magnetometer);

      if (!Magnetometer) {
        setCompassData(prev => ({
          ...prev,
          isAvailable: false,
          error: 'Magnetometer not available',
        }));
        return null;
      }

      const isAvailable = await Magnetometer.isAvailableAsync();
      if (!isAvailable) {
        setCompassData(prev => ({
          ...prev,
          isAvailable: false,
          error: 'Magnetometer not available on this device',
        }));
        return null;
      }

      Magnetometer.setUpdateInterval(updateInterval);

      const subscription = Magnetometer.addListener(({ x, y }) => {
        // Calculate heading from magnetometer data
        let heading = Math.atan2(y, x) * (180 / Math.PI);
        if (heading < 0) {
          heading += 360;
        }

        setCompassData({
          heading: Math.round(heading),
          accuracy: 1, // Simplified accuracy
          isAvailable: true,
          error: null,
        });
      });

      return subscription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (__DEV__) {
        logger.debug('Compass error:', errorMessage);
      }
      setCompassData(prev => ({
        ...prev,
        isAvailable: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [updateInterval]);

  useEffect(() => {
    if (!enabled) return;

    let subscription: { remove: () => void } | null = null;

    updateHeading().then(sub => {
      subscription = sub;
    });

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [enabled, updateHeading]);

  return compassData;
}

export default useCompass;
