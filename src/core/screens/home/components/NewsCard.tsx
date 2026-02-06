/**
 * NEWS CARD - ULTRA PREMIUM EDITORIAL DESIGN
 * Horizontal carousel with elite typography and premium details
 * Every element crafted for maximum visual impact
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/core';
import { colors, spacing } from '../../../theme';
import * as haptics from '../../../utils/haptics';
import { useNewsStore } from '../../../ai/stores/newsStore';
import { newsAggregatorService } from '../../../ai/services/NewsAggregatorService';
import { NewsArticle } from '../../../ai/types/news.types';
import { createLogger } from '../../../utils/logger';
import { PremiumMaterialSurface } from '../../../components/PremiumMaterialSurface';

const logger = createLogger('NewsCard');
const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const SPACING = 12;

export default function NewsCard() {
  const navigation = useNavigation();
  const { articles, loading } = useNewsStore();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    newsAggregatorService.fetchLatestNews().then(news => {
      useNewsStore.getState().setArticles(news.slice(0, 5));
    }).catch(err => logger.error('News fetch failed', err));
  }, []);

  const handleArticlePress = (article: NewsArticle) => {
    haptics.impactLight();
    try {
      if (navigation && 'navigate' in navigation) {
        (navigation as any).navigate('NewsDetail', { article });
      }
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

  if (articles.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
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
              if (navigation && 'navigate' in navigation) {
                (navigation as any).navigate('AllNews');
              }
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
            style={styles.cardContainer}
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
                    {new Date(article.publishedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
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
    </Animated.View>
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
  scrollContent: {
    paddingRight: 16,
    gap: SPACING,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: 170,
  },
  cardBackground: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
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
