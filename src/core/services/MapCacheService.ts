/**
 * MAP CACHE SERVICE - ELITE
 * Advanced caching for map data with TTL and invalidation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('MapCacheService');

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class MapCacheService {
  private readonly CACHE_PREFIX = '@afetnet:map_cache:';
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private readonly MAX_MEMORY_ENTRIES = 100;

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && this.isValid(memoryEntry)) {
        return memoryEntry.data as T;
      }

      // Check AsyncStorage
      const stored = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (this.isValid(entry)) {
          // Promote to memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        } else {
          // Expired, remove it
          await this.remove(key);
        }
      }

      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      // Store in memory cache
      this.memoryCache.set(key, entry);
      this.evictMemoryCacheIfNeeded();

      // Store in AsyncStorage
      await AsyncStorage.setItem(`${this.CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Remove cached data
   */
  async remove(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${key}`);
    } catch (error) {
      logger.error('Cache remove error:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Evict oldest entries from memory cache if needed
   */
  private evictMemoryCacheIfNeeded(): void {
    if (this.memoryCache.size <= this.MAX_MEMORY_ENTRIES) return;

    // Remove oldest 20% of entries
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = Math.floor(this.MAX_MEMORY_ENTRIES * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ memory: number; storage: number; total: number }> {
    const memory = this.memoryCache.size;
    const keys = await AsyncStorage.getAllKeys();
    const storage = keys.filter(key => key.startsWith(this.CACHE_PREFIX)).length;
    
    return {
      memory,
      storage,
      total: memory + storage,
    };
  }
}

export const mapCacheService = new MapCacheService();









