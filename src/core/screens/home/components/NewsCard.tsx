/**
 * NEWS CARD - EDITORIAL CAROUSEL
 * Elite V2: Horizontal swiping cards with premium typography
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Dimensions, ImageBackground } from 'react-native';
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
const CARD_WIDTH = width * 0.85;
const SPACING = 16;

export default function NewsCard() {
  const navigation = useNavigation();
  const { articles, loading } = useNewsStore();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Initial load
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
        <Text style={styles.loadingText}>Editör Masası Hazırlanıyor...</Text>
      </View>
    );
  }

  if (articles.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>GÜNDEM</Text>
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
        >
          <Text style={styles.seeAllText}>TÜMÜ</Text>
        </TouchableOpacity>
      </View>

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
            activeOpacity={0.9}
            onPress={() => handleArticlePress(article)}
            style={styles.cardContainer}
          >
            <PremiumMaterialSurface variant="B" style={styles.cardBackground}>
              {/* Subtle Top Glow (New Theme) */}
              <LinearGradient
                colors={['rgba(43,110,243,0.10)', 'transparent']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20%' }}
              />

              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.sourceTag, { backgroundColor: 'rgba(37,99,235,0.14)', borderColor: 'transparent' }]}>
                  <Text style={[styles.sourceText, { color: '#2563EB' }]}>{article.source}</Text>
                </View>
                <Text style={styles.timeText}>
                  {new Date(article.publishedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {/* Headline */}
              <Text style={styles.headline} numberOfLines={3}>
                {article.title}
              </Text>

              {/* Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.readMoreBtn}>
                  <Text style={styles.readMoreText}>OKU</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.brand.primary} />
                </View>
                {article.magnitude && (
                  <View style={styles.magBadge}>
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
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text.secondary,
    letterSpacing: 2,
  },
  seeAllText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand.primary,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  scrollContent: {
    paddingRight: 20,
    gap: SPACING,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: 180,
    // Shadow/Radius/BG handled by PremiumMaterialSurface
  },
  cardBackground: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  headline: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 26,
    letterSpacing: 0.5,
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
    color: colors.brand.primary,
    letterSpacing: 1,
  },
  magBadge: {
    backgroundColor: colors.emergency.critical,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  magText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
});
