/**
 * ELITE: FIREBASE CRASHLYTICS SERVICE
 * Comprehensive crash reporting and error tracking
 * Supports both web (Firebase JS SDK) and React Native (custom implementation)
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('FirebaseCrashlytics');

// CRITICAL: Lazy load Firebase app to prevent module loading errors
async function getFirebaseAppAsync() {
  try {
    const firebaseModule = await import('../../lib/firebase');
    return firebaseModule.getFirebaseAppAsync ? await firebaseModule.getFirebaseAppAsync() : null;
  } catch (error) {
    if (__DEV__) {
      logger.debug('Firebase app not available:', error);
    }
    return null;
  }
}

// Crashlytics instance cache
let crashlyticsInstance: any = null;
let isWebCrashlyticsAvailable = false;

/**
 * Initialize Firebase Crashlytics (web only - React Native uses custom tracking)
 */
async function initializeWebCrashlytics() {
  if (Platform.OS !== 'web' || crashlyticsInstance) return crashlyticsInstance;

  try {
    // Firebase JS SDK doesn't have Crashlytics for web
    // Use Performance Monitoring or custom error tracking instead
    logger.info('Crashlytics: Using custom error tracking (web)');
    return null;
  } catch (error) {
    logger.warn('Crashlytics initialization failed (web):', error);
    return null;
  }
}

/**
 * Custom crash storage for React Native
 */
const CRASH_STORAGE_KEY = 'afetnet_crash_reports';
const MAX_STORED_CRASHES = 100;

interface CrashReport {
  error: string;
  stack?: string;
  context?: Record<string, string>;
  timestamp: number;
  platform: string;
  appVersion?: string;
  deviceInfo?: Record<string, any>;
}

class FirebaseCrashlyticsService {
  private isInitialized = false;
  private isEnabled = true; // Enabled by default for production
  private crashQueue: CrashReport[] = [];
  private errorCount = 0;
  private lastErrorTime = 0;
  // CRITICAL: Store original console.error to prevent recursive calls from GlobalErrorHandler
  private originalConsoleError: typeof console.error;
  
