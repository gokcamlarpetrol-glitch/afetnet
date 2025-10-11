/**
 * Production-safe logging utility
 * CRITICAL: Prevents sensitive data leaks in production
 */

const isDevelopment = __DEV__;

export const logger = {
  info: (message: string, data?: any) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, data || '');
    }
  },
  
  warn: (message: string, data?: any) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  },
  
  error: (message: string, data?: any) => {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, data || '');
    }
  },
  
  debug: (message: string, data?: any) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  },
  
  // Emergency logs - always shown
  emergency: (message: string, data?: any) => {
    console.error(`[EMERGENCY] ${message}`, data || '');
  }
};
