import { create } from "zustand";
type P2PState = { enabled: boolean; setEnabled: (v:boolean)=>void; };
export const useP2P = create<P2PState>(set=>({ enabled:false, setEnabled:(v)=>set({enabled:v}) }));



