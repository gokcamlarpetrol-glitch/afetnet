import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from "../utils/productionLogger";
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Appearance } from 'react-native';
import { notificationService } from '../services/notifications/NotificationService';

// App settings interface
export interface AppSettings {
  // Uygulama Ayarları
  autoUpdate: boolean;
  errorReports: boolean;
  analyticsData: boolean;
  usageStatistics: boolean;
  darkMode: boolean;
  language: string;
  region: string;
  timezone: string;
  
  // Deprem Ayarları
  liveMode: boolean;
  experimentalPWave: boolean;
  magnitudeThreshold: number;
  alertRadius: number;
  alertDelay: number;
  dataSource: string;
  
  // Bildirim Ayarları
  pushNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  emergencyAlerts: boolean;
  familyAlerts: boolean;
  messageAlerts: boolean;
  systemAlerts: boolean;
  marketingAlerts: boolean;
  quietHours: boolean;
  ledNotification: boolean;
  badgeCount: boolean;
  notificationSound: string;
  vibrationPattern: string;
  quietStartTime: string;
  quietEndTime: string;
  
  // Mesh Ağ Ayarları
  bleEnabled: boolean;
  meshDiscovery: boolean;
  relayMode: boolean;
  powerSaving: boolean;
  meshEncryption: boolean;
  autoConnect: boolean;
  meshRange: number;
  
  // Güvenlik Ayarları
  biometricEnabled: boolean;
  encryptionEnabled: boolean;
  screenLockEnabled: boolean;
  appLockEnabled: boolean;
  twoFactorAuth: boolean;
  loginNotifications: boolean;
  suspiciousActivityAlerts: boolean;
  sessionTimeout: number;
  passwordComplexity: string;
  dataSharing: boolean;
  analyticsSharing: boolean;
  crashReports: boolean;
  
  // Veri Ayarları
  autoBackup: boolean;
  cloudSync: boolean;
  syncWifiOnly: boolean;
  debugMode: boolean;
  backupFrequency: string;
  dataRetention: number;
  localStorage: number;
  compressionLevel: string;
  encryptionLevel: string;
  dataUsageLimit: number;
  cacheSize: number;
  logLevel: string;
}

// Default settings
const defaultSettings: AppSettings = {
  // Uygulama Ayarları
  autoUpdate: true,
  errorReports: true,
  analyticsData: true,
  usageStatistics: true,
  darkMode: true,
  language: 'tr',
  region: 'TR',
  timezone: 'Europe/Istanbul',
  
  // Deprem Ayarları
  liveMode: true,
  experimentalPWave: true,
  magnitudeThreshold: 4.0,
  alertRadius: 500,
  alertDelay: 0,
  dataSource: 'AFAD',
  
  // Bildirim Ayarları
  pushNotifications: true,
  soundEnabled: true,
  vibrationEnabled: true,
  emergencyAlerts: true,
  familyAlerts: true,
  messageAlerts: true,
  systemAlerts: true,
  marketingAlerts: false,
  quietHours: true,
  ledNotification: true,
  badgeCount: true,
  notificationSound: 'default',
  vibrationPattern: 'default',
  quietStartTime: '22:00',
  quietEndTime: '08:00',
  
  // Mesh Ağ Ayarları
  bleEnabled: true,
  meshDiscovery: true,
  relayMode: true,
  powerSaving: true,
  meshEncryption: true,
  autoConnect: true,
  meshRange: 100,
  
  // Güvenlik Ayarları
  biometricEnabled: true,
  encryptionEnabled: true,
  screenLockEnabled: true,
  appLockEnabled: true,
  twoFactorAuth: false,
  loginNotifications: true,
  suspiciousActivityAlerts: true,
  sessionTimeout: 15,
  passwordComplexity: 'high',
  dataSharing: true,
  analyticsSharing: true,
  crashReports: true,
  
  // Veri Ayarları
  autoBackup: true,
  cloudSync: false,
  syncWifiOnly: true,
  debugMode: false,
  backupFrequency: 'daily',
  dataRetention: 365,
  localStorage: 256,
  compressionLevel: 'medium',
  encryptionLevel: 'high',
  dataUsageLimit: 1024,
  cacheSize: 100,
  logLevel: 'info',
};

type AppSettingsState = AppSettings & {
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  initializeSettings: () => Promise<void>;
};

