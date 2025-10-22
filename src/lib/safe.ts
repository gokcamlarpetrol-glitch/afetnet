import { logEvent } from '../store/devlog';
import { logger } from '../utils/productionLogger';

export interface SafeCallOptions {
  timeout?: number;
  retries?: number;
   
  onError?: (error: Error) => void;
  fallback?: any;
}

export interface WatchdogOptions {
  name: string;
  timeout: number;
   
  onTimeout?: (name: string, duration: number) => void;
}

class WatchdogManager {
  private timers: Map<string, any> = new Map();
  private startTimes: Map<string, number> = new Map();

  start(name: string, timeout: number, onTimeout?: (name: string, duration: number) => void): void {
    this.stop(name); // Clear any existing timer
    
    this.startTimes.set(name, Date.now());
    
    const timer = (globalThis as any).setTimeout(() => {
      const duration = Date.now() - (this.startTimes.get(name) || Date.now());
      
      logEvent('WATCHDOG_TIMEOUT', {
        name,
        duration,
        timeout,
      });
      
      if (onTimeout) {
        onTimeout(name, duration);
      } else {
        logger.warn(`Watchdog timeout: ${name} took ${duration}ms (limit: ${timeout}ms)`);
      }
      
      this.cleanup(name);
    }, timeout);
    
    this.timers.set(name, timer);
  }

  stop(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      (globalThis as any).clearTimeout(timer);
      this.cleanup(name);
    }
  }

  private cleanup(name: string): void {
    this.timers.delete(name);
    this.startTimes.delete(name);
  }

  isRunning(name: string): boolean {
    return this.timers.has(name);
  }

  getElapsed(name: string): number {
    const startTime = this.startTimes.get(name);
    return startTime ? Date.now() - startTime : 0;
  }

  stopAll(): void {
    for (const [name] of this.timers) {
      this.stop(name);
    }
  }
}

const watchdogManager = new WatchdogManager();

export function withWatchdog<T>(
  name: string,
  timeout: number,
  fn: () => Promise<T>,
  onTimeout?: (name: string, duration: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    watchdogManager.start(name, timeout, onTimeout);
    
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        watchdogManager.stop(name);
      });
  });
}

export function safeCall<T>(
  fn: () => T | Promise<T>,
  options: SafeCallOptions = {},
): Promise<T | undefined> {
  const {
    timeout = 8000,
    retries = 1,
    onError,
    fallback,
  } = options;

  return new Promise((resolve) => {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const watchdogName = `safeCall_${Date.now()}_${attempt}`;
        
        const result = await withWatchdog(
          watchdogName,
          timeout,
          async () => {
            const fnResult = fn();
            return Promise.resolve(fnResult);
          },
          (name, duration) => {
            logEvent('SAFE_CALL_TIMEOUT', {
              name: watchdogName,
              duration,
              timeout,
              attempt,
            });
          },
        );
        
        if (attempt > 0) {
          logEvent('SAFE_CALL_SUCCESS_RETRY', {
            attempt,
            totalAttempts: retries + 1,
          });
        }
        
        resolve(result);
        return;
      } catch (error) {
        lastError = error as Error;
        
        logEvent('SAFE_CALL_ERROR', {
          attempt,
          error: error instanceof Error ? error.message : String(error),
          willRetry: attempt < retries,
        });
        
        if (onError) {
          onError(lastError);
        }
        
        if (attempt < retries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => (globalThis as any).setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    // All attempts failed
    logEvent('SAFE_CALL_FAILED_ALL_ATTEMPTS', {
      totalAttempts: retries + 1,
      error: lastError?.message || 'Unknown error',
    });
    
    resolve(fallback);
  });
}

export function safeAwait<T>(
  promise: Promise<T>,
  options: SafeCallOptions = {},
): Promise<T | undefined> {
  return safeCall(() => promise, options);
}

export function createGlobalErrorHandler() {
  const originalHandler = (globalThis as any).ErrorUtils?.getGlobalHandler();
  
  (globalThis as any).ErrorUtils?.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logEvent('GLOBAL_ERROR', {
      message: error.message,
      stack: error.stack,
      isFatal,
      timestamp: Date.now(),
    });
    
    // Call original handler
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
    
    // Don't crash the app for non-fatal errors
    if (!isFatal) {
      logger.error('Non-fatal global error:', error);
    }
  });
}

export function setupCrashGuards(): void {
  // Set up global error handler
  createGlobalErrorHandler();
  
  // Set up unhandled promise rejection handler
  const originalUnhandledRejection = (globalThis as any).addEventListener;
  (globalThis as any).addEventListener = function(type: string, listener: any, options?: any) {
    if (type === 'unhandledrejection') {
      const wrappedListener = (event: any) => {
        logEvent('UNHANDLED_PROMISE_REJECTION', {
          reason: event.reason?.toString() || 'Unknown',
          promise: event.promise?.toString() || 'Unknown',
        });
        
        if (listener) {
          listener(event);
        }
      };
      
      return originalUnhandledRejection.call(this, type, wrappedListener, options);
    }
    
    return originalUnhandledRejection.call(this, type, listener, options);
  };
  
  logEvent('CRASH_GUARDS_INITIALIZED');
}

export function createSafeAsyncFunction<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: SafeCallOptions = {},
) {
  return async (...args: T): Promise<R | undefined> => {
    return safeCall(() => fn(...args), options);
  };
}

export function createSafeSyncFunction<T extends any[], R>(
  fn: (...args: T) => R,
  options: SafeCallOptions = {},
) {
  return (...args: T): R | undefined => {
    try {
      return fn(...args);
    } catch (error) {
      logEvent('SAFE_SYNC_FUNCTION_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (options.onError) {
        options.onError(error as Error);
      }
      
      return options.fallback;
    }
  };
}

export { watchdogManager };
