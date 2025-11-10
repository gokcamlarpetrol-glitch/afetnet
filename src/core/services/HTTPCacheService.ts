/**
 * ELITE: HTTP CACHE SERVICE
 * HTTP response caching for improved performance and offline support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('HTTPCacheService');

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  headers?: Record<string, string>;
}

const CACHE_PREFIX = 'http_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

class HTTPCacheService {
  private cacheSize = 0;

  /**
   * ELITE: Cache HTTP response
   */
  async cacheResponse(
    url: string,
    data: any,
    ttl: number = DEFAULT_TTL,
    headers?: Record<string, string>
  ): Promise<void> {
    try {
      const key = this.getCacheKey(url);
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        ttl,
        headers,
      };

      const serialized = JSON.stringify(entry);
      const size = serialized.length;

      // Check cache size limit
      if (this.cacheSize + size > MAX_CACHE_SIZE) {
        await this.cleanupOldest();
      }

      await AsyncStorage.setItem(key, serialized);
      this.cacheSize += size;

      logger.info(`Cached HTTP response: ${url} (${Math.round(size / 1024)}KB, TTL: ${ttl}ms)`);
    } catch (error) {
      logger.error('HTTP cache error:', error);
    }
  }

  /**
   * ELITE: Get cached HTTP response
   */
  async getCachedResponse(url: string): Promise<any | null> {
    try {
      const key = this.getCacheKey(url);
      const cached = await AsyncStorage.getItem(key);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry = JSON.parse(cached);
      const age = Date.now() - entry.timestamp;

      if (age > entry.ttl) {
        logger.info(`Cache expired: ${url} (age: ${Math.round(age / 1000)}s)`);
        await this.deleteCache(url);
        return null;
      }

      logger.info(`Cache hit: ${url} (age: ${Math.round(age / 1000)}s)`);
      return entry.data;
    } catch (error) {
      logger.error('HTTP cache get error:', error);
      return null;
    }
  }

  /**
   * ELITE: Delete cached response
   */
  async deleteCache(url: string): Promise<void> {
    try {
      const key = this.getCacheKey(url);
      const cached = await AsyncStorage.getItem(key);
      
      if (cached) {
        this.cacheSize -= cached.length;
      }
      
      await AsyncStorage.removeItem(key);
      logger.info(`Deleted cache: ${url}`);
    } catch (error) {
      logger.error('HTTP cache delete error:', error);
    }
  }

  /**
   * ELITE: Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      await AsyncStorage.multiRemove(cacheKeys);
      this.cacheSize = 0;
      
      logger.info(`Cleared all HTTP cache: ${cacheKeys.length} entries`);
    } catch (error) {
      logger.error('HTTP cache clear error:', error);
    }
  }

  /**
   * ELITE: Cleanup oldest entries
   */
  private async cleanupOldest(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      const entries: Array<{ key: string; timestamp: number; size: number }> = [];
      
      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          try {
            const entry: CacheEntry = JSON.parse(cached);
            entries.push({
              key,
              timestamp: entry.timestamp,
              size: cached.length,
            });
          } catch {
            // Invalid entry, remove it
            await AsyncStorage.removeItem(key);
          }
        }
      }

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 20% of entries
      const toRemove = Math.ceil(entries.length * 0.2);
      const keysToRemove = entries.slice(0, toRemove).map(e => e.key);
      
      for (const key of keysToRemove) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          this.cacheSize -= cached.length;
        }
        await AsyncStorage.removeItem(key);
      }

      logger.info(`Cleaned up ${keysToRemove.length} oldest cache entries`);
    } catch (error) {
      logger.error('HTTP cache cleanup error:', error);
    }
  }

  /**
   * ELITE: Get cache key from URL
   */
  private getCacheKey(url: string): string {
    // Simple hash of URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${CACHE_PREFIX}${Math.abs(hash).toString(36)}`;
  }

  /**
   * ELITE: Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      let totalSize = 0;
      let oldestTimestamp = Date.now();

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          totalSize += cached.length;
          
          try {
            const entry: CacheEntry = JSON.parse(cached);
            if (entry.timestamp < oldestTimestamp) {
              oldestTimestamp = entry.timestamp;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      return {
        totalEntries: cacheKeys.length,
        totalSize,
        oldestEntry: oldestTimestamp,
      };
    } catch (error) {
      logger.error('HTTP cache stats error:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: Date.now(),
      };
    }
  }
}

export const httpCacheService = new HTTPCacheService();

