/**
 * NEWS CARD - ULTRA PREMIUM EDITORIAL DESIGN
 * Horizontal carousel with elite typography and premium details
 * Every element crafted for maximum visual impact
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/core';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../../types/navigation';
import * as haptics from '../../../utils/haptics';
import { useNewsStore } from '../../../ai/stores/newsStore';
import { newsAggregatorService } from '../../../ai/services/NewsAggregatorService';
import { NewsArticle } from '../../../ai/types/news.types';
import { createLogger } from '../../../utils/logger';
import { PremiumMaterialSurface } from '../../../components/PremiumMaterialSurface';

const logger = createLogger('NewsCard');
const SPACING = 12;

type NewsCardNavigationProp = StackNavigationProp<MainStackParamList>;

export default function NewsCard() {
  const navigation = useNavigation<NewsCardNavigationProp>();
  const { articles, loading, error } = useNewsStore();
  // ELITE: iPad-safe — recompute on rotation / Split View resize
  const { width: screenWidth } = useWindowDimensions();
  const CARD_WIDTH = useMemo(() => Math.min(screenWidth - 32, 600), [screenWidth]);

  const loadNews = useCallback(async () => {
    const store = useNewsStore.getState();
    // ORDER MATTERS: setError(null) flips loading=false in the store, so it must
    // come BEFORE setLoading(true) — otherwise the spinner never shows on retry.
    store.setError(null);
    store.setLoading(true);
    try {
      const news = await newsAggregatorService.fetchLatestNews();
      store.setArticles(news.slice(0, 5));
    } catch (err) {
      logger.error('News fetch failed', err);
      store.setError('Deprem haberleri yüklenemedi.');
    } finally {
      store.setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews().catch(err => logger.error('News load failed', err));
  }, [loadNews]);

  const handleArticlePress = (article: NewsArticle) => {
    haptics.impactLight();
    try {
      navigation.navigate('NewsDetail', { article });
    } catch (error) {
      logger.error('Nav failed', error);
    }
  };

  if (loading && articles.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="newspaper-outline" size={20} color="#64748B" />
        </View>
        <Text style={styles.loadingText}>Gündem hazırlanıyor...</Text>
      </View>
    );
  }

  if (error && articles.length === 0) {
    return (
      <TouchableOpacity
        style={styles.errorContainer}
        activeOpacity={0.86}
        onPress={() => {
          haptics.impactLight();
          loadNews().catch(err => logger.error('News retry failed', err));
        }}
      >
        <View style={styles.loadingIcon}>
          <Ionicons name="cloud-offline-outline" size={20} color="#64748B" />
        </View>
        <View style={styles.errorTextWrap}>
          <Text style={styles.loadingText}>Deprem haberleri alınamadı</Text>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (articles.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="newspaper" size={12} color="#3B82F6" />
          </View>
          <Text style={styles.sectionTitle}>GÜNDEM</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            haptics.impactLight();
            try {
              navigation.navigate('AllNews');
            } catch (error) {
              logger.error('AllNews navigation failed', error);
            }
          }}
          style={styles.seeAllBtn}
        >
          <Text style={styles.seeAllText}>TÜMÜ</Text>
          <Ionicons name="chevron-forward" size={12} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Article Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + SPACING}
        snapToAlignment="start"
      >
        {articles.map((article, index) => (
          <TouchableOpacity
            key={article.id || index}
            activeOpacity={0.92}
            onPress={() => handleArticlePress(article)}
            style={[styles.cardContainer, { width: CARD_WIDTH }]}
          >
            <PremiumMaterialSurface variant="B" style={styles.cardBackground}>
              {/* ELITE: Top gradient removed for cleaner design */}

              {/* Header: Source + Time */}
              <View style={styles.cardHeader}>
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sourceTag}
                >
                  <Text style={styles.sourceText}>{article.source}</Text>
                </LinearGradient>
                <View style={styles.timeContainer}>
                  <Ionicons name="time-outline" size={10} color="#94A3B8" />
                  <Text style={styles.timeText}>
                    {new Date(article.publishedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
                  </Text>
                </View>
              </View>

              {/* Headline */}
              <Text style={styles.headline} numberOfLines={3}>
                {article.title}
              </Text>

              {/* Footer */}
              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.readMoreBtn}
                  onPress={() => handleArticlePress(article)}
                >
                  <Text style={styles.readMoreText}>OKU</Text>
                  <View style={styles.readMoreArrow}>
                    <Ionicons name="arrow-forward" size={10} color="#FFF" />
                  </View>
                </TouchableOpacity>
                {article.magnitude && (
                  <View style={styles.magBadge}>
                    <Ionicons name="pulse" size={10} color="#FFF" />
                    <Text style={styles.magText}>{article.magnitude.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </PremiumMaterialSurface>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1.5,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  errorContainer: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
  },
  errorTextWrap: {
    flex: 1,
  },
  retryText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  scrollContent: {
    paddingRight: 16,
    gap: SPACING,
  },
  cardContainer: {
    // width set dynamically via useWindowDimensions for iPad/rotation support
    height: 170,
  },
  cardBackground: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readMoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 1,
  },
  readMoreArrow: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  magBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  magText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
});
