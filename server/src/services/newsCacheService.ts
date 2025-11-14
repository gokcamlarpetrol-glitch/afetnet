/**
 * NEWS CACHE SERVICE
 * Elite: Advanced caching strategy with invalidation and TTL management
 * Multi-layer cache: Memory -> Database -> Firestore
 */

import { pool } from '../database';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[NewsCache] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[NewsCache] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[NewsCache] ${msg}`, ...args),
};

interface CacheEntry {
  key: string;
  value: string;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

class NewsCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MEMORY_CACHE_SIZE = 1000;
  private readonly DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  /**
   * Get cached summary
   */
  async get(articleId: string): Promise<string | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(articleId);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      memoryEntry.hits++;
      logger.info(`Cache HIT (memory): ${articleId}`);
      return memoryEntry.value;
    }

    // Check database cache
    try {
      const result = await pool.query(
        `SELECT summary, expires_at 
         FROM news_summaries 
         WHERE article_id = $1 
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC 
         LIMIT 1`,
        [articleId]
      );

      if (result.rows.length > 0) {
        const summary = result.rows[0].summary;
        const expiresAt = result.rows[0].expires_at 
          ? new Date(result.rows[0].expires_at).getTime()
          : Date.now() + this.DEFAULT_TTL_MS;

        // Store in memory cache
        this.setMemoryCache(articleId, summary, expiresAt);
        
        logger.info(`Cache HIT (database): ${articleId}`);
        return summary;
      }
    } catch (error) {
      logger.error('Failed to get from database cache:', error);
    }

    logger.info(`Cache MISS: ${articleId}`);
    return null;
  }

  /**
   * Set cached summary
   */
  async set(articleId: string, summary: string, ttlMs?: number): Promise<void> {
    const expiresAt = Date.now() + (ttlMs || this.DEFAULT_TTL_MS);

    // Store in memory cache
    this.setMemoryCache(articleId, summary, expiresAt);

    // Store in database (handled by centralizedNewsSummaryService)
    // This method is for explicit cache operations
  }

  /**
   * Invalidate cache for article
   */
  async invalidate(articleId: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(articleId);

    // Mark as expired in database
    try {
      await pool.query(
        `UPDATE news_summaries 
         SET expires_at = NOW() - INTERVAL '1 second'
         WHERE article_id = $1`,
        [articleId]
      );
      logger.info(`Cache invalidated: ${articleId}`);
    } catch (error) {
      logger.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Clear expired entries
   */
  async clearExpired(): Promise<void> {
    const now = Date.now();
    let cleared = 0;

    // Clear memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
        cleared++;
      }
    }

    // Clear database cache (old entries)
    try {
      const result = await pool.query(
        `DELETE FROM news_summaries 
         WHERE expires_at IS NOT NULL 
         AND expires_at < NOW() - INTERVAL '7 days'`
      );
      cleared += result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to clear expired database cache:', error);
    }

    if (cleared > 0) {
      logger.info(`Cleared ${cleared} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    memoryHits: number;
    oldestEntry: number | null;
  } {
    let totalHits = 0;
    let oldestExpiry: number | null = null;

    for (const entry of this.memoryCache.values()) {
      totalHits += entry.hits;
      if (!oldestExpiry || entry.expiresAt < oldestExpiry) {
        oldestExpiry = entry.expiresAt;
      }
    }

    return {
      memorySize: this.memoryCache.size,
      memoryHits: totalHits,
      oldestEntry: oldestExpiry,
    };
  }

  /**
   * Set memory cache entry
   */
  private setMemoryCache(key: string, value: string, expiresAt: number): void {
    // Evict oldest entries if cache is full
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      this.evictOldest();
    }

    this.memoryCache.set(key, {
      key,
      value,
      expiresAt,
      createdAt: Date.now(),
      hits: 0,
    });
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestCreatedAt = Infinity;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.createdAt < oldestCreatedAt) {
        oldestCreatedAt = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }
}

export const newsCacheService = new NewsCacheService();










