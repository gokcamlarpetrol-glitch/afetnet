/**
 * ELITE: FIREBASE ANALYTICS SERVICE
 * Privacy-compliant analytics with comprehensive event tracking
 * Supports both web (Firebase JS SDK) and React Native (custom implementation)
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import { safeIncludes } from '../utils/safeString';

const logger = createLogger('FirebaseAnalytics');

// CRITICAL: Lazy load Firebase app to prevent module loading errors
async function getFirebaseAppAsync() {
  try {
    const firebaseModule = await import('../config/firebase');
    return firebaseModule.getFirebaseAppAsync ? await firebaseModule.getFirebaseAppAsync() : null;
  } catch (error) {
    if (__DEV__) {
      logger.debug('Firebase app not available:', error);
    }
    return null;
  }
}

// Analytics instance cache
let analyticsInstance: any = null;
let isWebAnalyticsAvailable = false;

/**
 * Initialize Firebase Analytics (web only - React Native uses custom tracking)
 */
async function initializeWebAnalytics() {
  if (Platform.OS !== 'web' || analyticsInstance) return analyticsInstance;

  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    const app = await getFirebaseAppAsync();

    if (!app) {
      logger.warn('Firebase app not available for Analytics');
      return null;
    }

    // Check if Analytics is supported
    const supported = await isSupported();
    if (!supported) {
      logger.warn('Firebase Analytics not supported on this platform');
      return null;
    }

    analyticsInstance = getAnalytics(app);
    isWebAnalyticsAvailable = true;
    logger.info('✅ Firebase Analytics initialized (web)');
    return analyticsInstance;
  } catch (error) {
    logger.warn('Firebase Analytics initialization failed (web):', error);
    return null;
  }
}

