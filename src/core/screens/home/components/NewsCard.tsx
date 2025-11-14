/**
 * NEWS CARD - Home Screen Component
 * Displays latest earthquake-related news from Google News RSS + AFAD
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing } from '../../../theme';
import * as haptics from '../../../utils/haptics';
import { useNewsStore } from '../../../ai/stores/newsStore';
import { newsAggregatorService } from '../../../ai/services/NewsAggregatorService';
import { NewsArticle } from '../../../ai/types/news.types';
import { notificationService } from '../../../services/NotificationService';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('NewsCard');
const NOTIFICATION_FRESH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const NOTIFIED_NEWS_STORAGE_KEY = 'afn_news_notified_v1';
const NOTIFICATION_MEMORY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 saat

export default function NewsCard() {
  const navigation = useNavigation();
  const { articles, loading } = useNewsStore();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const notifiedNewsRef = useRef<Record<string, number>>({});

  const persistNotified = async () => {
    try {
      await AsyncStorage.setItem(
        NOTIFIED_NEWS_STORAGE_KEY,
        JSON.stringify(notifiedNewsRef.current),
      );
    } catch (error) {
      logger.warn('Failed to persist notified news cache:', error);
    }
  };

  const pruneExpiredNotified = () => {
    const entries = notifiedNewsRef.current;
    const now = Date.now();
    let mutated = false;
    for (const key of Object.keys(entries)) {
      const timestamp = entries[key];
      if (!timestamp || now - timestamp > NOTIFICATION_MEMORY_WINDOW_MS) {
        delete entries[key];
        mutated = true;
      }
    }
    if (mutated) {
      persistNotified().catch((error) => {
        logger.warn('Failed to persist notified news:', error);
      });
    }
  };

  const hydrateNotifiedNews = async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTIFIED_NEWS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          notifiedNewsRef.current = parsed as Record<string, number>;
        }
      }
      pruneExpiredNotified();
    } catch (error) {
      logger.warn('Failed to hydrate notified news cache:', error);
    }
  };

  const hasBeenNotified = (articleId: string | undefined): boolean => {
    if (!articleId) return false;
    pruneExpiredNotified();
    return Boolean(notifiedNewsRef.current[articleId]);
  };

  const markArticlesAsNotified = (items: NewsArticle[]) => {
    if (items.length === 0) return;
    const now = Date.now();
    let mutated = false;
    for (const article of items) {
      if (article.id) {
        notifiedNewsRef.current[article.id] = now;
        mutated = true;
      }
    }
    if (mutated) {
      persistNotified().catch((error) => {
        logger.warn('Failed to persist notified news:', error);
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    (async () => {
      await hydrateNotifiedNews();
      if (!mounted) return;
      await loadNews();
      if (!mounted) return;

      intervalId = setInterval(() => {
        loadNews({ background: true }).catch((error) => {
          logger.error('Background news refresh failed:', error);
        });
      }, 2 * 60 * 1000); // 2 dakikada bir yenile
    })();

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const loadNews = async ({ background = false }: { background?: boolean } = {}) => {
    // CRITICAL: News loading with timeout and error recovery
    try {
      if (!background) {
        useNewsStore.getState().setLoading(true);
        useNewsStore.getState().setError(null);
      }
      
      // Ensure NewsAggregatorService is initialized
      try {
        await newsAggregatorService.initialize();
      } catch (initError) {
        logger.debug('NewsAggregatorService initialization:', initError);
      }
      
      // CRITICAL: Fetch news with timeout (30 seconds)
      const fetchPromise = newsAggregatorService.fetchLatestNews();
      const timeoutPromise = new Promise<NewsArticle[]>((_, reject) => 
        setTimeout(() => reject(new Error('News fetch timeout')), 30000)
      );
      
      const allNews = await Promise.race([fetchPromise, timeoutPromise]);

      // Sirala (en yeni once)
      allNews.sort(
        (a, b) => b.publishedAt - a.publishedAt
      );

      const previousArticles = useNewsStore.getState().articles;
      const previousIds = new Set(previousArticles.map((item) => item.id).filter(Boolean));
      const hadPrevious = previousArticles.length > 0;

      const candidateArticles = allNews.filter((article) => {
        if (!article.id) {
          return false;
        }
        if (!article.url || article.url === '#') {
          return false;
        }
        if (previousIds.has(article.id)) {
          return false;
        }
        if (hasBeenNotified(article.id)) {
          return false;
        }
        return Date.now() - article.publishedAt <= NOTIFICATION_FRESH_WINDOW_MS;
      });

      const notificationsToSend = hadPrevious ? candidateArticles.slice(0, 5) : [];

      if (notificationsToSend.length > 0) {
        logger.info(`Detected ${candidateArticles.length} new articles`);
      }

      if (notificationsToSend.length > 0) {
        await notificationService.initialize().catch((error: unknown) => {
          logger.error('Notification initialization failed:', error);
        });

        // CRITICAL: Process notifications with shared summary optimization
        // All users will receive the same shared summary (cost optimization)
        // COST OPTIMIZATION: One summary per article, shared across ALL users
        // Token cost: 1 API call per article (not per user)
        for (const article of notificationsToSend) {
          try {
            // CRITICAL: Use getSummaryForNotification which uses shared cache
            // This ensures ALL users get the same summary with ZERO additional token cost
            // Flow: in-memory cache -> local cache -> cloud cache -> generate (if needed, shared)
            // If cloud cache exists, it's used for ALL users without any API call
            const summary = await newsAggregatorService.getSummaryForNotification(article);

            // CRITICAL: Send professional notification with shared summary
            await notificationService.showNewsNotification({
              title: article.title,
              summary,
              source: article.source,
              url: article.url && article.url !== '#' ? article.url : undefined,
              articleId: article.id,
            });
            
            if (__DEV__) {
              logger.info(`✅ Professional news notification sent with shared summary (articleId: ${article.id}) - zero additional token cost for this user`);
            }
          } catch (error) {
            logger.error('Failed to send news notification:', error, { articleId: article.id });
          }
        }

        markArticlesAsNotified(notificationsToSend);
      }

      // En az 1 haber varsa göster, yoksa fallback göster
      if (allNews.length > 0) {
        useNewsStore.getState().setArticles(allNews.slice(0, 5)); // En son 5 haber
        useNewsStore.getState().setError(null);
      } else {
        // Fallback haber göster
        const fallback = newsAggregatorService.getFallbackArticles();
        useNewsStore.getState().setArticles(fallback);
        useNewsStore.getState().setError(null);
        logger.info('No news found, showing fallback');
      }
    } catch (error: any) {
      logger.error('Failed to load news:', error);
      
      // CRITICAL: Try to use cached articles if available
      const currentArticles = useNewsStore.getState().articles;
      if (currentArticles.length === 0) {
        // Show fallback articles instead of error
        const fallback = newsAggregatorService.getFallbackArticles();
        useNewsStore.getState().setArticles(fallback);
        useNewsStore.getState().setError(null);
        logger.info('Using fallback articles due to fetch failure');
      } else {
        // Keep showing cached articles, just log the error
        logger.warn('Using cached news articles due to fetch failure');
        useNewsStore.getState().setError(null);
      }
    } finally {
      if (!background) {
        useNewsStore.getState().setLoading(false);
      }
    }
  };

  const handleArticlePress = (article: NewsArticle) => {
    haptics.impactLight();
    // CRITICAL: Navigate to NewsDetailScreen with error handling
    try {
      if (navigation && 'navigate' in navigation) {
        (navigation as { navigate: (screen: string, params?: any) => void }).navigate('NewsDetail', { article });
      } else {
        logger.warn('Navigation not available for news article');
      }
    } catch (error) {
      logger.error('Failed to navigate to news detail:', error);
      // Fallback: Try to open URL if navigation fails
      if (article.url && article.url !== '#') {
        const Linking = require('react-native').Linking;
        Linking.openURL(article.url).catch((linkError: any) => {
          logger.error('Failed to open news URL:', linkError);
        });
      }
    }
  };

  const getTimeAgo = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMinutes < 1) return 'Az once';
    if (diffMinutes < 60) return `${diffMinutes} dk once`;
    if (diffHours < 24) return `${diffHours} saat once`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} gun once`;
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={['#1a1f2e', '#141824']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Ionicons name="newspaper" size={20} color={colors.accent.primary} />
            </View>
            <Text style={styles.title}>Son Dakika Haberler</Text>
          </View>
          <TouchableOpacity onPress={() => loadNews()}>
            <Ionicons 
              name="refresh" 
              size={20} 
              color={loading ? colors.text.tertiary : colors.text.secondary} 
            />
          </TouchableOpacity>
        </View>

        {/* News List */}
        {loading && articles.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Haberler yükleniyor...</Text>
          </View>
        ) : articles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="newspaper-outline" size={32} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>Henüz haber yok</Text>
            <Text style={styles.emptySubtext}>Yenile butonuna basarak haberleri yükleyebilirsiniz</Text>
          </View>
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.newsScroll}
            nestedScrollEnabled={true}
          >
            {articles.map((article, index) => (
              <NewsItemCard
                key={`${article.id}-${index}`}
                article={article}
                onPress={() => handleArticlePress(article)}
              />
            ))}
          </ScrollView>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

