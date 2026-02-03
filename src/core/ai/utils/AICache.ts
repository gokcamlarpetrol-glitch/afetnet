/**
 * AI CACHE UTILITY
 * Caching strategy for AI responses to reduce costs and improve performance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AICache');

const CACHE_PREFIX = 'ai_cache_';
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class AICache {
  /**
   * Cache'e veri kaydet
   */
  static async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      await AsyncStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify(entry),
      );

      logger.info(`Cached: ${key} (TTL: ${ttl}ms)`);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Cache'den veri oku
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_PREFIX + key);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);

      // TTL kontrolü
      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        logger.info(`Cache expired: ${key} (age: ${Math.round(age / 1000)}s)`);
        await this.delete(key);
        return null;
      }

      logger.info(`Cache hit: ${key} (age: ${Math.round(age / 1000)}s)`);
      return entry.data;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache'den sil
   */
  static async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      logger.info(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  /**
   * Tüm cache'i temizle
   */
  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));

      await AsyncStorage.multiRemove(cacheKeys);
      logger.info(`Cache cleared: ${cacheKeys.length} entries`);
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Cache istatistikleri
   */
  static async getStats(): Promise<{
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
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;

          try {
            const entry = JSON.parse(value);
            if (entry.timestamp < oldestTimestamp) {
              oldestTimestamp = entry.timestamp;
            }
          } catch (e) {
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
      logger.error('Cache stats error:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: Date.now(),
      };
    }
  }

  /**
   * Eski cache'leri temizle
   */
  static async cleanup(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));

      let cleaned = 0;

      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          try {
            const entry = JSON.parse(value);
            const age = Date.now() - entry.timestamp;

            if (age > entry.ttl) {
              await AsyncStorage.removeItem(key);
              cleaned++;
            }
          } catch (e) {
            // Invalid entry, remove it
            await AsyncStorage.removeItem(key);
            cleaned++;
          }
        }
      }

      logger.info(`Cache cleanup: ${cleaned} expired entries removed`);
      return cleaned;
    } catch (error) {
      logger.error('Cache cleanup error:', error);
      return 0;
    }
  }
}

/**
 * Cache key generator
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateCacheKey(service: string, params: Record<string, unknown>): string {
  // Parametreleri sırala ve string'e çevir
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);

  const paramsStr = JSON.stringify(sortedParams);

  // Basit hash fonksiyonu
  let hash = 0;
  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `${service}_${Math.abs(hash).toString(36)}`;
}


