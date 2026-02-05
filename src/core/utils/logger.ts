/**
 * LOGGER SERVICE - ELITE EDITION
 * Production-safe logging with custom crash tracking integration
 * ELITE: Uses custom FirebaseCrashlyticsService instead of native module
 * ELITE V2: Added log level control to reduce terminal noise
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ELITE: Log level priority for filtering
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ELITE: Configurable minimum log level
// Set to 'info' by default to reduce debug noise
// Can be overridden by setting LOG_LEVEL environment variable
const getMinLogLevel = (): LogLevel => {
  // In production, only show warnings and errors
  if (!__DEV__) return 'warn';
  // In dev, show info and above by default (reduces debug spam)
  return 'info';
};

let currentMinLogLevel: LogLevel = getMinLogLevel();

// ELITE: Allow runtime log level changes for debugging
export const setLogLevel = (level: LogLevel) => {
  currentMinLogLevel = level;
};

export const getLogLevel = (): LogLevel => currentMinLogLevel;

// ELITE: Crashlytics service interface for type safety
interface CrashlyticsServiceInterface {
  setUserId: (userId: string) => void;
  setAttribute: (key: string, value: string) => void;
  log: (message: string) => void;
  recordError: (error: Error, context?: Record<string, string>) => void;
}

// ELITE: Lazy import crashlytics service to avoid circular dependencies
let crashlyticsService: CrashlyticsServiceInterface | null = null;
let crashlyticsAvailable = false;

// Initialize Crashlytics check - lazy loaded
const getCrashlytics = async () => {
  if (crashlyticsService) return crashlyticsService;
  try {
    const { firebaseCrashlyticsService } = await import('../services/FirebaseCrashlyticsService');
    crashlyticsService = firebaseCrashlyticsService;
    crashlyticsAvailable = true;
    return crashlyticsService;
  } catch (e) {
    // Crashlytics not available
    crashlyticsAvailable = false;
    return null;
  }
};

// Initialize on module load
getCrashlytics();

class Logger {
  private prefix: string;
  private breadcrumbs: string[] = [];
  private readonly MAX_BREADCRUMBS = 50;

  constructor(prefix: string = 'AfetNet') {
    this.prefix = prefix;
  }

  /**
   * ELITE: Set user context for error tracking
   */
  async setUser(userId: string, email?: string, displayName?: string) {
    const cs = await getCrashlytics();
    if (!cs) return;
    try {
      cs.setUserId(userId);
      if (email) cs.setAttribute('email', email);
      if (displayName) cs.setAttribute('displayName', displayName);
    } catch (e) {
      // Ignore if Crashlytics not available
    }
  }

  /**
   * ELITE: Add custom attribute for debugging
   */
  async setAttribute(key: string, value: string) {
    const cs = await getCrashlytics();
    if (!cs) return;
    try {
      cs.setAttribute(key, value);
    } catch { /* Crashlytics may not be available */ }
  }

  /**
   * ELITE: Add breadcrumb for debugging crash context
   */
  private async addBreadcrumb(message: string) {
    this.breadcrumbs.push(`[${new Date().toISOString()}] ${message}`);
    if (this.breadcrumbs.length > this.MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }

    // Also log to Crashlytics in production
    if (!__DEV__ && crashlyticsAvailable) {
      try {
        const cs = await getCrashlytics();
        if (cs) cs.log(message);
      } catch { /* Crashlytics may not be available */ }
    }
  }

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${this.prefix}] ${message}`;

    // Always add as breadcrumb for crash debugging
    this.addBreadcrumb(`[${level.toUpperCase()}] ${logMessage}`);

    if (__DEV__) {
      // ELITE: Only log if level is at or above minimum level
      if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[currentMinLogLevel]) {
        return; // Skip logs below minimum level
      }

      // Development: Full console logging
      const formattedMessage = `[${timestamp}] ${logMessage}`;
      switch (level) {
        case 'debug':
          console.log('🔍', formattedMessage, ...args);
          break;
        case 'info':
          console.log('ℹ️', formattedMessage, ...args);
          break;
        case 'warn':
          console.warn('⚠️', formattedMessage, ...args);
          break;
        case 'error':
          console.error('❌', formattedMessage, ...args);
          break;
      }
    } else {
      // Production: Only errors and warnings go to Crashlytics
      if (crashlyticsAvailable) {
        getCrashlytics().then(cs => {
          if (!cs) return;
          try {
            if (level === 'error') {
              // Record error with full context
              const error = args[0] instanceof Error ? args[0] : new Error(logMessage);
              cs.recordError(error);
            } else if (level === 'warn') {
              // Log warnings as breadcrumbs
              cs.log(`[WARN] ${logMessage}`);
            }
          } catch (e) {
            // Ignore Crashlytics errors
          }
        });
      }
    }
  }

  debug(message: string, ...args: unknown[]) {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.log('error', message, ...args);
  }

  /**
   * ELITE: Force a non-fatal crash report with current breadcrumbs
   */
  async reportError(error: Error, context?: Record<string, string>) {
    const cs = await getCrashlytics();
    if (!cs) return;
    try {
      // Add context as attributes
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          cs.setAttribute(key, value);
        });
      }
      cs.recordError(error, context);
    } catch { /* Crashlytics may not be available */ }
  }

  /**
   * Get recent breadcrumbs for debugging
   */
  getBreadcrumbs(): string[] {
    return [...this.breadcrumbs];
  }
}

export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}

export const logger = new Logger();
