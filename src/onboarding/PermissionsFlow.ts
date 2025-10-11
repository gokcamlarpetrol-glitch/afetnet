import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/productionLogger';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { ble } from '../ble/manager';

export type PermissionStatus = {
  notifications: 'granted' | 'denied' | 'undetermined';
  location: 'granted' | 'denied' | 'undetermined';
  bluetooth: 'granted' | 'denied' | 'undetermined';
  backgroundLocation?: 'granted' | 'denied' | 'undetermined';
};

export type PermissionStep = {
  key: keyof PermissionStatus;
  title: string;
  description: string;
  required: boolean;
};

const PERMISSION_STEPS: PermissionStep[] = [
  {
    key: 'notifications',
    title: 'Bildirim İzni',
    description: 'Acil durum bildirimleri ve SOS uyarıları için gerekli',
    required: true,
  },
  {
    key: 'location',
    title: 'Konum İzni',
    description: 'GPS konum belirleme ve harita görüntüleme için gerekli',
    required: true,
  },
  {
    key: 'bluetooth',
    title: 'Bluetooth İzni',
    description: 'Çevrimdışı mesh iletişimi için gerekli',
    required: true,
  },
  {
    key: 'backgroundLocation',
    title: 'Arka Plan Konum İzni',
    description: 'Uygulama arka plandayken konum takibi (isteğe bağlı)',
    required: false,
  },
];

export class PermissionsManager {
  private static instance: PermissionsManager;
  private status: PermissionStatus = {
    notifications: 'undetermined',
    location: 'undetermined',
    bluetooth: 'undetermined',
  };

  static getInstance(): PermissionsManager {
    if (!PermissionsManager.instance) {
      PermissionsManager.instance = new PermissionsManager();
    }
    return PermissionsManager.instance;
  }

  async requestNotificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      this.status.notifications = status === 'granted' ? 'granted' : 'denied';
      return this.status.notifications;
    } catch (error) {
      logger.error('Notification permission error:', error);
      this.status.notifications = 'denied';
      return 'denied';
    }
  }

  async requestLocationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.status.location = status === 'granted' ? 'granted' : 'denied';
      return this.status.location;
    } catch (error) {
      logger.error('Location permission error:', error);
      this.status.location = 'denied';
      return 'denied';
    }
  }

  async requestBackgroundLocationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      this.status.backgroundLocation = status === 'granted' ? 'granted' : 'denied';
      return this.status.backgroundLocation;
    } catch (error) {
      logger.error('Background location permission error:', error);
      this.status.backgroundLocation = 'denied';
      return 'denied';
    }
  }

  async requestBluetoothPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      // Check if Bluetooth is available and enabled
      const state = await ble.state();
      
      if (state === 'PoweredOn') {
        this.status.bluetooth = 'granted';
        return 'granted';
      } else if (state === 'PoweredOff') {
        // Bluetooth is turned off, show alert to user
        Alert.alert(
          'Bluetooth Kapalı',
          'AfetNet için Bluetooth\'u açmanız gerekiyor. Ayarlar > Bluetooth bölümünden açabilirsiniz.',
          [{ text: 'Tamam' }]
        );
        this.status.bluetooth = 'denied';
        return 'denied';
      } else {
        // Bluetooth is not available or not authorized
        this.status.bluetooth = 'denied';
        return 'denied';
      }
    } catch (error) {
      logger.error('Bluetooth permission error:', error);
      this.status.bluetooth = 'denied';
      return 'denied';
    }
  }

  async requestAllPermissions(): Promise<PermissionStatus> {
    // Request notifications first
    await this.requestNotificationPermission();

    // Request location permissions
    await this.requestLocationPermission();

    // Request Bluetooth permission
    await this.requestBluetoothPermission();

    // Request background location only if foreground location is granted
    if (this.status.location === 'granted') {
      await this.requestBackgroundLocationPermission();
    }

    // Save permission status
    await this.savePermissionStatus();

    return this.status;
  }

  async getCurrentStatus(): Promise<PermissionStatus> {
    try {
      // Check notification permission
      const notificationStatus = await Notifications.getPermissionsAsync();
      this.status.notifications = notificationStatus.granted ? 'granted' : 'denied';

      // Check location permission
      const locationStatus = await Location.getForegroundPermissionsAsync();
      this.status.location = locationStatus.granted ? 'granted' : 'denied';

      // Check background location if available
      if (this.status.location === 'granted') {
        const backgroundStatus = await Location.getBackgroundPermissionsAsync();
        this.status.backgroundLocation = backgroundStatus.granted ? 'granted' : 'denied';
      }

      // Bluetooth permission status
      if (Platform.OS === 'android') {
        const bluetoothStatus = await (Bluetooth as any)?.getPermissionsAsync?.() || { granted: false };
        this.status.bluetooth = bluetoothStatus.granted ? 'granted' : 'denied';
      } else {
        this.status.bluetooth = 'granted'; // iOS handles this automatically
      }

      return this.status;
    } catch (error) {
      logger.error('Error getting permission status:', error);
      return this.status;
    }
  }

  async savePermissionStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem('afn/permissions/v1', JSON.stringify(this.status));
    } catch (error) {
      logger.error('Error saving permission status:', error);
    }
  }

  async loadPermissionStatus(): Promise<PermissionStatus> {
    try {
      const stored = await AsyncStorage.getItem('afn/permissions/v1');
      if (stored) {
        this.status = { ...this.status, ...JSON.parse(stored) };
      }
      return this.status;
    } catch (error) {
      logger.error('Error loading permission status:', error);
      return this.status;
    }
  }

  getPermissionSteps(): PermissionStep[] {
    return PERMISSION_STEPS;
  }

  hasRequiredPermissions(): boolean {
    return (
      this.status.notifications === 'granted' &&
      this.status.location === 'granted' &&
      this.status.bluetooth === 'granted'
    );
  }

  getMissingRequiredPermissions(): string[] {
    const missing: string[] = [];
    
    if (this.status.notifications !== 'granted') {
      missing.push('Bildirim');
    }
    if (this.status.location !== 'granted') {
      missing.push('Konum');
    }
    if (this.status.bluetooth !== 'granted') {
      missing.push('Bluetooth');
    }

    return missing;
  }

  async retryFailedPermissions(): Promise<PermissionStatus> {
    const missing = this.getMissingRequiredPermissions();
    
    if (missing.includes('Bildirim')) {
      await this.requestNotificationPermission();
    }
    if (missing.includes('Konum')) {
      await this.requestLocationPermission();
    }
    if (missing.includes('Bluetooth')) {
      await this.requestBluetoothPermission();
    }

    await this.savePermissionStatus();
    return this.status;
  }

  async markOnboardingComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem('afn/onboarding/v1', JSON.stringify({
        completed: true,
        completedAt: Date.now(),
        permissions: this.status,
      }));
    } catch (error) {
      logger.error('Error marking onboarding complete:', error);
    }
  }

  async isOnboardingComplete(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem('afn/onboarding/v1');
      if (stored) {
        const data = JSON.parse(stored);
        return data.completed === true;
      }
      return false;
    } catch (error) {
      logger.error('Error checking onboarding status:', error);
      return false;
    }
  }

  async resetOnboarding(): Promise<void> {
    try {
      await AsyncStorage.removeItem('afn/onboarding/v1');
    } catch (error) {
      logger.error('Error resetting onboarding:', error);
    }
  }
}

export const permissionsManager = PermissionsManager.getInstance();
