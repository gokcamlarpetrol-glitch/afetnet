/**
 * ALL NEWS SCREEN
 * Elite V2: Full list of news articles with search and filter
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../../theme';
import { newsAggregatorService } from '../../ai/services/NewsAggregatorService';
import { NewsArticle } from '../../ai/types/news.types';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AllNewsScreen');

export default function AllNewsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchNews = useCallback(async () => {
    try {
      const news = await newsAggregatorService.fetchLatestNews();
      setArticles(news);
    } catch (error) {
      logger.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNews();
  }, [fetchNews]);

  const handleArticlePress = useCallback((article: NewsArticle) => {
    haptics.impactLight();
    try {
      if (navigation && 'navigate' in navigation) {
        (navigation as any).navigate('NewsDetail', { article });
      }
    } catch (error) {
      logger.error('Navigation failed:', error);
    }
  }, [navigation]);

  // ELITE: Filtered articles based on search
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const query = searchQuery.toLowerCase();
    return articles.filter(article =>
      article.title?.toLowerCase().includes(query) ||
            article.source?.toLowerCase().includes(query) ||
            article.summary?.toLowerCase().includes(query),
    );
  }, [articles, searchQuery]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderNewsItem = useCallback(({ item }: { item: NewsArticle }) => (
    <TouchableOpacity
      style={styles.newsItem}
      activeOpacity={0.8}
      onPress={() => handleArticlePress(item)}
    >
      <View style={styles.newsContent}>
        <View style={styles.newsHeader}>
          <View style={styles.sourceTag}>
            <Text style={styles.sourceText}>{item.source}</Text>
          </View>
          <Text style={styles.timeText}>{formatDate(item.publishedAt)}</Text>
        </View>
        <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
        {item.summary && (
          <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text>
        )}
      </View>
      <View style={styles.arrowContainer}>
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  ), [handleArticlePress]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={styles.loadingText}>Haberler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ELITE: Header */}
      <LinearGradient
        colors={[colors.gradients.header[0], colors.gradients.header[1]]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            haptics.impactLight();
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tüm Haberler</Text>
        <View style={styles.headerRight} />
      </LinearGradient>

      {/* ELITE: Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Haber ara..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ELITE: News List */}
      <FlatList
        data={filteredArticles}
        renderItem={renderNewsItem}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        // ELITE: Performance optimizations
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 100, // Approximate item height
          offset: 100 * index,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="newspaper-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'Arama sonucu bulunamadı' : 'Haber bulunamadı'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  newsItem: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  newsContent: {
    flex: 1,
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sourceTag: {
    backgroundColor: colors.accent.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
    fontSize: 10,
  },
  timeText: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 11,
  },
  newsTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  newsSummary: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  arrowContainer: {
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl * 3,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
