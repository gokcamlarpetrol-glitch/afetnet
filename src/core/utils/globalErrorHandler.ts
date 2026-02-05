/**
 * ELITE: GLOBAL ERROR HANDLER
 * Unicorn-level error handling - catches all unhandled errors and promises
 * Ensures app never crashes, always graceful degradation
 */

// ELITE: Logger interface for type safety
interface LoggerInterface {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

// CRITICAL: Safe logger import - prevent recursive errors
let logger: LoggerInterface | null = null;
try {
  const loggerModule = require('./logger');
  logger = loggerModule.createLogger('GlobalErrorHandler');
} catch (loggerError) {
  // Fallback to console if logger fails
  logger = {
    error: (...args: unknown[]) => console.error('[GlobalErrorHandler]', ...args),
    warn: (...args: unknown[]) => console.warn('[GlobalErrorHandler]', ...args),
    info: (...args: unknown[]) => console.log('[GlobalErrorHandler]', ...args),
  };
}

// ELITE: Crashlytics interface for type safety
interface CrashlyticsInterface {
  recordError: (error: Error, context?: Record<string, string>) => void;
}

// CRITICAL: Safe Firebase Crashlytics import - prevent initialization errors
let firebaseCrashlyticsService: CrashlyticsInterface | null = null;
try {
  firebaseCrashlyticsService = require('../services/FirebaseCrashlyticsService').firebaseCrashlyticsService;
} catch (crashlyticsError) {
  // Firebase Crashlytics not available - use no-op
  firebaseCrashlyticsService = {
    recordError: () => { }, // No-op
  };
}

interface ErrorContext {
  source?: string;
  userId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

class GlobalErrorHandler {
  private isInitialized = false;
  private errorCount = 0;
  private readonly MAX_ERRORS_PER_MINUTE = 10; // Prevent error spam
  private errorTimestamps: number[] = [];
  private isHandlingError = false; // CRITICAL: Prevent recursive calls

  /**
   * Initialize global error handlers
   * CRITICAL: Call this once at app startup
   */
  initialize() {
    if (this.isInitialized) {
      logger?.warn('Global error handler already initialized');
      return;
    }

    // Handle unhandled JavaScript errors
    const originalErrorHandler = global.ErrorUtils?.getGlobalHandler?.();
    if (global.ErrorUtils) {
      global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        this.handleError(error, {
          source: 'unhandled_error',
          isFatal: isFatal || false,
        });

        // Call original handler if it exists
        if (originalErrorHandler) {
          try {
            originalErrorHandler(error, isFatal);
          } catch (handlerError) {
            logger?.error('Original error handler failed:', handlerError);
          }
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

        this.handleError(error, {
          source: 'unhandled_promise_rejection',
        });

        // Call original handler if it exists
        if (originalRejectionHandler) {
          try {
            originalRejectionHandler(event);
          } catch (handlerError) {
            logger?.error('Original rejection handler failed:', handlerError);
          }
        }
      };
    }

    // Handle console errors (for React Native)
    // CRITICAL: Prevent recursive calls - check if we're already handling an error
    if (typeof console !== 'undefined') {
      const originalConsoleError = console.error.bind(console);
      // Store original for use in recursive detection
      (console as any)._originalError = originalConsoleError;
      let isHandlingConsoleError = false; // Flag to prevent recursion

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.error = (...args: any[]) => {
        // CRITICAL: Skip if already handling a console error to prevent recursion
        if (isHandlingConsoleError) {
          originalConsoleError.apply(console, args);
          return;
        }

        // Only intercept if it looks like an error
        if (args.length > 0 && (args[0] instanceof Error || typeof args[0] === 'string')) {
          const error = args[0] instanceof Error
            ? args[0]
            : new Error(String(args[0]));

          // CRITICAL: Skip if error is from Crashlytics or GlobalErrorHandler itself
          const errorMessage = error?.message || String(error);
          const errorStack = error?.stack || '';

          // ELITE: Skip LoadBundleFromServerRequestError - these are expected in some environments
          if (errorMessage.includes('LoadBundleFromServerRequestError') ||
            errorMessage.includes('Could not load bundle')) {
            // Don't intercept - just log directly as debug
            if (__DEV__) {
              console.debug('[GlobalErrorHandler] Bundle error (expected):', errorMessage);
            }
            return;
          }

          if (errorMessage.includes('Crashlytics') ||
            errorMessage.includes('GlobalErrorHandler') ||
            errorStack.includes('FirebaseCrashlyticsService') ||
            errorStack.includes('globalErrorHandler.ts')) {
            // Don't intercept - just log directly
            originalConsoleError.apply(console, args);
            return;
          }

          // Set flag to prevent recursion
          isHandlingConsoleError = true;
          try {
            this.handleError(error, {
              source: 'console_error',
              args: args.slice(1),
            });
          } finally {
            // Always reset flag
            isHandlingConsoleError = false;
          }
        }

        // Always call original console.error
        originalConsoleError.apply(console, args);
      };
    }

    this.isInitialized = true;
    logger?.info('✅ Global error handler initialized');
  }

