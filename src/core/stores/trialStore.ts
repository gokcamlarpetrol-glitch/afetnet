/**
 * TRIAL STORE - 3 Day Trial Management
 * Manages free trial period for premium features
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { usePremiumStore } from './premiumStore';
import { createLogger } from '../utils/logger';

const logger = createLogger('TrialStore');

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

// ELITE: Type-safe trial status computation with validation
const computeTrialStatus = (startTime: number): {
  isActive: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  remainingMs: number;
} => {
  try {
    // ELITE: Validate startTime
    if (!startTime || typeof startTime !== 'number' || isNaN(startTime) || startTime <= 0) {
      return {
        isActive: false,
        daysRemaining: 0,
        hoursRemaining: 0,
        remainingMs: 0,
      };
    }
    
    const now = Date.now();
    
    // ELITE: Validate time values
    if (isNaN(now) || now <= 0) {
      return {
        isActive: false,
        daysRemaining: 0,
        hoursRemaining: 0,
        remainingMs: 0,
      };
    }
    
    const elapsed = Math.max(0, now - startTime); // ELITE: Prevent negative elapsed time
    const remainingMs = Math.max(0, TRIAL_DURATION_MS - elapsed);
    const isActive = remainingMs > 0;
    
    // ELITE: Calculate remaining time with proper rounding
    const daysRemaining = isActive ? Math.max(0, Math.ceil(remainingMs / MS_PER_DAY)) : 0;
    const hoursRemaining = isActive ? Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000))) : 0;

    return {
      isActive,
      daysRemaining,
      hoursRemaining,
      remainingMs,
    };
  } catch (error) {
    // ELITE: Fail-safe - return inactive trial on error
    logger.error('computeTrialStatus error:', error);
    return {
      isActive: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      remainingMs: 0,
    };
  }
};

const syncPremiumAccess = (isTrialActive: boolean) => {
  try {
    const premiumState = usePremiumStore.getState();
    
    // ELITE: Type-safe access to isLifetime
    const premiumStateWithLifetime = premiumState as typeof premiumState & { isLifetime?: boolean };
    
    // CRITICAL: Check if user has paid subscription
    // Paid subscriptions have:
    //   - Regular: subscriptionType: 'monthly' | 'yearly', expiresAt: number
    //   - Lifetime: subscriptionType: null, expiresAt: null, isLifetime: true
    // Trial users have: subscriptionType: null, expiresAt: null, isLifetime: false, isPremium: true/false (trial dependent)
    
    // ELITE: Comprehensive paid subscription check
    const hasPaidSubscription = 
      premiumState.subscriptionType !== null || // Monthly/Yearly subscription
      (premiumState.expiresAt !== null && premiumState.expiresAt > 0 && premiumState.isPremium) || // Has valid expiration = paid subscription
      (premiumStateWithLifetime.isLifetime === true); // Lifetime purchase

    // CRITICAL: Only sync trial access if user doesn't have paid subscription
    // If user has premium subscription, don't override it with trial status
    if (!hasPaidSubscription) {
      // ELITE: Set premium with explicit isLifetime: false for trial
      premiumState.setPremium(isTrialActive, null, null, false);
    } else {
      // ELITE: Log when trial sync is skipped due to paid subscription
      if (__DEV__) {
        logger.info('Trial sync skipped - user has paid subscription');
      }
    }
  } catch (error) {
    // ELITE: Fail-safe error handling
    logger.error('syncPremiumAccess error:', error);
    // Don't crash - silently fail
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

      // ELITE: Check if trial already started with error handling
      let storedStart: string | null = null;
      try {
        storedStart = await SecureStore.getItemAsync(TRIAL_START_KEY);
      } catch (storeError) {
        logger.warn('SecureStore read error (non-critical):', storeError);
        // Continue - will create new trial
      }

      // ELITE: Validate and parse stored start time
      let startTime: number;
      if (storedStart) {
        const parsed = parseInt(storedStart, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now()) {
          startTime = parsed;
        } else {
          // ELITE: Invalid stored time - create new trial
          logger.warn('Invalid stored trial start time, creating new trial');
          startTime = Date.now();
          try {
            await SecureStore.setItemAsync(TRIAL_START_KEY, String(startTime));
          } catch (writeError) {
            logger.error('Failed to write trial start time:', writeError);
          }
        }
      } else {
        // ELITE: No stored trial - create new one
        startTime = Date.now();
        try {
          await SecureStore.setItemAsync(TRIAL_START_KEY, String(startTime));
        } catch (writeError) {
          logger.error('Failed to write trial start time:', writeError);
          // Continue anyway - trial will work in memory
        }
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
      // ELITE: Use logger for production safety
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
    try {
      const { trialStartTime } = get();

      // ELITE: Validate trialStartTime
      if (!trialStartTime || typeof trialStartTime !== 'number' || isNaN(trialStartTime)) {
        return false;
      }

      const { isActive, daysRemaining, hoursRemaining } = computeTrialStatus(trialStartTime);
      
      // ELITE: Update state atomically
      set({
        isTrialActive: isActive,
        daysRemaining,
        hoursRemaining,
      });
      
      // ELITE: Sync premium access safely
      syncPremiumAccess(isActive);
      
      // ELITE: Clean up monitor if trial expired
      if (!isActive) {
        stopTrialMonitor();
      }

      return isActive;
    } catch (error) {
      logger.error('checkTrialStatus error:', error);
      // ELITE: Fail-safe - return false on error
      return false;
    }
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
      // ELITE: Use logger for production safety
      logger.error('End trial error:', error);
    }
  },
}));


