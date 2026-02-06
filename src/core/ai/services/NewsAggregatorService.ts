/**
 * NEWS AGGREGATOR SERVICE
 * Fetches and aggregates earthquake-related news
 * Sources: Google News RSS + AFAD earthquake data
 */

import { NewsArticle, NewsCategory } from '../types/news.types';
import { createLogger } from '../../utils/logger';
import { openAIService } from './OpenAIService';
import { AICache } from '../utils/AICache';
import type { NewsSummaryRecord } from '../../services/FirebaseDataService';
import { getDeviceId } from '../../utils/device';
import { safeLowerCase, safeIncludes } from '../../utils/safeString';
import { getErrorMessage } from '../../utils/errorUtils';

interface NewsSource {
  id: string;
  name: string;
  url: string;
  category: NewsCategory;
  keywords?: string[];
  maxItems?: number;
}

const logger = createLogger('NewsAggregatorService');

// Detayli, deprem odakli Turkce haber kaynaklari
const NEWS_SOURCES: NewsSource[] = [
  {
    id: 'google-news',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=deprem+türkiye&hl=tr&gl=TR&ceid=TR:tr',
    category: 'earthquake',
    keywords: ['deprem', 'sarsıntı', 'afad', 'artçı', 'fay hattı'],
    maxItems: 20,
  },
  {
    id: 'aa-sondakika',
    name: 'Anadolu Ajansı',
    url: 'https://www.aa.com.tr/tr/rss/default?cat=guncel',
    category: 'general',
    keywords: ['deprem', 'sarsıntı', 'afet', 'AFAD'],
    maxItems: 15,
  },
  {
    id: 'cnnturk',
    name: 'CNN Türk',
    url: 'https://www.cnnturk.com/feed/rss/turkiye/news',
    category: 'general',
    keywords: ['deprem', 'son deprem', 'sarsıntı', 'AFAD'],
    maxItems: 15,
  },
  {
    id: 'ntv-sondakika',
    name: 'NTV',
    url: 'https://www.ntv.com.tr/rss/sondakika',
    category: 'earthquake',
    keywords: ['deprem', 'sarsıntı', 'son deprem'],
    maxItems: 20,
  },
  {
    id: 'haberturk',
    name: 'HaberTürk',
    url: 'https://www.haberturk.com/rss/manset.xml',
    category: 'general',
    keywords: ['deprem', 'sarsıntı', 'AFAD', 'fay'],
    maxItems: 15,
  },
  {
    id: 'hurriyet',
    name: 'Hürriyet',
    url: 'https://www.hurriyet.com.tr/rss/turkiye',
    category: 'general',
    keywords: ['deprem', 'sarsıntı', 'son dakika deprem'],
    maxItems: 15,
  },
  // Yeni eklenen popüler Türk haber kanalları
  {
    id: 'sozcu',
    name: 'Sözcü',
    url: 'https://www.sozcu.com.tr/rss/tum-haberler.xml',
    category: 'general',
    keywords: ['deprem', 'sarsıntı', 'afet', 'AFAD'],
    maxItems: 15,
  },
  {
    id: 'sabah',
    name: 'Sabah',
    url: 'https://www.sabah.com.tr/rss/turkiye.xml',
    category: 'general',
    keywords: ['deprem', 'sarsıntı', 'afet'],
    maxItems: 15,
  },
  {
    id: 'milliyet',
    name: 'Milliyet',
    url: 'https://www.milliyet.com.tr/rss/rssnew/gundemrss.xml',
    category: 'general',
    keywords: ['deprem', 'sarsıntı', 'AFAD'],
    maxItems: 15,
  },
  {
    id: 'trthaber',
    name: 'TRT Haber',
    url: 'https://www.trthaber.com/sondakika.rss',
    category: 'general',
    keywords: ['deprem', 'sarsıntı', 'afet', 'AFAD'],
    maxItems: 15,
  },
  {
    id: 'cumhuriyet',
    name: 'Cumhuriyet',
    url: 'https://www.cumhuriyet.com.tr/rss/son_dakika.xml',
    category: 'general',
    keywords: ['deprem', 'sarsıntı', 'afet'],
    maxItems: 15,
  },
];

class NewsAggregatorService {
  private isInitialized = false;
  private summaryCache = new Map<string, { summary: string; timestamp: number }>();
  private readonly SUMMARY_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 saat
  private readonly SUMMARY_CACHE_KEY_PREFIX = 'news-summary:';
  private readonly FALLBACK_SUMMARY_TTL = 2 * 60 * 60 * 1000; // 2 saat
  private readonly REQUEST_TIMEOUT = 12_000; // 12 seconds
  private readonly DEFAULT_KEYWORDS = ['deprem', 'sarsıntı', 'afet'];
  private readonly MAX_TOTAL_ARTICLES = 60;
  private cachedDeviceId: string | null = null;
  private deviceIdPromise: Promise<string | null> | null = null;

