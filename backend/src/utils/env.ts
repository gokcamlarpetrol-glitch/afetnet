import { backendLogger } from '../utils/productionLogger';
/**
 * Environment Variable Validation
 * CRITICAL: Ensures all required environment variables are set
 * Prevents runtime errors due to missing configuration
 */

interface EnvConfig {
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';

  // Database
  DATABASE_URL: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // Firebase (optional in development)
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;

  // Stripe (optional in development)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // APIs
  AFAD_API_URL: string;
  USGS_API_URL: string;

  // CORS
  CORS_ORIGIN: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;

  // Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'http' | 'debug';
}

/**
 * Validate and parse environment variables
 * CRITICAL: Called on server startup
 */
export function validateEnv(): EnvConfig {
  const errors: string[] = [];

  // Required variables - MINIMAL for deployment
  const required = [
    'DATABASE_URL',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // CRITICAL: JWT_SECRET must be strong in production
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      errors.push('JWT_SECRET is required in production');
    } else {
      process.env.JWT_SECRET = 'default-jwt-secret-for-deployment-' + Math.random().toString(36);
    }
  } else if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }

  // CRITICAL: Production security checks
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      errors.push('Firebase credentials are required in production');
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      errors.push('Stripe credentials are required in production');
    }
    if (process.env.CORS_ORIGIN === '*') {
      errors.push('CORS_ORIGIN cannot be * in production');
    }
  }

  // Throw if any errors
  if (errors.length > 0) {
    backendLogger.error('❌ CRITICAL: Environment validation failed:');
    errors.forEach((error) => backendLogger.error(`  - ${error}`));
    throw new Error('Environment validation failed. Please check your .env file.');
  }

  // Parse and return config
  const config: EnvConfig = {
    PORT: parseInt(process.env.PORT || '3000'),
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    AFAD_API_URL: process.env.AFAD_API_URL || 'https://deprem.afad.gov.tr/EventData/GetLast100Event',
    USGS_API_URL: process.env.USGS_API_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
  };

  backendLogger.debug('✅ Environment variables validated successfully');
  backendLogger.debug(`   - Environment: ${config.NODE_ENV}`);
  backendLogger.debug(`   - Port: ${config.PORT}`);
  backendLogger.debug(`   - Database: ${config.DATABASE_URL.substring(0, 30)}...`);
  backendLogger.debug(`   - JWT Secret: ${config.JWT_SECRET.substring(0, 10)}... (${config.JWT_SECRET.length} chars)`);
  backendLogger.debug(`   - Firebase: ${config.FIREBASE_PROJECT_ID ? 'Configured' : 'Not configured'}`);
  backendLogger.debug(`   - Stripe: ${config.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured'}`);

  return config;
}

/**
 * Get environment config
 * Safe to call after validateEnv()
 */
export function getEnv(): EnvConfig {
  return {
    PORT: parseInt(process.env.PORT || '3000'),
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    AFAD_API_URL: process.env.AFAD_API_URL || 'https://deprem.afad.gov.tr/EventData/GetLast100Event',
    USGS_API_URL: process.env.USGS_API_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
  };
}

