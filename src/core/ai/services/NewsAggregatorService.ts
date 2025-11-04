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
      // Simdilik mock data, Phase 4'te gercek API entegre edilecek
      const mockNews: NewsArticle[] = [
        {
          id: 'news_1',
          title: 'AFAD: Son 24 saatte 15 deprem kaydedildi',
          summary: 'AFAD verilerine gore son 24 saatte Turkiye genelinde 15 deprem meydana geldi.',
          url: 'https://www.afad.gov.tr',
          source: 'AFAD',
          publishedAt: Date.now() - 3600000, // 1 saat once
          category: 'earthquake',
        },
        {
          id: 'news_2',
          title: 'Uzmanlar uyardi: Deprem cantasi hazir olsun',
          summary: 'Deprem uzmanlari, her ailenin deprem cantasi hazirlamasi gerektigini vurguladi.',
          url: 'https://example.com',
          source: 'Haberler',
          publishedAt: Date.now() - 7200000, // 2 saat once
          category: 'preparedness',
        },
      ];

      return mockNews;
    } catch (error) {
      logger.error('Failed to fetch news:', error);
      return [];
    }
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

