/**
 * FIREBASE CRASHLYTICS SERVICE
 * Crash reporting and error tracking
 * Note: Disabled by default, enable in production if needed
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('FirebaseCrashlytics');

class FirebaseCrashlyticsService {
  private isInitialized = false;
  private isEnabled = false; // Disabled by default

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Crashlytics is disabled by default
      // Enable in production if needed
      this.isEnabled = false;
      
      if (__DEV__) {
        logger.info('Crashlytics service initialized (disabled by default)');
      }

      this.isInitialized = true;
    } catch (error) {
      logger.error('Crashlytics initialization error:', error);
    }
  }

  /**
   * Enable crashlytics
   */
  enable() {
    this.isEnabled = true;
    if (__DEV__) {
      logger.info('Crashlytics enabled');
    }
  }

  /**
   * Disable crashlytics
   */
  disable() {
    this.isEnabled = false;
    if (__DEV__) {
      logger.info('Crashlytics disabled');
    }
  }

  /**
   * Record error
   */
  recordError(error: Error, context?: Record<string, string>) {
    if (!this.isEnabled || !this.isInitialized) {
      // In dev mode, log to console
      if (__DEV__) {
        console.error('Crashlytics (disabled):', error, context);
      }
      return;
    }

    try {
      // TODO: Implement Firebase Crashlytics when enabled
      // import crashlytics from '@react-native-firebase/crashlytics';
      // crashlytics().recordError(error);
      // if (context) {
      //   Object.entries(context).forEach(([key, value]) => {
      //     crashlytics().setAttribute(key, value);
      //   });
      // }
      
      if (__DEV__) {
        logger.error('Crashlytics error recorded:', error, context);
      }
    } catch (crashError) {
      logger.error('Crashlytics recordError failed:', crashError);
    }
  }

  /**
   * Set user identifier (anonymized)
   */
  setUserId(userId: string) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      // TODO: Implement when enabled
      // Use anonymized device ID
      if (__DEV__) {
        logger.info(`Crashlytics user ID set: ${userId.substring(0, 8)}...`);
      }
    } catch (error) {
      logger.error('Crashlytics setUserId error:', error);
    }
  }

  /**
   * Set custom attribute
   */
  setAttribute(key: string, value: string) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      // TODO: Implement when enabled
      if (__DEV__) {
        logger.debug(`Crashlytics attribute: ${key} = ${value}`);
      }
    } catch (error) {
      logger.error('Crashlytics setAttribute error:', error);
    }
  }

  /**
   * Log message
   */
  log(message: string) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      // TODO: Implement when enabled
      if (__DEV__) {
        logger.debug(`Crashlytics log: ${message}`);
      }
    } catch (error) {
      logger.error('Crashlytics log error:', error);
    }
  }
}

export const firebaseCrashlyticsService = new FirebaseCrashlyticsService();

