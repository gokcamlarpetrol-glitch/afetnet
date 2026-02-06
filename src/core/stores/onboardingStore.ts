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
// CRITICAL FIX: Robust hydration with fallback timeout to prevent black screen
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
      onRehydrateStorage: () => (state, error) => {
        // CRITICAL: Mark hydrated on success OR error - app must continue either way
        if (error) {
          console.warn('[OnboardingStore] Hydration error, using defaults:', error);
        }
        // Always mark as hydrated so app doesn't get stuck
        if (state) {
          state.setHydrated(true);
        } else {
          // Fallback: directly update store if state is null
          useOnboardingStore.setState({ isHydrated: true });
        }
      },
    }
  )
);

// CRITICAL FIX: Fallback timeout - if hydration doesn't complete in 3 seconds, force it
// This prevents black screen on production where persist might silently fail
setTimeout(() => {
  const state = useOnboardingStore.getState();
  if (!state.isHydrated) {
    console.warn('[OnboardingStore] Hydration timeout - forcing hydrated state');
    useOnboardingStore.setState({ isHydrated: true });
  }
}, 3000);
