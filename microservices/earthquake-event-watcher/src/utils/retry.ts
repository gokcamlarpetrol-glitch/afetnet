/**
 * Retry Utility with Exponential Backoff
 */

import { logger } from './logger';
import { config } from '../config';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = config.maxRetries,
    baseDelayMs = config.retryBackoffBaseMs,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`, {
          error: lastError.message,
        });

        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}









