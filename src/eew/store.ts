/**
 * EEW STORE - Early Earthquake Warning State Management
 * Zustand store for EEW alerts and status
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { eliteStorage } from '../core/utils/storage';
import { createLogger } from '../core/utils/logger';

const logger = createLogger('EEWStore');

export interface EEWAlert {
    id: string;
    magnitude: number;
    latitude: number;
    longitude: number;
    depth: number;
    location: string;
    timestamp: number;
    estimatedArrivalTime?: number;
    estimatedIntensity?: number;
    source: string;
    verified: boolean;
    distance?: number;
}

interface EEWState {
    // Current active alert (if any)
    activeAlert: EEWAlert | null;

    // Recent alerts history
    recentAlerts: EEWAlert[];

    // EEW service status
    isEnabled: boolean;
    isConnected: boolean;
    lastUpdateTime: number;

    // User location for distance calculation
    userLocation: { latitude: number; longitude: number } | null;
}

interface EEWActions {
    setActiveAlert: (alert: EEWAlert | null) => void;
    addRecentAlert: (alert: EEWAlert) => void;
    clearActiveAlert: () => void;
    setEnabled: (enabled: boolean) => void;
    setConnected: (connected: boolean) => void;
    setUserLocation: (location: { latitude: number; longitude: number } | null) => void;
    setStatus: (status: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected', message?: string) => void;
    setActive: (active: boolean) => void;
    reset: () => void;
}

const initialState: EEWState = {
  activeAlert: null,
  recentAlerts: [],
  isEnabled: false,
  isConnected: false,
  lastUpdateTime: 0,
  userLocation: null,
};

export const useEEWStore = create<EEWState & EEWActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setActiveAlert: (alert) => {
        set({
          activeAlert: alert,
          lastUpdateTime: Date.now(),
        });
        if (alert) {
          get().addRecentAlert(alert);
        }
      },

      addRecentAlert: (alert) => {
        set((state) => ({
          recentAlerts: [alert, ...state.recentAlerts].slice(0, 50), // Keep last 50
        }));
      },

      clearActiveAlert: () => {
        set({ activeAlert: null });
      },

      setEnabled: (enabled) => {
        set({ isEnabled: enabled });
        if (__DEV__) {
          logger.info('EEW enabled:', enabled);
        }
      },

      setConnected: (connected) => {
        set({ isConnected: connected });
      },

      setUserLocation: (location) => {
        set({ userLocation: location });
      },

      setStatus: (status, _message) => {
        // Map status to connected state (message is for logging only)
        set({ isConnected: status === 'connected' });
      },

      setActive: (active) => {
        set({ isEnabled: active });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'eew-storage',
      storage: createJSONStorage(() => eliteStorage),
      partialize: (state) => ({
        recentAlerts: state.recentAlerts,
        isEnabled: state.isEnabled,
      }),
    },
  ),
);

export default useEEWStore;