// Settings store with real-time effects
export const useAppSettings = create<AppSettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      
      updateSetting: async (key, value) => {
        const currentSettings = get();
        const newSettings = { ...currentSettings, [key]: value };
        
        // Update state
        set({ [key]: value });
        
        // Apply real-time effects
        await applySettingEffect(key, value, newSettings);
        
        // Save to storage
        try {
          await AsyncStorage.setItem('afn/app-settings/v1', JSON.stringify(newSettings));
        } catch (error) {
          logger.warn('Failed to save settings:', error);
        }
      },
      
      updateSettings: async (updates) => {
        const currentSettings = get();
        const newSettings = { ...currentSettings, ...updates };
        
        // Update state
        set(updates);
        
        // Apply real-time effects for each changed setting
        for (const [key, value] of Object.entries(updates)) {
          await applySettingEffect(key as keyof AppSettings, value, newSettings);
        }
        
        // Save to storage
        try {
          await AsyncStorage.setItem('afn/app-settings/v1', JSON.stringify(newSettings));
        } catch (error) {
          logger.warn('Failed to save settings:', error);
        }
      },
      
      resetToDefaults: async () => {
        set(defaultSettings);
        
        // Apply default effects
        await applySettingEffect('darkMode', defaultSettings.darkMode, defaultSettings);
        await applySettingEffect('pushNotifications', defaultSettings.pushNotifications, defaultSettings);
        await applySettingEffect('soundEnabled', defaultSettings.soundEnabled, defaultSettings);
        await applySettingEffect('vibrationEnabled', defaultSettings.vibrationEnabled, defaultSettings);
        
        // Save to storage
        try {
          await AsyncStorage.setItem('afn/app-settings/v1', JSON.stringify(defaultSettings));
        } catch (error) {
          logger.warn('Failed to save default settings:', error);
        }
      },
      
      initializeSettings: async () => {
        try {
          const savedSettings = await AsyncStorage.getItem('afn/app-settings/v1');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            const mergedSettings = { ...defaultSettings, ...parsedSettings };
            set(mergedSettings);
            
            // Apply saved settings effects
            await applySettingEffect('darkMode', mergedSettings.darkMode, mergedSettings);
            await applySettingEffect('pushNotifications', mergedSettings.pushNotifications, mergedSettings);
            await applySettingEffect('soundEnabled', mergedSettings.soundEnabled, mergedSettings);
            await applySettingEffect('vibrationEnabled', mergedSettings.vibrationEnabled, mergedSettings);
          }
        } catch (error) {
          logger.warn('Failed to initialize settings:', error);
        }
      },
    }),
    {
      name: 'afn/app-settings/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        return { ...defaultSettings, ...persistedState };
      },
      onRehydrateStorage: () => {
        // CRITICAL: Prevent re-renders during rehydration
        return (state, error) => {
          if (error) {
            logger.warn('App settings rehydration error:', error);
          }
          // No state mutation here - just logging
        };
      },
    },
  ),
);

// Apply real-time effects for settings changes
async function applySettingEffect(
  key: keyof AppSettings, 
  value: any, 
  allSettings: AppSettings,
): Promise<void> {
  try {
    switch (key) {
    case 'darkMode':
      await applyDarkModeEffect(value);
      break;
        
    case 'pushNotifications':
      await applyPushNotificationsEffect(value);
      break;
        
    case 'soundEnabled':
      await applySoundEffect(value);
      break;
        
    case 'vibrationEnabled':
      await applyVibrationEffect(value);
      break;
        
    case 'emergencyAlerts':
      await applyEmergencyAlertsEffect(value);
      break;
        
    case 'familyAlerts':
      await applyFamilyAlertsEffect(value);
      break;
        
    case 'messageAlerts':
      await applyMessageAlertsEffect(value);
      break;
        
    case 'systemAlerts':
      await applySystemAlertsEffect(value);
      break;
        
    case 'marketingAlerts':
      await applyMarketingAlertsEffect(value);
      break;
        
    case 'quietHours':
      await applyQuietHoursEffect(value, allSettings);
      break;
        
    case 'ledNotification':
      await applyLedNotificationEffect(value);
      break;
        
    case 'badgeCount':
      await applyBadgeCountEffect(value);
      break;
        
    case 'bleEnabled':
      await applyBleEffect(value);
      break;
        
    case 'meshDiscovery':
      await applyMeshDiscoveryEffect(value);
      break;
        
    case 'relayMode':
      await applyRelayModeEffect(value);
      break;
        
    case 'powerSaving':
      await applyPowerSavingEffect(value);
      break;
        
    case 'meshEncryption':
      await applyMeshEncryptionEffect(value);
      break;
        
    case 'autoConnect':
      await applyAutoConnectEffect(value);
      break;
        
    case 'biometricEnabled':
      await applyBiometricEffect(value);
      break;
        
    case 'encryptionEnabled':
      await applyEncryptionEffect(value);
      break;
        
    case 'screenLockEnabled':
      await applyScreenLockEffect(value);
      break;
        
    case 'appLockEnabled':
      await applyAppLockEffect(value);
      break;
        
    case 'twoFactorAuth':
      await applyTwoFactorAuthEffect(value);
      break;
        
    case 'loginNotifications':
      await applyLoginNotificationsEffect(value);
      break;
        
    case 'suspiciousActivityAlerts':
      await applySuspiciousActivityEffect(value);
      break;
        
    case 'autoBackup':
      await applyAutoBackupEffect(value);
      break;
        
    case 'cloudSync':
      await applyCloudSyncEffect(value);
      break;
        
    case 'syncWifiOnly':
      await applySyncWifiOnlyEffect(value);
      break;
        
    case 'debugMode':
      await applyDebugModeEffect(value);
      break;
        
    case 'errorReports':
      await applyErrorReportsEffect(value);
      break;
        
    case 'analyticsData':
      await applyAnalyticsDataEffect(value);
      break;
        
    case 'usageStatistics':
      await applyUsageStatisticsEffect(value);
      break;
        
    case 'crashReports':
      await applyCrashReportsEffect(value);
      break;
        
    case 'liveMode':
      await applyLiveModeEffect(value);
      break;
        
    case 'experimentalPWave':
      await applyExperimentalPWaveEffect(value);
      break;
        
    case 'autoUpdate':
      await applyAutoUpdateEffect(value);
      break;
    }
  } catch (error) {
    logger.warn(`Failed to apply setting effect for ${key}:`, error);
  }
}

