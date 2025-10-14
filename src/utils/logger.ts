/**
 * Production-safe logging utility
 * CRITICAL: Prevents sensitive data leaks in production
 */

const isDevelopment = __DEV__;

export const logger = {
  info: (message: string, data?: any) => {
    if (isDevelopment) {
      logger.info(`[INFO] ${message}`, data || '');
    }
  },
  
  warn: (message: string, data?: any) => {
    if (isDevelopment) {
      logger.warn(`[WARN] ${message}`, data || '');
    }
  },
  
  error: (message: string, data?: any) => {
    if (isDevelopment) {
      logger.error(`[ERROR] ${message}`, data || '');
    }
  },
  
  debug: (message: string, data?: any) => {
    if (isDevelopment) {
      logger.info(`[DEBUG] ${message}`, data || '');
    }
  },
  
  // Emergency logs - always shown
  emergency: (message: string, data?: any) => {
    logger.error(`[EMERGENCY] ${message}`, data || '');
  }
};
