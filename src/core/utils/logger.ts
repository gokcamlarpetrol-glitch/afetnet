/**
 * LOGGER SERVICE
 * Production-safe logging with __DEV__ guards
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private prefix: string;

  constructor(prefix: string = 'AfetNet') {
    this.prefix = prefix;
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    if (__DEV__) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${this.prefix}] ${message}`;
      
      switch (level) {
        case 'debug':
          console.log(logMessage, ...args);
          break;
        case 'info':
          console.log(logMessage, ...args);
          break;
        case 'warn':
          console.warn(logMessage, ...args);
          break;
        case 'error':
          console.error(logMessage, ...args);
          break;
      }
    } else {
      // Production: Only log errors, send to crash reporting service
      if (level === 'error') {
        // TODO: Send to Sentry/Firebase Crashlytics
        // Example: Sentry.captureException(new Error(message));
      }
    }
  }

  debug(message: string, ...args: any[]) {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log('error', message, ...args);
  }
}

export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}

export const logger = new Logger();

