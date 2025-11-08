// FCM Worker Configuration (Production)
// Backend push worker base URL and shared secret header.
// NOTE: ORG_SECRET must match the server's expected secret (x-org-secret)
// GÜVENLIK: ORG_SECRET artık environment variable'dan okunuyor, hardcoded değil!

import { ENV } from '../core/config/env';

export const WORKER_URL = ENV.API_BASE_URL || 'https://afetnet-backend.onrender.com';
export const ORG_SECRET = ENV.ORG_SECRET;

// Helper to check if worker is configured
export function isWorkerConfigured(): boolean {
  return Boolean(WORKER_URL) && Boolean(ORG_SECRET) &&
         WORKER_URL.includes('render.com') && ORG_SECRET.length > 20;
}
