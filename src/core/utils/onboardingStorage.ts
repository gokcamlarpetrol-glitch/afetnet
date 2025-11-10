/**
 * ONBOARDING STORAGE - First Launch Detection
 * Manages onboarding completion state with backend sync
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';

const logger = createLogger('OnboardingStorage');

const ONBOARDING_COMPLETED_KEY = 'AFETNET_ONBOARDING_COMPLETED';

/**
 * Check if user has completed onboarding
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    return value === '1';
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
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
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
    await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    logger.info('Onboarding reset');
  } catch (error) {
    logger.error('Error resetting onboarding:', error);
  }
}
