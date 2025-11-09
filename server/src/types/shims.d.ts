/**
 * ELITE: Type Augmentations for Express and Third-Party Libraries
 * These type declarations extend Express types to include properties from middleware
 */

declare module 'pg';
declare module 'cors';
declare module 'dotenv';
declare module 'firebase-admin';

// Import Express rate limit types
/// <reference path="./express-rate-limit.d.ts" />

export {};