  /**
   * Handle an error with context
   * CRITICAL: Safe error handling - prevent recursive errors
   */
  private handleError(error: Error, context: ErrorContext = {}) {
    // CRITICAL: Prevent recursive calls
    if (this.isHandlingError) {
      // Last resort - direct console to prevent infinite loop
      try {
        const originalConsoleError = (console as any)._originalError || console.error;
        originalConsoleError.call(console, '[GlobalErrorHandler] Recursive error detected, skipping:', error?.message || error);
      } catch (e) {
        // Absolute last resort - do nothing to prevent infinite loop
      }
      return;
    }

    this.isHandlingError = true;

    try {
      // CRITICAL: Prevent recursive errors - if logger fails, use console directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeLog = (level: 'error' | 'warn' | 'info', message: string, data?: any) => {
        try {
          if (logger && logger[level]) {
            logger[level](message, data);
          } else {
            // Use original console method if available, otherwise fallback
            const originalMethod = (console as any)._originalError || console[level === 'info' ? 'log' : level];
            originalMethod.call(console, '[GlobalErrorHandler]', message, data);
          }
        } catch (logError) {
          // Last resort - direct console
          try {
            const originalMethod = (console as any)._originalError || console[level === 'info' ? 'log' : level];
            originalMethod.call(console, '[GlobalErrorHandler]', message, data);
          } catch (e) {
            // Absolute last resort - do nothing
          }
        }
      };

      // Rate limiting - prevent error spam
      const now = Date.now();
      this.errorTimestamps = this.errorTimestamps.filter(ts => now - ts < 60000); // Last minute

      if (this.errorTimestamps.length >= this.MAX_ERRORS_PER_MINUTE) {
        safeLog('warn', 'Too many errors - rate limiting error reporting');
        return;
      }

      // CRITICAL: Skip if this is a logger/Firebase error to prevent recursion
      const errorMessage = error?.message || String(error);
      const errorStack = error?.stack || '';

      // Skip recursive errors from logger/Firebase
      if (errorMessage.includes('logger') ||
        errorMessage.includes('firebase') ||
        errorMessage.includes('GlobalErrorHandler') ||
        errorStack.includes('logger.ts') ||
        errorStack.includes('firebase.ts') ||
        errorStack.includes('globalErrorHandler.ts')) {
        // Only log to console to prevent recursion
        console.warn('[GlobalErrorHandler] Skipping recursive error:', errorMessage);
        return;
      }

      this.errorCount++;
      this.errorTimestamps.push(now);

      // Log error safely
      try {
        safeLog('error', 'Global error caught:', {
          error: errorMessage,
          stack: errorStack,
          context,
          errorCount: this.errorCount,
        });
      } catch (logError) {
        // If logging fails, use console directly
        console.error('[GlobalErrorHandler] Error:', errorMessage, context);
      }

      // Report to crash reporting service (safely)
      try {
        if (firebaseCrashlyticsService && firebaseCrashlyticsService.recordError) {
          // Convert context to string-only for Crashlytics
          const crashContext: Record<string, string> = {
            globalHandler: 'true',
            errorCount: String(this.errorCount),
          };
          if (context.source) crashContext.source = String(context.source);
          if (context.userId) crashContext.userId = String(context.userId);
          if (context.timestamp) crashContext.timestamp = String(context.timestamp);

          firebaseCrashlyticsService.recordError(error, crashContext);
        }
      } catch (reportError) {
        // Don't log report errors to prevent recursion
        console.warn('[GlobalErrorHandler] Failed to report error to Crashlytics');
      }

    } finally {
      // CRITICAL: Always reset flag
      this.isHandlingError = false;
    }

    // CRITICAL: Don't throw - graceful degradation
    // App should continue working even if errors occur
  }

  /**
   * Manually report an error
   */
  reportError(error: Error | string, context: ErrorContext = {}) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.handleError(errorObj, context);
  }

  /**
   * Wrap async function with error handling
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: ErrorContext,
  ): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(
          error instanceof Error ? error : new Error(String(error)),
          {
            ...context,
            function: fn.name || 'anonymous',
            args: args.length > 0 ? String(args[0]) : undefined,
          },
        );
        // Re-throw for caller to handle if needed
        throw error;
      }
    }) as T;
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      errorCount: this.errorCount,
      errorsLastMinute: this.errorTimestamps.length,
      isInitialized: this.isInitialized,
    };
  }
}

export const globalErrorHandler = new GlobalErrorHandler();

