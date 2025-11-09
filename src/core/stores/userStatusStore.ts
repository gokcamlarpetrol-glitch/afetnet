/**
 * USER STATUS STORE
 * Tracks user safety status and location
 */

import { create } from 'zustand';

export type UserStatus = 'safe' | 'needs_help' | 'trapped' | 'sos' | 'offline';

interface Location {
  latitude: number;
  longitude: number;
}

interface UserStatusState {
  status: UserStatus;
  location: Location | null;
  lastUpdate: number;
  sosTriggered: boolean;
  batteryLevel: number;
}

interface UserStatusActions {
  setStatus: (status: UserStatus) => Promise<void>;
  setLocation: (location: Location) => Promise<void>;
  setSosTriggered: (triggered: boolean) => void;
  setBatteryLevel: (level: number) => void;
  reset: () => void;
}

const initialState: UserStatusState = {
  status: 'safe',
  location: null,
  lastUpdate: Date.now(),
  sosTriggered: false,
  batteryLevel: 100,
};

export const useUserStatusStore = create<UserStatusState & UserStatusActions>((set, get) => ({
  ...initialState,

  setStatus: async (status) => {
    set({ status, lastUpdate: Date.now() });
    
    // Save to Firebase
    try {
      const { getDeviceId } = await import('../../lib/device');
      const deviceId = await getDeviceId();
      if (deviceId) {
        const { firebaseDataService } = await import('../services/FirebaseDataService');
        if (firebaseDataService.isInitialized) {
          const { location } = get();
          await firebaseDataService.saveStatusUpdate(deviceId, {
            status,
            location: location || null,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to save status to Firebase:', error);
    }
  },
  
  setLocation: async (location) => {
    set({ location, lastUpdate: Date.now() });
    
    // Save to Firebase
    try {
      const { getDeviceId } = await import('../../lib/device');
      const deviceId = await getDeviceId();
      if (deviceId) {
        const { firebaseDataService } = await import('../services/FirebaseDataService');
        if (firebaseDataService.isInitialized) {
          await firebaseDataService.saveLocationUpdate(deviceId, {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: null,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to save location to Firebase:', error);
    }
  },
  
  setSosTriggered: (triggered) => set({ sosTriggered: triggered }),
  
  setBatteryLevel: (level) => set({ batteryLevel: level }),
  
  updateStatus: async (status, location) => {
    set({ status, location: location || null, lastUpdate: Date.now() });
    
    // Save to Firebase
    try {
      const { getDeviceId } = await import('../../lib/device');
      const deviceId = await getDeviceId();
      if (deviceId) {
        const { firebaseDataService } = await import('../services/FirebaseDataService');
        if (firebaseDataService.isInitialized) {
          await firebaseDataService.saveStatusUpdate(deviceId, {
            status,
            location: location || null,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to save status to Firebase:', error);
    }
  },
  
  reset: () => set(initialState),
}));

