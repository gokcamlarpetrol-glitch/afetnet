// FCM Worker Configuration
// TODO: Set these values in production environment

export const WORKER_URL = 'https://YOUR-WORKER-URL'; // Replace with actual Cloudflare Worker URL
export const ORG_SECRET = 'REPLACE_ME_DEV'; // Must match server ORG_SECRET

// Helper to check if worker is configured
export function isWorkerConfigured(): boolean {
  return WORKER_URL !== 'https://YOUR-WORKER-URL' && ORG_SECRET !== 'REPLACE_ME_DEV';
}
