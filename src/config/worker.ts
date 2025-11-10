// FCM Worker Configuration (Production)
// Backend push worker base URL and shared secret header.
// NOTE: ORG_SECRET must match the server's expected secret (x-org-secret)

export const WORKER_URL = 'https://afetnet-backend.onrender.com';
export const ORG_SECRET = '278a6f3c8a4e86014bc1559d3210daf09022a405eeb22c2b9b2db00176b37406';

// Helper to check if worker is configured
export function isWorkerConfigured(): boolean {
  return Boolean(WORKER_URL) && Boolean(ORG_SECRET) &&
         WORKER_URL.includes('render.com') && ORG_SECRET.length > 20;
}
