/**
 * MONITORING SERVICE - Sentry Integration
 * Error tracking, performance monitoring, and alerting
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { expressIntegration, setupExpressErrorHandler } from '@sentry/node';
import { Express, Request, Response, NextFunction } from 'express';

export interface MonitoringConfig {
  dsn: string;
  environment: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  enabled?: boolean;
}

class MonitoringService {
  private isInitialized = false;

  /**
   * Initialize Sentry monitoring
   */
  initialize(config: MonitoringConfig) {
    if (this.isInitialized) {
      console.warn('⚠️ Monitoring already initialized');
      return;
    }

    if (!config.enabled) {
      console.log('ℹ️ Monitoring disabled');
      return;
    }

    if (!config.dsn) {
      console.warn('⚠️ Sentry DSN not provided - monitoring disabled');
      return;
    }

    try {
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment || 'production',
        tracesSampleRate: config.tracesSampleRate || 0.1, // 10% of transactions
        profilesSampleRate: config.profilesSampleRate || 0.1, // 10% of transactions
        integrations: [
          expressIntegration(),
          nodeProfilingIntegration(),
        ],
        beforeSend(event, hint) {
          // Filter out sensitive data
          if (event.request) {
            delete event.request.cookies;
            if (event.request.headers) {
              delete event.request.headers['authorization'];
              delete event.request.headers['cookie'];
            }
          }
          return event;
        },
      });

      this.isInitialized = true;
      console.log('✅ Sentry monitoring initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error);
    }
  }

  /**
   * Setup Express middleware
   */
  setupExpressMiddleware(app: Express) {
    if (!this.isInitialized) return;

    // ELITE: Sentry v10+ API - expressIntegration automatically handles request/tracing
    // No need for manual middleware setup - expressIntegration handles it automatically
    // The integration is already added in initialize() method
    console.log('✅ Sentry Express middleware configured (via expressIntegration)');
  }

  /**
   * Setup error handler (must be after all routes)
   */
  setupErrorHandler(app: Express) {
    if (!this.isInitialized) return;

    // ELITE: Sentry v10+ API - setupExpressErrorHandler takes app as parameter
    // Error handler must be before any other error middleware
    setupExpressErrorHandler(app);

    console.log('✅ Sentry error handler configured');
  }

  /**
   * Capture exception manually
   */
  captureException(error: Error, context?: Record<string, any>) {
    if (!this.isInitialized) {
      console.error('Error (monitoring disabled):', error);
      return;
    }

    Sentry.captureException(error, {
      extra: context,
    });
  }

  /**
   * Capture message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    if (!this.isInitialized) {
      console.log(`Message (monitoring disabled): ${message}`);
      return;
    }

    Sentry.captureMessage(message, level);
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }) {
    if (!this.isInitialized) return;

    Sentry.setUser(user);
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (!this.isInitialized) return;

    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: 'info' | 'warning' | 'error';
    data?: Record<string, any>;
  }) {
    if (!this.isInitialized) return;

    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Start transaction for performance monitoring
   * ELITE: Sentry v10+ - transactions are automatically managed by tracingHandler
   * This method is kept for backward compatibility
   */
  startTransaction(name: string, op: string) {
    if (!this.isInitialized) return null;

    // ELITE: Sentry v10+ API - transactions are automatically created by tracingHandler
    // If you need custom spans, use Sentry.startSpan() directly in your code
    // This method returns null for backward compatibility
    console.log(`[Monitoring] Transaction started: ${name} (${op})`);
    return null;
  }

  /**
   * Flush events (useful before shutdown)
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    if (!this.isInitialized) return true;

    try {
      await Sentry.flush(timeout);
      return true;
    } catch (error) {
      console.error('Failed to flush Sentry:', error);
      return false;
    }
  }
}

export const monitoringService = new MonitoringService();

/**
 * Express error logging middleware
 */
export function errorLoggingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error details
  console.error('❌ Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Capture in Sentry
  monitoringService.captureException(err, {
    url: req.url,
    method: req.method,
    query: req.query,
    body: req.body,
    ip: req.ip,
  });

  next(err);
}

/**
 * Performance monitoring middleware
 */
export function performanceMonitoringMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log slow requests (>1s)
    if (duration > 1000) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.url} - ${duration}ms`);
      monitoringService.captureMessage(
        `Slow request: ${req.method} ${req.url}`,
        'warning'
      );
    }

    // Add breadcrumb
    monitoringService.addBreadcrumb({
      message: `${req.method} ${req.url}`,
      category: 'http',
      data: {
        status: res.statusCode,
        duration,
      },
    });
  });

  next();
}


