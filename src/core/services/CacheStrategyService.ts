/**
 * CACHE STRATEGY SERVICE
 * Stale-while-revalidate pattern for optimal UX
 * ELITE: Professional cache management with smart invalidation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('CacheStrategyService');

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number; // When data becomes stale
  expireTime: number; // When data expires
}

class CacheStrategyService {
  private readonly DEFAULT_STALE_TIME = 2 * 60 * 1000; // 2 minutes
  private readonly DEFAULT_EXPIRE_TIME = 5 * 60 * 1000; // 5 minutes
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private readonly MAX_MEMORY_CACHE_SIZE = 50;

  /**
   * ELITE: Stale-while-revalidate pattern
   * Returns cached data immediately if available (even if stale)
   * Fetches fresh data in background
   */
  async getWithRevalidate<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: {
      staleTime?: number;
      expireTime?: number;
      useMemoryCache?: boolean;
    },
  ): Promise<T> {
    const staleTime = options?.staleTime || this.DEFAULT_STALE_TIME;
    const expireTime = options?.expireTime || this.DEFAULT_EXPIRE_TIME;
    const useMemoryCache = options?.useMemoryCache !== false;

    // Check memory cache first (fastest)
    if (useMemoryCache) {
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry) {
        const now = Date.now();
        if (now < memoryEntry.expireTime) {
          // Data is valid - return immediately
          if (now >= memoryEntry.staleTime) {
            // Data is stale but not expired - return stale data and revalidate in background
            this.revalidateInBackground(key, fetchFn, staleTime, expireTime);
          }
          return memoryEntry.data;
        }
      }
    }

    // Check AsyncStorage cache
    const storageEntry = await this.getFromStorage<T>(key);
    if (storageEntry) {
      const now = Date.now();
      if (now < storageEntry.expireTime) {
        // Data is valid - return and update memory cache
        if (useMemoryCache) {
          this.memoryCache.set(key, storageEntry);
        }
        
        if (now >= storageEntry.staleTime) {
          // Data is stale but not expired - return stale data and revalidate in background
          this.revalidateInBackground(key, fetchFn, staleTime, expireTime);
        }
        
        return storageEntry.data;
      }
    }

    // No cache or expired - fetch fresh data
    return this.fetchAndCache(key, fetchFn, staleTime, expireTime, useMemoryCache);
  }

  /**
   * ELITE: Revalidate stale data in background
   */
  private async revalidateInBackground<T>(
    key: string,
    fetchFn: () => Promise<T>,
    staleTime: number,
    expireTime: number,
    useMemoryCache: boolean = true,
  ): Promise<void> {
    try {
      const freshData = await fetchFn();
      await this.set(key, freshData, staleTime, expireTime, useMemoryCache);
      
      if (__DEV__) {
        logger.debug(`✅ Background revalidation completed for ${key}`);
      }
    } catch (error) {
      // Silent fail - stale data is still better than no data
      if (__DEV__) {
        logger.debug(`⚠️ Background revalidation failed for ${key}:`, error);
      }
    }
  }

  /**
   * ELITE: Fetch and cache data
   */
  private async fetchAndCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    staleTime: number,
    expireTime: number,
    useMemoryCache: boolean = true,
  ): Promise<T> {
    const data = await fetchFn();
    await this.set(key, data, staleTime, expireTime, useMemoryCache);
    return data;
  }

  /**
   * ELITE: Set cache entry
   */
  async set<T>(
    key: string,
    data: T,
    staleTime?: number,
    expireTime?: number,
    useMemoryCache: boolean = true,
  ): Promise<void> {
    const now = Date.now();
    const stale = staleTime || this.DEFAULT_STALE_TIME;
    const expire = expireTime || this.DEFAULT_EXPIRE_TIME;

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      staleTime: now + stale,
      expireTime: now + expire,
    };

    // Update memory cache
    if (useMemoryCache) {
      // Enforce max size
      if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
        // Remove oldest entry
        const oldestKey = Array.from(this.memoryCache.keys())[0];
        this.memoryCache.delete(oldestKey);
      }
      this.memoryCache.set(key, entry);
    }

    // Update AsyncStorage cache
    try {
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (error) {
      if (__DEV__) {
        logger.warn(`Failed to save cache for ${key}:`, error);
      }
    }
  }

  /**
   * ELITE: Get from AsyncStorage
   */
  private async getFromStorage<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cached = await AsyncStorage.getItem(`cache_${key}`);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      return entry;
    } catch (error) {
      if (__DEV__) {
        logger.debug(`Failed to load cache for ${key}:`, error);
      }
      return null;
    }
  }

  /**
   * ELITE: Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      if (__DEV__) {
        logger.debug(`Failed to invalidate cache for ${key}:`, error);
      }
    }
  }

  /**
   * ELITE: Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      if (__DEV__) {
        logger.warn('Failed to clear cache:', error);
      }
    }
  }

  /**
   * ELITE: Get cache stats
   */
  getStats(): {
    memoryCacheSize: number;
    memoryCacheKeys: string[];
    } {
    return {
      memoryCacheSize: this.memoryCache.size,
      memoryCacheKeys: Array.from(this.memoryCache.keys()),
    };
  }
}

export const cacheStrategyService = new CacheStrategyService();









