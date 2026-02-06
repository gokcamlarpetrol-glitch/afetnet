/**
 * PERMISSION SERVICE - Elite Centralized Permission Management
 * ELITE: Comprehensive permission handling for all app features
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import { Audio } from 'expo-av';

const logger = createLogger('PermissionService');

// ELITE: Permission status interface
export interface PermissionStatus {
    location: boolean;
    locationBackground: boolean;
    notification: boolean;
    camera: boolean;
    contacts: boolean;
    microphone: boolean;
}

// ELITE: Default permission status
const DEFAULT_STATUS: PermissionStatus = {
  location: false,
  locationBackground: false,
  notification: false,
  camera: false,
  contacts: false,
  microphone: false,
};

class PermissionService {
  private isInitialized = false;
  private cachedStatus: PermissionStatus = { ...DEFAULT_STATUS };

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('Initializing PermissionService...');
    // ELITE: Pre-cache permission status on init
    await this.checkAllPermissions();
    this.isInitialized = true;
    logger.info('PermissionService initialized');
  }

  // ==================== LOCATION ====================
  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        this.cachedStatus.location = true;
        logger.info('Location permission granted (foreground)');
        return true;
      }
      this.cachedStatus.location = false;
      logger.warn('Location permission denied');
      return false;
    } catch (error) {
      logger.error('Location permission request failed:', error);
      return false;
    }
  }

  async checkLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.cachedStatus.location = status === 'granted';
      return this.cachedStatus.location;
    } catch (error) {
      logger.error('Location permission check failed:', error);
      return false;
    }
  }

  // ==================== NOTIFICATION ====================
  async requestNotificationPermission(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
        },
      });
      this.cachedStatus.notification = status === 'granted';
      if (this.cachedStatus.notification) {
        logger.info('Notification permission granted');
      } else {
        logger.warn('Notification permission denied');
      }
      return this.cachedStatus.notification;
    } catch (error) {
      logger.error('Notification permission request failed:', error);
      return false;
    }
  }

  async checkNotificationPermission(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      this.cachedStatus.notification = status === 'granted';
      return this.cachedStatus.notification;
    } catch (error) {
      logger.error('Notification permission check failed:', error);
      return false;
    }
  }

  // ==================== CAMERA ====================
  async requestCameraPermission(): Promise<boolean> {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      this.cachedStatus.camera = status === 'granted';
      if (this.cachedStatus.camera) {
        logger.info('Camera permission granted');
      } else {
        logger.warn('Camera permission denied');
      }
      return this.cachedStatus.camera;
    } catch (error) {
      logger.error('Camera permission request failed:', error);
      return false;
    }
  }

  async checkCameraPermission(): Promise<boolean> {
    try {
      const { status } = await Camera.getCameraPermissionsAsync();
      this.cachedStatus.camera = status === 'granted';
      return this.cachedStatus.camera;
    } catch (error) {
      logger.error('Camera permission check failed:', error);
      return false;
    }
  }

  // ==================== CONTACTS ====================
  async requestContactsPermission(): Promise<boolean> {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      this.cachedStatus.contacts = status === 'granted';
      if (this.cachedStatus.contacts) {
        logger.info('Contacts permission granted');
      } else {
        logger.warn('Contacts permission denied');
      }
      return this.cachedStatus.contacts;
    } catch (error) {
      logger.error('Contacts permission request failed:', error);
      return false;
    }
  }

  async checkContactsPermission(): Promise<boolean> {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      this.cachedStatus.contacts = status === 'granted';
      return this.cachedStatus.contacts;
    } catch (error) {
      logger.error('Contacts permission check failed:', error);
      return false;
    }
  }

  // ==================== MICROPHONE ====================
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      this.cachedStatus.microphone = status === 'granted';
      if (this.cachedStatus.microphone) {
        logger.info('Microphone permission granted');
      } else {
        logger.warn('Microphone permission denied');
      }
      return this.cachedStatus.microphone;
    } catch (error) {
      logger.error('Microphone permission request failed:', error);
      return false;
    }
  }

  async checkMicrophonePermission(): Promise<boolean> {
    try {
      const { status } = await Audio.getPermissionsAsync();
      this.cachedStatus.microphone = status === 'granted';
      return this.cachedStatus.microphone;
    } catch (error) {
      logger.error('Microphone permission check failed:', error);
      return false;
    }
  }

  // ==================== BLUETOOTH ====================
  // ELITE: Bluetooth permission handling
  // On iOS 13+, CBCentralManager triggers the permission dialog automatically
  // On Android 12+, BLUETOOTH_SCAN and BLUETOOTH_CONNECT are required (handled via expo-device)
  async requestBluetoothPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Android 12+ requires location permission for BLE scanning
        const locationGranted = await this.requestLocationPermission();
        if (locationGranted) {
          logger.info('Bluetooth (via location) permission granted for Android');
        }
        return locationGranted;
      } else {
        // iOS: Bluetooth permission is requested when app first uses BLE
        // We return true here as the dialog will appear when BLE is accessed
        logger.info('Bluetooth permission will be requested on first BLE access (iOS)');
        return true;
      }
    } catch (error) {
      logger.error('Bluetooth permission request failed:', error);
      return false;
    }
  }

  // ==================== CHECK ALL ====================
  async checkAllPermissions(): Promise<PermissionStatus> {
    try {
      // ELITE: Check all permissions in parallel for performance
      const [location, notification, camera, contacts, microphone] = await Promise.all([
        this.checkLocationPermission(),
        this.checkNotificationPermission(),
        this.checkCameraPermission(),
        this.checkContactsPermission(),
        this.checkMicrophonePermission(),
      ]);

      // Check background location separately (iOS only)
      let locationBackground = false;
      if (Platform.OS === 'ios' && location) {
        const { status } = await Location.getBackgroundPermissionsAsync();
        locationBackground = status === 'granted';
      }

      this.cachedStatus = {
        location,
        locationBackground,
        notification,
        camera,
        contacts,
        microphone,
      };

      logger.info('All permissions checked:', this.cachedStatus);
      return this.cachedStatus;
    } catch (error) {
      logger.error('Permission check failed:', error);
      return { ...DEFAULT_STATUS };
    }
  }

  // ELITE: Legacy method for backward compatibility
  async checkPermissions(): Promise<{ location: boolean; notification: boolean }> {
    const status = await this.checkAllPermissions();
    return {
      location: status.location,
      notification: status.notification,
    };
  }

  // ELITE: Get cached permission status (fast, no async)
  getCachedStatus(): PermissionStatus {
    return { ...this.cachedStatus };
  }

  // ELITE: Check if essential permissions are granted
  hasEssentialPermissions(): boolean {
    return this.cachedStatus.location && this.cachedStatus.notification;
  }

  // ELITE: Request all essential permissions at once
  async requestEssentialPermissions(): Promise<boolean> {
    const location = await this.requestLocationPermission();
    const notification = await this.requestNotificationPermission();
    return location && notification;
  }
}

export const permissionService = new PermissionService();
