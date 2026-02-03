/**
 * EEW POLLER - ELITE EDITION
 * Handles AFAD earthquake polling for Early Earthquake Warning
 */

import NetInfo from '@react-native-community/netinfo';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EEWPoller');

// ELITE: Type-safe error helpers
const getErrorMessage = (e: unknown): string => e instanceof Error ? e.message : String(e);
const getErrorName = (e: unknown): string => e instanceof Error ? e.name : 'UnknownError';

// AFAD API endpoints
const AFAD_BASE_URL = 'https://deprem.afad.gov.tr/apiv2/event/filter';

export interface PollConfig {
  intervalMs: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvents: (events: any[]) => void;
  onError: (error: Error) => void;
}

export interface PollerState {
  isPolling: boolean;
  lastPollTime: number | null;
  pollCount: number;
  lastError: string | null;
}

// State
let pollInterval: NodeJS.Timeout | null = null;
let isPolling = false;
let lastPollTime: number | null = null;
let pollCount = 0;
let lastError: string | null = null;
let config: PollConfig | null = null;

const MIN_POLL_INTERVAL = 5000; // 5 seconds minimum
const DEFAULT_POLL_INTERVAL = 15000; // 15 seconds

/**
 * ELITE: Generate AFAD poll URL with time range
 */
function getAfadPollUrl(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const start = `${formatDate(yesterday)}%2000:00:00`;
  const end = `${formatDate(now)}%2023:59:59`;

  return `${AFAD_BASE_URL}?start=${start}&end=${end}&minmag=0&limit=100`;
}

/**
 * ELITE: Get poller state
 */
export function getState(): PollerState {
  return {
    isPolling,
    lastPollTime,
    pollCount,
    lastError,
  };
}

/**
 * ELITE: Start polling
 */
export function start(newConfig: PollConfig): void {
  if (isPolling) {
    logger.debug('Poller already running');
    return;
  }

  config = {
    ...newConfig,
    intervalMs: Math.max(newConfig.intervalMs || DEFAULT_POLL_INTERVAL, MIN_POLL_INTERVAL),
  };

  isPolling = true;
  pollCount = 0;
  lastError = null;

  logger.info(`🔄 Starting AFAD polling (interval: ${config.intervalMs}ms)`);

  // Initial poll
  poll();

  // Start interval
  pollInterval = setInterval(poll, config.intervalMs);
}

/**
 * ELITE: Stop polling
 */
export function stop(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  isPolling = false;
  config = null;

  logger.info('🛑 AFAD polling stopped');
}

/**
 * ELITE: Execute single poll
 */
async function poll(): Promise<void> {
  if (!config) {
    return;
  }

  // Check network connectivity first
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      logger.debug('No network connection - skipping poll');
      return;
    }
  } catch (netError) {
    // Continue anyway - NetInfo might fail but network could still work
  }

  const url = getAfadPollUrl();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AfetNet/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    lastPollTime = Date.now();
    pollCount++;
    lastError = null;

    // Extract events array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let events: any[] = [];
    if (Array.isArray(data)) {
      events = data;
    } else if (data?.result && Array.isArray(data.result)) {
      events = data.result;
    } else if (data?.data && Array.isArray(data.data)) {
      events = data.data;
    }

    if (events.length > 0) {
      config.onEvents(events);
    }
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const errorName = getErrorName(error);
    lastError = errorMessage;

    // Only log if not an abort (timeout)
    if (errorName !== 'AbortError') {
      logger.error('Poll failed:', errorMessage);
      if (config) {
        config.onError(error instanceof Error ? error : new Error(errorMessage));
      }
    } else {
      logger.debug('Poll timeout - will retry on next interval');
    }
  }
}

/**
 * ELITE: Force immediate poll
 */
export async function pollNow(): Promise<void> {
  await poll();
}

/**
 * ELITE: Check if poller is running
 */
export function isRunning(): boolean {
  return isPolling;
}
