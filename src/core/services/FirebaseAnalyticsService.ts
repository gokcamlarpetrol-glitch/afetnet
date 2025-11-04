/**
 * FIREBASE ANALYTICS SERVICE
 * Privacy-compliant analytics for app usage tracking
 * Note: Disabled by default for Apple review compliance
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('FirebaseAnalytics');

class FirebaseAnalyticsService {
  private isInitialized = false;
  private isEnabled = false; // Disabled by default for privacy

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Analytics is disabled by default for Apple review compliance
      // Enable in production if needed with proper privacy consent
      this.isEnabled = false;
      
      if (__DEV__) {
        logger.info('Analytics service initialized (disabled by default)');
      }

      this.isInitialized = true;
    } catch (error) {
      logger.error('Analytics initialization error:', error);
    }
  }

  /**
   * Enable analytics (requires user consent)
   */
  enable() {
    this.isEnabled = true;
    if (__DEV__) {
      logger.info('Analytics enabled');
    }
  }

  /**
   * Disable analytics
   */
  disable() {
    this.isEnabled = false;
    if (__DEV__) {
      logger.info('Analytics disabled');
    }
  }

  /**
   * Log event (if enabled)
   */
  logEvent(eventName: string, parameters?: Record<string, any>) {
    if (!this.isEnabled || !this.isInitialized) {
      if (__DEV__) {
        logger.debug(`Analytics event (disabled): ${eventName}`, parameters);
      }
      return;
    }

    try {
      // TODO: Implement Firebase Analytics logging when enabled
      // import { getAnalytics, logEvent } from 'firebase/analytics';
      // const analytics = getAnalytics(getFirebaseApp());
      // logEvent(analytics, eventName, parameters);
      
      if (__DEV__) {
        logger.info(`Analytics event: ${eventName}`, parameters);
      }
    } catch (error) {
      logger.error('Analytics log error:', error);
    }
  }

  /**
   * Set user property
   */
  setUserProperty(name: string, value: string) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      // TODO: Implement when analytics enabled
      // import { getAnalytics, setUserProperties } from 'firebase/analytics';
      // const analytics = getAnalytics(getFirebaseApp());
      // setUserProperties(analytics, { [name]: value });
      
      if (__DEV__) {
        logger.info(`User property: ${name} = ${value}`);
      }
    } catch (error) {
      logger.error('Analytics setUserProperty error:', error);
    }
  }

  /**
   * Set user ID (anonymized)
   */
  setUserId(userId: string | null) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      // TODO: Implement when analytics enabled
      // Use hashed/anonymized device ID, not personal info
      
      if (__DEV__) {
        logger.info(`User ID set (anonymized): ${userId ? '***' : 'null'}`);
      }
    } catch (error) {
      logger.error('Analytics setUserId error:', error);
    }
  }
}

export const firebaseAnalyticsService = new FirebaseAnalyticsService();

