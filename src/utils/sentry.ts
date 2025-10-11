/**
 * Sentry Integration - Production Error Monitoring
 * Elite Software Engineering Standards
 * 
 * Features:
 * - Automatic crash reporting
 * - Performance monitoring
 * - User feedback
 * - Release tracking
 * - Source maps
 */

import * as Sentry from '@sentry/react-native';

/**
 * Initialize Sentry for production monitoring
 * 
 * @param {Object} options - Sentry configuration
 * @param {string} options.dsn - Sentry DSN from dashboard
 * @param {string} options.environment - Environment (development, staging, production)
 * @param {number} options.tracesSampleRate - Performance monitoring sample rate (0-1)
 * 
 * @example
 * ```typescript
 * initializeSentry({
 *   dsn: 'https://your-sentry-dsn@sentry.io/project-id',
 *   environment: 'production',
 *   tracesSampleRate: 0.2
 * });
 * ```
 */
export function initializeSentry(options: {
  dsn: string;
  environment?: string;
  tracesSampleRate?: number;
}) {
  // Only initialize in production or when explicitly enabled
  if (!__DEV__ || process.env.EXPO_PUBLIC_SENTRY_ENABLED === 'true') {
    Sentry.init({
      dsn: options.dsn,
      environment: options.environment || 'production',
      
      // Performance Monitoring
      tracesSampleRate: options.tracesSampleRate || 0.2,
      
      // Session tracking
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      
      // Native crashes
      enableNative: true,
      enableNativeCrashHandling: true,
      
      // Network breadcrumbs
      enableCaptureFailedRequests: true,
      
      // Release tracking
      release: `afetnet@1.0.0`,
      dist: '1',
      
      // Before send hook - filter sensitive data
      beforeSend(event, hint) {
        // Remove sensitive data
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        
        // Remove sensitive breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.filter(breadcrumb => {
            return !breadcrumb.message?.includes('password') &&
                   !breadcrumb.message?.includes('token') &&
                   !breadcrumb.message?.includes('apiKey');
          });
        }
        
        return event;
      },
      
      // Integrations
      integrations: [
        new Sentry.ReactNativeTracing({
          routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
          tracingOrigins: ['localhost', 'afetnet-backend.onrender.com', /^\//],
        }),
      ],
    });
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: {
  id: string;
  afnId: string;
  name?: string;
}) {
  Sentry.setUser({
    id: user.id,
    username: user.afnId,
    // Don't send PII
  });
}

/**
 * Capture custom error with context
 */
export function captureError(
  error: Error,
  context?: {
    component?: string;
    action?: string;
    severity?: 'fatal' | 'error' | 'warning' | 'info';
  }
) {
  Sentry.captureException(error, {
    level: context?.severity || 'error',
    tags: {
      component: context?.component,
      action: context?.action,
    },
  });
}

/**
 * Capture breadcrumb for debugging
 */
export function captureBreadcrumb(
  message: string,
  category?: string,
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
) {
  Sentry.addBreadcrumb({
    message,
    category: category || 'app',
    level: level || 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start performance transaction
 */
export function startTransaction(
  name: string,
  op: string
) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Capture custom metric
 */
export function captureMetric(
  name: string,
  value: number,
  unit: string
) {
  // Sentry metrics
  Sentry.metrics.gauge(name, value, {
    unit,
    tags: {
      platform: 'mobile',
    },
  });
}

export default Sentry;

