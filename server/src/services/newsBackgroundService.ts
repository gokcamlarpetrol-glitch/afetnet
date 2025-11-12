/**
 * NEWS BACKGROUND SERVICE
 * Elite: Automatically generates summaries for new articles
 * Runs periodically to fetch news and create centralized summaries
 * 
 * COST OPTIMIZATION: Single AI call per article for all users
 */

import { centralizedNewsSummaryService } from './centralizedNewsSummaryService';
import { pool } from '../database';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[NewsBackground] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[NewsBackground] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[NewsBackground] ${msg}`, ...args),
};

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  magnitude?: number;
  location?: string;
}

class NewsBackgroundService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly FETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ARTICLES_PER_BATCH = 10;
  private readonly PROCESSING_DELAY_MS = 2000; // 2 seconds between articles

  /**
   * Start background news processing
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('News background service already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting news background service...');

    // Process immediately on start
    this.processNewArticles().catch((error) => {
      logger.error('Initial news processing failed:', error);
    });

    // Then process periodically
    this.intervalId = setInterval(() => {
      this.processNewArticles().catch((error) => {
        logger.error('Periodic news processing failed:', error);
      });
    }, this.FETCH_INTERVAL_MS);

    logger.info(`News background service started (interval: ${this.FETCH_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Stop background news processing
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('News background service stopped');
  }

  /**
   * Process new articles and generate summaries
   */
  private async processNewArticles(): Promise<void> {
    try {
      logger.info('Processing new articles...');

      // Get articles that need summaries
      const articlesToProcess = await this.getArticlesNeedingSummaries();

      if (articlesToProcess.length === 0) {
        logger.info('No articles need summaries');
        return;
      }

      logger.info(`Found ${articlesToProcess.length} articles needing summaries`);

      // Process in batches to avoid overwhelming the system
      const batches = this.chunkArray(articlesToProcess, this.MAX_ARTICLES_PER_BATCH);

      for (const batch of batches) {
        await this.processBatch(batch);
        
        // Delay between batches
        if (batches.length > 1) {
          await this.delay(this.PROCESSING_DELAY_MS);
        }
      }

      logger.info(`Successfully processed ${articlesToProcess.length} articles`);
    } catch (error) {
      logger.error('Failed to process new articles:', error);
    }
  }

  /**
   * Get articles that need summaries
   * ELITE: Fetches articles from database that don't have AI summaries yet
   */
  private async getArticlesNeedingSummaries(): Promise<NewsArticle[]> {
    try {
      // ELITE: Get articles that have original summary but no AI-generated summary
      // This query finds articles where summary exists but is likely the original RSS summary
      // (short summaries < 100 chars are likely original, not AI-generated)
      // CRITICAL: When using SELECT DISTINCT, ORDER BY expressions must appear in SELECT list
      const result = await pool.query(
        `SELECT DISTINCT 
          ns.article_id as id,
          ns.title,
          ns.summary as original_summary,
          ns.source,
          ns.url,
          EXTRACT(EPOCH FROM ns.created_at) * 1000 as published_at,
          ns.created_at
        FROM news_summaries ns
        WHERE ns.summary IS NOT NULL
          AND ns.summary != ''
          AND LENGTH(ns.summary) < 200
          AND ns.created_at > NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (
            SELECT 1 FROM news_summaries ns2 
            WHERE ns2.article_id = ns.article_id 
            AND LENGTH(ns2.summary) > 200
            AND ns2.created_at > ns.created_at
          )
        ORDER BY ns.created_at DESC
        LIMIT $1`,
        [this.MAX_ARTICLES_PER_BATCH * 2] // Get more to filter
      );

      const articles: NewsArticle[] = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.original_summary || '',
        url: row.url || '',
        source: row.source || 'Unknown',
        publishedAt: parseInt(row.published_at) || Date.now(),
      }));

      // Filter out articles that already have AI summaries
      const articlesNeedingSummaries: NewsArticle[] = [];
      for (const article of articles) {
        const hasSummary = await this.hasAISummary(article.id);
        if (!hasSummary && article.title && article.summary) {
          articlesNeedingSummaries.push(article);
        }
      }

      return articlesNeedingSummaries.slice(0, this.MAX_ARTICLES_PER_BATCH);
    } catch (error) {
      logger.error('Failed to get articles needing summaries:', error);
      return [];
    }
  }

  /**
   * Check if article already has AI summary
   * ELITE: AI summaries are typically longer (>200 chars) and more detailed
   */
  private async hasAISummary(articleId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT summary FROM news_summaries 
         WHERE article_id = $1 
         AND summary IS NOT NULL 
         AND summary != ''
         AND LENGTH(summary) > 200
         AND expires_at > NOW()
         LIMIT 1`,
        [articleId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check AI summary:', error);
      return false;
    }
  }

  /**
   * Process a batch of articles
   */
  private async processBatch(articles: NewsArticle[]): Promise<void> {
    for (const article of articles) {
      try {
        // Generate summary using centralized service
        await centralizedNewsSummaryService.getOrGenerateSummary(article);
        
        logger.info(`Generated summary for article: ${article.title.substring(0, 50)}...`);
        
        // Small delay between articles to avoid rate limiting
        await this.delay(this.PROCESSING_DELAY_MS);
      } catch (error) {
        logger.error(`Failed to process article ${article.id}:`, error);
        // Continue with next article
      }
    }
  }

  /**
   * Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manually trigger processing (for testing/admin)
   */
  async triggerProcessing(): Promise<void> {
    logger.info('Manual processing triggered');
    await this.processNewArticles();
  }
}

export const newsBackgroundService = new NewsBackgroundService();

