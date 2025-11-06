/**
 * NEWS AGGREGATOR SERVICE
 * Fetches and aggregates earthquake-related news
 * Sources: Google News RSS + AFAD earthquake data
 */

import { NewsArticle, NewsCategory } from '../types/news.types';
import { createLogger } from '../../utils/logger';
import { openAIService } from './OpenAIService';

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
    url: 'https://www.ntv.com.tr/rss/son-depremler',
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
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private readonly REQUEST_TIMEOUT = 12_000; // 12 seconds
  private readonly DEFAULT_KEYWORDS = ['deprem', 'sarsıntı', 'afet'];
  private readonly MAX_TOTAL_ARTICLES = 60;

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

      if (limited.length === 0) {
        logger.warn('No news articles fetched; returning fallback content');
        return this.getFallbackArticles();
      }

      logger.info(`Aggregated ${limited.length} news articles from ${NEWS_SOURCES.length} sources`);
      return limited;
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
          const sanitizedUrl = this.sanitizeUrl(link);

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

      logger.info(`Fetched ${limited.length}/${parsedArticles.length} articles from ${source.name}`);
      return limited;
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

  private sanitizeUrl(url: string): string {
    try {
      const trimmed = url.trim();
      if (!trimmed) return '#';
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '#';
      }
      return parsed.toString();
    } catch (error) {
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
    try {
      // Cache kontrolu
      const cacheKey = article.id;
      const cached = this.summaryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        logger.info('Returning cached summary for:', article.title);
        return cached.summary;
      }

      // OpenAI ile ozet olustur
      if (!openAIService.isConfigured()) {
        logger.warn('OpenAI not configured, returning article summary');
        return article.summary || article.title;
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

      // Cache'e kaydet
      this.summaryCache.set(cacheKey, { summary, timestamp: Date.now() });

      logger.info('Generated AI summary for:', article.title);
      return summary;
    } catch (error) {
      logger.error('Failed to summarize article:', error);
      // Fallback: Orijinal ozet
      return article.summary || article.title;
    }
  }
}

export const newsAggregatorService = new NewsAggregatorService();

