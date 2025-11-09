declare module 'pg';
declare module 'cors';
declare module 'dotenv';
declare module 'firebase-admin';

/**
 * ELITE: Express Rate Limit Type Augmentation
 * Extends Express Request type to include rateLimit property from express-rate-limit
 */
declare namespace Express {
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

export {};