// CRITICAL: News Item Card Component with AI Summary
function NewsItemCard({ article, onPress }: { article: NewsArticle; onPress: () => void }) {
  const [aiSummary, setAiSummary] = React.useState<string>('');
  const [summaryLoading, setSummaryLoading] = React.useState(false);

  React.useEffect(() => {
    // Load AI summary for this article
    const loadSummary = async () => {
      try {
        setSummaryLoading(true);
        // CRITICAL: Use getSummaryForNotification which uses shared cache (cost optimization)
        const summary = await newsAggregatorService.getSummaryForNotification(article);
        if (summary && summary.trim().length > 0) {
          // Clean and truncate summary for card display
          const cleaned = summary.replace(/<[^>]*>/g, '').trim();
          const maxLength = 120; // Short summary for card
          const truncated = cleaned.length > maxLength 
            ? cleaned.substring(0, maxLength).trim() + '...'
            : cleaned;
          setAiSummary(truncated);
        } else {
          // Fallback to article summary or title
          const fallback = article.summary || article.title || '';
          const cleaned = fallback.replace(/<[^>]*>/g, '').trim();
          const maxLength = 120;
          const truncated = cleaned.length > maxLength 
            ? cleaned.substring(0, maxLength).trim() + '...'
            : cleaned;
          setAiSummary(truncated);
        }
      } catch (error) {
        logger.debug('Failed to load AI summary for card:', error);
        // Fallback
        const fallback = article.summary || article.title || '';
        const cleaned = fallback.replace(/<[^>]*>/g, '').trim();
        const maxLength = 120;
        const truncated = cleaned.length > maxLength 
          ? cleaned.substring(0, maxLength).trim() + '...'
          : cleaned;
        setAiSummary(truncated);
      } finally {
        setSummaryLoading(false);
      }
    };

    loadSummary();
  }, [article.id]);

  const getTimeAgo = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMinutes < 1) return 'Az önce';
    if (diffMinutes < 60) return `${diffMinutes} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} gün önce`;
  };

  return (
    <TouchableOpacity
      style={styles.newsItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.newsContent}>
        {article.magnitude && (
          <View style={[styles.magnitudeBadge, { backgroundColor: colors.emergency.critical }]}>
            <Text style={styles.magnitudeText}>{article.magnitude.toFixed(1)}</Text>
          </View>
        )}
        <Text style={styles.newsTitle} numberOfLines={2}>
          {article.title}
        </Text>
        
        {/* AI Summary */}
        {summaryLoading ? (
          <View style={styles.summaryLoading}>
            <Text style={styles.summaryLoadingText}>AI özeti hazırlanıyor...</Text>
          </View>
        ) : aiSummary ? (
          <View style={styles.summaryContainer}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color={colors.accent.primary} />
              <Text style={styles.aiBadgeText}>AI Özet</Text>
            </View>
            <Text style={styles.newsSummary} numberOfLines={3}>
              {aiSummary}
            </Text>
          </View>
        ) : null}
        
        <View style={styles.newsFooter}>
          <Text style={styles.newsSource} numberOfLines={1}>
            {article.source}
          </Text>
          <Text style={styles.newsTime}>{getTimeAgo(article.publishedAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[6],
  },
  gradient: {
    borderRadius: 20,
    padding: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  loadingContainer: {
    paddingVertical: spacing[6],
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyContainer: {
    paddingVertical: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing[1],
  },
  newsScroll: {
    gap: spacing[4],
  },
  newsItem: {
    width: 280,
    backgroundColor: colors.background.elevated,
    borderRadius: 12,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  newsContent: {
    gap: spacing[3],
  },
  magnitudeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  magnitudeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 20,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newsSource: {
    fontSize: 12,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  newsTime: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  summaryContainer: {
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: spacing[1],
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent.primary,
    textTransform: 'uppercase',
  },
  newsSummary: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
    lineHeight: 16,
  },
  summaryLoading: {
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  summaryLoadingText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.text.tertiary,
  },
});

