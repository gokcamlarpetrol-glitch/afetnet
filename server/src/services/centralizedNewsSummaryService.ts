/**
 * CENTRALIZED NEWS SUMMARY SERVICE
 * Creates a single AI summary for each news article that all users can share
 * Cost optimization: One OpenAI request per article instead of per user
 * 
 * COST SAVINGS: 1 AI call vs 1000+ AI calls = 99.9% cost reduction
 */

import { pool } from '../database';
import { newsCacheService } from './newsCacheService';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[NewsSummary] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[NewsSummary] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[NewsSummary] ${msg}`, ...args),
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

interface NewsSummaryRecord {
  id: string;
  articleId: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  ttlMs?: number;
}

class CentralizedNewsSummaryService {
  private readonly SUMMARY_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
  private summaryCache = new Map<string, { summary: string; timestamp: number }>();

  /**
   * Generate or retrieve AI summary for a news article
   * Returns cached summary if available, otherwise generates new one
   */
  async getOrGenerateSummary(article: NewsArticle): Promise<string> {
    const cacheKey = article.id || `${article.source}-${article.title}`;
    const now = Date.now();

    try {
      // ELITE: Check advanced cache service first
      const cachedSummary = await newsCacheService.get(article.id);
      if (cachedSummary) {
        logger.info('Returning cached summary for:', article.title);
        return cachedSummary;
      }

      // Check in-memory cache
      const cached = this.summaryCache.get(cacheKey);
      if (cached && now - cached.timestamp < this.SUMMARY_CACHE_TTL) {
        logger.info('Returning in-memory cached summary for:', article.title);
        return cached.summary;
      }

      // Check database cache
      const dbSummary = await this.getSummaryFromDatabase(article.id);
      if (dbSummary) {
        logger.info('Returning database summary for:', article.title);
        this.summaryCache.set(cacheKey, { summary: dbSummary, timestamp: now });
        await newsCacheService.set(article.id, dbSummary);
        return dbSummary;
      }

      // Generate new summary
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        logger.warn('OpenAI not configured, using fallback summary.');
        return this.useFallbackSummary(article);
      }

      const summary = await this.generateAISummary(article, openaiApiKey);
      
      // ELITE: Cache the summary in all layers
      this.summaryCache.set(cacheKey, { summary, timestamp: now });
      await this.saveSummaryToDatabase(article, summary);
      await newsCacheService.set(article.id, summary, this.SUMMARY_CACHE_TTL);

      logger.info('Generated new AI summary for:', article.title);
      return summary;
    } catch (error) {
      logger.error('Failed to get or generate summary:', error);
      return this.useFallbackSummary(article);
    }
  }

  /**
   * Generate AI summary using OpenAI (single call for all users)
   */
  private async generateAISummary(article: NewsArticle, apiKey: string): Promise<string> {
    const prompt = `Aşağıdaki haber içeriğini Türkçe olarak özetle. Özet 3-5 paragraf olmalı, anlaşılır ve bilgilendirici olmalı. Deprem ve afet güvenliği açısından önemli detayları vurgula.

Haber Başlığı: ${article.title}

Haber İçeriği:
${article.summary}

Kaynak: ${article.source}
${article.magnitude ? `Deprem Büyüklüğü: ${article.magnitude}` : ''}
${article.location ? `Konum: ${article.location}` : ''}

Lütfen sadece özet metnini döndür, başlık veya ek açıklama ekleme.`;

    const systemPrompt = `Sen bir haber özeti uzmanısın. Deprem ve afet haberleri konusunda bilgilisin. Özetlerin Türkçe, anlaşılır, bilgilendirici ve objektif olmalı. Paniğe yol açmadan, gerçekleri net bir şekilde aktarmalısın.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Cost-effective model
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const summary = data.choices[0]?.message?.content || '';
      
      return summary.trim();
    } catch (error) {
      logger.error('Failed to generate AI summary:', error);
      throw error;
    }
  }

  /**
   * Get summary from database
   */
  private async getSummaryFromDatabase(articleId: string): Promise<string | null> {
    try {
      const result = await pool.query(
        `SELECT summary FROM news_summaries 
         WHERE article_id = $1 
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC 
         LIMIT 1`,
        [articleId]
      );

      if (result.rows.length > 0) {
        return result.rows[0].summary;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get summary from database:', error);
      return null;
    }
  }

  /**
   * Save summary to database (also saves to Firestore via API if needed)
   */
  private async saveSummaryToDatabase(article: NewsArticle, summary: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.SUMMARY_CACHE_TTL);
      
      await pool.query(
        `INSERT INTO news_summaries 
         (article_id, title, summary, source, url, created_at, updated_at, expires_at, ttl_ms)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7)
         ON CONFLICT (article_id) 
         DO UPDATE SET 
           summary = EXCLUDED.summary,
           updated_at = NOW(),
           expires_at = EXCLUDED.expires_at,
           ttl_ms = EXCLUDED.ttl_ms`,
        [
          article.id,
          article.title,
          summary,
          article.source,
          article.url,
          expiresAt,
          this.SUMMARY_CACHE_TTL,
        ]
      );

      logger.info('Saved summary to database for:', article.id);
    } catch (error) {
      logger.error('Failed to save summary to database:', error);
      // Don't throw - summary is still usable even if DB save fails
    }
  }

  /**
   * Use fallback summary when AI is unavailable
   */
  private useFallbackSummary(article: NewsArticle): string {
    if (article.summary && article.summary.trim().length > 0) {
      return article.summary.trim();
    }
    return article.title || 'Detaylar için haber kaynağını ziyaret edin.';
  }
}

export const centralizedNewsSummaryService = new CentralizedNewsSummaryService();

