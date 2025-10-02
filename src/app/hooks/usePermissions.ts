import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';

interface PermissionStatus {
  location: boolean;
  bluetooth: boolean;
  notifications: boolean;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    location: false,
    bluetooth: false,
    notifications: false,
  });

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    const locationPermission = await checkLocationPermission();
    const bluetoothPermission = await checkBluetoothPermission();
    const notificationPermission = await checkNotificationPermission();

    setPermissions({
      location: locationPermission,
      bluetooth: bluetoothPermission,
      notifications: notificationPermission,
    });
  };

  const checkLocationPermission = async (): Promise<boolean> => {
    try {
      const permission = Platform.select({
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      });

      if (!permission) return false;

      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Failed to check location permission:', error);
      return false;
    }
  };

  const checkBluetoothPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios') {
        // iOS handles Bluetooth permissions differently
        return true;
      }

      const permission = PERMISSIONS.ANDROID.BLUETOOTH_SCAN;
      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Failed to check bluetooth permission:', error);
      return false;
    }
  };

  const checkNotificationPermission = async (): Promise<boolean> => {
    try {
      const permission = Platform.select({
        ios: PERMISSIONS.IOS.NOTIFICATIONS,
        android: PERMISSIONS.ANDROID.POST_NOTIFICATIONS,
      });

      if (!permission) return false;

      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Failed to check notification permission:', error);
      return false;
    }
  };

  const requestPermissions = async (): Promise<PermissionStatus> => {
    const locationPermission = await checkLocationPermission();
    const bluetoothPermission = await checkBluetoothPermission();
    const notificationPermission = await checkNotificationPermission();

    const newPermissions = {
      location: locationPermission,
      bluetooth: bluetoothPermission,
      notifications: notificationPermission,
    };

    setPermissions(newPermissions);
    return newPermissions;
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    const granted = await checkLocationPermission();
    setPermissions(prev => ({ ...prev, location: granted }));
    
    if (!granted) {
      Alert.alert(
        'Location Permission Required',
        'This app needs location access to send help requests with your location.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => {} },
        ]
      );
    }
    
    return granted;
  };

  const requestBluetoothPermission = async (): Promise<boolean> => {
    const granted = await checkBluetoothPermission();
    setPermissions(prev => ({ ...prev, bluetooth: granted }));
    
    if (!granted) {
      Alert.alert(
        'Bluetooth Permission Required',
        'This app needs Bluetooth access to communicate with nearby devices.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => {} },
        ]
      );
    }
    
    return granted;
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    const granted = await checkNotificationPermission();
    setPermissions(prev => ({ ...prev, notifications: granted }));
    
    if (!granted) {
      Alert.alert(
        'Notification Permission Required',
        'This app needs notification access to alert you about important updates.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => {} },
        ]
      );
    }
    
    return granted;
  };

  return {
    permissions,
    requestPermissions,
    requestLocationPermission,
    requestBluetoothPermission,
    requestNotificationPermission,
    checkAllPermissions,
  };
};