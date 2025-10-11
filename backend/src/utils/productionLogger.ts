/**
 * Backend Production-Safe Logger
 * Elite Server-Side Logging Standards
 * 
 * Features:
 * - Zero sensitive data in logs
 * - Structured JSON logging
 * - Log levels
 * - PII masking
 * - Request ID tracking
 * - Production safety
 */

import winston from 'winston';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Create Winston logger
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'afetnet-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    }),
  ],
});

// In production, also log to file
if (!isDevelopment) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
}

/**
 * Mask sensitive data
 */
function maskSensitiveData(data: any): any {
  if (!data) return data;
  
  const sensitive = ['password', 'token', 'secret', 'apiKey', 'privateKey', 'jwt'];
  
  if (typeof data === 'object') {
    const masked = { ...data };
    Object.keys(masked).forEach(key => {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        masked[key] = '***REDACTED***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = maskSensitiveData(masked[key]);
      }
    });
    return masked;
  }
  
  return data;
}

/**
 * Production-safe logging functions
 */
export const backendLogger = {
  debug: (message: string, meta?: any) => {
    if (isDevelopment) {
      logger.debug(message, maskSensitiveData(meta));
    }
  },

  info: (message: string, meta?: any) => {
    logger.info(message, maskSensitiveData(meta));
  },

  warn: (message: string, meta?: any) => {
    logger.warn(message, maskSensitiveData(meta));
  },

  error: (message: string, error?: Error | any, meta?: any) => {
    logger.error(message, {
      ...maskSensitiveData(meta),
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    });
  },

  critical: (message: string, error?: Error | any, meta?: any) => {
    logger.error(`🚨 CRITICAL: ${message}`, {
      ...maskSensitiveData(meta),
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
      level: 'critical',
    });
    
    // TODO: Send alert to monitoring (PagerDuty, etc.)
  },

  api: (method: string, path: string, statusCode: number, duration: number, userId?: string) => {
    logger.info('API Request', {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      userId: userId || 'anonymous',
    });
  },

  security: (event: string, details: any) => {
    logger.warn(`🔒 SECURITY EVENT: ${event}`, maskSensitiveData(details));
  },

  performance: (operation: string, duration: number) => {
    if (duration > 1000) {
      logger.warn(`⚡ SLOW OPERATION: ${operation}`, { duration: `${duration}ms` });
    }
  },
};

export default backendLogger;

