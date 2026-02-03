import { create } from 'zustand';

interface OnboardingState {
  completed: boolean;
  setCompleted: (completed: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  setCompleted: (completed) => set({ completed }),
}));
