/**
 * TRIAL STORE - 3 Day Trial Management
 * Manages free trial period for premium features
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { usePremiumStore } from './premiumStore';

const TRIAL_START_KEY = 'afetnet_trial_start';
const TRIAL_DURATION_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * MS_PER_DAY;
const TRIAL_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let trialMonitor: NodeJS.Timeout | null = null;
let trialExpiryTimeout: NodeJS.Timeout | null = null;

interface TrialState {
  trialStartTime: number | null;
  isTrialActive: boolean;
  daysRemaining: number;
  hoursRemaining: number;
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
  hoursRemaining: 0,
  isLoading: true,
};

const computeTrialStatus = (startTime: number) => {
  const now = Date.now();
  const elapsed = now - startTime;
  const remainingMs = TRIAL_DURATION_MS - elapsed;
  const isActive = remainingMs > 0;
  const daysRemaining = isActive ? Math.max(0, Math.ceil(remainingMs / MS_PER_DAY)) : 0;
  const hoursRemaining = isActive ? Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000))) : 0;

  return {
    isActive,
    daysRemaining,
    hoursRemaining,
    remainingMs: Math.max(0, remainingMs),
  };
};

const syncPremiumAccess = (isTrialActive: boolean) => {
  const premiumState = usePremiumStore.getState();
  const hasPaidSubscription = premiumState.subscriptionType !== null;

  if (!hasPaidSubscription) {
    premiumState.setPremium(isTrialActive);
  }
};

const startTrialMonitor = (recompute: () => void) => {
  if (trialMonitor) {
    return;
  }

  trialMonitor = setInterval(() => {
    recompute();
  }, TRIAL_REFRESH_INTERVAL);
};

const stopTrialMonitor = () => {
  if (trialMonitor) {
    clearInterval(trialMonitor);
    trialMonitor = null;
  }

  if (trialExpiryTimeout) {
    clearTimeout(trialExpiryTimeout);
    trialExpiryTimeout = null;
  }
};

export const useTrialStore = create<TrialState & TrialActions>((set, get) => ({
  ...initialState,

  initializeTrial: async () => {
    try {
      set({ isLoading: true });

      // Check if trial already started
      const storedStart = await SecureStore.getItemAsync(TRIAL_START_KEY);

      const startTime = storedStart ? parseInt(storedStart, 10) : Date.now();

      if (!storedStart) {
        await SecureStore.setItemAsync(TRIAL_START_KEY, String(startTime));
      }

      const applyState = () => {
        const { isActive, daysRemaining, hoursRemaining, remainingMs } = computeTrialStatus(startTime);

        set({
          trialStartTime: startTime,
          isTrialActive: isActive,
          daysRemaining,
          hoursRemaining,
          isLoading: false,
        });

        syncPremiumAccess(isActive);

        if (!isActive) {
          stopTrialMonitor();
        } else {
          // If trial will expire sooner than refresh interval, schedule immediate check
          if (remainingMs < TRIAL_REFRESH_INTERVAL) {
            if (trialExpiryTimeout) {
              clearTimeout(trialExpiryTimeout);
            }

            trialExpiryTimeout = setTimeout(() => {
              const { isActive: stillActive, daysRemaining: nextDays, hoursRemaining: nextHours } = computeTrialStatus(startTime);
              set({
                isTrialActive: stillActive,
                daysRemaining: nextDays,
                hoursRemaining: nextHours,
              });
              syncPremiumAccess(stillActive);
              if (!stillActive) {
                stopTrialMonitor();
              }
            }, remainingMs + 1000);
          }
        }

        return isActive;
      };

      const active = applyState();

      if (active) {
        startTrialMonitor(applyState);
      }
    } catch (error) {
      // Use logger instead of console.error for production safety
      const { createLogger } = require('../utils/logger');
      const logger = createLogger('TrialStore');
      logger.error('Initialize error:', error);
      // On error, give user trial
      set({
        trialStartTime: Date.now(),
        isTrialActive: true,
        daysRemaining: TRIAL_DURATION_DAYS,
        hoursRemaining: TRIAL_DURATION_DAYS * 24,
        isLoading: false,
      });
      syncPremiumAccess(true);
      startTrialMonitor(() => {
        const { trialStartTime } = get();
        if (!trialStartTime) {
          return false;
        }
        const { isActive, daysRemaining, hoursRemaining } = computeTrialStatus(trialStartTime);
        set({ isTrialActive: isActive, daysRemaining, hoursRemaining });
        syncPremiumAccess(isActive);
        if (!isActive) {
          stopTrialMonitor();
        }
        return isActive;
      });
    }
  },

  checkTrialStatus: () => {
    const { trialStartTime, isTrialActive } = get();

    if (!trialStartTime) {
      return false;
    }

    const { isActive, daysRemaining, hoursRemaining } = computeTrialStatus(trialStartTime);
    set({
      isTrialActive: isActive,
      daysRemaining,
      hoursRemaining,
    });
    syncPremiumAccess(isActive);
    if (!isActive) {
      stopTrialMonitor();
    }

    return isActive;
  },

  getRemainingDays: () => {
    const { daysRemaining } = get();
    return daysRemaining;
  },

  getRemainingHours: () => {
    const { hoursRemaining } = get();
    return hoursRemaining;
  },

  endTrial: async () => {
    try {
      await SecureStore.deleteItemAsync(TRIAL_START_KEY);
      set({
        trialStartTime: null,
        isTrialActive: false,
        daysRemaining: 0,
        hoursRemaining: 0,
      });
      syncPremiumAccess(false);
      stopTrialMonitor();
    } catch (error) {
      // Use logger instead of console.error for production safety
      const { createLogger } = require('../utils/logger');
      const logger = createLogger('TrialStore');
      logger.error('End trial error:', error);
    }
  },
}));


