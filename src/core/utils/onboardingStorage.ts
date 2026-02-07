/**
 * ONBOARDING STORAGE - First Launch Detection
 * Manages onboarding completion state with backend sync
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';
import { useOnboardingStore } from '../stores/onboardingStore';

const logger = createLogger('OnboardingStorage');

const LEGACY_ONBOARDING_COMPLETED_KEY = 'AFETNET_ONBOARDING_COMPLETED';
const ONBOARDING_STORE_KEY = 'afetnet-onboarding';

async function getPersistedStoreCompleted(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_STORE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as {
      state?: {
        completed?: boolean;
      };
    };

    return parsed?.state?.completed === true;
  } catch (error) {
    logger.warn('Persisted onboarding store parse failed:', error);
    return false;
  }
}

/**
 * Check if user has completed onboarding
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const inMemoryCompleted = useOnboardingStore.getState().completed;
    if (inMemoryCompleted) return true;

    const persistedStoreCompleted = await getPersistedStoreCompleted();
    if (persistedStoreCompleted) {
      useOnboardingStore.setState({ completed: true, isHydrated: true });
      return true;
    }

    const legacyValue = await AsyncStorage.getItem(LEGACY_ONBOARDING_COMPLETED_KEY);
    const completed = legacyValue === '1';
    if (completed) {
      useOnboardingStore.setState({ completed: true, isHydrated: true });
    }

    return completed;
  } catch (error) {
    logger.error('Error checking onboarding status:', error);
    // Fail-safe: assume onboarding not completed
    return false;
  }
}

/**
 * Mark onboarding as completed with backend sync
 */
export async function setOnboardingCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(LEGACY_ONBOARDING_COMPLETED_KEY, '1');
    useOnboardingStore.setState({ completed: true, isHydrated: true });
    logger.info('Onboarding marked as completed');

    // ELITE: Sync with backend (fire-and-forget)
    // Backend sync is optional and should not block onboarding completion
    // Future: BackendPushService can be extended to track onboarding completion
    try {
      // Track analytics instead (more reliable)
      const { firebaseAnalyticsService } = await import('../services/FirebaseAnalyticsService');
      await firebaseAnalyticsService.logEvent('onboarding_completed', {
        timestamp: Date.now(),
      }).catch((error) => {
        logger.warn('Analytics tracking failed (non-critical):', error);
      });
    } catch (backendError) {
      // Backend sync is optional - don't fail onboarding completion
      logger.debug('Backend sync not available (non-critical)');
    }
  } catch (error) {
    logger.error('Error setting onboarding completed:', error);
    // Fail silently - not critical
  }
}

/**
 * Reset onboarding (for testing or settings)
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETED_KEY);
    await AsyncStorage.removeItem(ONBOARDING_STORE_KEY);
    useOnboardingStore.setState({ completed: false, isHydrated: true });
    logger.info('Onboarding reset');
  } catch (error) {
    logger.error('Error resetting onboarding:', error);
  }
}
