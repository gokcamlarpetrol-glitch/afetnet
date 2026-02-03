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
  language: 'tr' | 'en' | 'ar' | 'ru';
  // News
  newsEnabled: boolean;

  // ELITE: Comprehensive Earthquake Settings
  // Notification Thresholds
  minMagnitudeForNotification: number; // Minimum magnitude to receive notifications (default: 3.0)
  maxDistanceForNotification: number; // Maximum distance in km (0 = unlimited, default: 0)

  // Critical Earthquake Settings
  criticalMagnitudeThreshold: number; // Magnitude threshold for critical alerts (default: 6.0)
  criticalDistanceThreshold: number; // Distance threshold for critical alerts (default: 100km)

  // Early Warning Settings
  eewMinMagnitude: number; // Minimum magnitude for EEW (default: 3.5)
  eewWarningTime: number; // Warning time in seconds before earthquake (default: 10)

  // Sensor Settings
  sensorSensitivity: 'low' | 'medium' | 'high'; // Sensor sensitivity level (default: 'medium')
  sensorFalsePositiveFilter: boolean; // Enable false positive filtering (default: true)

  // Source Selection
  sourceAFAD: boolean; // AFAD source enabled (default: true)
  sourceUSGS: boolean; // USGS source enabled (default: true)
  sourceEMSC: boolean; // EMSC source enabled (default: true)
  sourceKOERI: boolean; // KOERI source enabled (default: true)
  sourceCommunity: boolean; // Community/Sensor source enabled (default: true)

  // Observatory Selection (for display)
  selectedObservatory: 'AFAD' | 'KANDILLI'; // Selected observatory for earthquake monitoring (default: 'AFAD')

  // Notification Types
  notificationPush: boolean; // Push notifications (default: true)
  notificationFullScreen: boolean; // Full-screen alerts (default: true)
  notificationSound: boolean; // Alarm sound (default: true)
  notificationVibration: boolean; // Vibration (default: true)
  notificationTTS: boolean; // Text-to-Speech (default: true)

  // Priority Settings
  priorityCritical: 'critical' | 'high' | 'normal'; // Priority for critical earthquakes (default: 'critical')
  priorityHigh: 'critical' | 'high' | 'normal'; // Priority for high magnitude (5.0-6.0) (default: 'high')
  priorityMedium: 'high' | 'normal' | 'low'; // Priority for medium magnitude (4.0-5.0) (default: 'normal')
  priorityLow: 'normal' | 'low'; // Priority for low magnitude (3.0-4.0) (default: 'normal')

  // ELITE: Advanced Notification Settings
  // Sound Settings
  notificationSoundType: 'default' | 'alarm' | 'sos' | 'beep' | 'chime' | 'siren' | 'custom'; // Sound type (default: 'alarm')
  notificationSoundVolume: number; // Sound volume 0-100 (default: 80)
  notificationSoundRepeat: number; // Number of times to repeat sound (default: 3)

  // Notification Mode
  notificationMode: 'silent' | 'vibrate' | 'sound' | 'sound+vibrate' | 'critical-only'; // Notification mode (default: 'sound+vibrate')

  // Time-based Settings
  quietHoursEnabled: boolean; // Enable quiet hours (default: false)
  quietHoursStart: string; // Quiet hours start time (HH:mm format, default: '22:00')
  quietHoursEnd: string; // Quiet hours end time (HH:mm format, default: '07:00')
  quietHoursCriticalOnly: boolean; // Only critical earthquakes during quiet hours (default: true)

  // Magnitude-based Custom Settings
  magnitudeBasedSound: boolean; // Different sounds for different magnitudes (default: true)
  magnitudeBasedVibration: boolean; // Different vibration patterns for different magnitudes (default: true)

  // Display Settings
  notificationShowOnLockScreen: boolean; // Show notifications on lock screen (default: true)
  notificationShowPreview: boolean; // Show preview text in notifications (default: true)
  notificationGroupByMagnitude: boolean; // Group notifications by magnitude (default: false)

  // ELITE: Compliance
  eulaAccepted: boolean;
  blockedUsers: string[]; // List of blocked user IDs
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
  setLanguage: (lang: 'tr' | 'en' | 'ar' | 'ru') => void;
  setNews: (enabled: boolean) => void;

  // ELITE: Comprehensive Earthquake Settings Actions
  setMinMagnitudeForNotification: (magnitude: number) => void;
  setMaxDistanceForNotification: (distance: number) => void;
  setCriticalMagnitudeThreshold: (magnitude: number) => void;
  setCriticalDistanceThreshold: (distance: number) => void;
  setEewMinMagnitude: (magnitude: number) => void;
  setEewWarningTime: (seconds: number) => void;
  setSensorSensitivity: (sensitivity: 'low' | 'medium' | 'high') => void;
  setSensorFalsePositiveFilter: (enabled: boolean) => void;
  setSourceAFAD: (enabled: boolean) => void;
  setSourceUSGS: (enabled: boolean) => void;
  setSourceEMSC: (enabled: boolean) => void;
  setSourceKOERI: (enabled: boolean) => void;
  setSourceCommunity: (enabled: boolean) => void;
  setSelectedObservatory: (observatory: 'AFAD' | 'KANDILLI') => void;
  setNotificationPush: (enabled: boolean) => void;
  setNotificationFullScreen: (enabled: boolean) => void;
  setNotificationSound: (enabled: boolean) => void;
  setNotificationVibration: (enabled: boolean) => void;
  setNotificationTTS: (enabled: boolean) => void;
  setPriorityCritical: (priority: 'critical' | 'high' | 'normal') => void;
  setPriorityHigh: (priority: 'critical' | 'high' | 'normal') => void;
  setPriorityMedium: (priority: 'high' | 'normal' | 'low') => void;
  setPriorityLow: (priority: 'normal' | 'low') => void;

  // ELITE: Advanced Notification Settings Actions
  setNotificationSoundType: (type: 'default' | 'alarm' | 'sos' | 'beep' | 'chime' | 'siren' | 'custom') => void;
  setNotificationSoundVolume: (volume: number) => void;
  setNotificationSoundRepeat: (repeat: number) => void;
  setNotificationMode: (mode: 'silent' | 'vibrate' | 'sound' | 'sound+vibrate' | 'critical-only') => void;
  setQuietHoursEnabled: (enabled: boolean) => void;
  setQuietHoursStart: (time: string) => void;
  setQuietHoursEnd: (time: string) => void;
  setQuietHoursCriticalOnly: (enabled: boolean) => void;
  setMagnitudeBasedSound: (enabled: boolean) => void;
  setMagnitudeBasedVibration: (enabled: boolean) => void;
  setNotificationShowOnLockScreen: (enabled: boolean) => void;
  setNotificationShowPreview: (enabled: boolean) => void;
  setNotificationGroupByMagnitude: (enabled: boolean) => void;

  // ELITE: Compliance
  setEulaAccepted: (accepted: boolean) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  isUserBlocked: (userId: string) => boolean;

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
  newsEnabled: true,

  // ELITE: Comprehensive Earthquake Settings Defaults
  // CRITICAL: Default notification threshold is 4.0 M (user requirement)
  minMagnitudeForNotification: 4.0,
  maxDistanceForNotification: 0, // 0 = unlimited
  criticalMagnitudeThreshold: 6.0,
  criticalDistanceThreshold: 100,
  eewMinMagnitude: 3.5,
  eewWarningTime: 10,
  sensorSensitivity: 'medium',
  sensorFalsePositiveFilter: true,
  sourceAFAD: true,
  sourceUSGS: true,
  sourceEMSC: true,
  sourceKOERI: true,
  sourceCommunity: true,
  selectedObservatory: 'AFAD' as const,
  notificationPush: true,
  notificationFullScreen: true,
  notificationSound: true,
  notificationVibration: true,
  notificationTTS: true,
  priorityCritical: 'critical',
  priorityHigh: 'high',
  priorityMedium: 'normal',
  priorityLow: 'normal',

  // ELITE: Advanced Notification Settings Defaults
  notificationSoundType: 'alarm',
  notificationSoundVolume: 80,
  notificationSoundRepeat: 3,
  notificationMode: 'sound+vibrate',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursCriticalOnly: true,
  magnitudeBasedSound: true,
  magnitudeBasedVibration: true,
  notificationShowOnLockScreen: true,
  notificationShowPreview: true,
  notificationGroupByMagnitude: false,

  // ELITE: Compliance
  eulaAccepted: false,
  blockedUsers: [],
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
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
      setNews: (enabled) => set({ newsEnabled: enabled }),

      // ELITE: Comprehensive Earthquake Settings Actions
      setMinMagnitudeForNotification: (magnitude) => set({ minMagnitudeForNotification: Math.max(0, Math.min(10, magnitude)) }),
      setMaxDistanceForNotification: (distance) => set({ maxDistanceForNotification: Math.max(0, distance) }),
      setCriticalMagnitudeThreshold: (magnitude) => set({ criticalMagnitudeThreshold: Math.max(0, Math.min(10, magnitude)) }),
      setCriticalDistanceThreshold: (distance) => set({ criticalDistanceThreshold: Math.max(0, distance) }),
      setEewMinMagnitude: (magnitude) => set({ eewMinMagnitude: Math.max(0, Math.min(10, magnitude)) }),
      setEewWarningTime: (seconds) => set({ eewWarningTime: Math.max(0, Math.min(60, seconds)) }),
      setSensorSensitivity: (sensitivity) => set({ sensorSensitivity: sensitivity }),
      setSensorFalsePositiveFilter: (enabled) => set({ sensorFalsePositiveFilter: enabled }),
      setSourceAFAD: (enabled) => set({ sourceAFAD: enabled }),
      setSourceUSGS: (enabled) => set({ sourceUSGS: enabled }),
      setSourceEMSC: (enabled) => set({ sourceEMSC: enabled }),
      setSourceKOERI: (enabled) => set({ sourceKOERI: enabled }),
      setSourceCommunity: (enabled) => set({ sourceCommunity: enabled }),
      setSelectedObservatory: (observatory) => set({ selectedObservatory: observatory }),
      setNotificationPush: (enabled) => set({ notificationPush: enabled }),
      setNotificationFullScreen: (enabled) => set({ notificationFullScreen: enabled }),
      setNotificationSound: (enabled) => set({ notificationSound: enabled }),
      setNotificationVibration: (enabled) => set({ notificationVibration: enabled }),
      setNotificationTTS: (enabled) => set({ notificationTTS: enabled }),
      setPriorityCritical: (priority) => set({ priorityCritical: priority }),
      setPriorityHigh: (priority) => set({ priorityHigh: priority }),
      setPriorityMedium: (priority) => set({ priorityMedium: priority }),
      setPriorityLow: (priority) => set({ priorityLow: priority }),

      // ELITE: Advanced Notification Settings Actions
      setNotificationSoundType: (type) => set({ notificationSoundType: type }),
      setNotificationSoundVolume: (volume) => set({ notificationSoundVolume: Math.max(0, Math.min(100, volume)) }),
      setNotificationSoundRepeat: (repeat) => set({ notificationSoundRepeat: Math.max(1, Math.min(10, repeat)) }),
      setNotificationMode: (mode) => set({ notificationMode: mode }),
      setQuietHoursEnabled: (enabled) => set({ quietHoursEnabled: enabled }),
      setQuietHoursStart: (time) => set({ quietHoursStart: time }),
      setQuietHoursEnd: (time) => set({ quietHoursEnd: time }),
      setQuietHoursCriticalOnly: (enabled) => set({ quietHoursCriticalOnly: enabled }),
      setMagnitudeBasedSound: (enabled) => set({ magnitudeBasedSound: enabled }),
      setMagnitudeBasedVibration: (enabled) => set({ magnitudeBasedVibration: enabled }),
      setNotificationShowOnLockScreen: (enabled) => set({ notificationShowOnLockScreen: enabled }),
      setNotificationShowPreview: (enabled) => set({ notificationShowPreview: enabled }),
      setNotificationGroupByMagnitude: (enabled) => set({ notificationGroupByMagnitude: enabled }),

      // ELITE: Compliance
      setEulaAccepted: (accepted) => set({ eulaAccepted: accepted }),

      blockUser: (userId) => set((state) => ({
        blockedUsers: state.blockedUsers.includes(userId) ? state.blockedUsers : [...state.blockedUsers, userId],
      })),
      unblockUser: (userId) => set((state) => ({
        blockedUsers: state.blockedUsers.filter((id) => id !== userId),
      })),
      isUserBlocked: (userId) => get().blockedUsers.includes(userId),

      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'afetnet-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

