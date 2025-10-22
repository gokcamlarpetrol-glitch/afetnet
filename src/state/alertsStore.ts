import { create } from 'zustand';
type AlertsState = {
  enableProximityAlerts: boolean;
  showOnlyNearby: boolean;
  proximityMeters: number;
  setEnable: (v:boolean)=>void;
  setShowNearby: (v:boolean)=>void;
  setMeters: (m:number)=>void;
};
export const useAlerts = create<AlertsState>((set)=>({
  enableProximityAlerts: true,
  showOnlyNearby: true,
  proximityMeters: 300,
  setEnable: (v)=>set({ enableProximityAlerts: v }),
  setShowNearby: (v)=>set({ showOnlyNearby: v }),
  setMeters: (m)=>set({ proximityMeters: Math.max(100, Math.min(1000, m|0)) }),
}));



