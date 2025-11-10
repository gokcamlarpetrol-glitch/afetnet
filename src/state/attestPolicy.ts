import { create } from 'zustand';
type S = { thresholdM: number; setM:(m:number)=>void };
export const useAttestPolicy = create<S>((set)=>({
  thresholdM: 2,
  setM: (m)=>set({ thresholdM: Math.max(1, Math.min(10, m|0)) }),
}));



