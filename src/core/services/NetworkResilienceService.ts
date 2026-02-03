/**
 * NETWORK RESILIENCE SERVICE
 * Exponential backoff, circuit breaker, and request deduplication
 * ELITE: Professional-grade network resilience patterns
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('NetworkResilienceService');

interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailureTime: number;
  successCount: number;
}

interface RequestCache<T = unknown> {
  key: string;
  timestamp: number;
  promise: Promise<T>;
}

class NetworkResilienceService {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private requestCache: Map<string, RequestCache> = new Map();
  private readonly MAX_FAILURES = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly REQUEST_DEDUP_WINDOW = 2000; // 2 seconds
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF = 1000; // 1 second
  private readonly MAX_BACKOFF = 30000; // 30 seconds

  /**
   * ELITE: Exponential backoff with jitter
   */
  private calculateBackoff(attempt: number): number {
    const exponential = Math.min(
      this.INITIAL_BACKOFF * Math.pow(2, attempt),
      this.MAX_BACKOFF,
    );
    // Add jitter (±20%)
    const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
    return Math.max(100, exponential + jitter);
  }

  /**
   * ELITE: Circuit breaker pattern
   * Prevents cascading failures by opening circuit after repeated failures
   */
  private checkCircuitBreaker(endpoint: string): boolean {
    const breaker = this.circuitBreakers.get(endpoint) || {
      isOpen: false,
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
    };

    // If circuit is open, check if timeout has passed
    if (breaker.isOpen) {
      const timeSinceFailure = Date.now() - breaker.lastFailureTime;
      if (timeSinceFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
        // Half-open state - allow one request to test
        breaker.isOpen = false;
        breaker.failures = 0;
        this.circuitBreakers.set(endpoint, breaker);
        if (__DEV__) {
          logger.info(`🔄 Circuit breaker half-open for ${endpoint}`);
        }
        return true;
      }
      return false; // Circuit is open
    }

    return true; // Circuit is closed (normal operation)
  }

  /**
   * ELITE: Record success - close circuit breaker
   */
  recordSuccess(endpoint: string): void {
    const breaker = this.circuitBreakers.get(endpoint);
    if (breaker) {
      breaker.successCount++;
      breaker.failures = 0;
      if (breaker.isOpen) {
        breaker.isOpen = false;
        if (__DEV__) {
          logger.info(`✅ Circuit breaker closed for ${endpoint}`);
        }
      }
      this.circuitBreakers.set(endpoint, breaker);
    }
  }

  /**
   * ELITE: Record failure - potentially open circuit breaker
   */
  recordFailure(endpoint: string): void {
    let breaker = this.circuitBreakers.get(endpoint) || {
      isOpen: false,
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
    };

    breaker.failures++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failures >= this.MAX_FAILURES) {
      breaker.isOpen = true;
      if (__DEV__) {
        logger.warn(`⚠️ Circuit breaker opened for ${endpoint} (${breaker.failures} failures)`);
      }
    }

    this.circuitBreakers.set(endpoint, breaker);
  }

  /**
   * ELITE: Request deduplication
   * Prevents duplicate requests within a time window
   */
  private getRequestKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * ELITE: Execute request with resilience patterns
   */
  async executeWithResilience<T>(
    endpoint: string,
    url: string,
    fetchFn: () => Promise<Response>,
    options?: RequestInit,
  ): Promise<T> {
    // Check circuit breaker
    if (!this.checkCircuitBreaker(endpoint)) {
      throw new Error(`Circuit breaker is open for ${endpoint}`);
    }

    // Check for duplicate requests
    const requestKey = this.getRequestKey(url, options);
    const cached = this.requestCache.get(requestKey);
    if (cached && Date.now() - cached.timestamp < this.REQUEST_DEDUP_WINDOW) {
      if (__DEV__) {
        logger.debug(`🔄 Deduplicating request: ${url}`);
      }
      return cached.promise as Promise<T>;
    }

    // Execute with exponential backoff retry
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const response = await fetchFn();

        if (response.ok) {
          // Success - record and return
          this.recordSuccess(endpoint);
          const data = await response.json();

          // Cache promise for deduplication
          const promise = Promise.resolve(data);
          this.requestCache.set(requestKey, {
            key: requestKey,
            timestamp: Date.now(),
            promise,
          });

          // Clean up old cache entries
          this.cleanupRequestCache();

          return data;
        } else {
          // HTTP error - might be retryable
          if (response.status >= 500 && attempt < this.MAX_RETRIES - 1) {
            // Server error - retry
            lastError = new Error(`HTTP ${response.status}`);
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          } else {
            // Client error or max retries - don't retry
            this.recordFailure(endpoint);
            throw new Error(`HTTP ${response.status}`);
          }
        }
      } catch (error: unknown) {
        lastError = error as Error;

        // Network error - retry with backoff
        const errMsg = error instanceof Error ? error.message : String(error);
        const errName = error instanceof Error ? error.name : '';
        if (
          (errMsg?.includes('Network request failed') ||
            errName === 'NetworkError' ||
            errName === 'TypeError') &&
          attempt < this.MAX_RETRIES - 1
        ) {
          const backoff = this.calculateBackoff(attempt);
          if (__DEV__) {
            logger.debug(`⏱️ Retrying ${endpoint} after ${backoff}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
          }
          await this.sleep(backoff);
          continue;
        }

        // Non-retryable error or max retries reached
        this.recordFailure(endpoint);
        throw error;
      }
    }

    // All retries failed
    this.recordFailure(endpoint);
    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * ELITE: Clean up old request cache entries
   */
  private cleanupRequestCache(): void {
    const now = Date.now();
    for (const [key, cache] of this.requestCache.entries()) {
      if (now - cache.timestamp > this.REQUEST_DEDUP_WINDOW * 2) {
        this.requestCache.delete(key);
      }
    }
  }

  /**
   * ELITE: Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ELITE: Get circuit breaker status
   */
  getCircuitBreakerStatus(endpoint: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(endpoint) || null;
  }

  /**
   * ELITE: Reset circuit breaker (for testing or manual recovery)
   */
  resetCircuitBreaker(endpoint: string): void {
    this.circuitBreakers.delete(endpoint);
    if (__DEV__) {
      logger.info(`🔄 Circuit breaker reset for ${endpoint}`);
    }
  }
}

export const networkResilienceService = new NetworkResilienceService();