/**
 * Custom analytics storage for React Native (AsyncStorage fallback)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANALYTICS_STORAGE_KEY = 'afetnet_analytics_events';
const MAX_STORED_EVENTS = 1000; // Limit stored events

interface StoredEvent {
  eventName: string;
  parameters?: Record<string, any>;
  timestamp: number;
}

class FirebaseAnalyticsService {
  private isInitialized = false;
  private isEnabled = false;
  private eventQueue: StoredEvent[] = [];
  private performanceMetrics: Map<string, number[]> = new Map();
  private customMetrics: Map<string, number> = new Map();

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize web Analytics if on web platform
      if (Platform.OS === 'web') {
        await initializeWebAnalytics();
      }

      // Load stored events from AsyncStorage (React Native)
      if (Platform.OS !== 'web') {
        await this.loadStoredEvents();
      }

      // Enable by default (can be disabled via settings)
      this.isEnabled = true;
      this.isInitialized = true;

      if (__DEV__) {
        logger.info('Analytics service initialized', {
          platform: Platform.OS,
          webAnalyticsAvailable: isWebAnalyticsAvailable,
        });
      }

      // Flush stored events if any
      if (this.eventQueue.length > 0) {
        await this.flushStoredEvents();
      }
    } catch (error) {
      logger.error('Analytics initialization error:', error);
      // Continue without analytics - app should still work
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
   * ELITE: Log event with comprehensive tracking
   */
  async logEvent(eventName: string, parameters?: Record<string, any>) {
    if (!this.isEnabled || !this.isInitialized) {
      if (__DEV__) {
        logger.debug(`Analytics event (disabled): ${eventName}`, parameters);
      }
      return;
    }

    try {
      const sanitizedParams = this.sanitizeParameters(parameters);
      const timestamp = Date.now();

      // Web: Use Firebase Analytics SDK
      if (Platform.OS === 'web' && isWebAnalyticsAvailable && analyticsInstance) {
        try {
          const { logEvent } = await import('firebase/analytics');
          await logEvent(analyticsInstance, eventName, sanitizedParams);

          if (__DEV__) {
            logger.info(`✅ Analytics event (web): ${eventName}`, sanitizedParams);
          }
        } catch (webError) {
          logger.warn('Web Analytics logEvent failed:', webError);
          // Fallback to storage
          await this.storeEvent(eventName, sanitizedParams, timestamp);
        }
      } else {
        // React Native: Store events for batch upload or custom backend
        await this.storeEvent(eventName, sanitizedParams, timestamp);
      }

      // Track custom metrics
      this.trackCustomMetric(eventName, sanitizedParams);
    } catch (error) {
      logger.error('Analytics logEvent error:', error);
      // Don't throw - analytics failures shouldn't break the app
    }
  }

  /**
   * ELITE: Store event for React Native (batch upload later)
   */
  private async storeEvent(eventName: string, parameters: Record<string, any> | undefined, timestamp: number) {
    const event: StoredEvent = {
      eventName,
      parameters,
      timestamp,
    };

    this.eventQueue.push(event);

    // Limit queue size
    if (this.eventQueue.length > MAX_STORED_EVENTS) {
      this.eventQueue.shift();
    }

    // Save to AsyncStorage periodically (every 10 events)
    if (this.eventQueue.length % 10 === 0) {
      await this.saveStoredEvents();
    }

    if (__DEV__) {
      logger.info(`📊 Analytics event stored: ${eventName}`, parameters);
    }
  }

  /**
   * ELITE: Load stored events from AsyncStorage
   */
  private async loadStoredEvents() {
    try {
      const stored = await AsyncStorage.getItem(ANALYTICS_STORAGE_KEY);
      if (stored) {
        const events: StoredEvent[] = JSON.parse(stored);
        this.eventQueue = events.slice(-MAX_STORED_EVENTS); // Keep only recent events
        logger.info(`Loaded ${this.eventQueue.length} stored analytics events`);
      }
    } catch (error) {
      logger.error('Failed to load stored events:', error);
    }
  }

  /**
   * ELITE: Save stored events to AsyncStorage
   */
  private async saveStoredEvents() {
    try {
      await AsyncStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(this.eventQueue));
    } catch (error) {
      logger.error('Failed to save stored events:', error);
    }
  }

  /**
   * ELITE: Flush stored events (upload to backend or Firebase)
   */
  private async flushStoredEvents() {
    if (this.eventQueue.length === 0) return;

    try {
      // In production, upload to backend analytics endpoint
      // For now, log them (can be extended to upload to custom backend)
      if (__DEV__) {
        logger.info(`Flushing ${this.eventQueue.length} stored analytics events`);
      }

      // Clear queue after flush
      this.eventQueue = [];
      await AsyncStorage.removeItem(ANALYTICS_STORAGE_KEY);
    } catch (error) {
      logger.error('Failed to flush stored events:', error);
    }
  }

  /**
   * ELITE: Sanitize parameters (remove sensitive data, limit size)
   */
  private sanitizeParameters(parameters?: Record<string, any>): Record<string, any> {
    if (!parameters) return {};

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

    for (const [key, value] of Object.entries(parameters)) {
      // Skip sensitive keys
      if (sensitiveKeys.some(sk => safeIncludes(key, sk))) {
        continue;
      }

      // Limit string length
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...';
      } else {
        sanitized[key] = value;
      }

      // Limit object depth
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = JSON.stringify(value).substring(0, 500);
      }
    }

    return sanitized;
  }

  /**
   * ELITE: Track custom metrics (deprem bildirim gecikmesi, sensör algılama süresi)
   */
  private trackCustomMetric(eventName: string, parameters?: Record<string, any>) {
    // Track earthquake notification delay
    if (eventName === 'earthquake_notification_sent' && parameters?.detectionDelayMs) {
      const delay = parameters.detectionDelayMs as number;
      const key = 'earthquake_notification_delay';
      if (!this.performanceMetrics.has(key)) {
        this.performanceMetrics.set(key, []);
      }
      const delays = this.performanceMetrics.get(key)!;
      delays.push(delay);
      if (delays.length > 100) delays.shift(); // Keep last 100 measurements

      // Calculate average
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      this.customMetrics.set(`${key}_avg`, avgDelay);
      this.customMetrics.set(`${key}_max`, Math.max(...delays));
      this.customMetrics.set(`${key}_min`, Math.min(...delays));
    }

    // Track sensor detection time
    if (eventName === 'seismic_detection' && parameters?.detectionDelayMs) {
      const delay = parameters.detectionDelayMs as number;
      const key = 'seismic_detection_delay';
      if (!this.performanceMetrics.has(key)) {
        this.performanceMetrics.set(key, []);
      }
      const delays = this.performanceMetrics.get(key)!;
      delays.push(delay);
      if (delays.length > 100) delays.shift();

      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      this.customMetrics.set(`${key}_avg`, avgDelay);
      this.customMetrics.set(`${key}_max`, Math.max(...delays));
      this.customMetrics.set(`${key}_min`, Math.min(...delays));
    }
  }

  /**
   * ELITE: Get custom metrics
   */
  getCustomMetrics(): Record<string, number> {
    return Object.fromEntries(this.customMetrics);
  }

  /**
   * ELITE: Performance monitoring - Track app startup time
   */
  trackAppStartup(startupTimeMs: number) {
    this.logEvent('app_startup', {
      startup_time_ms: startupTimeMs,
      platform: Platform.OS,
    });
    this.customMetrics.set('app_startup_time_ms', startupTimeMs);
  }

  /**
   * ELITE: Performance monitoring - Track API response time
   */
  trackAPIResponseTime(endpoint: string, responseTimeMs: number, success: boolean) {
    this.logEvent('api_request', {
      endpoint,
      response_time_ms: responseTimeMs,
      success,
    });

    const key = `api_${endpoint}_response_time`;
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }
    const times = this.performanceMetrics.get(key)!;
    times.push(responseTimeMs);
    if (times.length > 50) times.shift(); // Keep last 50 measurements
  }

  /**
   * Set user property
   */
  async setUserProperty(name: string, value: string) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      // Web: Use Firebase Analytics SDK
      if (Platform.OS === 'web' && isWebAnalyticsAvailable && analyticsInstance) {
        try {
          const { setUserProperties } = await import('firebase/analytics');
          await setUserProperties(analyticsInstance, { [name]: value });
        } catch (webError) {
          logger.warn('Web Analytics setUserProperties failed:', webError);
        }
      }

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
  async setUserId(userId: string | null) {
    if (!this.isEnabled || !this.isInitialized) return;

    try {
      // Web: Use Firebase Analytics SDK
      if (Platform.OS === 'web' && isWebAnalyticsAvailable && analyticsInstance) {
        try {
          const { setUserId: setAnalyticsUserId } = await import('firebase/analytics');
          // Use anonymized/hashed device ID, not personal info
          const anonymizedId = userId ? this.hashUserId(userId) : null;
          await setAnalyticsUserId(analyticsInstance, anonymizedId);
        } catch (webError) {
          logger.warn('Web Analytics setUserId failed:', webError);
        }
      }

      if (__DEV__) {
        logger.info(`User ID set (anonymized): ${userId ? '***' : 'null'}`);
      }
    } catch (error) {
      logger.error('Analytics setUserId error:', error);
    }
  }

  /**
   * ELITE: Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    // Simple hash (can be improved with crypto-js)
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `user_${Math.abs(hash).toString(36)}`;
  }

  /**
   * ELITE: Flush all pending events (call on app close or periodically)
   */
  async flush() {
    await this.flushStoredEvents();
  }
}

export const firebaseAnalyticsService = new FirebaseAnalyticsService();
