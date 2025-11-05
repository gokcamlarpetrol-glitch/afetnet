/**
 * NEWS CARD - Home Screen Component
 * Displays latest earthquake-related news from Google News RSS + AFAD
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/core';
import { colors, spacing } from '../../../theme';
import * as haptics from '../../../utils/haptics';
import { useNewsStore } from '../../../ai/stores/newsStore';
import { newsAggregatorService } from '../../../ai/services/NewsAggregatorService';
import { NewsArticle } from '../../../ai/types/news.types';

export default function NewsCard() {
  const navigation = useNavigation();
  const { articles, loading } = useNewsStore();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Haberleri yukle
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      useNewsStore.getState().setLoading(true);
      
      // Haber kaynaklarindan veri cek
      const [newsArticles, earthquakeNews] = await Promise.all([
        newsAggregatorService.fetchLatestNews(),
        newsAggregatorService.convertEarthquakesToNews(),
      ]);

      // Birlestir ve sirala (en yeni once)
      const allNews = [...earthquakeNews, ...newsArticles].sort(
        (a, b) => b.publishedAt - a.publishedAt
      );

      useNewsStore.getState().setArticles(allNews.slice(0, 5)); // En son 5 haber
    } catch (error) {
      if (__DEV__) {
        const logger = await import('../../../utils/logger').then(m => m.createLogger('NewsCard'));
        logger.error('Failed to load news:', error);
      }
      useNewsStore.getState().setError('Haberler yuklenemedi');
    } finally {
      useNewsStore.getState().setLoading(false);
    }
  };

  const handleArticlePress = (article: NewsArticle) => {
    haptics.impactLight();
    // Navigate to NewsDetailScreen instead of opening external link
    (navigation as any).navigate('NewsDetail', { article });
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
          <TouchableOpacity onPress={loadNews}>
            <Ionicons 
              name="refresh" 
              size={20} 
              color={loading ? colors.text.tertiary : colors.text.secondary} 
            />
          </TouchableOpacity>
        </View>

        {/* News List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Haberler yukleniyor...</Text>
          </View>
        ) : articles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Haber bulunamadi</Text>
          </View>
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.newsScroll}
          >
            {articles.map((article) => (
              <TouchableOpacity
                key={article.id}
                style={styles.newsItem}
                onPress={() => handleArticlePress(article)}
                activeOpacity={0.8}
              >
                <View style={styles.newsContent}>
                  {article.magnitude && (
                    <View style={[styles.magnitudeBadge, { backgroundColor: colors.emergency.critical }]}>
                      <Text style={styles.magnitudeText}>{article.magnitude}</Text>
                    </View>
                  )}
                  <Text style={styles.newsTitle} numberOfLines={2}>
                    {article.title}
                  </Text>
                  <View style={styles.newsFooter}>
                    <Text style={styles.newsSource}>{article.source}</Text>
                    <Text style={styles.newsTime}>{getTimeAgo(article.publishedAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </LinearGradient>
    </Animated.View>
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
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
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
});

