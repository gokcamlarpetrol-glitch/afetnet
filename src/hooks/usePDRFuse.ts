import * as Location from 'expo-location';
import { logger } from '../utils/productionLogger';
import { useEffect, useState } from 'react';

interface Position {
  lat: number;
  lon: number;
  accuracy?: number;
  timestamp: number;
}

export function usePDRFuse() {
  const [currentPos, setCurrentPos] = useState<Position | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      try {
        // Request permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Konum izni verilmedi');
          return;
        }

        // Check if location services are enabled
        const isEnabled = await Location.hasServicesEnabledAsync();
        if (!isEnabled) {
          setError('Konum servisleri kapalı');
          return;
        }

        // Start location tracking
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000, // 1 second
            distanceInterval: 1, // 1 meter
          },
          (location) => {
            setCurrentPos({
              lat: location.coords.latitude,
              lon: location.coords.longitude,
              accuracy: location.coords.accuracy || undefined,
              timestamp: location.timestamp,
            });
            setError(null);
          },
        );

        setIsTracking(true);
      } catch (err) {
        logger.error('Location tracking error:', err);
        setError('Konum takibi başlatılamadı');
      }
    };

    startTracking();

    return () => {
      if (subscription) {
        subscription.remove();
        setIsTracking(false);
      }
    };
  }, []);

  const getLastKnownPosition = async (): Promise<Position | null> => {
    try {
      const location = await Location.getLastKnownPositionAsync({
        maxAge: 60000, // 1 minute
        requiredAccuracy: 100, // 100 meters
      });

      if (location) {
        return {
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          accuracy: location.coords.accuracy || undefined,
          timestamp: location.timestamp,
        };
      }
    } catch (err) {
      logger.error('Failed to get last known position:', err);
    }
    return null;
  };

  const requestCurrentPosition = async (): Promise<Position | null> => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 30000, // 30 seconds
      });

      return {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };
    } catch (err) {
      logger.error('Failed to get current position:', err);
      return null;
    }
  };

  return {
    currentPos,
    isTracking,
    error,
    getLastKnownPosition,
    requestCurrentPosition,
  };
}