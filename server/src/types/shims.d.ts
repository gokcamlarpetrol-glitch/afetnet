/**
 * ELITE: Type Augmentations for Express and Third-Party Libraries
 * These type declarations extend Express types to include properties from middleware
 */

declare module 'pg';
declare module 'cors';
declare module 'dotenv';
declare module 'firebase-admin';

/**
 * ELITE: Express Rate Limit Type Augmentation
 * Extends Express Request type to include rateLimit property from express-rate-limit
 * CRITICAL: This must be declared before express module is imported anywhere
 */
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
