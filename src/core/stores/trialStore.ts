/**
 * TRIAL STORE - 3 Day Trial Management
 * Manages free trial period for premium features
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TRIAL_START_KEY = 'afetnet_trial_start';
const TRIAL_DURATION_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface TrialState {
  trialStartTime: number | null;
  isTrialActive: boolean;
  daysRemaining: number;
  isLoading: boolean;
}

interface TrialActions {
  initializeTrial: () => Promise<void>;
  checkTrialStatus: () => boolean;
  getRemainingDays: () => number;
  getRemainingHours: () => number;
  endTrial: () => Promise<void>;
}

const initialState: TrialState = {
  trialStartTime: null,
  isTrialActive: false,
  daysRemaining: 0,
  isLoading: true,
};

export const useTrialStore = create<TrialState & TrialActions>((set, get) => ({
  ...initialState,

  initializeTrial: async () => {
    try {
      set({ isLoading: true });

      // Check if trial already started
      const storedStart = await SecureStore.getItemAsync(TRIAL_START_KEY);

      if (storedStart) {
        // Trial already started
        const startTime = parseInt(storedStart, 10);
        const now = Date.now();
        const elapsed = now - startTime;
        const daysElapsed = elapsed / MS_PER_DAY;

        if (daysElapsed < TRIAL_DURATION_DAYS) {
          // Trial still active
          const daysRemaining = Math.ceil(TRIAL_DURATION_DAYS - daysElapsed);
          set({
            trialStartTime: startTime,
            isTrialActive: true,
            daysRemaining,
            isLoading: false,
          });
        } else {
          // Trial expired
          set({
            trialStartTime: startTime,
            isTrialActive: false,
            daysRemaining: 0,
            isLoading: false,
          });
        }
      } else {
        // First time - start trial
        const now = Date.now();
        await SecureStore.setItemAsync(TRIAL_START_KEY, String(now));

        set({
          trialStartTime: now,
          isTrialActive: true,
          daysRemaining: TRIAL_DURATION_DAYS,
          isLoading: false,
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[TrialStore] Initialize error:', error);
      }
      // On error, give user trial
      set({
        trialStartTime: Date.now(),
        isTrialActive: true,
        daysRemaining: TRIAL_DURATION_DAYS,
        isLoading: false,
      });
    }
  },

  checkTrialStatus: () => {
    const { trialStartTime, isTrialActive } = get();

    if (!trialStartTime) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - trialStartTime;
    const daysElapsed = elapsed / MS_PER_DAY;

    if (daysElapsed >= TRIAL_DURATION_DAYS) {
      set({ isTrialActive: false, daysRemaining: 0 });
      return false;
    }

    return isTrialActive;
  },

  getRemainingDays: () => {
    const { trialStartTime } = get();

    if (!trialStartTime) {
      return 0;
    }

    const now = Date.now();
    const elapsed = now - trialStartTime;
    const daysElapsed = elapsed / MS_PER_DAY;
    const remaining = Math.ceil(TRIAL_DURATION_DAYS - daysElapsed);

    return Math.max(0, remaining);
  },

  getRemainingHours: () => {
    const { trialStartTime } = get();

    if (!trialStartTime) {
      return 0;
    }

    const now = Date.now();
    const elapsed = now - trialStartTime;
    const hoursElapsed = elapsed / (60 * 60 * 1000);
    const remaining = Math.ceil((TRIAL_DURATION_DAYS * 24) - hoursElapsed);

    return Math.max(0, remaining);
  },

  endTrial: async () => {
    try {
      await SecureStore.deleteItemAsync(TRIAL_START_KEY);
      set({
        trialStartTime: null,
        isTrialActive: false,
        daysRemaining: 0,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[TrialStore] End trial error:', error);
      }
    }
  },
}));