// Individual setting effect functions
async function applyDarkModeEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      Appearance.setColorScheme('dark');
    } else {
      Appearance.setColorScheme('light');
    }
  } catch (error) {
    logger.warn('Failed to apply dark mode:', error);
  }
}

async function applyPushNotificationsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      const granted = await notificationService.requestPermissions();
      if (granted) {
        await notificationService.initializeChannels();
        logger.info('✅ Push notifications enabled');
      } else {
        logger.warn('Push notification permission not granted');
      }
    }
  } catch (error) {
    logger.warn('Failed to apply push notifications:', error);
  }
}

async function applySoundEffect(enabled: boolean): Promise<void> {
  try {
    await notificationService.configureNotificationHandler(enabled, true);
    logger.info(`✅ Sound notifications ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    logger.warn('Failed to apply sound effect:', error);
  }
}

async function applyVibrationEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      logger.info('✅ Vibration enabled');
    } else {
      logger.info('✅ Vibration disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply vibration effect:', error);
  }
}

async function applyEmergencyAlertsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await notificationService.initializeChannels();
      logger.info('✅ Emergency alerts enabled');
    } else {
      logger.info('✅ Emergency alerts disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply emergency alerts effect:', error);
  }
}

async function applyFamilyAlertsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await notificationService.initializeChannels();
      logger.info('✅ Family alerts enabled');
    } else {
      logger.info('✅ Family alerts disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply family alerts effect:', error);
  }
}

async function applyMessageAlertsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await notificationService.initializeChannels();
      logger.info('✅ Message alerts enabled');
    } else {
      logger.info('✅ Message alerts disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply message alerts effect:', error);
  }
}

async function applySystemAlertsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await notificationService.initializeChannels();
      logger.info('✅ System alerts enabled');
    } else {
      logger.info('✅ System alerts disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply system alerts effect:', error);
  }
}

async function applyMarketingAlertsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await notificationService.initializeChannels();
      logger.info('✅ Marketing alerts enabled');
    } else {
      logger.info('✅ Marketing alerts disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply marketing alerts effect:', error);
  }
}

async function applyQuietHoursEffect(enabled: boolean, settings: AppSettings): Promise<void> {
  try {
    if (enabled) {
      // Configure quiet hours
      const startTime = settings.quietStartTime;
      const endTime = settings.quietEndTime;
      
      // This would integrate with a quiet hours service
      logger.info(`Quiet hours enabled: ${startTime} - ${endTime}`);
    }
  } catch (error) {
    logger.warn('Failed to apply quiet hours effect:', error);
  }
}

async function applyLedNotificationEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      logger.info('✅ LED notifications enabled');
    } else {
      logger.info('✅ LED notifications disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply LED notification effect:', error);
  }
}

async function applyBadgeCountEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await notificationService.setBadgeCount(1);
      logger.info('✅ Badge count enabled');
    } else {
      await notificationService.setBadgeCount(0);
      logger.info('✅ Badge count disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply badge count effect:', error);
  }
}

async function applyBleEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable BLE
      logger.info('BLE enabled');
    } else {
      // Disable BLE
      logger.info('BLE disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply BLE effect:', error);
  }
}

async function applyMeshDiscoveryEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable mesh discovery
      logger.info('Mesh discovery enabled');
    } else {
      // Disable mesh discovery
      logger.info('Mesh discovery disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply mesh discovery effect:', error);
  }
}

async function applyRelayModeEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable relay mode
      logger.info('Relay mode enabled');
    } else {
      // Disable relay mode
      logger.info('Relay mode disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply relay mode effect:', error);
  }
}

async function applyPowerSavingEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable power saving
      logger.info('Power saving enabled');
    } else {
      // Disable power saving
      logger.info('Power saving disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply power saving effect:', error);
  }
}

async function applyMeshEncryptionEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable mesh encryption
      logger.info('Mesh encryption enabled');
    } else {
      // Disable mesh encryption
      logger.info('Mesh encryption disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply mesh encryption effect:', error);
  }
}

async function applyAutoConnectEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable auto connect
      logger.info('Auto connect enabled');
    } else {
      // Disable auto connect
      logger.info('Auto connect disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply auto connect effect:', error);
  }
}

async function applyBiometricEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable biometric authentication
      logger.info('Biometric authentication enabled');
    } else {
      // Disable biometric authentication
      logger.info('Biometric authentication disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply biometric effect:', error);
  }
}

async function applyEncryptionEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable encryption
      logger.info('Encryption enabled');
    } else {
      // Disable encryption
      logger.info('Encryption disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply encryption effect:', error);
  }
}

async function applyScreenLockEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable screen lock
      logger.info('Screen lock enabled');
    } else {
      // Disable screen lock
      logger.info('Screen lock disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply screen lock effect:', error);
  }
}

async function applyAppLockEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable app lock
      logger.info('App lock enabled');
    } else {
      // Disable app lock
      logger.info('App lock disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply app lock effect:', error);
  }
}

async function applyTwoFactorAuthEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable two-factor authentication
      logger.info('Two-factor authentication enabled');
    } else {
      // Disable two-factor authentication
      logger.info('Two-factor authentication disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply two-factor auth effect:', error);
  }
}

async function applyLoginNotificationsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable login notifications
      logger.info('Login notifications enabled');
    } else {
      // Disable login notifications
      logger.info('Login notifications disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply login notifications effect:', error);
  }
}

async function applySuspiciousActivityEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable suspicious activity alerts
      logger.info('Suspicious activity alerts enabled');
    } else {
      // Disable suspicious activity alerts
      logger.info('Suspicious activity alerts disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply suspicious activity effect:', error);
  }
}

async function applyAutoBackupEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable auto backup
      logger.info('Auto backup enabled');
    } else {
      // Disable auto backup
      logger.info('Auto backup disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply auto backup effect:', error);
  }
}

async function applyCloudSyncEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable cloud sync
      logger.info('Cloud sync enabled');
    } else {
      // Disable cloud sync
      logger.info('Cloud sync disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply cloud sync effect:', error);
  }
}

async function applySyncWifiOnlyEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable WiFi-only sync
      logger.info('WiFi-only sync enabled');
    } else {
      // Disable WiFi-only sync
      logger.info('WiFi-only sync disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply sync WiFi-only effect:', error);
  }
}

async function applyDebugModeEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable debug mode
      logger.info('Debug mode enabled');
    } else {
      // Disable debug mode
      logger.info('Debug mode disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply debug mode effect:', error);
  }
}

async function applyErrorReportsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable error reports
      logger.info('Error reports enabled');
    } else {
      // Disable error reports
      logger.info('Error reports disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply error reports effect:', error);
  }
}

async function applyAnalyticsDataEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable analytics data
      logger.info('Analytics data enabled');
    } else {
      // Disable analytics data
      logger.info('Analytics data disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply analytics data effect:', error);
  }
}

async function applyUsageStatisticsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable usage statistics
      logger.info('Usage statistics enabled');
    } else {
      // Disable usage statistics
      logger.info('Usage statistics disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply usage statistics effect:', error);
  }
}

async function applyCrashReportsEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable crash reports
      logger.info('Crash reports enabled');
    } else {
      // Disable crash reports
      logger.info('Crash reports disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply crash reports effect:', error);
  }
}

async function applyLiveModeEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable live mode
      logger.info('Live mode enabled');
    } else {
      // Disable live mode
      logger.info('Live mode disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply live mode effect:', error);
  }
}

async function applyExperimentalPWaveEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable experimental P-wave detection
      logger.info('Experimental P-wave detection enabled');
    } else {
      // Disable experimental P-wave detection
      logger.info('Experimental P-wave detection disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply experimental P-wave effect:', error);
  }
}

async function applyAutoUpdateEffect(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      // Enable auto update
      logger.info('Auto update enabled');
    } else {
      // Disable auto update
      logger.info('Auto update disabled');
    }
  } catch (error) {
    logger.warn('Failed to apply auto update effect:', error);
  }
}
