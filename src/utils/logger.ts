/**
 * Production-safe logging utility
 * CRITICAL: Prevents sensitive data leaks in production
 */

import { safeStringify } from './safeStringify';

// Global console declaration for logger
declare const console: {
   
  log: (...args: any[]) => void;
  info?: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
};

const isDevelopment = __DEV__;

export const logger = {
  info: (message: string, data?: any) => {
    if (isDevelopment) {
      // Use console to avoid recursion
       
      console.info?.(`[INFO] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
    }
  },

  warn: (message: string, data?: any) => {
    if (isDevelopment) {
       
      console.warn(`[WARN] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
    }
  },

  error: (message: string, data?: any) => {
    if (isDevelopment) {
       
      console.error(`[ERROR] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
    }
  },

  debug: (message: string, data?: any) => {
    if (isDevelopment) {
       
      console.debug?.(`[DEBUG] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
    }
  },

  // Emergency logs - always shown
  emergency: (message: string, data?: any) => {
     
    console.error(`[EMERGENCY] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
  },

  // IAP-specific logging methods
  iap: {
    productDetected: (productId: string) => {
      if (isDevelopment) {
         
        console.info?.(`✅ Premium product detected: ${productId}`);
      }
    },

    premiumStatus: (isPremium: boolean, productId?: string) => {
      if (isDevelopment) {
        const status = isPremium ? 'ACTIVE' : 'INACTIVE';
        const productInfo = productId ? ` (Product: ${productId})` : '';
         
        console.info?.(`📊 Premium Status: ${status}${productInfo}`);
      }
    },

    purchaseSuccess: (productId: string, transactionId?: string) => {
      if (isDevelopment) {
         
        console.info?.(`💳 Purchase successful: ${productId}${transactionId ? ` (${transactionId})` : ''}`);
      }
    },

    purchaseFailed: (productId: string, error: string) => {
      if (isDevelopment) {
         
        console.error(`❌ Purchase failed: ${productId} - ${error}`);
      }
    },

    restoreSuccess: (count: number) => {
      if (isDevelopment) {
         
        console.info?.(`🔄 Restore successful: ${count} purchases restored`);
      }
    },

    restoreFailed: (error: string) => {
      if (isDevelopment) {
         
        console.error(`❌ Restore failed: ${error}`);
      }
    },

    verificationSuccess: (productId: string) => {
      if (isDevelopment) {
         
        console.info?.(`✅ Receipt verification passed: ${productId}`);
      }
    },

    verificationFailed: (productId: string, error: string) => {
      if (isDevelopment) {
         
        console.error(`❌ Receipt verification failed: ${productId} - ${error}`);
      }
    },

    serverError: (endpoint: string, error: string) => {
      if (isDevelopment) {
         
        console.error(`🌐 Server error (${endpoint}): ${error}`);
      }
    },

    webhookReceived: (type: string, transactionId: string) => {
      if (isDevelopment) {
         
        console.info?.(`🔔 Webhook received: ${type} for ${transactionId}`);
      }
    },
  },
};
