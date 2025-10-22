import { create } from 'zustand';

type S = {
  sensorDetect: boolean;     // sensör tabanlı tespit aktif
  unconsciousMode: boolean;  // onay beklemeden auto-SOS
  setSensorDetect: (v:boolean)=>void;
  setUnconsciousMode: (v:boolean)=>void;
};

export const useSafety = create<S>((set)=>({
  sensorDetect: true,
  unconsciousMode: false,
  setSensorDetect: (v)=>set({ sensorDetect: v }),
  setUnconsciousMode: (v)=>set({ unconsciousMode: v }),
}));



