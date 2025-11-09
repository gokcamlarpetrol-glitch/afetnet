/**
 * ELITE: Express Rate Limit Type Definitions
 * Type augmentation for express-rate-limit middleware
 * This file ensures type safety for rateLimit property on Express Request
 */

import 'express';

declare global {
  namespace Express {
    interface Request {
      rateLimit?: {
        limit: number;
        current: number;
        remaining: number;
        resetTime: Date;
        totalHits: number;
      };
    }
  }
}

export {};

