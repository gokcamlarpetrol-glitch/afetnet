import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ProviderKey = 'USGS' | 'AFAD' | 'KANDILLI';
export type RegionFilter = 
  | { type: 'province'; codes: string[] } 
  | { type: 'circle'; lat: number; lon: number; km: number } 
  | { type: 'all' };

export type EewSettings = {
  quakeProvider: ProviderKey;
  magThreshold: number;
  liveMode: boolean;
  pollFastMs: number;
  pollSlowMs: number;
  region: RegionFilter;
  experimentalPWave: boolean;
  selectedProvinces: string[];
};

export type QuakeProvider = ProviderKey;

export function ensureDefaults(settings: Partial<Settings>): Settings {
  const defaults = { ...defaultSettings };
  
  // Enforce magThreshold: 3.5
  if (settings.magThreshold == null || Number.isNaN(settings.magThreshold)) {
    settings.magThreshold = 3.5;
  } else if (settings.magThreshold < 2.0 || settings.magThreshold > 7.5) {
    settings.magThreshold = 3.5;
  }
  
  // Ensure other required defaults
  if (settings.liveMode == null) {
    settings.liveMode = true;
  }
  
  if (typeof settings.pollFastMs !== 'number') {
    settings.pollFastMs = 5000;
  }
  
  if (typeof settings.pollSlowMs !== 'number') {
    settings.pollSlowMs = 60000;
  }
  
  return { ...defaults, ...settings };
}

export interface Settings {
  quakeProvider: QuakeProvider;
  magThreshold: number;
  pollMs: number;
  relayTTL: number;
  tapDetectionEnabled: boolean;
  tapThreshold: number;
  tapWindowMs: number;
  tapRequiredTaps: number;
  emergencyMode: boolean;
  batterySaver: boolean;
  aggressiveBeacon: boolean;
  uiHighContrast: boolean;
  // EEW Lite settings
  liveMode: boolean;
  pollFastMs: number;
  pollSlowMs: number;
  region: RegionFilter;
  experimentalPWave: boolean;
  // FCM Push settings
  selectedProvinces: string[];
}

type SettingsState = Settings & {
  updateSettings: (updates: Partial<Settings>) => void;
  resetToDefaults: () => void;
};

const defaultSettings: Settings = {
  quakeProvider: 'AFAD',
  magThreshold: 3.5, // ENFORCED GLOBAL DEFAULT
  pollMs: 90000, // 90 seconds
  relayTTL: 5,
  tapDetectionEnabled: false,
  tapThreshold: 2.5,
  tapWindowMs: 10000, // 10 seconds
  tapRequiredTaps: 3,
  emergencyMode: false,
  batterySaver: false,
  aggressiveBeacon: false,
  uiHighContrast: false,
  // EEW Lite defaults
  liveMode: true,
  pollFastMs: 5000, // 5 seconds
  pollSlowMs: 60000, // 60 seconds
  region: { type: 'all' },
  experimentalPWave: false,
  // FCM Push defaults
  selectedProvinces: []
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      
      updateSettings: (updates) => {
        set((state) => ({ ...state, ...updates }));
      },
      
      resetToDefaults: () => {
        set(defaultSettings);
      }
    }),
    {
      name: 'afn/settings/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migrations if needed
        return ensureDefaults(persistedState || {});
      }
    }
  )
);