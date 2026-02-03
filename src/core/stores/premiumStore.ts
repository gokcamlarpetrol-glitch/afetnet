/**
 * PREMIUM STORE - AfetNet Free Model
 * Tüm özellikler ücretsiz ve sınırsız - uygulama içi satın alım yok
 */

import { create } from 'zustand';
import { createLogger } from '../utils/logger';

const logger = createLogger('PremiumStore');

export type SubscriptionType = 'monthly' | 'yearly' | null;

interface PremiumState {
  isPremium: boolean;
  subscriptionType: SubscriptionType;
  expiresAt: number | null;
  isLoading: boolean;
  isLifetime: boolean;
  lastChecked: number;
}

interface PremiumActions {
  setPremium: (isPremium: boolean, subscriptionType?: SubscriptionType, expiresAt?: number | null, isLifetime?: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  checkExpiration: () => boolean;
  clear: () => void;
  getStatus: () => PremiumState;
}

// AFETNET: Tüm kullanıcılar premium - ücretsiz model
const initialState: PremiumState = {
  isPremium: true, // AFETNET: Her zaman premium
  subscriptionType: null,
  expiresAt: null,
  isLoading: false,
  isLifetime: true, // AFETNET: Lifetime access
  lastChecked: Date.now(),
};

// ELITE: Validation helpers
const validateExpiresAt = (expiresAt: number | null | undefined): number | null => {
  if (expiresAt === null || expiresAt === undefined) return null;
  if (typeof expiresAt !== 'number' || isNaN(expiresAt) || expiresAt <= 0) {
    logger.warn('Invalid expiresAt value:', expiresAt);
    return null;
  }
  return expiresAt;
};

const validateSubscriptionType = (type: SubscriptionType | undefined): SubscriptionType => {
  if (type === undefined || type === null) return null;
  if (type !== 'monthly' && type !== 'yearly') {
    logger.warn('Invalid subscriptionType:', type);
    return null;
  }
  return type;
};

export const usePremiumStore = create<PremiumState & PremiumActions>((set, get) => ({
  ...initialState,

  setPremium: (isPremium, subscriptionType, expiresAt, isLifetime = false) => {
    try {
      // ELITE: Validate all inputs
      const validatedSubscriptionType = validateSubscriptionType(subscriptionType);
      const validatedExpiresAt = validateExpiresAt(expiresAt);

      // ELITE: Determine if lifetime based on parameters with strict validation
      // Lifetime: explicitly marked as lifetime (isLifetime === true)
      // Trial users: subscriptionType is null, expiresAt is null, isPremium true/false, isLifetime should be false
      // Regular subscriptions: subscriptionType is 'monthly'|'yearly', expiresAt is number, isLifetime should be false

      // ELITE: Only mark as lifetime if explicitly set to true AND conditions match
      const isLifetimeSubscription = isLifetime === true &&
        validatedSubscriptionType === null &&
        validatedExpiresAt === null &&
        isPremium === true;

      // ELITE: Log state changes for debugging (production-safe)
      if (__DEV__) {
        logger.info('Premium state updated:', {
          isPremium,
          subscriptionType: validatedSubscriptionType,
          expiresAt: validatedExpiresAt,
          isLifetime: isLifetimeSubscription,
        });
      }

      set({
        isPremium: Boolean(isPremium), // ELITE: Ensure boolean
        subscriptionType: validatedSubscriptionType,
        expiresAt: validatedExpiresAt,
        isLoading: false,
        isLifetime: isLifetimeSubscription,
        lastChecked: Date.now(),
      });
    } catch (error) {
      logger.error('setPremium error:', error);
      // ELITE: Fail-safe - don't crash, just log error
    }
  },

  setLoading: (isLoading) => {
    try {
      set({ isLoading: Boolean(isLoading) });
    } catch (error) {
      logger.error('setLoading error:', error);
    }
  },

  checkExpiration: () => {
    try {
      const { isPremium, expiresAt, subscriptionType, isLifetime, lastChecked } = get();

      // ELITE: Rate limiting - don't check too frequently (max once per minute)
      const now = Date.now();
      if (now - lastChecked < 60000 && isPremium && !expiresAt) {
        // Recent check, no expiration - skip check
        return isPremium;
      }

      // CRITICAL: Lifetime subscriptions never expire
      if (isLifetime && isPremium) {
        return true; // Lifetime subscription - never expires
      }

      // ELITE: Validate expiresAt before comparison
      if (!expiresAt || typeof expiresAt !== 'number' || isNaN(expiresAt)) {
        // No expiration date - could be lifetime or trial
        return isPremium;
      }

      // CRITICAL: Check if subscription expired
      if (isPremium && expiresAt > 0 && now > expiresAt) {
        // Subscription expired - check if trial is still active
        // ELITE: Dynamic require prevents circular dependency between premiumStore and trialStore
        // This is the only safe way to access trialStore from premiumStore without causing import loops
        try {
           
          const trialStoreModule = require('./trialStore') as { useTrialStore: { getState: () => { isTrialActive: boolean } } };
          // CRITICAL: Read state directly WITHOUT calling checkTrialStatus to avoid circular dependency
          // checkTrialStatus() triggers syncPremiumAccess() which calls back here → infinite loop
          const { isTrialActive } = trialStoreModule.useTrialStore.getState();

          if (isTrialActive) {
            // Trial still active - keep premium access
            logger.info('Subscription expired but trial active - keeping premium access');
            return true;
          } else {
            // No trial, subscription expired - revoke premium
            logger.info('Subscription expired and no trial - revoking premium');
            set({
              isPremium: false,
              subscriptionType: null,
              expiresAt: null,
              isLifetime: false,
              lastChecked: now,
            });
            return false;
          }
        } catch (trialError) {
          logger.error('Trial check error during expiration:', trialError);
          // ELITE: Fail-safe - if trial check fails, revoke premium
          set({
            isPremium: false,
            subscriptionType: null,
            expiresAt: null,
            isLifetime: false,
            lastChecked: now,
          });
          return false;
        }
      }

      // ELITE: Update lastChecked timestamp
      if (now - lastChecked >= 60000) {
        set({ lastChecked: now });
      }

      return isPremium;
    } catch (error) {
      logger.error('checkExpiration error:', error);
      // ELITE: Fail-safe - return current premium status
      return get().isPremium;
    }
  },

  getStatus: () => {
    try {
      return get();
    } catch (error) {
      logger.error('getStatus error:', error);
      return initialState;
    }
  },

  clear: () => {
    try {
      set(initialState);
      logger.info('Premium store cleared');
    } catch (error) {
      logger.error('clear error:', error);
    }
  },
}));

