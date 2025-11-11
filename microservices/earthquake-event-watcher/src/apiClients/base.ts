/**
 * Base API Client
 * Common functionality for all API clients
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { config } from '../config';
import { RawEarthquakeEvent } from '../types/earthquake';

export abstract class BaseAPIClient {
  protected client: AxiosInstance;
  protected sourceName: string;
  protected lastFetchTime: number = 0;
  protected failureCount: number = 0;
  protected readonly MAX_FAILURES = 3;

  constructor(sourceName: string, baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.sourceName = sourceName;
    this.client = axios.create({
      baseURL,
      timeout: config.requestTimeoutMs,
      headers: {
        'User-Agent': 'AfetNet-EarthquakeWatcher/1.0',
        ...defaultHeaders,
      },
    });
  }

  /**
   * Fetch recent earthquakes from API
   * Returns raw events with latency tracking
   */
  async fetchRecent(): Promise<RawEarthquakeEvent[]> {
    const startTime = Date.now();
    const fetchTime = startTime;

    try {
      const data = await retryWithBackoff(
        () => this.fetchData(),
        {
          maxRetries: config.maxRetries,
          baseDelayMs: config.retryBackoffBaseMs,
          onRetry: (attempt, error) => {
            logger.warn(`${this.sourceName} retry ${attempt}`, { error: error.message });
          },
        }
      );

      const latencyMs = Date.now() - startTime;
      this.lastFetchTime = fetchTime;
      this.failureCount = 0;

      logger.debug(`${this.sourceName} fetch successful`, {
        count: Array.isArray(data) ? data.length : 1,
        latencyMs,
      });

      return Array.isArray(data)
        ? data.map((item) => ({
            source: this.getSourceName(),
            data: item,
            fetchedAt: fetchTime,
            latencyMs,
          }))
        : [
            {
              source: this.getSourceName(),
              data,
              fetchedAt: fetchTime,
              latencyMs,
            },
          ];
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      this.failureCount++;

      logger.error(`${this.sourceName} fetch failed`, {
        error: error.message,
        latencyMs,
        failureCount: this.failureCount,
      });

      if (this.failureCount >= this.MAX_FAILURES) {
        logger.warn(`${this.sourceName} exceeded max failures, marking as degraded`);
      }

      throw error;
    }
  }

  /**
   * Check if API is healthy
   */
  isHealthy(): boolean {
    return this.failureCount < this.MAX_FAILURES;
  }

  /**
   * Get health status
   */
  getHealthStatus(): { healthy: boolean; failureCount: number; lastFetchTime: number } {
    return {
      healthy: this.isHealthy(),
      failureCount: this.failureCount,
      lastFetchTime: this.lastFetchTime,
    };
  }

  protected abstract fetchData(): Promise<any>;
  protected abstract getSourceName(): 'USGS' | 'Ambee' | 'Xweather' | 'Zyla';
}

