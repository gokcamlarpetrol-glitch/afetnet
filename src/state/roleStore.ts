import { create } from "zustand";
export type Role = "leader"|"coordinator"|"volunteer";
type S = { role: Role; setRole:(r:Role)=>void };
export const useRole = create<S>((set)=>({ role:"volunteer", setRole:(r)=>set({ role:r }) }));



