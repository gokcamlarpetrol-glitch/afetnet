import { create } from 'zustand';
type EEW = { mag?: number; place?: string; time: number };
 
type EEWState = { live?: EEW; last?: EEW; setLive:(_e?:EEW)=>void; setLast:(_e?:EEW)=>void; };
export const useEEW = create<EEWState>((set)=>({
  live: undefined, last: undefined,
  setLive:(e)=>set({ live:e, last: e ?? undefined }),
  setLast:(e)=>set({ last:e }),
}));
