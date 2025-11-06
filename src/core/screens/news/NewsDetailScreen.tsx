/**
 * NEWS DETAIL SCREEN
 * Displays news article with AI summary and original content
 * Premium feature with 2 tabs: AI Summary + Original Article (WebView)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import type { WebViewProps } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../../theme';
import { NewsArticle } from '../../ai/types/news.types';
import { newsAggregatorService } from '../../ai/services/NewsAggregatorService';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('NewsDetailScreen');

type TabType = 'summary' | 'original';

interface NewsDetailScreenProps {
  route: {
    params: {
      article: NewsArticle;
    };
  };
  navigation: any;
}

export default function NewsDetailScreen({ route, navigation }: NewsDetailScreenProps) {
  const { article } = route.params;
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [articleContent, setArticleContent] = useState<string>('');
  const [articleContentLoading, setArticleContentLoading] = useState(false);
  const [articleContentError, setArticleContentError] = useState<string | null>(null);

  const WebViewComponent = useMemo<React.ComponentType<WebViewProps> | null>(() => {
    try {
      const { WebView } = require('react-native-webview');
      return WebView as React.ComponentType<WebViewProps>;
    } catch (error) {
      logger.warn('react-native-webview module unavailable; falling back to external browser.', error);
      return null;
    }
  }, []);

  const sanitizeArticleContent = (html: string): string => {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const loadArticleContent = useCallback(async () => {
    if (!article.url || article.url === '#') return;

    try {
      setArticleContentLoading(true);
      setArticleContentError(null);

      const response = await fetch(article.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'AfetNet/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const rawHtml = await response.text();
      const sanitized = sanitizeArticleContent(rawHtml);

      if (sanitized.length > 0) {
        setArticleContent(sanitized);
      } else {
        setArticleContentError('Haber içeriği çözümlenemedi.');
      }
    } catch (err) {
      logger.error('Failed to fetch article content:', err);
      setArticleContentError('Haber içeriği yüklenemedi. Tarayıcıda açmayı deneyin.');
    } finally {
      setArticleContentLoading(false);
    }
  }, [article.url]);

  useEffect(() => {
    loadAISummary();
  }, []);

  useEffect(() => {
    if (!WebViewComponent && article.url && article.url !== '#') {
      void loadArticleContent();
    }
  }, [WebViewComponent, article.url, loadArticleContent]);

  const loadAISummary = async () => {
    try {
      setLoading(true);
      const summary = await newsAggregatorService.summarizeArticle(article);
      setAiSummary(summary);
    } catch (error) {
      logger.error('Failed to load AI summary:', error);
      setAiSummary(article.summary || 'Özet oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    haptics.impactLight();
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\n${article.url}`,
        url: article.url,
      });
    } catch (error) {
      logger.error('Failed to share:', error);
    }
  };

  const handleOpenExternal = () => {
    haptics.impactLight();
    if (article.url && article.url !== '#') {
      Linking.openURL(article.url);
    }
  };

  const switchTab = (tab: TabType) => {
    haptics.impactLight();
    setActiveTab(tab);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.gradients.header[0], colors.gradients.header[1]]}
        style={styles.header}
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
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Haber Detayı
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {article.source}
          </Text>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Article Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{article.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{article.source}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>
            {new Date(article.publishedAt).toLocaleDateString('tr-TR')}
          </Text>
          {article.magnitude && (
            <>
              <Text style={styles.metaDot}>•</Text>
              <View style={styles.magnitudeBadge}>
                <Text style={styles.magnitudeText}>{article.magnitude}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'summary' && styles.tabActive]}
          onPress={() => switchTab('summary')}
        >
          <Ionicons
            name="sparkles"
            size={20}
            color={activeTab === 'summary' ? colors.accent.primary : colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>
            AI Özeti
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'original' && styles.tabActive]}
          onPress={() => switchTab('original')}
        >
          <Ionicons
            name="newspaper-outline"
            size={20}
            color={activeTab === 'original' ? colors.accent.primary : colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'original' && styles.tabTextActive]}>
            Orijinal Haber
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'summary' ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent.primary} />
              <Text style={styles.loadingText}>AI özeti oluşturuluyor...</Text>
            </View>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Ionicons name="sparkles" size={24} color={colors.accent.primary} />
                  <Text style={styles.summaryTitle}>AI Özeti</Text>
                </View>
                <Text style={styles.summaryText}>{aiSummary}</Text>
              </View>

              {/* Disclaimer */}
              <View style={styles.disclaimer}>
                <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
                <Text style={styles.disclaimerText}>
                  Bu özet yapay zeka tarafından oluşturulmuştur. Detaylı bilgi için orijinal haberi okuyun.
                </Text>
              </View>

              {/* Open Original Button */}
              {article.url && article.url !== '#' && (
                <TouchableOpacity style={styles.originalButton} onPress={handleOpenExternal}>
                  <LinearGradient
                    colors={[colors.accent.primary, colors.accent.secondary]}
                    style={styles.originalButtonGradient}
                  >
                    <Ionicons name="open-outline" size={20} color="#fff" />
                    <Text style={styles.originalButtonText}>Orijinal Haberi Aç</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.webViewContainer}>
          {article.url && article.url !== '#' ? (
            WebViewComponent ? (
              <WebViewComponent
                source={{ uri: article.url }}
                style={styles.webView}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.webViewLoading}>
                    <ActivityIndicator size="large" color={colors.accent.primary} />
                    <Text style={styles.loadingText}>Haber yükleniyor...</Text>
                  </View>
                )}
                javaScriptEnabled
                domStorageEnabled={false}
                thirdPartyCookiesEnabled={false}
                sharedCookiesEnabled={false}
                allowsInlineMediaPlayback={false}
                mediaPlaybackRequiresUserAction
                allowsBackForwardNavigationGestures={false}
                onShouldStartLoadWithRequest={(request) => {
                  const url = request.url;
                  if (!url.startsWith('https://')) {
                    logger.warn('Blocked non-HTTPS URL:', url);
                    return false;
                  }
                  return true;
                }}
                onError={(event) => {
                  const { nativeEvent } = event;
                  logger.error('WebView error:', nativeEvent);
                }}
              />
            ) : (
              <View style={styles.webViewUnavailableContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
                <Text style={styles.webViewUnavailableTitle}>WebView kullanılabilir değil</Text>
                <Text style={styles.webViewUnavailableText}>
                  Cihazınızda web içerik bileşeni yüklü değil. Aşağıda haberin sadeleştirilmiş metnini görüntüleyebilir veya tarayıcıda açabilirsiniz.
                </Text>
                {articleContentLoading ? (
                  <View style={styles.articleFallbackLoading}>
                    <ActivityIndicator size="large" color={colors.accent.primary} />
                    <Text style={styles.articleFallbackLoadingText}>Haber içeriği yükleniyor...</Text>
                  </View>
                ) : articleContent ? (
                  <ScrollView style={styles.articleFallbackScroll}>
                    <Text style={styles.articleFallbackText}>{articleContent}</Text>
                  </ScrollView>
                ) : (
                  <Text style={styles.articleFallbackText}>
                    {articleContentError || 'Haber içeriği yüklenemedi. Tarayıcıda açmayı deneyebilirsiniz.'}
                  </Text>
                )}
                <TouchableOpacity style={styles.originalButton} onPress={handleOpenExternal}>
                  <LinearGradient
                    colors={[colors.accent.primary, colors.accent.secondary]}
                    style={styles.originalButtonGradient}
                  >
                    <Ionicons name="open-outline" size={20} color="#fff" />
                    <Text style={styles.originalButtonText}>Tarayıcıda Aç</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View style={styles.noUrlContainer}>
              <Ionicons name="alert-circle-outline" size={64} color={colors.text.tertiary} />
              <Text style={styles.noUrlText}>Orijinal haber linki bulunamadı</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  shareButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: 12,
    lineHeight: 32,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  metaDot: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginHorizontal: 8,
  },
  magnitudeBadge: {
    backgroundColor: colors.emergency.critical,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  magnitudeText: {
    ...typography.small,
    fontWeight: '700',
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accent.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.accent.primary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 16,
  },
  summaryCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  summaryTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  summaryText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 24,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 20,
  },
  disclaimerText: {
    flex: 1,
    ...typography.small,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  originalButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  originalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  originalButtonText: {
    ...typography.button,
    color: '#fff',
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  noUrlContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noUrlText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 20,
    textAlign: 'center',
  },
  webViewUnavailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  webViewUnavailableTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  webViewUnavailableText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  articleFallbackLoading: {
    alignItems: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  articleFallbackLoadingText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  articleFallbackScroll: {
    maxHeight: 240,
    marginTop: spacing[4],
    marginBottom: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  articleFallbackText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 22,
  },
});


