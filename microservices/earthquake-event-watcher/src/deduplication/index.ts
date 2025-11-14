/**
 * Deduplication & Prioritization Module
 * Identifies duplicate events and assigns priority based on detection latency
 */

import { NormalizedEarthquake, PrioritizedEvent, DeduplicationKey } from '../types/earthquake';
import { config } from '../config';
import { logger } from '../utils/logger';
import Redis from 'ioredis';

export class DeduplicationService {
  private redis: Redis | null = null;
  private notificationCache: Map<string, number> = new Map(); // region -> last notification time

  constructor() {
    // Initialize Redis if available
    try {
      this.redis = new Redis(config.redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.redis.on('error', (error) => {
        logger.warn('Redis connection error, using in-memory cache', { error: error.message });
        this.redis = null;
      });
    } catch (error: any) {
      logger.warn('Redis initialization failed, using in-memory cache', { error: error.message });
      this.redis = null;
    }
  }

  /**
   * Deduplicate and prioritize events
   */
  async deduplicateAndPrioritize(
    events: NormalizedEarthquake[]
  ): Promise<PrioritizedEvent[]> {
    if (events.length === 0) {
      return [];
    }

    // Group events by deduplication key
    const groups = new Map<string, NormalizedEarthquake[]>();

    for (const event of events) {
      const key = this.getDeduplicationKey(event);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    // Process each group
    const prioritized: PrioritizedEvent[] = [];

    for (const [key, group] of groups) {
      if (group.length === 0) continue;

      // Find fastest detection (lowest latency)
      const fastest = group.reduce((prev, curr) => {
        const prevLatency = prev.latencyMs || Infinity;
        const currLatency = curr.latencyMs || Infinity;
        return currLatency < prevLatency ? curr : prev;
      });

      // Collect duplicate sources
      const duplicateSources = group
        .map((e) => e.source)
        .filter((s, i, arr) => arr.indexOf(s) === i);

      // Check notification cooldown
      const regionKey = this.getRegionKey(fastest);
      const lastNotification = await this.getLastNotificationTime(regionKey);
      const now = Date.now();

      if (
        lastNotification &&
        now - lastNotification < config.notificationCooldownSeconds * 1000
      ) {
        logger.debug(`Skipping notification due to cooldown`, {
          regionKey,
          lastNotification: new Date(lastNotification).toISOString(),
        });
        continue;
      }

      // Create prioritized event
      const prioritizedEvent: PrioritizedEvent = {
        ...fastest,
        priorityScore: fastest.latencyMs || Infinity,
        duplicateSources: duplicateSources.filter((s) => s !== fastest.source),
      };

      prioritized.push(prioritizedEvent);

      // Update notification cache
      await this.setLastNotificationTime(regionKey, now);
    }

    // Sort by priority score (lower = faster)
    prioritized.sort((a, b) => a.priorityScore - b.priorityScore);

    logger.info(`Deduplicated ${events.length} events to ${prioritized.length} unique events`);

    return prioritized;
  }

  /**
   * Generate deduplication key
   */
  private getDeduplicationKey(event: NormalizedEarthquake): string {
    const windowMs = config.deduplicationWindowSeconds * 1000;
    const roundedTime = Math.floor(event.timestamp / windowMs) * windowMs;

    const latRounded = Math.round(event.latitude / config.deduplicationDistanceDegrees);
    const lonRounded = Math.round(event.longitude / config.deduplicationDistanceDegrees);

    return `${latRounded}_${lonRounded}_${roundedTime}`;
  }

  /**
   * Generate region key for cooldown tracking
   */
  private getRegionKey(event: NormalizedEarthquake): string {
    // Round to ~10km grid
    const latRounded = Math.round(event.latitude * 10) / 10;
    const lonRounded = Math.round(event.longitude * 10) / 10;
    return `${latRounded}_${lonRounded}`;
  }

  /**
   * Get last notification time for region
   */
  private async getLastNotificationTime(regionKey: string): Promise<number | null> {
    if (this.redis) {
      try {
        const value = await this.redis.get(`notification:${regionKey}`);
        return value ? parseInt(value, 10) : null;
      } catch (error) {
        logger.warn('Redis get failed, using in-memory cache', { error });
      }
    }

    return this.notificationCache.get(regionKey) || null;
  }

  /**
   * Set last notification time for region
   */
  private async setLastNotificationTime(regionKey: string, time: number): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.setex(
          `notification:${regionKey}`,
          config.notificationCooldownSeconds,
          time.toString()
        );
        return;
      } catch (error) {
        logger.warn('Redis set failed, using in-memory cache', { error });
      }
    }

    this.notificationCache.set(regionKey, time);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export const deduplicationService = new DeduplicationService();









