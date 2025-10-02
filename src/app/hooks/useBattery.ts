import { useState, useEffect } from 'react';
import { Battery } from 'expo-battery';

export const useBattery = () => {
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);

  useEffect(() => {
    const updateBatteryStatus = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const charging = await Battery.isChargingAsync();
        
        setBatteryLevel(level * 100);
        setIsCharging(charging);
      } catch (error) {
        console.error('Failed to get battery status:', error);
      }
    };

    // Initial update
    updateBatteryStatus();

    // Set up listener for battery changes
    const subscription = Battery.addBatteryLevelListener(updateBatteryStatus);
    const chargingSubscription = Battery.addBatteryStateListener(updateBatteryStatus);

    return () => {
      subscription?.remove();
      chargingSubscription?.remove();
    };
  }, []);

  return {
    batteryLevel,
    isCharging,
  };
};