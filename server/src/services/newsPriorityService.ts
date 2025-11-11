/**
 * NEWS PRIORITY SERVICE
 * Elite: Intelligent prioritization and filtering of news articles
 * Prioritizes critical earthquake news and filters low-quality content
 */

import { pool } from '../database';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[NewsPriority] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[NewsPriority] ${msg}`, ...args),
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

interface PriorityScore {
  article: NewsArticle;
  score: number;
  reasons: string[];
}

class NewsPriorityService {
  /**
   * Calculate priority score for article
   * Higher score = higher priority
   */
  calculatePriority(article: NewsArticle): PriorityScore {
    let score = 0;
    const reasons: string[] = [];

    // Recency bonus (newer = higher priority)
    const ageHours = (Date.now() - article.publishedAt) / (1000 * 60 * 60);
    if (ageHours < 1) {
      score += 30;
      reasons.push('Very recent (<1h)');
    } else if (ageHours < 6) {
      score += 20;
      reasons.push('Recent (<6h)');
    } else if (ageHours < 24) {
      score += 10;
      reasons.push('Recent (<24h)');
    }

    // Magnitude bonus (higher magnitude = higher priority)
    if (article.magnitude) {
      if (article.magnitude >= 6.0) {
        score += 50;
        reasons.push('Major earthquake (M≥6.0)');
      } else if (article.magnitude >= 5.0) {
        score += 30;
        reasons.push('Significant earthquake (M≥5.0)');
      } else if (article.magnitude >= 4.0) {
        score += 15;
        reasons.push('Moderate earthquake (M≥4.0)');
      }
    }

    // Source reliability bonus
    const reliableSources = ['AFAD', 'Kandilli', 'USGS', 'EMSC'];
    if (reliableSources.some(s => article.source.includes(s))) {
      score += 20;
      reasons.push('Reliable source');
    }

    // Title keywords bonus
    const criticalKeywords = ['deprem', 'sarsıntı', 'afet', 'acil', 'uyarı'];
    const titleLower = article.title.toLowerCase();
    const keywordCount = criticalKeywords.filter(k => titleLower.includes(k)).length;
    if (keywordCount > 0) {
      score += keywordCount * 5;
      reasons.push(`${keywordCount} critical keywords`);
    }

    // Location bonus (Turkey-specific)
    if (article.location) {
      const turkeyKeywords = ['türkiye', 'turkey', 'istanbul', 'ankara', 'izmir'];
      if (turkeyKeywords.some(k => article.location!.toLowerCase().includes(k))) {
        score += 15;
        reasons.push('Turkey location');
      }
    }

    // Quality penalties
    if (!article.url || article.url === '#') {
      score -= 10;
      reasons.push('No URL');
    }

    if (!article.summary || article.summary.length < 50) {
      score -= 5;
      reasons.push('Short summary');
    }

    return {
      article,
      score: Math.max(0, score), // Ensure non-negative
      reasons,
    };
  }

  /**
   * Sort articles by priority
   */
  sortByPriority(articles: NewsArticle[]): NewsArticle[] {
    const scored = articles.map(article => this.calculatePriority(article));
    
    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.article);
  }

  /**
   * Filter low-priority articles
   */
  filterLowPriority(articles: NewsArticle[], minScore: number = 10): NewsArticle[] {
    const scored = articles.map(article => this.calculatePriority(article));
    
    return scored
      .filter(s => s.score >= minScore)
      .map(s => s.article);
  }

  /**
   * Get top priority articles
   */
  getTopPriority(articles: NewsArticle[], limit: number = 10): NewsArticle[] {
    const sorted = this.sortByPriority(articles);
    return sorted.slice(0, limit);
  }
}

export const newsPriorityService = new NewsPriorityService();


