/**
 * SETTINGS STORE - Persistent User Settings
 * Manages all user preferences with AsyncStorage persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // Notifications
  notificationsEnabled: boolean;
  // Location
  locationEnabled: boolean;
  // BLE Mesh
  bleMeshEnabled: boolean;
  // EEW (Earthquake Early Warning)
  eewEnabled: boolean;
  // Seismic Sensor
  seismicSensorEnabled: boolean;
  // Alarm Sound
  alarmSoundEnabled: boolean;
  // Vibration
  vibrationEnabled: boolean;
  // Voice Commands
  voiceCommandEnabled: boolean;
  // Battery Saver
  batterySaverEnabled: boolean;
  // Language
  language: 'tr' | 'ku' | 'ar' | 'en';
}

interface SettingsActions {
  setNotifications: (enabled: boolean) => void;
  setLocation: (enabled: boolean) => void;
  setBleMesh: (enabled: boolean) => void;
  setEew: (enabled: boolean) => void;
  setSeismicSensor: (enabled: boolean) => void;
  setAlarmSound: (enabled: boolean) => void;
  setVibration: (enabled: boolean) => void;
  setVoiceCommand: (enabled: boolean) => void;
  setBatterySaver: (enabled: boolean) => void;
  setLanguage: (lang: 'tr' | 'ku' | 'ar' | 'en') => void;
  resetToDefaults: () => void;
}

const defaultSettings: SettingsState = {
  notificationsEnabled: true,
  locationEnabled: true,
  bleMeshEnabled: true,
  eewEnabled: true,
  seismicSensorEnabled: true,
  alarmSoundEnabled: true,
  vibrationEnabled: true,
  voiceCommandEnabled: false,
  batterySaverEnabled: false,
  language: 'tr',
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setNotifications: (enabled) => set({ notificationsEnabled: enabled }),
      setLocation: (enabled) => set({ locationEnabled: enabled }),
      setBleMesh: (enabled) => set({ bleMeshEnabled: enabled }),
      setEew: (enabled) => set({ eewEnabled: enabled }),
      setSeismicSensor: (enabled) => set({ seismicSensorEnabled: enabled }),
      setAlarmSound: (enabled) => set({ alarmSoundEnabled: enabled }),
      setVibration: (enabled) => set({ vibrationEnabled: enabled }),
      setVoiceCommand: (enabled) => set({ voiceCommandEnabled: enabled }),
      setBatterySaver: (enabled) => set({ batterySaverEnabled: enabled }),
      setLanguage: (lang) => set({ language: lang }),
      
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'afetnet-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

