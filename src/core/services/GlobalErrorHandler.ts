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
      // Setup unhandled promise rejection handler (with error handling)
      try {
        this.setupUnhandledRejectionHandler();
      } catch (err) {
        // Silently fail - some environments don't support this
        if (__DEV__) {
          logger.warn('setupUnhandledRejectionHandler failed (non-critical):', err);
        }
      }

      // Setup global error handler (if available)
      try {
        this.setupGlobalErrorHandler();
      } catch (err) {
        // Silently fail - some environments don't support this
        if (__DEV__) {
          logger.warn('setupGlobalErrorHandler failed (non-critical):', err);
        }
      }

      // Setup console error interceptor (for better error tracking)
      try {
        this.setupConsoleErrorInterceptor();
      } catch (err) {
        // Silently fail - console override might not be possible
        if (__DEV__) {
          logger.warn('setupConsoleErrorInterceptor failed (non-critical):', err);
        }
      }

      this.isInitialized = true;
      logger.info('✅ Global error handler initialized');
    } catch (error) {
      // CRITICAL: Extract meaningful error message from various error types
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null && 'jsEngine' in error
        ? `Hermes engine initialization note: ${JSON.stringify(error)}`
        : String(error);
      
      // Only log as warning if it's a Hermes engine note (not a real error)
      if (typeof error === 'object' && error !== null && 'jsEngine' in error) {
        if (__DEV__) {
          logger.warn('Global error handler initialization note (non-critical):', errorMessage);
        }
        // Still mark as initialized - Hermes note is not a real error
        this.isInitialized = true;
      } else {
        logger.error('Failed to initialize global error handler:', errorMessage);
      }
    }
  }

  /**
   * ELITE: Setup unhandled promise rejection handler
   */
  private setupUnhandledRejectionHandler() {
    // React Native
    if (typeof global !== 'undefined') {
      try {
        const originalHandler = (global as any).onunhandledrejection;
        
        (global as any).onunhandledrejection = (event: PromiseRejectionEvent) => {
          try {
            const reason = event.reason;
            const error = reason instanceof Error 
              ? reason 
              : new Error(String(reason || 'Unhandled promise rejection'));

            this.handleError(error, {
              source: 'unhandled_promise_rejection',
              rejectionReason: String(reason),
            });
          } catch (handlerError) {
            // Prevent infinite loop - don't use logger.error here
            if (__DEV__) {
              console.warn('GlobalErrorHandler.handleError failed in rejection handler:', handlerError);
            }
          }

          // Call original handler if exists
          if (originalHandler && typeof originalHandler === 'function') {
            try {
              originalHandler(event);
            } catch (handlerError) {
              if (__DEV__) {
                logger.error('Original rejection handler failed:', handlerError);
              }
            }
          }

          // Prevent default browser behavior (if web)
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
        };
      } catch (err) {
        // Silently fail - onunhandledrejection might not be available in all environments
        if (__DEV__) {
          logger.warn('onunhandledrejection setup failed:', err);
        }
      }
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
      try {
        const ErrorUtils = (global as any).ErrorUtils;
        
        // CRITICAL: Check if setGlobalHandler exists and is callable
        if (typeof ErrorUtils.setGlobalHandler !== 'function') {
          if (__DEV__) {
            logger.warn('ErrorUtils.setGlobalHandler is not available');
          }
          return;
        }
        
        const originalHandler = typeof ErrorUtils.getGlobalHandler === 'function'
          ? ErrorUtils.getGlobalHandler()
          : null;

        ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
          try {
            this.handleError(error, {
              source: 'global_error_handler',
              isFatal: String(isFatal ?? false),
            });
          } catch (handlerError) {
            // Prevent infinite loop - don't use logger.error here
            if (__DEV__) {
              console.warn('GlobalErrorHandler.handleError failed:', handlerError);
            }
          }

          // Call original handler if exists
          if (originalHandler && typeof originalHandler === 'function') {
            try {
              originalHandler(error, isFatal);
            } catch (handlerError) {
              if (__DEV__) {
                logger.error('Original global handler failed:', handlerError);
              }
            }
          }
        });
      } catch (err) {
        // Silently fail - ErrorUtils might not be available in all environments
        if (__DEV__) {
          logger.warn('ErrorUtils setup failed:', err);
        }
      }
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
      try {
        // In dev mode, enhance console.error with better logging
        const originalConsoleError = console.error;
        
        // CRITICAL: Check if console.error is writable
        if (typeof originalConsoleError !== 'function') {
          if (__DEV__) {
            logger.warn('console.error is not a function, skipping interceptor');
          }
          return;
        }
        
        console.error = (...args: any[]) => {
          try {
            // Call original
            originalConsoleError(...args);

            // Try to extract Error object from args
            for (const arg of args) {
              if (arg instanceof Error) {
                try {
                  this.handleError(arg, {
                    source: 'console_error',
                  });
                } catch (handlerError) {
                  // Prevent infinite loop - don't use logger.error here
                  // Just silently fail
                }
                break;
              }
            }
          } catch (err) {
            // Fallback to original if our interceptor fails
            try {
              originalConsoleError(...args);
            } catch {
              // Last resort - ignore
            }
          }
        };
      } catch (err) {
        // Silently fail - console override might not be possible in all environments
        if (__DEV__) {
          logger.warn('console.error interceptor setup failed:', err);
        }
      }
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
      const crashContext: Record<string, string> = {
        source: String(errorContext.source),
        timestamp: String(errorContext.timestamp),
        platform: String(errorContext.platform),
        errorMessage: String(error.message || ''),
        errorStack: String(error.stack || ''),
      };
      // Add optional fields as strings
      if (errorContext.appState) {
        crashContext.appState = String(errorContext.appState);
      }
      // Add any other context fields
      Object.keys(context).forEach(key => {
        if (key !== 'source' && key !== 'timestamp' && key !== 'platform' && key !== 'appState') {
          crashContext[key] = String(context[key]);
        }
      });
      firebaseCrashlyticsService.recordError(error, crashContext);
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

