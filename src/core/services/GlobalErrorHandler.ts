/**
 * ELITE: GLOBAL ERROR HANDLER SERVICE
 * Comprehensive error handling for unhandled errors and promise rejections
 * Integrates with Crashlytics and provides user-friendly error recovery
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import { firebaseCrashlyticsService } from './FirebaseCrashlyticsService';
import { firebaseAnalyticsService } from './FirebaseAnalyticsService';

const logger = createLogger('GlobalErrorHandler');

interface ErrorContext {
  source: string;
  timestamp: number;
  platform: string;
  appState?: string;
  [key: string]: any;
}

class GlobalErrorHandlerService {
  private isInitialized = false;
  private errorCount = 0;
  private lastErrorTime = 0;
  private readonly ERROR_RATE_LIMIT = 10; // Max 10 errors per minute
  private readonly ERROR_RATE_WINDOW = 60 * 1000; // 1 minute window

  /**
   * ELITE: Initialize global error handlers
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Setup unhandled promise rejection handler
      this.setupUnhandledRejectionHandler();

      // Setup global error handler (if available)
      this.setupGlobalErrorHandler();

      // Setup console error interceptor (for better error tracking)
      this.setupConsoleErrorInterceptor();

      this.isInitialized = true;
      logger.info('✅ Global error handler initialized');
    } catch (error) {
      logger.error('Failed to initialize global error handler:', error);
    }
  }

  /**
   * ELITE: Setup unhandled promise rejection handler
   */
  private setupUnhandledRejectionHandler() {
    // React Native
    if (typeof global !== 'undefined') {
      const originalHandler = (global as any).onunhandledrejection;
      
      (global as any).onunhandledrejection = (event: PromiseRejectionEvent) => {
        const reason = event.reason;
        const error = reason instanceof Error 
          ? reason 
          : new Error(String(reason || 'Unhandled promise rejection'));

        this.handleError(error, {
          source: 'unhandled_promise_rejection',
          rejectionReason: String(reason),
        });

        // Call original handler if exists
        if (originalHandler) {
          try {
            originalHandler(event);
          } catch (handlerError) {
            logger.error('Original rejection handler failed:', handlerError);
          }
        }

        // Prevent default browser behavior (if web)
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
      };
    }

    // Web: window.addEventListener
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const error = reason instanceof Error 
          ? reason 
          : new Error(String(reason || 'Unhandled promise rejection'));

        this.handleError(error, {
          source: 'window_unhandledrejection',
          rejectionReason: String(reason),
        });

        // Prevent default browser console error
        event.preventDefault();
      });
    }
  }

  /**
   * ELITE: Setup global error handler
   */
  private setupGlobalErrorHandler() {
    // React Native ErrorUtils
    if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
      const ErrorUtils = (global as any).ErrorUtils;
      const originalHandler = ErrorUtils.getGlobalHandler?.();

      ErrorUtils.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
        this.handleError(error, {
          source: 'global_error_handler',
          isFatal: String(isFatal ?? false),
        });

        // Call original handler if exists
        if (originalHandler) {
          try {
            originalHandler(error, isFatal);
          } catch (handlerError) {
            logger.error('Original global handler failed:', handlerError);
          }
        }
      });
    }

    // Web: window.onerror
    if (typeof window !== 'undefined') {
      const originalHandler = window.onerror;
      
      window.onerror = (message, source, lineno, colno, error) => {
        const err = error || new Error(String(message));
        
        this.handleError(err, {
          source: 'window_onerror',
          message: String(message),
          sourceFile: String(source || 'unknown'),
          lineNumber: String(lineno || 'unknown'),
          columnNumber: String(colno || 'unknown'),
        });

        // Call original handler if exists
        if (originalHandler) {
          try {
            return originalHandler(message, source, lineno, colno, error);
          } catch (handlerError) {
            logger.error('Original window.onerror handler failed:', handlerError);
          }
        }

        return false; // Don't prevent default error handling
      };
    }
  }

  /**
   * ELITE: Setup console error interceptor
   */
  private setupConsoleErrorInterceptor() {
    if (__DEV__) {
      // In dev mode, enhance console.error with better logging
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        // Call original
        originalConsoleError(...args);

        // Try to extract Error object from args
        for (const arg of args) {
          if (arg instanceof Error) {
            this.handleError(arg, {
              source: 'console_error',
            });
            break;
          }
        }
      };
    }
  }

  /**
   * ELITE: Handle error with rate limiting and comprehensive logging
   */
  private handleError(error: Error, context: Partial<ErrorContext> = {}) {
    // Rate limiting: Prevent error spam
    const now = Date.now();
    if (now - this.lastErrorTime < this.ERROR_RATE_WINDOW) {
      this.errorCount++;
      if (this.errorCount > this.ERROR_RATE_LIMIT) {
        // Too many errors - skip logging to prevent spam
        if (__DEV__) {
          logger.warn(`⚠️ Error rate limit exceeded (${this.errorCount} errors in ${this.ERROR_RATE_WINDOW}ms)`);
        }
        return;
      }
    } else {
      this.errorCount = 0;
    }
    this.lastErrorTime = now;

    // Build comprehensive error context
    const errorContext: ErrorContext = {
      source: context.source || 'unknown',
      timestamp: Date.now(),
      platform: Platform.OS,
      ...context,
    };

    // Log error
    logger.error('Global error handler caught:', error, errorContext);

    // Send to Crashlytics
    try {
      firebaseCrashlyticsService.recordError(error, {
        ...errorContext,
        errorMessage: error.message,
        errorStack: error.stack,
      });
    } catch (crashlyticsError) {
      logger.error('Failed to send error to Crashlytics:', crashlyticsError);
    }

    // Track error analytics
    try {
      firebaseAnalyticsService.logEvent('error_occurred', {
        error_name: error.name,
        error_message: error.message.substring(0, 100), // Limit length
        error_source: errorContext.source,
        platform: Platform.OS,
      });
    } catch (analyticsError) {
      logger.error('Failed to track error analytics:', analyticsError);
    }
  }

  /**
   * ELITE: Manually handle error (for explicit error handling)
   */
  handleManualError(error: Error, context?: Partial<ErrorContext>) {
    this.handleError(error, {
      ...context,
      source: context?.source || 'manual_error',
    });
  }

  /**
   * ELITE: Wrap async function with error handling
   */
  wrapAsyncFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: Partial<ErrorContext>
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(
          error instanceof Error ? error : new Error(String(error)),
          {
            ...context,
            source: context?.source || 'async_function_wrapper',
            functionName: fn.name || 'anonymous',
          }
        );
        throw error; // Re-throw to maintain original behavior
      }
    }) as T;
  }

  /**
   * ELITE: Get error statistics
   */
  getErrorStats(): { errorCount: number; rateLimitExceeded: boolean } {
    const now = Date.now();
    const rateLimitExceeded = 
      now - this.lastErrorTime < this.ERROR_RATE_WINDOW && 
      this.errorCount > this.ERROR_RATE_LIMIT;

    return {
      errorCount: this.errorCount,
      rateLimitExceeded,
    };
  }
}

export const globalErrorHandlerService = new GlobalErrorHandlerService();

