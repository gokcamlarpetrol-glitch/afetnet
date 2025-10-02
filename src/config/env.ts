import { z } from 'zod';

// Environment variable schema
const EnvSchema = z.object({
  // Backend Configuration
  BACKEND_URL: z.string().url().optional(),
  BACKEND_WS_URL: z.string().url().optional(),
  
  // Remote Config
  REMOTE_CONFIG_URL: z.string().url().optional(),
  REMOTE_CONFIG_PUBLIC_KEY: z.string().optional(),
  
  // EEW Feeds
  EEW_FEED_URLS: z.string().optional(),
  
  // Push Notifications
  FCM_SENDER_ID: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),
  
  // SMS Gateway
  SMS_GATEWAY_URL: z.string().url().optional(),
  SMS_GATEWAY_API_KEY: z.string().optional(),
  
  // Map Tiles
  TILES_UPDATE_URL: z.string().url().optional(),
  
  // Telemetry
  TELEMETRY_ENDPOINT: z.string().url().optional(),
  
  // Development
  DEBUG: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

// Parse environment variables
export const parseEnv = (): EnvConfig => {
  try {
    return EnvSchema.parse({
      BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
      BACKEND_WS_URL: process.env.EXPO_PUBLIC_BACKEND_WS_URL,
      REMOTE_CONFIG_URL: process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL,
      REMOTE_CONFIG_PUBLIC_KEY: process.env.EXPO_PUBLIC_REMOTE_CONFIG_PUBLIC_KEY,
      EEW_FEED_URLS: process.env.EXPO_PUBLIC_EEW_FEED_URLS,
      FCM_SENDER_ID: process.env.EXPO_PUBLIC_FCM_SENDER_ID,
      APNS_BUNDLE_ID: process.env.EXPO_PUBLIC_APNS_BUNDLE_ID,
      SMS_GATEWAY_URL: process.env.EXPO_PUBLIC_SMS_GATEWAY_URL,
      SMS_GATEWAY_API_KEY: process.env.EXPO_PUBLIC_SMS_GATEWAY_API_KEY,
      TILES_UPDATE_URL: process.env.EXPO_PUBLIC_TILES_UPDATE_URL,
      TELEMETRY_ENDPOINT: process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT,
      DEBUG: process.env.EXPO_PUBLIC_DEBUG,
      LOG_LEVEL: process.env.EXPO_PUBLIC_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
    });
  } catch (error) {
    console.warn('Invalid environment configuration:', error);
    return {} as EnvConfig;
  }
};

// Get environment configuration
export const getEnvConfig = (): EnvConfig => {
  return parseEnv();
};

// Check if running in development mode
export const isDevelopment = (): boolean => {
  return getEnvConfig().DEBUG === 'true' || __DEV__;
};

// Get log level
export const getLogLevel = (): 'debug' | 'info' | 'warn' | 'error' => {
  return getEnvConfig().LOG_LEVEL || 'info';
};
