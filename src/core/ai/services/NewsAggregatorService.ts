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
import { getDeviceId } from '../../../lib/device';

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

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    logger.info('NewsAggregatorService initialized');
    this.isInitialized = true;
  }

  /**
   * Depremle ilgili son dakika haberlerini topla
   * Kaynaklar: AFAD (mevcut), Google News RSS
   */
  async fetchLatestNews(): Promise<NewsArticle[]> {
    try {
      const results = await Promise.allSettled(
        NEWS_SOURCES.map((source) => this.fetchFromSource(source))
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
      const itemRegex = /<item>(.*?)<\/item>/gs;
      const matches = xmlText.matchAll(itemRegex);
      
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
      const parsedArticles = this.parseRSSFeed(xmlText, source);
      const keywords = source.keywords ?? this.DEFAULT_KEYWORDS;

      const keywordFiltered = parsedArticles.filter((article) =>
        this.containsKeyword(article, keywords)
      );

      const limited = keywordFiltered
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, source.maxItems ?? 20);

      const stable = this.ensureStableIds(limited);

      logger.info(`Fetched ${stable.length}/${parsedArticles.length} articles from ${source.name}`);
      return stable;
    } catch (error) {
      logger.warn(
        `News source unavailable (${source.name})`,
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * XML tag'inden icerik cikar
   */
  private extractTag(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * HTML tag'lerini ve CDATA'yi temizle
   */
  private cleanHTML(text: string): string {
    return text
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
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

    const searchable = `${article.title} ${article.summary}`.toLowerCase();
    return keywords.some((keyword) => searchable.includes(keyword.toLowerCase()));
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
        const { hostname, pathname } = new URL(article.url);
        return `${hostname}${pathname}`.toLowerCase();
      } catch {
        return article.url.toLowerCase();
      }
    }
    if (article.title) {
      return article.title.toLowerCase();
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
        ? article.source.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : 'haber';
      const fallbackTitle = (article.title || 'news').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const fallbackBase = `${fallbackSource}-${fallbackTitle}-${article.publishedAt}`;

      return {
        ...article,
        id: this.sanitizeId(fallbackBase),
      };
    });
  }

  private sanitizeId(value: string): string {
    return value
      .toLowerCase()
      .replace(/https?:\/\//g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || `news-${Date.now()}`;
  }

  private resolveArticleKey(article: NewsArticle): string {
    if (article.id) {
      return article.id;
    }

    const base = `${article.source ?? 'haber'}-${article.title ?? article.url ?? Date.now().toString()}`;
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
      const deviceId = await this.getDeviceIdForSummary();
      if (!deviceId) {
        return;
      }

      const { firebaseDataService } = await import('../../services/FirebaseDataService');
      if (!firebaseDataService.isInitialized) {
        await firebaseDataService.initialize();
      }
      if (!firebaseDataService.isInitialized) {
        return;
      }

      await firebaseDataService.saveNewsSummary(article.id, {
        summary,
        source: article.source,
        title: article.title,
        url: article.url,
        publishedAt: article.publishedAt,
        createdByDeviceId: deviceId,
        ttlMs,
      });
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
    const fallback = (article.summary && article.summary.trim().length > 0)
      ? article.summary.trim()
      : (article.title || 'Detaylar için AfetNet uygulamasını açın.');

    this.summaryCache.set(cacheKey, { summary: fallback, timestamp: Date.now() });
    await this.persistSummaryLocally(cacheKey, fallback, ttlMs);
    void this.persistSummaryToCloud(article, fallback, ttlMs);

    return fallback;
  }

  private async getDeviceIdForSummary(): Promise<string | null> {
    if (this.cachedDeviceId) {
      return this.cachedDeviceId;
    }

    if (!this.deviceIdPromise) {
      this.deviceIdPromise = getDeviceId()
        .then((id) => (id && id.startsWith('afn-') ? id : null))
        .catch((error) => {
          logger.warn('Failed to resolve device ID for news summary:', error);
          return null;
        });
    }

    this.cachedDeviceId = await this.deviceIdPromise;
    return this.cachedDeviceId;
  }

  private async fetchWithTimeout(url: string): Promise<string> {
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
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getFallbackArticles(): NewsArticle[] {
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
        (eq) => eq.magnitude >= 4.0 && Date.now() - eq.time < 24 * 60 * 60 * 1000
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
      logger.error('Failed to convert earthquakes to news:', error);
      return [];
    }
  }

  /**
   * Haber icerigi AI ile ozetle
   * OpenAI GPT-4 kullanarak Turkce, anlasilir ozet olustur
   */
  async summarizeArticle(article: NewsArticle): Promise<string> {
    const cacheKey = this.resolveArticleKey(article);
    const now = Date.now();

    try {
      // In-memory cache
      const cached = this.summaryCache.get(cacheKey);
      if (cached && now - cached.timestamp < this.SUMMARY_CACHE_TTL) {
        logger.info('Returning cached summary for:', article.title);
        return cached.summary;
      }

      // Local / cloud cache
      const persisted = await this.getPersistedSummary(article, cacheKey);
      if (persisted) {
        logger.info('Returning persisted summary for:', article.title);
        this.summaryCache.set(cacheKey, { summary: persisted, timestamp: now });
        return persisted;
      }

      if (!openAIService.isConfigured()) {
        logger.warn('OpenAI not configured, using fallback summary.');
        return await this.useFallbackSummary(article, cacheKey, this.FALLBACK_SUMMARY_TTL);
      }

      const prompt = `Aşağıdaki haber içeriğini Türkçe olarak özetle. Özet 3-5 paragraf olmalı, anlaşılır ve bilgilendirici olmalı. Deprem ve afet güvenliği açısından önemli detayları vurgula.

Haber Başlığı: ${article.title}

Haber İçeriği:
${article.summary}

Kaynak: ${article.source}
${article.magnitude ? `Deprem Büyüklüğü: ${article.magnitude}` : ''}
${article.location ? `Konum: ${article.location}` : ''}

Lütfen sadece özet metnini döndür, başlık veya ek açıklama ekleme.`;

      const systemPrompt = `Sen bir haber özeti uzmanısın. Deprem ve afet haberleri konusunda bilgilisin. Özetlerin Türkçe, anlaşılır, bilgilendirici ve objektif olmalı. Paniğe yol açmadan, gerçekleri net bir şekilde aktarmalısın.`;

      const summary = await openAIService.generateText(prompt, {
        systemPrompt,
        maxTokens: 500,
        temperature: 0.7,
      });

      this.summaryCache.set(cacheKey, { summary, timestamp: now });
      await this.persistSummaryLocally(cacheKey, summary, this.SUMMARY_CACHE_TTL);
      void this.persistSummaryToCloud(article, summary, this.SUMMARY_CACHE_TTL);

      logger.info('Generated AI summary for:', article.title);
      return summary;
    } catch (error) {
      logger.error('Failed to summarize article:', error);
      return await this.useFallbackSummary(article, cacheKey, this.FALLBACK_SUMMARY_TTL);
    }
  }
}

export const newsAggregatorService = new NewsAggregatorService();

