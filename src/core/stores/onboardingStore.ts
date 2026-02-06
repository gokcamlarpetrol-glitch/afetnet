import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingState {
  completed: boolean;
  isHydrated: boolean;
  setCompleted: (completed: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
}

// ELITE: Persisted onboarding store - survives app restart
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      isHydrated: false,
      setCompleted: (completed) => set({ completed }),
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
    }),
    {
      name: 'afetnet-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // Mark as hydrated when storage loads
        state?.setHydrated(true);
      },
    }
  )
);
