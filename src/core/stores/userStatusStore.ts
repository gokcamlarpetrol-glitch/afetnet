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
  setStatus: (status: UserStatus) => void;
  setLocation: (location: Location) => void;
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

export const useUserStatusStore = create<UserStatusState & UserStatusActions>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status, lastUpdate: Date.now() }),
  
  setLocation: (location) => set({ location, lastUpdate: Date.now() }),
  
  setSosTriggered: (triggered) => set({ sosTriggered: triggered }),
  
  setBatteryLevel: (level) => set({ batteryLevel: level }),
  
  reset: () => set(initialState),
}));