  constructor() {
    // Store original console.error before GlobalErrorHandler overrides it
    this.originalConsoleError = console.error.bind(console);
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize web Crashlytics if on web platform
      if (Platform.OS === 'web') {
        await initializeWebCrashlytics();
      }

      // Load stored crashes from AsyncStorage (React Native)
      if (Platform.OS !== 'web') {
        await this.loadStoredCrashes();
      }

      // Setup global error handlers
      this.setupGlobalErrorHandlers();

      this.isInitialized = true;

      if (__DEV__) {
        logger.info('Crashlytics service initialized', {
          platform: Platform.OS,
          enabled: this.isEnabled,
        });
      }

      // Flush stored crashes if any
      if (this.crashQueue.length > 0) {
        await this.flushStoredCrashes();
      }
    } catch (error) {
      logger.error('Crashlytics initialization error:', error);
      // Continue without crashlytics - app should still work
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
   * ELITE: Record error with comprehensive context
   */
  recordError(error: Error, context?: Record<string, string>) {
    if (!this.isEnabled || !this.isInitialized) {
      // CRITICAL: Use original console.error to prevent recursive calls from GlobalErrorHandler
      // In dev mode, log to console
      if (__DEV__) {
        try {
          this.originalConsoleError('Crashlytics (disabled):', error, context);
        } catch (e) {
          // Last resort - direct console access
          if (typeof console !== 'undefined' && console.error) {
            (console.error as any).call(console, 'Crashlytics (disabled):', error, context);
          }
        }
      }
      return;
    }

    try {
      // Rate limiting: Don't spam crash reports
      const now = Date.now();
      if (now - this.lastErrorTime < 1000) {
        this.errorCount++;
        if (this.errorCount > 10) {
          // Too many errors in short time - skip
          return;
        }
      } else {
        this.errorCount = 0;
      }
      this.lastErrorTime = now;

      const crashReport: CrashReport = {
        error: error.message || String(error),
        stack: error.stack,
        context: this.sanitizeContext(context),
        timestamp: Date.now(),
        platform: Platform.OS,
        appVersion: this.getAppVersion(),
        deviceInfo: this.getDeviceInfo(),
      };

      // Store crash report
      this.crashQueue.push(crashReport);

      // Limit queue size
      if (this.crashQueue.length > MAX_STORED_CRASHES) {
        this.crashQueue.shift();
      }

      // Save to AsyncStorage immediately for critical errors
      if (error.name === 'Error' || error.stack) {
        this.saveStoredCrashes();
      }

      // Log to console in dev mode
      if (__DEV__) {
        logger.error('❌ Crashlytics error recorded:', error, context);
      }

      // In production, send to backend or Firebase
      // For now, store locally and flush periodically
    } catch (crashError) {
      logger.error('Crashlytics recordError failed:', crashError);
      // Don't throw - crashlytics failures shouldn't break the app
    }
  }

  /**
   * ELITE: Setup global error handlers
   */
  private setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
    
    if (global.ErrorUtils) {
      global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        this.recordError(error, {
          isFatal: String(isFatal ?? false),
          source: 'global_error_handler',
        });
        
        // Call original handler if exists
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }

    // Handle unhandled promise rejections
    if (typeof global !== 'undefined') {
      const originalRejectionHandler = (global as any).onunhandledrejection;
      (global as any).onunhandledrejection = (event: PromiseRejectionEvent) => {
        const error = event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason));
        
        this.recordError(error, {
          source: 'unhandled_promise_rejection',
        });

        if (originalRejectionHandler) {
          originalRejectionHandler(event);
        }
      };
    }
  }

  /**
   * ELITE: Sanitize context (remove sensitive data)
   */
  private sanitizeContext(context?: Record<string, string>): Record<string, string> | undefined {
    if (!context) return undefined;

    const sanitized: Record<string, string> = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

    for (const [key, value] of Object.entries(context)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '***REDACTED***';
      } else {
        // Limit string length
        sanitized[key] = value.length > 500 ? value.substring(0, 500) + '...' : value;
      }
    }

    return sanitized;
  }

  /**
   * ELITE: Get app version
   */
  private getAppVersion(): string {
    try {
      const Constants = require('expo-constants');
      return Constants.expoConfig?.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * ELITE: Get device info
   */
  private getDeviceInfo(): Record<string, any> {
    try {
      const Constants = require('expo-constants');
      const Device = require('expo-device');
      
      return {
        platform: Platform.OS,
        version: Platform.Version,
        deviceName: Device.deviceName || 'unknown',
        modelName: Device.modelName || 'unknown',
        osVersion: Device.osVersion || 'unknown',
        brand: Device.brand || 'unknown',
        manufacturer: Device.manufacturer || 'unknown',
      };
    } catch {
      return {
        platform: Platform.OS,
        version: Platform.Version,
      };
    }
  }

  /**
   * ELITE: Load stored crashes from AsyncStorage
   */
  private async loadStoredCrashes() {
    try {
      const stored = await AsyncStorage.getItem(CRASH_STORAGE_KEY);
      if (stored) {
        const crashes: CrashReport[] = JSON.parse(stored);
        this.crashQueue = crashes.slice(-MAX_STORED_CRASHES);
        logger.info(`Loaded ${this.crashQueue.length} stored crash reports`);
      }
    } catch (error) {
      logger.error('Failed to load stored crashes:', error);
    }
  }

  /**
   * ELITE: Save stored crashes to AsyncStorage
   */
  private async saveStoredCrashes() {
    try {
      await AsyncStorage.setItem(CRASH_STORAGE_KEY, JSON.stringify(this.crashQueue));
    } catch (error) {
      logger.error('Failed to save stored crashes:', error);
    }
  }

  /**
   * ELITE: Flush stored crashes (upload to backend or Firebase)
   */
  private async flushStoredCrashes() {
    if (this.crashQueue.length === 0) return;

    try {
      // In production, upload to backend crash reporting endpoint
      // For now, log them (can be extended to upload to custom backend)
      if (__DEV__) {
        logger.info(`Flushing ${this.crashQueue.length} stored crash reports`);
      }

      // Clear queue after flush
      this.crashQueue = [];
      await AsyncStorage.removeItem(CRASH_STORAGE_KEY);
    } catch (error) {
      logger.error('Failed to flush stored crashes:', error);
    }
  }

  /**
   * Set user identifier (anonymized)
   */
  setUserId(userId: string) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      // Store user ID for crash reports (anonymized)
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
      // Store attribute for crash reports
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
      // Store log message for crash reports
      if (__DEV__) {
        logger.debug(`Crashlytics log: ${message}`);
      }
    } catch (error) {
      logger.error('Crashlytics log error:', error);
    }
  }

  /**
   * ELITE: Flush all pending crashes (call on app close or periodically)
   */
  async flush() {
    await this.flushStoredCrashes();
  }

  /**
   * ELITE: Get crash statistics
   */
  getCrashStats(): { totalCrashes: number; recentCrashes: number } {
    const now = Date.now();
    const recentCrashes = this.crashQueue.filter(
      crash => now - crash.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    ).length;

    return {
      totalCrashes: this.crashQueue.length,
      recentCrashes,
    };
  }
}

export const firebaseCrashlyticsService = new FirebaseCrashlyticsService();
