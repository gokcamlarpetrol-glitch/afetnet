/**
 * RETRY UTILITY - Exponential Backoff with Jitter
 * ELITE: Production-grade retry mechanism for network operations
 */

import { createLogger } from './logger';

const logger = createLogger('RetryUtility');

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/** Configuration for retry behavior */
export interface RetryConfig {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Base delay in milliseconds (default: 1000) */
    baseDelayMs?: number;
    /** Maximum delay in milliseconds (default: 30000) */
    maxDelayMs?: number;
    /** Whether to add jitter to prevent thundering herd (default: true) */
    useJitter?: boolean;
    /** Error codes that should not trigger a retry */
    nonRetryableErrors?: string[];
    /** Custom function to determine if an error is retryable */
    isRetryable?: (error: unknown) => boolean;
    /** Callback for each retry attempt */
    onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

/** Default non-retryable error codes */
const DEFAULT_NON_RETRYABLE_ERRORS = [
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'not-found',
  'already-exists',
  'failed-precondition',
  'cancelled',
  'ERR_REQUEST_CANCELED',
  'SIGN_IN_CANCELLED',
];

// ============================================================================
// Retry Functions
// ============================================================================

/**
 * Calculate delay with exponential backoff and optional jitter
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap
 * @param useJitter - Whether to add random jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  useJitter: boolean,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  if (useJitter) {
    // Add +/- 25% jitter
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, cappedDelay + jitter);
  }

  return cappedDelay;
}

/**
 * Check if an error is retryable based on configuration
 * @param error - The error to check
 * @param config - Retry configuration
 */
function isErrorRetryable(error: unknown, config: RetryConfig): boolean {
  // Use custom retryable check if provided
  if (config.isRetryable) {
    return config.isRetryable(error);
  }

  // Check against non-retryable error codes
  const nonRetryable = config.nonRetryableErrors ?? DEFAULT_NON_RETRYABLE_ERRORS;
  const errorCode = (error as { code?: string })?.code;

  if (errorCode && nonRetryable.includes(errorCode)) {
    return false;
  }

  return true;
}

/**
 * Execute an async function with retry logic and exponential backoff
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns The result of the function
 * 
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetchDataFromAPI(),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    useJitter = true,
    onRetry,
  } = config;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isErrorRetryable(error, config)) {
        throw error;
      }

      // Don't delay after the last attempt
      if (attempt < maxRetries - 1) {
        const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, useJitter);

        // Log retry attempt
        logger.info(
          `Yeniden deneniyor (${attempt + 1}/${maxRetries}), ${Math.round(delay)}ms bekleniyor...`,
        );

        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt + 1, error, delay);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Execute an async function with retry, returning null on failure instead of throwing
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns The result of the function or null on failure
 */
export async function retryWithBackoffSafe<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T | null> {
  try {
    return await retryWithBackoff(fn, config);
  } catch (error) {
    logger.warn('Tüm yeniden deneme girişimleri başarısız oldu:', error);
    return null;
  }
}

/**
 * Wrap a function to automatically retry on failure
 * @param fn - The async function to wrap
 * @param config - Retry configuration
 * @returns A new function that retries on failure
 */
export function withRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: RetryConfig = {},
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retryWithBackoff(() => fn(...args), config);
}

export default {
  retryWithBackoff,
  retryWithBackoffSafe,
  withRetry,
};
