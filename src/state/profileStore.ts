import { create } from "zustand";

export type ResilienceProfile = "normal" | "low_power" | "silent";

type S = {
  profile: ResilienceProfile;
  setProfile: (p: ResilienceProfile)=>void;
};

export const useProfile = create<S>((set)=>({
  profile: "normal",
  setProfile: (p)=>set({ profile: p })
}));



