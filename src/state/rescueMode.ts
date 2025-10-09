import { create } from "zustand";
export type RescueMode = "life_saving"|"search"|"logistics"|"coordination";
type S = { mode: RescueMode; setMode:(m:RescueMode)=>void };
export const useRescueMode = create<S>((set)=>({ mode:"life_saving", setMode:(m)=>set({ mode:m }) }));