  // ELITE COST OPTIMIZATION: In-flight request tracking
  // Aynı haber için eş zamanlı isteklerde yalnızca BİR API çağrısı yapılır
  // Diğer istekler aynı Promise'i bekler - BÜYÜK MALİYET TASARRUFU
  private inFlightRequests = new Map<string, Promise<string>>();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('NewsAggregatorService initialized');
    this.isInitialized = true;
  }

  /**
   * Depremle ilgili son dakika haberlerini topla
   * Kaynaklar: AFAD (mevcut), Google News RSS
   */
  /**
   * ELITE: Pre-fetch summaries for ALL relevant articles
   * Implements "Write Once, Read Many" architecture for maximum speed and cost efficiency.
   * Prioritizes "Breaking News" (Son Dakika) and Earthquake specific items.
   */
  private async prefetchSummaries(articles: NewsArticle[]): Promise<void> {
    try {
      // ELITE: Process significant number of articles (User request: "ne kadar haber varsa")
      // We cap at 30 to respect rate limits while covering virtually all visible news
      const TARGET_COUNT = 30;

      if (articles.length === 0) return;

      // ELITE: Smart Priority Queue
      // 1. Earthquake specific (highest)
      // 2. Breaking news (high)
      // 3. Others (normal)
      const sortedTargets = [...articles].sort((a, b) => {
        const scoreA = this.calculatePriorityScore(a);
        const scoreB = this.calculatePriorityScore(b);
        return scoreB - scoreA; // Descending priority
      }).slice(0, TARGET_COUNT); // Take top N highest priority

      if (__DEV__) {
        logger.info(`🚀 Starting Massive Pre-fetch for ${sortedTargets.length} articles (Priority Ordered)`);
      }

      // Initialize OpenAI once if needed
      if (!openAIService.isConfigured()) {
        try {
          await openAIService.initialize();
        } catch (e) {
          logger.warn('Prefetch: OpenAI init failed', e);
          return;
        }
      }

      // ELITE: High-Speed Batch Processing
      // We use a "sliding window" of concurrency to maximize speed without hitting 429s
      // Faster than sequential, safer than all-at-once
      const BATCH_SIZE = 3; // Process 3 articles simultaneously
      const DELAY_BETWEEN_BATCHES = 400; // ms

      for (let i = 0; i < sortedTargets.length; i += BATCH_SIZE) {
        const batch = sortedTargets.slice(i, i + BATCH_SIZE);

        // Process batch in parallel
        Promise.all(batch.map(article =>
          this.summarizeArticle(article).catch(err => {
            if (__DEV__) logger.debug(`Background prefetch info for ${article.id}:`, err?.message || 'processed');
            // Swallow error to prevent stopping the chain
          }),
        ));

        // Slight delay before next batch to be nice to API
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }

      if (__DEV__) {
        logger.info('✨ Massive Pre-fetch batching initiated');
      }

    } catch (error) {
      logger.warn('Prefetch flow failed:', error);
    }
  }

  // Helper for Smart Priority
  private calculatePriorityScore(article: NewsArticle): number {
    let score = 0;
    const combined = (article.title + ' ' + article.summary).toLowerCase();

    // Critical keywords
    if (combined.includes('deprem') || combined.includes('sarsıntı')) score += 10;
    if (combined.includes('son dakika') || combined.includes('acil')) score += 5;
    if (combined.includes('uyarı') || combined.includes('risk')) score += 3;
    if (article.source === 'AFAD') score += 8;

    // Recency boost (freshness is huge for "son dakika")
    const hourDiff = (Date.now() - article.publishedAt) / (1000 * 60 * 60);
    if (hourDiff < 1) score += 5; // Less than 1 hour old
    else if (hourDiff < 4) score += 2;

    return score;
  }

  async fetchLatestNews(): Promise<NewsArticle[]> {
    try {
      const results = await Promise.allSettled(
        NEWS_SOURCES.map((source) => this.fetchFromSource(source)),
      );

      const aggregated: NewsArticle[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          aggregated.push(...result.value);
        } else {
          logger.warn('News source failed', { error: result.reason });
        }
      }

      const earthquakeNews = await this.convertEarthquakesToNews();
      const combined = this.deduplicateArticles([...earthquakeNews, ...aggregated]);
      const sorted = combined.sort((a, b) => b.publishedAt - a.publishedAt);
      const limited = sorted.slice(0, this.MAX_TOTAL_ARTICLES);
      const stableArticles = this.ensureStableIds(limited);

      if (limited.length === 0) {
        logger.warn('No news articles fetched; returning fallback content');
        return this.getFallbackArticles();
      }

      logger.info(`Aggregated ${stableArticles.length} news articles from ${NEWS_SOURCES.length} sources`);

      // ELITE: Pre-fetch summaries for top articles in background
      // This ensures "instant" summaries when user clicks
      this.prefetchSummaries(stableArticles).catch(err => {
        logger.warn('Background summary prefetch failed:', err);
      });

      return stableArticles;
    } catch (error) {
      logger.error('Failed to fetch news from aggregator sources:', error);
      return this.getFallbackArticles();
    }
  }

  /**
   * RSS feed'i parse et ve NewsArticle formatina donustur
   */
  private parseRSSFeed(xmlText: string, newsSource: NewsSource): NewsArticle[] {
    const articles: NewsArticle[] = [];

    try {
      // <item> tag'lerini bul
      // ELITE: Use compatible regex for all JS engines (including Hermes)
      const itemRegex = /<item>(.*?)<\/item>/g;
      const matches: RegExpExecArray[] = [];
      let match: RegExpExecArray | null;
      while ((match = itemRegex.exec(xmlText)) !== null) {
        matches.push(match);
      }

      for (const match of matches) {
        const itemXml = match[1];

        // Title, link, pubDate extract et
        const title = this.extractTag(itemXml, 'title');
        const link = this.extractTag(itemXml, 'link');
        const pubDate = this.extractTag(itemXml, 'pubDate');
        const description = this.extractTag(itemXml, 'description');
        const source = this.extractTag(itemXml, 'source') || newsSource.name;

        if (title && link) {
          const cleanTitle = this.cleanHTML(title);
          const cleanSummary = this.cleanHTML(description || title);
          const sanitizedUrl = this.sanitizeUrl(link, newsSource.url);

          articles.push({
            id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: cleanTitle,
            summary: cleanSummary,
            url: sanitizedUrl,
            source: this.cleanHTML(source),
            publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
            category: newsSource.category,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to parse RSS feed:', error);
    }

    return articles;
  }

  private async fetchFromSource(source: NewsSource): Promise<NewsArticle[]> {
    try {
      const xmlText = await this.fetchWithTimeout(source.url);

      // ELITE: Handle empty response (404 or unavailable source)
      if (!xmlText || xmlText.trim().length === 0) {
        return [];
      }

      const parsedArticles = this.parseRSSFeed(xmlText, source);
      const keywords = source.keywords ?? this.DEFAULT_KEYWORDS;

      const keywordFiltered = parsedArticles.filter((article) =>
        this.containsKeyword(article, keywords),
      );

      const limited = keywordFiltered
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, source.maxItems ?? 20);

      const stable = this.ensureStableIds(limited);

      logger.info(`Fetched ${stable.length}/${parsedArticles.length} articles from ${source.name}`);
      return stable;
    } catch (error: unknown) {
      // ELITE: Silent error handling for unavailable news sources
      // 404 and network errors are expected - sources may be temporarily unavailable
      // Only log in dev mode for non-critical errors (not 404)
      const errorMsg = getErrorMessage(error);
      const errorStatus = (error as any)?.status;
      const is404 = errorMsg.includes('404') || errorStatus === 404;
      const isNetworkError = errorMsg.includes('network') || errorMsg.includes('fetch');

      if (__DEV__ && !is404 && !isNetworkError) {
        logger.debug(`News source unavailable (${source.name}):`, errorMsg);
      }
      return [];
    }
  }

  /**
   * XML tag'inden icerik cikar
   */
  private extractTag(xml: string, tag: string): string {
    // ELITE: Use compatible regex for all JS engines (including Hermes)
    // Remove 's' flag and use [\s\S] instead of . for multiline matching
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * HTML tag'lerini ve CDATA'yi temizle
   */
  private cleanHTML(text: string): string {
    // CRITICAL: Validate input
    if (!text || typeof text !== 'string') {
      return '';
    }

    // ELITE: Use compatible regex for all JS engines (including Hermes)
    // Remove 's' flag and use [\s\S] instead of . for multiline matching
    return text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }

  private sanitizeUrl(url: string, baseUrl?: string): string {
    try {
      const trimmed = url.trim();
      if (!trimmed) return '#';
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '#';
      }
      return parsed.toString();
    } catch (error) {
      if (baseUrl) {
        try {
          const resolved = new URL(url, baseUrl);
          if (['http:', 'https:'].includes(resolved.protocol)) {
            return resolved.toString();
          }
        } catch (resolveError) {
          logger.warn('Failed to resolve relative URL', { url, baseUrl, error: resolveError });
        }
      }
      logger.warn('Invalid URL in news article', { url });
      return '#';
    }
  }

  private containsKeyword(article: NewsArticle, keywords: string[]): boolean {
    if (keywords.length === 0) {
      return true;
    }

    const searchable = `${article.title || ''} ${article.summary || ''}`;
    return keywords.some((keyword) => safeIncludes(searchable, keyword));
  }

  private deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Map<string, NewsArticle>();

    for (const article of articles) {
      const key = this.buildArticleKey(article);
      if (!key) {
        // No reliable key, push anyway as unique id
        seen.set(`fallback-${article.id}`, article);
        continue;
      }

      const existing = seen.get(key);
      if (!existing || existing.publishedAt < article.publishedAt) {
        seen.set(key, article);
      }
    }

    return Array.from(seen.values());
  }

  private buildArticleKey(article: NewsArticle): string | null {
    if (article.url && article.url !== '#') {
      try {
        const parsed = new URL(article.url);
        return safeLowerCase(`${parsed.hostname}${parsed.pathname}`);
      } catch {
        return safeLowerCase(article.url);
      }
    }
    if (article.title) {
      return safeLowerCase(article.title);
    }
    return null;
  }

  private ensureStableIds(articles: NewsArticle[]): NewsArticle[] {
    return articles.map((article) => {
      const key = this.buildArticleKey(article);
      if (key) {
        return {
          ...article,
          id: this.sanitizeId(key),
        };
      }

      if (article.id && !article.id.startsWith('news_')) {
        return article;
      }

      const fallbackSource = article.source
        ? safeLowerCase(article.source).replace(/[^a-z0-9]+/g, '-')
        : 'haber';
      const fallbackTitle = safeLowerCase(article.title || 'news').replace(/[^a-z0-9]+/g, '-');
      const fallbackBase = `${fallbackSource}-${fallbackTitle}-${article.publishedAt}`;

      return {
        ...article,
        id: this.sanitizeId(fallbackBase),
      };
    });
  }

  private sanitizeId(value: string): string {
    return safeLowerCase(value)
      .replace(/https?:\/\//g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || `news-${Date.now()}`;
  }

  private resolveArticleKey(article: NewsArticle): string {
    // CRITICAL: Validate article input
    if (!article || typeof article !== 'object') {
      return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    if (article.id && typeof article.id === 'string' && article.id.trim().length > 0) {
      return article.id.trim();
    }

    // CRITICAL: Build fallback key with validation
    const source = (article.source && typeof article.source === 'string') ? article.source : 'haber';
    const title = (article.title && typeof article.title === 'string') ? article.title : '';
    const url = (article.url && typeof article.url === 'string' && article.url !== '#') ? article.url : '';
    const fallback = title || url || Date.now().toString();

    const base = `${source}-${fallback}`;
    return this.sanitizeId(base);
  }

  private buildSummaryCacheKey(articleKey: string): string {
    return `${this.SUMMARY_CACHE_KEY_PREFIX}${articleKey}`;
  }

  private async getPersistedSummary(article: NewsArticle, cacheKey: string): Promise<string | null> {
    try {
      const localSummary = await AICache.get<string>(this.buildSummaryCacheKey(cacheKey));
      if (localSummary) {
        return localSummary;
      }
    } catch (error) {
      logger.warn('Local summary cache read failed:', error);
    }

    if (!article.id) {
      return null;
    }

    const cloudRecord = await this.loadSummaryFromCloud(article.id);
    if (cloudRecord?.summary) {
      const ttlMs = this.calculateRemainingTtl(cloudRecord);
      await this.persistSummaryLocally(cacheKey, cloudRecord.summary, ttlMs);
      return cloudRecord.summary;
    }

    return null;
  }

  private async persistSummaryLocally(cacheKey: string, summary: string, ttlMs: number): Promise<void> {
    try {
      const ttl = Math.max(ttlMs, 5 * 60 * 1000); // En az 5 dakika
      await AICache.set(this.buildSummaryCacheKey(cacheKey), summary, ttl);
    } catch (error) {
      logger.warn('Failed to persist news summary locally:', error);
    }
  }

  private async persistSummaryToCloud(
    article: NewsArticle,
    summary: string,
    ttlMs: number,
  ): Promise<void> {
    if (!article.id) {
      return;
    }

    try {
      // CRITICAL: Check if summary already exists in cloud before saving
      // This prevents duplicate API calls and reduces costs
      const existing = await this.loadSummaryFromCloud(article.id);
      if (existing && existing.summary && existing.summary.trim().length > 0) {
        // Summary already exists in cloud - don't overwrite (cost optimization)
        if (__DEV__) {
          logger.debug('Summary already exists in cloud, skipping save:', article.id);
        }
        return;
      }

      const { firebaseDataService } = await import('../../services/FirebaseDataService');
      if (!firebaseDataService.isInitialized) {
        await firebaseDataService.initialize();
      }
      if (!firebaseDataService.isInitialized) {
        return;
      }

      // CRITICAL: Save summary by articleId (not deviceId) - shared across all users
      // This ensures cost optimization: one summary per article, not per user
      await firebaseDataService.saveNewsSummary({
        id: article.id, // Use article.id as document ID (shared across users)
        articleId: article.id, // Use articleId for querying (shared across users)
        title: article.title,
        summary,
        source: article.source,
        url: article.url || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (__DEV__) {
        logger.info(`✅ Shared summary saved to cloud (articleId: ${article.id}) - all users will use this`);
      }
    } catch (error) {
      logger.warn('Failed to persist news summary to Firestore:', error);
    }
  }

  private async loadSummaryFromCloud(articleId: string): Promise<NewsSummaryRecord | null> {
    try {
      const { firebaseDataService } = await import('../../services/FirebaseDataService');
      if (!firebaseDataService.isInitialized) {
        await firebaseDataService.initialize();
      }
      if (!firebaseDataService.isInitialized) {
        return null;
      }
      return await firebaseDataService.getNewsSummary(articleId);
    } catch (error) {
      logger.warn('Failed to load news summary from Firestore:', error);
      return null;
    }
  }

  private calculateRemainingTtl(record?: NewsSummaryRecord | null): number {
    if (record?.expiresAt) {
      const expiresMs = new Date(record.expiresAt).getTime();
      if (!Number.isNaN(expiresMs)) {
        const remaining = expiresMs - Date.now();
        if (remaining > 5 * 60 * 1000) {
          return remaining;
        }
      }
    }

    if (record?.ttlMs && record.ttlMs > 0) {
      return record.ttlMs;
    }

    return this.SUMMARY_CACHE_TTL;
  }

  private async useFallbackSummary(article: NewsArticle, cacheKey: string, ttlMs: number): Promise<string> {
    // ELITE: API key olmadan da bilgilendirici özet oluştur
    const title = article.title ? this.cleanHTML(article.title) : '';
    const summary = article.summary ? this.cleanHTML(article.summary) : '';
    const source = article.source || 'Haber Kaynağı';
    const location = article.location || '';
    const magnitude = article.magnitude ? `${article.magnitude}` : '';
    const date = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }) : '';

    // ELITE: Daha kapsamlı bir fallback özet oluştur
    let fallback = '';

    // Önce mevcut summary'yi kullan
    if (summary && summary.length > 50) {
      fallback = summary;
    } else if (title) {
      // Title'dan bilgilendirici özet oluştur
      const parts: string[] = [];

      // Başlık ekle
      parts.push(title);

      // Kaynak ve tarih ekle
      if (source && date) {
        parts.push(`\n\n📰 ${source} - ${date}`);
      } else if (source) {
        parts.push(`\n\n📰 ${source}`);
      }

      // Deprem bilgileri varsa ekle
      if (magnitude && location) {
        parts.push(`\n\n🌍 Konum: ${location}`);
        parts.push(`📊 Büyüklük: ${magnitude}`);
      } else if (location) {
        parts.push(`\n\n🌍 Konum: ${location}`);
      } else if (magnitude) {
        parts.push(`\n\n📊 Büyüklük: ${magnitude}`);
      }

      // Bilgi notu ekle
      parts.push('\n\n💡 Haberin tam içeriği için "Orijinal Haber" sekmesinden kaynağa ulaşabilirsiniz.');

      fallback = parts.join('');
    } else {
      fallback = 'Haber detayları için "Orijinal Haber" sekmesine geçin.';
    }

    // Cache'e kaydet - ELITE FIX: Fallback özetleri cloud'a ASLA kaydetme
    // Sadece lokal cache'e kısa süreli (1dk) kaydet ki kullanıcı tekrar deneyebilsin
    const SHORT_TTL = 60 * 1000; // 1 dakika
    this.summaryCache.set(cacheKey, { summary: fallback, timestamp: Date.now() });

    // Sadece lokal cache'e kısa süreli kaydet
    await this.persistSummaryLocally(cacheKey, fallback, SHORT_TTL);

    // CRITICAL: Fallback özetleri cloud'a kaydetme! 
    // Bu sayede bağlantı düzelince gerçek AI özeti oluşturulabilir.
    if (__DEV__) {
      logger.info('⚠️ Fallback summary cached locally for 1 min (not persisted to cloud)');
    }

    return fallback;
  }

  private async getDeviceIdForSummary(): Promise<string | null> {
    if (this.cachedDeviceId) {
      return this.cachedDeviceId;
    }

    if (!this.deviceIdPromise) {
      this.deviceIdPromise = getDeviceId()
        .then((id) => (id && id.toUpperCase().startsWith('AFN-') ? id : null))
        .catch((error) => {
          logger.warn('Failed to resolve device ID for news summary:', error);
          return null;
        });
    }

    this.cachedDeviceId = await this.deviceIdPromise;
    return this.cachedDeviceId;
  }

  /**
   * Elite Security: Safe URL fetching with SSRF protection
   */
  private async fetchWithTimeout(url: string): Promise<string> {
    // Elite Security: SSRF Protection - Validate URL
    if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
      throw new Error('Invalid URL');
    }

    // Elite: Only allow HTTP/HTTPS protocols
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Elite: Block dangerous protocols and internal networks
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols allowed');
    }

    // Elite: Block private/internal IP addresses (SSRF protection)
    const hostname = safeLowerCase(parsedUrl.hostname);
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254', // AWS metadata
      'metadata.google.internal', // GCP metadata
    ];

    // Check for private IP ranges
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname);

    if (blockedHosts.includes(hostname) || isPrivateIP || hostname.startsWith('169.254.')) {
      throw new Error('Access to internal networks blocked');
    }

    // Elite: Only allow known news sources (whitelist approach)
    // CRITICAL: Production-safe - all news sources must work
    const allowedDomains = [
      'news.google.com',
      'google.com',              // For Google News redirects
      'hurriyet.com.tr',
      'cnnturk.com',
      'ntv.com.tr',
      'aa.com.tr',
      'sozcu.com.tr',
      'haberturk.com',
      'sabah.com.tr',
      'milliyet.com.tr',
      'trthaber.com',            // TRT Haber
      'cumhuriyet.com.tr',       // Cumhuriyet
      'bbc.com',
      'reuters.com',
      'ap.org',
      'googleusercontent.com',   // For Google News proxied content
      'feedburner.com',          // Common RSS redirect
    ];

    // CRITICAL: Check domain - be permissive to allow all legitimate news sources
    const isAllowedDomain = allowedDomains.some(domain =>
      hostname.includes(domain) || hostname.endsWith(domain) || hostname === domain,
    );

    if (!isAllowedDomain) {
      // CRITICAL: Don't throw in production - log and return empty to allow other sources to work
      logger.warn(`News source domain not in whitelist: ${hostname} - skipping`);
      return ''; // Return empty instead of throwing - graceful degradation
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'AfetNet/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: controller.signal,
        // Elite: Prevent redirects to internal networks
        redirect: 'manual', // Handle redirects manually
      });

      // Elite: Handle redirects safely
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          // Recursively validate redirect URL
          return this.fetchWithTimeout(location);
        }
      }

      if (!response.ok) {
        // ELITE: Handle HTTP errors gracefully
        // 404 is expected for some sources - don't throw, return empty
        if (response.status === 404) {
          return ''; // Return empty string for 404 - will be handled gracefully
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fallback haberler - haber servisi çalışmadığında gösterilir
   */
  getFallbackArticles(): NewsArticle[] {
    return [
      {
        id: 'news_fallback_1',
        title: 'Deprem haberleri yükleniyor...',
        summary: 'Haber servisi geçici olarak kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin.',
        url: '#',
        source: 'AfetNet',
        publishedAt: Date.now(),
        category: 'general',
      },
    ];
  }

  /**
   * AFAD deprem verilerinden haber formatina donustur
   */
  async convertEarthquakesToNews(): Promise<NewsArticle[]> {
    try {
      const { useEarthquakeStore } = await import('../../stores/earthquakeStore');
      const earthquakes = useEarthquakeStore.getState().items;

      // Son 24 saatteki buyuk depremleri (>= 4.0) habere donustur
      const recentSignificant = earthquakes.filter(
        (eq) => eq.magnitude >= 4.0 && Date.now() - eq.time < 24 * 60 * 60 * 1000,
      );

      return recentSignificant.map((eq) => ({
        id: `eq_news_${eq.id}`,
        title: `${eq.magnitude} buyuklugunde deprem - ${eq.location}`,
        summary: `${eq.location} bolgesinde ${eq.magnitude} buyuklugunde, ${eq.depth} km derinlikte deprem meydana geldi.`,
        url: '#',
        source: eq.source,
        publishedAt: eq.time,
        category: 'earthquake' as NewsCategory,
        magnitude: eq.magnitude,
        location: eq.location,
      }));
    } catch (error) {
      // ELITE: Handle LoadBundleFromServerRequestError gracefully
      // This is a transient Firebase error that occurs during bundle loading
      const errorMessage = getErrorMessage(error);
      const isBundleError = errorMessage.includes('LoadBundleFromServerRequestError') ||
        errorMessage.includes('Could not load bundle') ||
        errorMessage.includes('bundle');

      if (isBundleError) {
        // This is expected during certain Firebase conditions - log as warning, not error
        if (__DEV__) {
          logger.warn('Earthquake data temporarily unavailable (bundle loading)');
        }
      } else {
        logger.error('Failed to convert earthquakes to news:', error);
      }
      return [];
    }
  }

  /**
   * Haber icerigi AI ile ozetle
   * OpenAI GPT-4 kullanarak Turkce, anlasilir ozet olustur
   */
  async summarizeArticle(article: NewsArticle): Promise<string> {
    // CRITICAL: Validate article input
    if (!article || typeof article !== 'object') {
      logger.error('Invalid article provided to summarizeArticle:', article);
      return 'Geçersiz haber verisi.';
    }

    // CRITICAL: Ensure article has at least title or summary
    if (!article.title && !article.summary) {
      logger.warn('Article has no title or summary:', article);
      return 'Haber içeriği bulunamadı.';
    }

    const cacheKey = this.resolveArticleKey(article);
    const now = Date.now();

    // ELITE COST OPTIMIZATION: In-flight request deduplication
    // Eğer bu haber için zaten bir API çağrısı yapılıyorsa, bekle ve sonucu kullan
    const inFlightPromise = this.inFlightRequests.get(cacheKey);
    if (inFlightPromise) {
      logger.info('🔄 In-flight request found, waiting for existing summary generation:', cacheKey);
      try {
        return await inFlightPromise;
      } catch (error) {
        logger.warn('In-flight request failed, will try again:', error);
        // Continue to try again if in-flight request failed
      }
    }

    try {
      // In-memory cache
      const cached = this.summaryCache.get(cacheKey);
      if (cached && cached.summary && typeof cached.summary === 'string' && now - cached.timestamp < this.SUMMARY_CACHE_TTL) {
        const articleTitle = (article.title && typeof article.title === 'string') ? article.title : 'Haber';
        logger.info('Returning cached summary for:', articleTitle);
        // Clean HTML from cached summary
        const cleanedCached = this.cleanHTML(cached.summary);

        // ELITE FIX: In-memory cache için de fallback kontrolü yap
        const cleanedRSS = article.summary ? this.cleanHTML(article.summary) : '';
        const cleanedTitle = article.title ? this.cleanHTML(article.title) : '';

        const isExplicitFallback = cleanedCached.includes('Haberin tam içeriği için "Orijinal Haber"') ||
          cleanedCached.includes('Haber servisi geçici olarak kullanılamıyor');
        const isRSSFallback = cleanedRSS.length > 0 && cleanedCached === cleanedRSS;
        const isStructuredFallback = cleanedTitle.length > 20 && cleanedCached.startsWith(cleanedTitle);

        const isFallback = isExplicitFallback || isRSSFallback || isStructuredFallback;

        if (cleanedCached && cleanedCached.trim().length > 0 && !(isFallback && openAIService.isConfigured())) {
          // Eğer fallback değilse VEYA fallback ama OpenAI çalışmıyorsa cache'i kullan
          // Eğer fallback ise VE OpenAI çalışıyorsa cache'i yoksay (aşağı inip yeniden oluşturacak)
          return cleanedCached;
        }
        logger.info('🔄 In-memory cached summary is fallback, regenerating...');
      }

      // Local / cloud cache (SHARED across all users - cost optimization)
      const persisted = await this.getPersistedSummary(article, cacheKey);
      if (persisted) {
        if (__DEV__) {
          logger.info('✅ Using shared cached summary (cost optimized):', article.title);
        }
        // Clean HTML from persisted summary
        const cleanedPersisted = this.cleanHTML(persisted);

        // ELITE FIX: Eğer cache'den gelen veri fallback ise ve AI çalışıyorsa, cache'i yoksay
        // Fallback detection logic improved to catch ALL fallback types:
        // 1. Explicit fallback messages
        // 2. Summary identical to RSS summary
        // 3. Structured fallback that starts with title (AI summary excludes title)
        const cleanedRSS = article.summary ? this.cleanHTML(article.summary) : '';
        const cleanedTitle = article.title ? this.cleanHTML(article.title) : '';

        const isExplicitFallback = cleanedPersisted.includes('Haberin tam içeriği için "Orijinal Haber"') ||
          cleanedPersisted.includes('Haber servisi geçici olarak kullanılamıyor');

        const isRSSFallback = cleanedRSS.length > 0 && cleanedPersisted === cleanedRSS;

        // Structured fallback creates: title + "\n\n📰 Source..."
        // AI summary is instructed NOT to include title.
        // So if summary starts with title, it's likely a fallback.
        const isStructuredFallback = cleanedTitle.length > 20 && cleanedPersisted.startsWith(cleanedTitle);

        const isFallback = isExplicitFallback || isRSSFallback || isStructuredFallback;

        if (isFallback && openAIService.isConfigured()) {
          logger.info('🔄 Cached summary detected as fallback (Explicit: ' + isExplicitFallback + ', RSS: ' + isRSSFallback + ', Structured: ' + isStructuredFallback + '), regenerating with AI...');
          // Devam et ve yeni özet oluştur (return etme)
        } else {
          this.summaryCache.set(cacheKey, { summary: cleanedPersisted, timestamp: now });
          return cleanedPersisted;
        }
      }

      // CRITICAL: Check cloud cache again before generating new summary
      // This prevents duplicate API calls if another user just created the summary
      // CRITICAL: Only check cloud if article.id exists
      if (article.id && typeof article.id === 'string' && article.id.trim().length > 0) {
        try {
          const cloudCheck = await this.loadSummaryFromCloud(article.id);
          if (cloudCheck && cloudCheck.summary && typeof cloudCheck.summary === 'string' && cloudCheck.summary.trim().length > 0) {
            const articleTitle = (article.title && typeof article.title === 'string') ? article.title : 'Haber';
            if (__DEV__) {
              logger.info('✅ Using shared cloud summary (cost optimized - another user created it):', articleTitle);
            }
            const cleanedCloud = this.cleanHTML(cloudCheck.summary);
            if (cleanedCloud && cleanedCloud.trim().length > 0) {
              this.summaryCache.set(cacheKey, { summary: cleanedCloud, timestamp: now });
              await this.persistSummaryLocally(cacheKey, cleanedCloud, this.SUMMARY_CACHE_TTL).catch((error) => {
                logger.warn('Failed to persist cloud summary locally:', error);
              });
              return cleanedCloud;
            }
          }
        } catch (cloudError) {
          logger.warn('Failed to load summary from cloud, continuing with generation:', cloudError);
          // Continue to generate new summary if cloud check fails
        }
      }

      // Ensure OpenAI service is initialized
      logger.info('🔧 Checking OpenAI configuration...');
      if (!openAIService.isConfigured()) {
        // Try to initialize if not already done
        logger.info('🔄 OpenAI not configured, trying to initialize...');
        try {
          await openAIService.initialize();
          logger.info('✅ OpenAI initialization complete, configured:', openAIService.isConfigured());
        } catch (error) {
          logger.error('❌ OpenAI initialization failed:', error);
        }
      }

      if (!openAIService.isConfigured()) {
        logger.warn('⚠️ OpenAI still not configured after init, using fallback summary.');
        return await this.useFallbackSummary(article, cacheKey, this.FALLBACK_SUMMARY_TTL);
      }

      logger.info('✅ OpenAI is configured, generating AI summary...');

      // ELITE COST OPTIMIZATION: Wrap API call in in-flight request tracking
      // Bu sayede aynı anda aynı haberi isteyen TÜM kullanıcılar tek bir API çağrısını bekleyecek
      const generateSummaryPromise = this.generateAndCacheSummary(article, cacheKey);
      this.inFlightRequests.set(cacheKey, generateSummaryPromise);

      try {
        const result = await generateSummaryPromise;
        return result;
      } finally {
        // CRITICAL: Her durumda in-flight request'i temizle
        this.inFlightRequests.delete(cacheKey);
      }
    } catch (error) {
      logger.error('Failed to summarize article:', error);
      this.inFlightRequests.delete(cacheKey);
      return await this.useFallbackSummary(article, cacheKey, this.FALLBACK_SUMMARY_TTL);
    }
  }

  /**
   * ELITE: Generate and cache summary - separated for in-flight tracking
   */
  private async generateAndCacheSummary(article: NewsArticle, cacheKey: string): Promise<string> {
    const now = Date.now();

    // CRITICAL: Generate new summary only if not exists in cloud (cost optimization)
    // This ensures only ONE summary per article is created, shared across all users

    // CRITICAL: Limit article summary length to prevent overly long prompts
    const maxSummaryLength = 5000; // Increased limit for full article source

    // CRITICAL: Validate and sanitize article data
    const articleTitle = (article.title && typeof article.title === 'string')
      ? article.title.trim().substring(0, 500) // Max 500 chars for title
      : 'Haber';

    if (__DEV__) {
      logger.info('🤖 Generating NEW shared summary (will be cached for all users):', articleTitle);
    }
    const articleSummary = (article.summary && typeof article.summary === 'string')
      ? article.summary.trim()
      : '';
    const articleSource = (article.source && typeof article.source === 'string')
      ? article.source.trim()
      : 'Bilinmeyen Kaynak';

    const truncatedSummary = articleSummary.length > maxSummaryLength
      ? articleSummary.substring(0, maxSummaryLength) + '...'
      : (articleSummary || articleTitle);

    // ELITE ULTRA UPDATE: "Haberin Eksiksiz Tam Raporu" - Okuyucu asla kaynağa gitmesin
    const prompt = `Aşağıdaki haberi Türkçe olarak, TÜM detaylarıyla EKSIKSIZ bir "tam haber raporu" olarak yeniden yaz.

KRİTİK KURALLAR (MUTLAKA UYULMASI GEREKEN):
1. KISA YAZMA! En az 12-15 cümle olmalı. Eksik bırakma, uzun ve doyurucu bir metin oluştur.
2. Haberdeki TÜM bilgileri dahil et: isimler, sayılar, tarih/saat, konum detayları, kurum açıklamaları, mahkeme kararları vs.
3. 5N1K kuralını KESİNLİKLE uygula: Ne oldu, Nerede oldu, Ne zaman oldu, Nasıl oldu, Neden oldu, Kim(ler) dahil.
4. Deprem haberi ise: Büyüklük, Derinlik (km), Tam Konum (il/ilçe), Tarih ve Saat, Hissedilen iller, Hasar/yaralı bilgisi, AFAD/Kandilli verileri - HEPSİNİ dahil et.
5. Mahkeme/dava haberi ise: Dava konusu, taraflar, karar detayları, gerekçe, sonuçlar - HEPSİNİ dahil et.
6. Hiçbir bilgiyi atlama. Özet değil, KAPSAMLI RAPOR yaz.
7. Akıcı, profesyonel gazetecilik diliyle yaz. Madde işareti kullanma, paragraf halinde yaz.
8. "Haber detaylarına göre...", "Haberde belirtildiğine göre..." gibi ifadeler KULLANMA. Doğrudan anlat.
9. Başlığı tekrarlama, doğrudan içeriğe geç.

HABER VERİLERİ:
Başlık: ${articleTitle}
${truncatedSummary ? `İçerik: ${truncatedSummary}` : ''}
${articleSource ? `Kaynak: ${articleSource}` : ''}
${(article.magnitude && typeof article.magnitude === 'number' && !isNaN(article.magnitude)) ? `Deprem Büyüklüğü: ${article.magnitude}` : ''}
${(article.location && typeof article.location === 'string') ? `Konum: ${article.location.trim()}` : ''}`;

    const systemPrompt = `Sen Türkiye'nin en saygın haber ajansının baş editörüsün. Görevin: verilen haberi okuyucunun kaynağa GİTMESİNE GEREK KALMAYACAK şekilde TAM ve EKSİKSİZ yazıya dökmek. Kısa yazma, her detayı dahil et. Profesyonel, güvenilir ve akıcı bir dil kullan. Minimum 12-15 cümle.`;

    let summary: string;
    try {
      // ELITE: Ultra-kapsamlı rapor için token limitini artırdım
      summary = await openAIService.generateText(prompt, {
        systemPrompt,
        maxTokens: 600, // ELITE: Eksiksiz içerik için 400 -> 600
        temperature: 0.25, // Daha tutarlı raporlar için 0.3 -> 0.25
        serviceName: 'NewsAggregatorService',
      });

      // CRITICAL: Validate AI response
      if (!summary || typeof summary !== 'string') {
        logger.warn('AI returned invalid summary type, using fallback');
        return await this.useFallbackSummary(article, cacheKey, this.FALLBACK_SUMMARY_TTL);
      }
    } catch (aiError) {
      logger.error('OpenAI API error:', aiError);
      return await this.useFallbackSummary(article, cacheKey, this.FALLBACK_SUMMARY_TTL);
    }

    // Clean HTML tags from AI response
    summary = this.cleanHTML(summary);

    // CRITICAL: Validate and limit summary length
    if (!summary || summary.trim().length === 0) {
      logger.warn('AI returned empty summary, using fallback');
      return await this.useFallbackSummary(article, cacheKey, this.FALLBACK_SUMMARY_TTL);
    }

    // Ensure summary is not too long (max 2000 characters)
    const MAX_SUMMARY_LENGTH = 2000;
    if (summary.length > MAX_SUMMARY_LENGTH) {
      // Truncate at sentence boundary
      const truncated = summary.substring(0, MAX_SUMMARY_LENGTH);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?'),
      );

      if (lastSentenceEnd > MAX_SUMMARY_LENGTH * 0.8) {
        summary = truncated.substring(0, lastSentenceEnd + 1);
      } else {
        // Truncate at word boundary
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > MAX_SUMMARY_LENGTH * 0.8) {
          summary = truncated.substring(0, lastSpace) + '...';
        } else {
          summary = truncated + '...';
        }
      }

      logger.warn('AI summary was too long, truncated to', summary.length, 'characters');
    }

    // CRITICAL: Save to cache and cloud (shared across all users)
    this.summaryCache.set(cacheKey, { summary, timestamp: now });

    // CRITICAL: Persist locally with error handling
    try {
      await this.persistSummaryLocally(cacheKey, summary, this.SUMMARY_CACHE_TTL);
    } catch (localError) {
      logger.warn('Failed to persist summary locally:', localError);
      // Continue even if local persistence fails
    }

    // CRITICAL: Persist to cloud with error handling (non-blocking)
    if (article.id && typeof article.id === 'string' && article.id.trim().length > 0) {
      this.persistSummaryToCloud(article, summary, this.SUMMARY_CACHE_TTL).catch((error) => {
        logger.warn('Failed to persist summary to cloud:', error);
      });
    }

    if (__DEV__) {
      logger.info('✅ Generated NEW shared summary (cached for all users):', articleTitle);
    }
    return summary;
  }

  /**
   * Get summary for notification - optimized for cost
   * Uses shared cache to ensure all users get the same summary with zero additional token cost
   * CRITICAL: This method is specifically designed for notifications to prevent duplicate API calls
   */
  async getSummaryForNotification(article: NewsArticle): Promise<string> {
    // CRITICAL: Validate article input
    if (!article || typeof article !== 'object') {
      logger.error('Invalid article provided to getSummaryForNotification:', article);
      return 'Yeni haber';
    }

    // This ensures ZERO duplicate API calls - one summary per article for ALL users
    const summary = await this.summarizeArticle(article);

    // CRITICAL: Format for notification (professional, concise)
    let formatted = summary.replace(/\s+/g, ' ').trim();

    // CRITICAL: Limit notification summary length (max 200 chars for notification body)
    const MAX_NOTIFICATION_LENGTH = 200;
    if (formatted.length > MAX_NOTIFICATION_LENGTH) {
      // Truncate at sentence boundary if possible
      const truncated = formatted.substring(0, MAX_NOTIFICATION_LENGTH);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?'),
      );

      if (lastSentenceEnd > MAX_NOTIFICATION_LENGTH * 0.7) {
        formatted = truncated.substring(0, lastSentenceEnd + 1);
      } else {
        // Truncate at word boundary
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > MAX_NOTIFICATION_LENGTH * 0.7) {
          formatted = truncated.substring(0, lastSpace) + '...';
        } else {
          formatted = truncated + '...';
        }
      }
    }

    return formatted;
  }
}

export const newsAggregatorService = new NewsAggregatorService();
