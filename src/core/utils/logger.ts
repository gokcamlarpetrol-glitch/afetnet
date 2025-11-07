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

  /**
   * Elite Security: Sanitize sensitive data from logs
   */
  private sanitizeLogData(data: any): any {
    if (typeof data === 'string') {
      // Elite: Mask API keys, tokens, secrets
      const sensitivePatterns = [
        /(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{10,})['"]?/gi,
        /(token|secret|password|pwd|passwd)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{8,})['"]?/gi,
        /(sk-|pk_|rk_)[a-zA-Z0-9]{20,}/g,
        /Bearer\s+[a-zA-Z0-9_-]{20,}/gi,
      ];
      
      let sanitized = data;
      sensitivePatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, (match, key, value) => {
          if (value && value.length > 8) {
            return `${key}: ***${value.slice(-4)}`;
          }
          return `${key}: ***`;
        });
      });
      
      return sanitized;
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};
      const sensitiveKeys = ['apiKey', 'api_key', 'token', 'secret', 'password', 'pwd', 'passwd', 'authorization', 'auth'];
      
      for (const key in data) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
          const value = String(data[key]);
          sanitized[key] = value.length > 8 ? `***${value.slice(-4)}` : '***';
        } else {
          sanitized[key] = this.sanitizeLogData(data[key]);
        }
      }
      
      return sanitized;
    }
    
    return data;
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    // Elite Security: Sanitize all log data
    const sanitizedMessage = this.sanitizeLogData(message);
    const sanitizedArgs = args.map(arg => this.sanitizeLogData(arg));
    
    if (__DEV__) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${this.prefix}] ${sanitizedMessage}`;
      
      switch (level) {
        case 'debug':
          console.log(logMessage, ...sanitizedArgs);
          break;
        case 'info':
          console.log(logMessage, ...sanitizedArgs);
          break;
        case 'warn':
          console.warn(logMessage, ...sanitizedArgs);
          break;
        case 'error':
          console.error(logMessage, ...sanitizedArgs);
          break;
      }
    } else {
      // Production: Only log errors, send to crash reporting service
      if (level === 'error') {
        // Elite: Sanitize error messages before sending to crash reporting
        const sanitizedError = sanitizedMessage;
        // TODO: Send to Sentry/Firebase Crashlytics
        // Example: Sentry.captureException(new Error(sanitizedError));
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

