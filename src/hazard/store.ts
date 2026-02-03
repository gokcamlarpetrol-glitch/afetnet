/**
 * HAZARD STORE - Hazard Map and Risk Data Management
 * Zustand store for hazard zones and risk assessment
 */

import { create } from 'zustand';
import { createLogger } from '../core/utils/logger';

const logger = createLogger('HazardStore');

export interface HazardZone {
    id: string;
    type: 'earthquake' | 'tsunami' | 'landslide' | 'flood' | 'fire';
    severity: 'low' | 'medium' | 'high' | 'critical';
    coordinates: Array<{ latitude: number; longitude: number }>;
    name: string;
    description?: string;
    lastUpdated: number;
}

export interface SafePoint {
    id: string;
    name: string;
    type: 'hospital' | 'shelter' | 'fire_station' | 'police' | 'meeting_point';
    latitude: number;
    longitude: number;
    capacity?: number;
    phone?: string;
    isOperational: boolean;
}

interface HazardState {
    hazardZones: HazardZone[];
    safePoints: SafePoint[];
    isLoading: boolean;
    lastFetchTime: number;
    userRiskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
}

interface HazardActions {
    setHazardZones: (zones: HazardZone[]) => void;
    setSafePoints: (points: SafePoint[]) => void;
    setLoading: (loading: boolean) => void;
    setUserRiskLevel: (level: HazardState['userRiskLevel']) => void;
    reset: () => void;
}

const initialState: HazardState = {
  hazardZones: [],
  safePoints: [],
  isLoading: false,
  lastFetchTime: 0,
  userRiskLevel: 'unknown',
};

export const useHazardStore = create<HazardState & HazardActions>((set) => ({
  ...initialState,

  setHazardZones: (zones) => {
    set({
      hazardZones: zones,
      lastFetchTime: Date.now(),
    });
  },

  setSafePoints: (points) => {
    set({ safePoints: points });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setUserRiskLevel: (level) => {
    set({ userRiskLevel: level });
  },

  reset: () => {
    set(initialState);
  },
}));


// ELITE: Export helper for external usage
export const listHazards = async (): Promise<HazardZone[]> => {
  return useHazardStore.getState().hazardZones;
};

export default useHazardStore;
