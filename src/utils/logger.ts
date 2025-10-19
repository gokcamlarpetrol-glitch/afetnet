/**
 * Production-safe logging utility
 * CRITICAL: Prevents sensitive data leaks in production
 */

import { safeStringify } from './safeStringify';
const isDevelopment = __DEV__;

export const logger = {
  info: (message: string, data?: any) => {
    if (isDevelopment) {
      // Use console to avoid recursion
      // eslint-disable-next-line no-console
      console.log(`[INFO] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
    }
  },

  warn: (message: string, data?: any) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
    }
  },

  error: (message: string, data?: any) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
    }
  },

  debug: (message: string, data?: any) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug?.(`[DEBUG] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
    }
  },

  // Emergency logs - always shown
  emergency: (message: string, data?: any) => {
    // eslint-disable-next-line no-console
    console.error(`[EMERGENCY] ${message}`, typeof data === 'object' ? safeStringify(data) : (data ?? ''));
  },

  // IAP-specific logging methods
  iap: {
    productDetected: (productId: string) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.log(`✅ Premium product detected: ${productId}`);
      }
    },

    premiumStatus: (isPremium: boolean, productId?: string) => {
      if (isDevelopment) {
        const status = isPremium ? 'ACTIVE' : 'INACTIVE';
        const productInfo = productId ? ` (Product: ${productId})` : '';
        // eslint-disable-next-line no-console
        console.log(`📊 Premium Status: ${status}${productInfo}`);
      }
    },

    purchaseSuccess: (productId: string, transactionId?: string) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.log(`💳 Purchase successful: ${productId}${transactionId ? ` (${transactionId})` : ''}`);
      }
    },

    purchaseFailed: (productId: string, error: string) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.error(`❌ Purchase failed: ${productId} - ${error}`);
      }
    },

    restoreSuccess: (count: number) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.log(`🔄 Restore successful: ${count} purchases restored`);
      }
    },

    restoreFailed: (error: string) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.error(`❌ Restore failed: ${error}`);
      }
    },

    verificationSuccess: (productId: string) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.log(`✅ Receipt verification passed: ${productId}`);
      }
    },

    verificationFailed: (productId: string, error: string) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.error(`❌ Receipt verification failed: ${productId} - ${error}`);
      }
    },

    serverError: (endpoint: string, error: string) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.error(`🌐 Server error (${endpoint}): ${error}`);
      }
    },

    webhookReceived: (type: string, transactionId: string) => {
      if (isDevelopment) {
        // eslint-disable-next-line no-console
        console.log(`🔔 Webhook received: ${type} for ${transactionId}`);
      }
    }
  }
};
