import { z } from 'zod';

// EEW Feed Adapter Schema
export const EEWFeedAdapterSchema = z.object({
  name: z.string().min(1, 'Feed name is required'),
  url: z.string().url('Invalid URL'),
  type: z.enum(['json', 'xml']),
  pathMapping: z.object({
    lat: z.string().min(1, 'Latitude path is required'),
    lon: z.string().min(1, 'Longitude path is required'),
    mag: z.string().min(1, 'Magnitude path is required'),
    origin: z.string().min(1, 'Origin time path is required'),
    id: z.string().min(1, 'ID path is required'),
  }),
  signature: z.object({
    header: z.string().min(1, 'Signature header is required'),
    publicKeyPem: z.string().min(1, 'Public key is required'),
  }).optional(),
  etaCutoffSec: z.number().min(1).max(300).default(25),
});

// Push Notifications Schema
export const PushConfigSchema = z.object({
  topics: z.array(z.string()).optional(),
  fcmSenderId: z.string().optional(),
  fcmAppId: z.string().optional(),
  fcmApiKey: z.string().optional(),
  fcmProjectId: z.string().optional(),
  apnsTeamId: z.string().optional(),
  apnsKeyId: z.string().optional(),
});

// EEW Configuration Schema
export const EEWConfigSchema = z.object({
  enabled: z.boolean().default(true),
  k: z.number().min(2).max(20).default(5),
  radiusKm: z.number().min(1).max(50).default(8),
  windowSec: z.number().min(2).max(30).default(5),
  etaCutoffSec: z.number().min(5).max(300).default(25),
  feeds: z.array(EEWFeedAdapterSchema).optional(),
});

// Tiles Configuration Schema
export const TilesConfigSchema = z.object({
  url: z.string().url('Invalid tiles URL'),
  version: z.string().min(1, 'Version is required'),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid SHA256 hash'),
});

// Backend Configuration Schema
export const BackendConfigSchema = z.object({
  apiBaseUrl: z.string().url('Invalid API URL'),
  wsUrl: z.string().url('Invalid WebSocket URL'),
});

// Main Remote Config Schema
export const RemoteConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  timestamp: z.number().default(Date.now),
  tiles: TilesConfigSchema.optional(),
  push: PushConfigSchema.optional(),
  eew: EEWConfigSchema.optional(),
  backend: BackendConfigSchema.optional(),
});

// Type exports
export type EEWFeedAdapter = z.infer<typeof EEWFeedAdapterSchema>;
export type PushConfig = z.infer<typeof PushConfigSchema>;
export type EEWConfig = z.infer<typeof EEWConfigSchema>;
export type TilesConfig = z.infer<typeof TilesConfigSchema>;
export type BackendConfig = z.infer<typeof BackendConfigSchema>;
export type RemoteConfig = z.infer<typeof RemoteConfigSchema>;

// Validation functions
export const validateRemoteConfig = (data: unknown): RemoteConfig => {
  try {
    return RemoteConfigSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Remote config validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
};

export const validateEEWFeedAdapter = (data: unknown): EEWFeedAdapter => {
  try {
    return EEWFeedAdapterSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`EEW feed adapter validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
};

// Utility functions for path parsing
export const parseJsonPath = (obj: any, path: string): any => {
  try {
    // Handle array notation like "geometry.coordinates[1]"
    const parts = path.split(/[\.\[\]]/).filter(part => part !== '');
    let result = obj;
    
    for (const part of parts) {
      if (result === null || result === undefined) {
        return null;
      }
      result = result[part];
    }
    
    return result;
  } catch (error) {
    return null;
  }
};

export const parseXmlPath = (xml: string, path: string): string | null => {
  try {
    // Simple XML path parsing - in production, use a proper XML parser
    const regex = new RegExp(`<${path}>(.*?)<\/${path}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
};

// Default configurations
export const DEFAULT_EEW_CONFIG: EEWConfig = {
  enabled: true,
  k: 5,
  radiusKm: 8,
  windowSec: 5,
  etaCutoffSec: 25,
};

export const DEFAULT_PUSH_CONFIG: PushConfig = {
  topics: [],
};

export const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  apiBaseUrl: 'https://api.afetnet.org',
  wsUrl: 'wss://api.afetnet.org/ws',
};
