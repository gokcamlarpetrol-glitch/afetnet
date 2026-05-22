import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { eliteStorage, DirectStorage, waitForStorageReady } from '../utils/storage';

interface OnboardingState {
  completed: boolean;
  isHydrated: boolean;
  setCompleted: (completed: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
}

// CRITICAL FIX: Read onboarding state SYNCHRONOUSLY from MMKV before Zustand hydration.
// Zustand's persist middleware hydrates ASYNCHRONOUSLY, which means on first render
// `completed` is `false` even if MMKV has `true`. This causes the app to flash the
// Onboarding screen after being killed in background and reopened.
// By reading MMKV synchronously here, we get the correct initial value BEFORE first render.
const getInitialCompleted = (): boolean => {
  try {
    // Use DirectStorage (pure synchronous MMKV) instead of eliteStorage
    // (which has async TypeScript type from Zustand's StateStorage interface)
    const raw = DirectStorage.getString('afetnet-onboarding');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.completed === true) return true;
    }
  } catch {
    // MMKV read failed — try legacy key below
  }
  // CRITICAL FIX: Fallback to legacy direct-write key.
  // If Zustand persist data is corrupted (MMKV encryption key changed,
  // MemoryStorage fallback, etc.), the legacy key written by
  // setOnboardingCompleted() via DirectStorage.setString('AFETNET_ONBOARDING_COMPLETED', '1')
  // still persists correctly because it's stored without Zustand's JSON wrapper.
  try {
    if (DirectStorage.getString('AFETNET_ONBOARDING_COMPLETED') === '1') return true;
  } catch {
    // ignore
  }
  // Final safety net: authenticated returning users should never be forced
  // through onboarding again due storage corruption.
  try {
    if (DirectStorage.getBoolean('afetnet_auth_cached')) return true;
  } catch {
    // ignore
  }
  return false;
};

const initialCompleted = getInitialCompleted();

let onboardingGuardInstalled = false;

const ensureOnboardingGuard = () => {
  if (onboardingGuardInstalled || !getInitialCompleted()) {
    return;
  }
  onboardingGuardInstalled = true;
  useOnboardingStore.subscribe((state, prevState) => {
    // Yalnızca completed gerçekten değiştiyse değerlendir — gereksiz
    // tetiklenmeyi ve guard'ın setState'i ile beslenen döngü riskini önler.
    if (state.completed === prevState.completed) return;
    if (!state.completed) {
      console.warn('[OnboardingStore] completed was set to false despite persistent completed=true — restoring immediately');
      useOnboardingStore.setState({ completed: true });
    }
  });
};

// ELITE: Persisted onboarding store - survives app restart
// CRITICAL FIX: Synchronous initial value prevents onboarding flash on cold start
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: initialCompleted,
      // If we got a synchronous value, we're already hydrated
      isHydrated: initialCompleted,
      setCompleted: (completed) => {
        set({ completed });
        // Immediately sync onboarding completion to cloud (critical for cross-device)
        if (completed) {
          import('../services/SettingsSyncService').then(({ settingsSyncService }) => {
            settingsSyncService.flushSync().catch(e => { if (__DEV__) console.debug('Settings flush failed:', e); });
          }).catch(e => { if (__DEV__) console.debug('SettingsSyncService import failed:', e); });
        }
      },
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
    }),
    {
      name: 'afetnet-onboarding',
      storage: createJSONStorage(() => eliteStorage),
      onRehydrateStorage: () => (state, error) => {
        // CRITICAL: Mark hydrated on success OR error - app must continue either way
        if (error) {
          if (__DEV__) console.warn('[OnboardingStore] Hydration error, using defaults:', error);
        }
        // CRITICAL FIX: Restore synchronous value if hydration overwrote it.
        // Zustand persist shallow-merges stored JSON over initial state.
        // If stored JSON has completed:false (corrupted/stale), it overwrites
        // the synchronous initialCompleted=true. We must restore it.
        if (state && !state.completed && initialCompleted) {
          useOnboardingStore.setState({ completed: true, isHydrated: true });
        } else if (state) {
          state.setHydrated(true);
        } else {
          // Fallback: directly update store if state is null
          useOnboardingStore.setState({ isHydrated: true, completed: getInitialCompleted() });
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
    if (__DEV__) console.warn('[OnboardingStore] Hydration timeout - forcing hydrated state');
    useOnboardingStore.setState({ isHydrated: true });
  }
}, 3000);

ensureOnboardingGuard();

waitForStorageReady().then(() => {
  const completed = getInitialCompleted();
  const state = useOnboardingStore.getState();
  if (completed && !state.completed) {
    useOnboardingStore.setState({ completed: true, isHydrated: true });
  } else if (!state.isHydrated) {
    useOnboardingStore.setState({ isHydrated: true });
  }
  ensureOnboardingGuard();
}).catch((error) => {
  if (__DEV__) console.warn('[OnboardingStore] Storage readiness wait failed:', error);
});
