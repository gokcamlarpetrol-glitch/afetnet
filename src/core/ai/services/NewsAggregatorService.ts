/**
 * NEWS AGGREGATOR SERVICE
 * Fetches and aggregates earthquake-related news
 * Sources: Google News RSS + AFAD earthquake data
 */

import { NewsArticle, NewsCategory } from '../types/news.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('NewsAggregatorService');

// Google News RSS feed URL (deprem haberleri)
const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search?q=deprem+türkiye&hl=tr&gl=TR&ceid=TR:tr';

class NewsAggregatorService {
  private isInitialized = false;

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
      // Google News RSS'ten haber cek
      const response = await fetch(GOOGLE_NEWS_RSS_URL, {
        method: 'GET',
        headers: {
          'User-Agent': 'AfetNet/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xmlText = await response.text();
      const articles = this.parseRSSFeed(xmlText);
      
      logger.info(`Fetched ${articles.length} news articles from Google News RSS`);
      return articles;
    } catch (error) {
      logger.error('Failed to fetch news from Google News RSS:', error);
      
      // Fallback: Mock data
      return [
        {
          id: 'news_fallback_1',
          title: 'Deprem haberleri yukleniyor...',
          summary: 'Haber servisi gecici olarak kullanilamiyor.',
          url: '#',
          source: 'AfetNet',
          publishedAt: Date.now(),
          category: 'general',
        },
      ];
    }
  }

  /**
   * RSS feed'i parse et ve NewsArticle formatina donustur
   */
  private parseRSSFeed(xmlText: string): NewsArticle[] {
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
        const source = this.extractTag(itemXml, 'source') || 'Google News';
        
        if (title && link) {
          articles.push({
            id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: this.cleanHTML(title),
            summary: this.cleanHTML(description || title),
            url: link,
            source: this.cleanHTML(source),
            publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
            category: 'earthquake',
          });
        }
      }
    } catch (error) {
      logger.error('Failed to parse RSS feed:', error);
    }
    
    return articles;
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
}

export const newsAggregatorService = new NewsAggregatorService();

