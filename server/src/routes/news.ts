/**
 * NEWS ROUTES
 * Handles news summary generation and retrieval
 * Cost optimization: Centralized AI summaries for all users
 */

import express from 'express';
import { centralizedNewsSummaryService } from '../services/centralizedNewsSummaryService';
import { newsPriorityService } from '../services/newsPriorityService';
import { newsCacheService } from '../services/newsCacheService';
import { newsBackgroundService } from '../services/newsBackgroundService';
import { pool } from '../database';

const router = express.Router();

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

/**
 * POST /api/news/summarize
 * Generate or retrieve AI summary for a news article
 * Cost optimization: One summary per article shared by all users
 */
router.post('/summarize', async (req, res) => {
  try {
    const article: NewsArticle = req.body;

    if (!article || !article.id || !article.title) {
      return res.status(400).json({
        success: false,
        error: 'Invalid article data',
      });
    }

    const summary = await centralizedNewsSummaryService.getOrGenerateSummary(article);

    res.json({
      success: true,
      summary,
      articleId: article.id,
    });
  } catch (error) {
    console.error('Failed to generate news summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary',
    });
  }
});

/**
 * GET /api/news/summary/:articleId
 * Get existing summary for an article
 */
router.get('/summary/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;

    if (!articleId) {
      return res.status(400).json({
        success: false,
        error: 'Article ID required',
      });
    }

    // Try to get from database
    const result = await pool.query(
      `SELECT summary FROM news_summaries 
       WHERE article_id = $1 
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC 
       LIMIT 1`,
      [articleId]
    );

    if (result.rows.length > 0) {
      return res.json({
        success: true,
        summary: result.rows[0].summary,
        articleId,
      });
    }

    res.status(404).json({
      success: false,
      error: 'Summary not found',
    });
  } catch (error) {
    console.error('Failed to get news summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get summary',
    });
  }
});

/**
 * POST /api/news/process
 * Manually trigger news processing (admin/testing)
 */
router.post('/process', async (req, res) => {
  try {
    await newsBackgroundService.triggerProcessing();
    res.json({
      success: true,
      message: 'News processing triggered',
    });
  } catch (error) {
    console.error('Failed to trigger news processing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger processing',
    });
  }
});

/**
 * GET /api/news/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = newsCacheService.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats',
    });
  }
});

/**
 * POST /api/news/cache/invalidate/:articleId
 * Invalidate cache for specific article
 */
router.post('/cache/invalidate/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    await newsCacheService.invalidate(articleId);
    res.json({
      success: true,
      message: `Cache invalidated for article ${articleId}`,
    });
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
    });
  }
});

/**
 * POST /api/news/priority
 * Calculate priority scores for articles
 */
router.post('/priority', async (req, res) => {
  try {
    const articles: NewsArticle[] = req.body.articles || [];
    
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Articles array required',
      });
    }

    const sorted = newsPriorityService.sortByPriority(articles);
    const topPriority = newsPriorityService.getTopPriority(articles, 10);

    res.json({
      success: true,
      sorted,
      topPriority,
      total: articles.length,
    });
  } catch (error) {
    console.error('Failed to calculate priority:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate priority',
    });
  }
});

export default router;

