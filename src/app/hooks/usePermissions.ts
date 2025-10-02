import { useState, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';

export const usePermissions = () => {
  const [permissions, setPermissions] = useState({
    location: false,
    bluetooth: false,
    contacts: false,
    camera: false,
  });

  const requestPermissions = useCallback(async () => {
    try {
      // Request location permission
      const locationStatus = await Location.requestForegroundPermissionsAsync();
      setPermissions(prev => ({ ...prev, location: locationStatus.status === 'granted' }));

      // Request contacts permission
      const contactsStatus = await Contacts.requestPermissionsAsync();
      setPermissions(prev => ({ ...prev, contacts: contactsStatus.status === 'granted' }));

      // Note: Bluetooth and camera permissions are handled by the platform
      // when the respective features are used

      return {
        location: locationStatus.status === 'granted',
        contacts: contactsStatus.status === 'granted',
        bluetooth: true, // Will be checked when BLE is used
        camera: true, // Will be checked when camera is used
      };
    } catch (error) {
      console.error('Permission request failed:', error);
      return permissions;
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      const locationStatus = await Location.getForegroundPermissionsAsync();
      const contactsStatus = await Contacts.getPermissionsAsync();

      setPermissions({
        location: locationStatus.status === 'granted',
        contacts: contactsStatus.status === 'granted',
        bluetooth: true,
        camera: true,
      });

      return permissions;
    } catch (error) {
      console.error('Permission check failed:', error);
      return permissions;
    }
  }, [permissions]);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return {
    permissions,
    requestPermissions,
    checkPermissions,
    openSettings,
  };
};