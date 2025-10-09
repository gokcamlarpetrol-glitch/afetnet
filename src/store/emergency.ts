import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { integrateSOSWithICE, updateSOSStatus } from '../fallback/sosIntegration';

export interface EmergencyState {
  enabled: boolean;
  batterySaver: boolean;
  beaconAggressive: boolean;
  uiHighContrast: boolean;
  activatedAt?: number;
  duration?: number; // in milliseconds
  // Dead man switch settings
  deadManEnabled: boolean;
  deadManIntervalMin: number;
  // Ultra battery mode settings
  ultra: boolean;
  pulseMs: number;
  screenDim: boolean;
  bigText: boolean;
  highContrast: boolean;
}

type EmergencyActions = {
  enable: () => void;
  disable: () => void;
  updateSettings: (settings: Partial<EmergencyState>) => void;
  updateSOSStatus: (statuses: string[]) => void;
  isActive: () => boolean;
  getRemainingTime: () => number; // milliseconds
};

export const useEmergency = create<EmergencyState & EmergencyActions>()(
  persist(
    (set, get) => ({
      enabled: false,
      batterySaver: false,
      beaconAggressive: false,
      uiHighContrast: false,
      activatedAt: undefined,
      duration: 2 * 60 * 1000, // 2 minutes default
      // Dead man switch defaults
      deadManEnabled: true,
      deadManIntervalMin: 10,
      // Ultra battery mode defaults
      ultra: false,
      pulseMs: 15000,
      screenDim: true,
      bigText: true,
      highContrast: true,
      
      enable: () => {
        const now = Date.now();
        set({
          enabled: true,
          activatedAt: now
        });
        
        // Integrate with ICE contacts for SMS fallback
        try {
          integrateSOSWithICE();
        } catch (error) {
          console.error('Failed to integrate SOS with ICE:', error);
        }
      },
      
      disable: () => {
        set({
          enabled: false,
          activatedAt: undefined
        });
      },
      
      updateSettings: (settings) => {
        set((state) => ({ ...state, ...settings }));
      },
      
      updateSOSStatus: (statuses) => {
        // Update SOS status and integrate with ICE contacts
        try {
          updateSOSStatus(statuses);
        } catch (error) {
          console.error('Failed to update SOS status with ICE:', error);
        }
      },
      
      isActive: () => {
        const state = get();
        if (!state.enabled || !state.activatedAt) {
          return false;
        }
        
        const elapsed = Date.now() - state.activatedAt;
        return elapsed < (state.duration || 2 * 60 * 1000);
      },
      
      getRemainingTime: () => {
        const state = get();
        if (!state.enabled || !state.activatedAt) {
          return 0;
        }
        
        const elapsed = Date.now() - state.activatedAt;
        const duration = state.duration || 2 * 60 * 1000;
        return Math.max(0, duration - elapsed);
      }
    }),
    {
      name: 'afn/emergency/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1
    }
  )
);
