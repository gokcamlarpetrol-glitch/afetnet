import { useState, useEffect } from 'react';
import * as Sensors from 'expo-sensors';

interface CompassData {
  heading: number;
  accuracy: number | null;
}

export function useCompass() {
  const [compassData, setCompassData] = useState<CompassData | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Check if magnetometer is available
    const checkAvailability = async () => {
      const isAvailable = await Sensors.Magnetometer.isAvailableAsync();
      setIsAvailable(isAvailable);
      
      if (isAvailable) {
        // Set update interval
        Sensors.Magnetometer.setUpdateInterval(100);
        
        // Subscribe to magnetometer updates
        const subscription = Sensors.Magnetometer.addListener(({ x, y }) => {
          // Calculate heading from magnetometer data
          let heading = Math.atan2(y, x) * (180 / Math.PI);
          
          // Convert to 0-360 range
          if (heading < 0) {
            heading += 360;
          }
          
          // Magnetic declination adjustment (Turkey is approximately +6°)
          heading += 6;
          if (heading >= 360) {
            heading -= 360;
          }
          
          setCompassData({
            heading,
            accuracy: null, // Expo Sensors doesn't provide accuracy
          });
        });
        
        return () => {
          subscription.remove();
        };
      }
    };

    const cleanup = checkAvailability();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  return {
    heading: compassData?.heading || 0,
    accuracy: compassData?.accuracy,
    isAvailable,
  };
}