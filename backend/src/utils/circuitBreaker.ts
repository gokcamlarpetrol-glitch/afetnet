import CircuitBreaker from 'opossum';
import { logger } from './logger';

/**
 * Circuit Breaker Pattern
 * CRITICAL: Prevents cascading failures in distributed systems
 * Automatically stops calling failing services and retries after cooldown
 */

interface CircuitBreakerOptions {
  timeout?: number; // Request timeout (ms)
  errorThresholdPercentage?: number; // Error % to open circuit
  resetTimeout?: number; // Time before retry (ms)
  rollingCountTimeout?: number; // Stats window (ms)
  rollingCountBuckets?: number; // Stats buckets
  name?: string; // Circuit breaker name for logging
}

/**
 * Create a circuit breaker for external API calls
 * CRITICAL: Protects against failing external services (AFAD, USGS, Firebase)
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CircuitBreakerOptions = {}
): any {
  const {
    timeout = 10000, // 10 seconds
    errorThresholdPercentage = 50, // Open circuit at 50% error rate
    resetTimeout = 30000, // Try again after 30 seconds
    rollingCountTimeout = 10000, // 10 second window
    rollingCountBuckets = 10,
    name = 'unnamed',
  } = options;

  const breaker = new CircuitBreaker(fn, {
    timeout,
    errorThresholdPercentage,
    resetTimeout,
    rollingCountTimeout,
    rollingCountBuckets,
    name,
  });

  // Event listeners for monitoring
  breaker.on('open', () => {
    logger.error(`🔴 Circuit breaker OPENED: ${name}`, {
      stats: breaker.stats,
    });
  });

  breaker.on('halfOpen', () => {
    logger.warn(`🟡 Circuit breaker HALF-OPEN: ${name} (testing...)`);
  });

  breaker.on('close', () => {
    logger.info(`🟢 Circuit breaker CLOSED: ${name} (recovered)`);
  });

  breaker.on('timeout', () => {
    logger.warn(`⏱️  Circuit breaker TIMEOUT: ${name}`);
  });

  breaker.on('reject', () => {
    logger.warn(`❌ Circuit breaker REJECTED request: ${name} (circuit open)`);
  });

  breaker.on('success', (result: any) => {
    // Only log on first success after recovery
    if (breaker.opened || breaker.halfOpen) {
      logger.info(`✅ Circuit breaker SUCCESS: ${name}`);
    }
  });

  breaker.on('failure', (error: Error) => {
    logger.error(`❌ Circuit breaker FAILURE: ${name}`, {
      error: error.message,
      stats: breaker.stats,
    });
  });

  return breaker;
}

/**
 * Fallback function wrapper
 * CRITICAL: Provides fallback when circuit is open
 */
export function withFallback<T>(
  breaker: CircuitBreaker<any, T>,
  fallbackFn: () => T | Promise<T>
): (...args: any[]) => Promise<T> {
  return async (...args: any[]) => {
    try {
      return await breaker.fire(...args);
    } catch (error) {
      logger.warn(`⚠️  Using fallback for ${breaker.name}`, {
        error: (error as Error).message,
      });
      return await fallbackFn();
    }
  };
}

/**
 * Get circuit breaker health status
 */
export function getCircuitBreakerHealth(breaker: CircuitBreaker<any, any>) {
  return {
    name: breaker.name,
    state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
    stats: breaker.stats,
    healthy: !breaker.opened,
  };
}
