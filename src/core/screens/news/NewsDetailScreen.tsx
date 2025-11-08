/**
 * NEWS DETAIL SCREEN
 * Displays news article with AI summary and original content
 * Premium feature with 2 tabs: AI Summary + Original Article (WebView)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Linking,
  NativeModules,
  Platform,
  useWindowDimensions,
  Modal,
  Pressable,
} from 'react-native';
import type { WebViewProps } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RenderHTML from 'react-native-render-html';
import { useNavigation } from '@react-navigation/core';
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
}

export default function NewsDetailScreen({ route }: NewsDetailScreenProps) {
  const navigation = useNavigation();
  const { article } = route.params;
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [articleHtml, setArticleHtml] = useState<string>('');
  const [articlePlainText, setArticlePlainText] = useState<string>('');
  const [articleContentLoading, setArticleContentLoading] = useState(false);
  const [articleContentError, setArticleContentError] = useState<string | null>(null);
  const [webViewComponent, setWebViewComponent] = useState<React.ComponentType<WebViewProps> | null>(null);
  const [webViewStatus, setWebViewStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserMode, setBrowserMode] = useState<'webview' | 'html'>('html');

  const hasValidUrl = Boolean(article.url && article.url !== '#');
  const NativeWebView = webViewComponent;
  const showWebView = Boolean(NativeWebView && hasValidUrl && webViewStatus === 'ready');
  const showWebViewLoading = hasValidUrl && webViewStatus === 'loading';
  const { width: windowWidth } = useWindowDimensions();

  const contentWidth = useMemo(() => {
    if (!windowWidth) {
      return 360;
    }
    const horizontalPadding = 32;
    const computed = windowWidth - horizontalPadding;
    return Math.min(Math.max(computed, 320), 820);
  }, [windowWidth]);

  const htmlTagStyles = useMemo(
    () => ({
      div: {
        color: colors.text.primary,
        fontSize: 15,
        lineHeight: 24,
      },
      p: {
        marginBottom: 12,
      },
      h1: {
        fontSize: 24,
        fontWeight: '700' as const,
        marginBottom: 16,
        color: colors.text.primary,
      },
      h2: {
        fontSize: 20,
        fontWeight: '700' as const,
        marginBottom: 14,
        color: colors.text.primary,
      },
      h3: {
        fontSize: 18,
        fontWeight: '700' as const,
        marginBottom: 12,
        color: colors.text.primary,
      },
      ul: {
        marginBottom: 12,
        paddingLeft: 18,
      },
      ol: {
        marginBottom: 12,
        paddingLeft: 18,
      },
      li: {
        marginBottom: 6,
        color: colors.text.primary,
      },
      a: {
        color: colors.accent.primary,
        textDecorationLine: 'underline' as const,
      },
      img: {
        width: '100%',
        height: undefined,
        borderRadius: 12,
        marginVertical: 16,
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: colors.accent.primary,
        paddingLeft: 12,
        marginVertical: 16,
        color: colors.text.secondary,
        fontStyle: 'italic' as const,
      },
      strong: {
        fontWeight: '700' as const,
      },
      em: {
        fontStyle: 'italic' as const,
      },
    }),
    [colors]
  );
  const ignoredDomTags = useMemo(() => ['script', 'style', 'link', 'form', 'input', 'button', 'iframe', 'svg', 'path', 'cwiz'], []);

  const isNativeWebViewRegistered = useCallback(() => {
    const nativeModules = NativeModules as Record<string, unknown>;
    if (nativeModules.RNCWebView || nativeModules.RNCWebViewModule) {
      return true;
    }

    if (Platform.OS === 'ios' && (nativeModules.RNCWKWebView || nativeModules.RNCUIWebView)) {
      return true;
    }

    if (Platform.OS === 'android' && (nativeModules.RNCWebViewManager || nativeModules.RNCWebViewTurboModule)) {
      return true;
    }

    return false;
  }, []);

  const sanitizeArticleHtml = (html: string): string => {
    if (!html) {
      return '';
    }

    let sanitized = html;
    sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '');
    sanitized = sanitized.replace(/<head[\s\S]*?<\/head>/gi, '');
    sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, '');
    sanitized = sanitized.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    sanitized = sanitized.replace(/<header[\s\S]*?<\/header>/gi, '');
    sanitized = sanitized.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    sanitized = sanitized.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

    sanitized = sanitized.replace(/<body[^>]*>/gi, '<div>');
    sanitized = sanitized.replace(/<\/body>/gi, '</div>');
    sanitized = sanitized.replace(/<html[^>]*>/gi, '<div>');
    sanitized = sanitized.replace(/<\/html>/gi, '</div>');

    // Remove inline event handlers and scripts
    sanitized = sanitized.replace(/ on\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/ on\w+='[^']*'/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Normalize line breaks for block-level tags
    sanitized = sanitized.replace(/<(p|div|section|article|h[1-6]|ul|ol|li|blockquote)[^>]*>/gi, '<$1>');

    return sanitized;
  };

  const sanitizeArticleText = (html: string): string => {
    if (!html) {
      return '';
    }

    const withBreaks = html
      .replace(/\r?\n|\r/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, '\n\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, ' ');

    const withoutTags = withBreaks
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u00a0/g, ' ');

    return withoutTags
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n\n');
  };

  const loadArticleContent = useCallback(async () => {
    if (!article.url || article.url === '#') {
      setArticleHtml('');
      setArticlePlainText('');
      setArticleContentError('Bu haber için tam metin bağlantısı sağlanmamış.');
      return;
    }

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
      const sanitizedHtml = sanitizeArticleHtml(rawHtml);
      const plainText = sanitizeArticleText(sanitizedHtml);

      if (sanitizedHtml.length > 0) {
        setArticleHtml(`<div class="afetnet-article">${sanitizedHtml}</div>`);
        setArticlePlainText(plainText);
      } else {
        setArticleHtml('');
        setArticlePlainText('');
        setArticleContentError('Haber içeriği çözümlenemedi.');
      }
    } catch (err) {
      logger.error('Failed to fetch article content:', err);
      setArticleContentError('Haber içeriği yüklenemedi. Tarayıcıda açmayı deneyin.');
      setArticleHtml('');
      setArticlePlainText('');
    } finally {
      setArticleContentLoading(false);
    }
  }, [article.url]);

  useEffect(() => {
    loadAISummary();
  }, []);

  useEffect(() => {
    if (!hasValidUrl) {
      if (webViewStatus !== 'unavailable') {
        setWebViewStatus('unavailable');
      }
      return undefined;
    }

    if (activeTab !== 'original' || webViewStatus !== 'idle') {
      return undefined;
    }

    if (!isNativeWebViewRegistered()) {
      logger.info('Native WebView module not registered; using inline renderer.');
      setWebViewComponent(null);
      setWebViewStatus('unavailable');
      return undefined;
    }

    let isMounted = true;
    setWebViewStatus('loading');

    import('react-native-webview')
      .then((module) => {
        if (!isMounted) {
          return;
        }

        const { WebView } = module;
        if (!WebView) {
          setWebViewComponent(null);
          setWebViewStatus('unavailable');
          return;
        }

        setWebViewComponent(() => WebView as React.ComponentType<WebViewProps>);
        setWebViewStatus('ready');
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        logger.warn('react-native-webview module unavailable; showing inline reader instead.', error);
        setWebViewComponent(null);
        setWebViewStatus('unavailable');
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, hasValidUrl, webViewStatus, isNativeWebViewRegistered]);

  useEffect(() => {
    if (article.url && article.url !== '#') {
      void loadArticleContent();
    }
  }, [article.url, loadArticleContent]);

  useEffect(() => {
    if (
      browserVisible &&
      browserMode === 'html' &&
      hasValidUrl &&
      !articleHtml &&
      !articlePlainText &&
      !articleContentLoading
    ) {
      void loadArticleContent();
    }
  }, [
    browserVisible,
    browserMode,
    hasValidUrl,
    articleHtml,
    articlePlainText,
    articleContentLoading,
    loadArticleContent,
  ]);

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

  const openAfetNetBrowser = () => {
    if (!hasValidUrl) {
      return;
    }

    haptics.impactLight();

    if (showWebView) {
      setBrowserMode('webview');
      setBrowserVisible(true);
      return;
    }

    setBrowserMode('html');
    setBrowserVisible(true);

    if (!articleHtml && !articlePlainText && !articleContentLoading) {
      void loadArticleContent();
    }
  };

  const openExternalBrowser = async () => {
    if (!hasValidUrl) {
      return;
    }

    haptics.impactLight();

    try {
      await Linking.openURL(article.url!);
    } catch (error) {
      logger.error('Failed to open URL with Linking:', error);
    }
  };

  const closeBrowser = () => {
    setBrowserVisible(false);
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
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            haptics.impactLight();
            if (navigation && 'goBack' in navigation) {
              navigation.goBack();
            }
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
          onPress={() => {
            switchTab('original');
            // Orijinal haber tab'ına tıklayınca direkt modal aç
            if (hasValidUrl && !browserVisible) {
              setTimeout(() => {
                openAfetNetBrowser();
              }, 100);
            }
          }}
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
                  Bu özet yapay zeka tarafından oluşturulmuştur. Detaylı bilgi için haber metnini okuyun.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.originalContainer}>
          {!hasValidUrl ? (
            <View style={styles.noUrlContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
              <Text style={styles.noUrlText}>Orijinal haber bağlantısı bulunamadı.</Text>
            </View>
          ) : (
            <View style={styles.originalPromptContainer}>
              <Ionicons name="newspaper-outline" size={64} color={colors.accent.primary} />
              <Text style={styles.originalPromptTitle}>Orijinal Haber</Text>
              <Text style={styles.originalPromptText}>
                Orijinal haberi uygulama içinde görüntülemek için aşağıdaki butona tıklayın.
              </Text>
              <TouchableOpacity style={styles.originalButton} onPress={openAfetNetBrowser}>
                <LinearGradient
                  colors={[colors.accent.primary, colors.accent.secondary]}
                  style={styles.originalButtonGradient}
                >
                  <Ionicons name="open-outline" size={20} color="#fff" />
                  <Text style={styles.originalButtonText}>Orijinal Haberi Aç</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      <Modal
        visible={browserVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeBrowser}
        statusBarTranslucent
      >
        <View style={styles.browserModal}>
          <LinearGradient
            colors={[colors.gradients.header[0], colors.gradients.header[1]]}
            style={[styles.browserHeader, { paddingTop: insets.top + 10 }]}
          >
            <Pressable style={styles.browserCloseButton} onPress={closeBrowser} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </Pressable>

            <View style={styles.browserHeaderCenter}>
              <Text style={styles.browserHeaderTitle} numberOfLines={1}>
                {article.source}
              </Text>
              <Text style={styles.browserHeaderSubtitle} numberOfLines={1}>
                {article.title}
              </Text>
            </View>

            <View style={styles.browserHeaderActions}>
              <Pressable style={styles.browserActionButton} onPress={handleShare} hitSlop={12}>
                <Ionicons name="share-social-outline" size={22} color={colors.text.primary} />
              </Pressable>
              <Pressable style={styles.browserActionButton} onPress={openExternalBrowser} hitSlop={12}>
                <Ionicons name="open-outline" size={22} color={colors.text.primary} />
              </Pressable>
            </View>
          </LinearGradient>

          {browserMode === 'webview' && showWebView ? (
            <NativeWebView
              source={{ uri: article.url ?? '' }}
              style={styles.browserWebView}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.browserLoading}>
                  <ActivityIndicator size="large" color={colors.accent.primary} />
                  <Text style={styles.browserLoadingText}>Orijinal haber yükleniyor...</Text>
                </View>
              )}
              onError={() => {
                logger.warn('In-app WebView failed; falling back to HTML reader.');
                setBrowserMode('html');
              }}
              onHttpError={() => {
                logger.warn('In-app WebView HTTP error; falling back to HTML reader.');
                setBrowserMode('html');
              }}
            />
          ) : (
            <ScrollView style={styles.browserHtmlScroll} contentContainerStyle={styles.browserHtmlContent}>
              {articleContentLoading && !articleHtml && !articlePlainText ? (
                <View style={styles.browserLoading}>
                  <ActivityIndicator size="large" color={colors.accent.primary} />
                  <Text style={styles.browserLoadingText}>Haber içeriği hazırlanıyor...</Text>
                </View>
              ) : articleHtml ? (
                <RenderHTML
                  contentWidth={contentWidth}
                  source={{ html: articleHtml }}
                  defaultTextProps={{ selectable: true }}
                  enableExperimentalMarginCollapsing
                  tagsStyles={htmlTagStyles}
                  ignoredDomTags={ignoredDomTags}
                />
              ) : articlePlainText ? (
                <Text style={styles.browserHtmlText}>{articlePlainText}</Text>
              ) : articleContentError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="warning-outline" size={18} color="#f87171" />
                  <Text style={styles.errorText}>
                    {articleContentError || 'Haber içeriği gösterilemedi. Dış tarayıcıdan açmayı deneyebilirsiniz.'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.browserHtmlText}>İçerik yüklenemedi.</Text>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
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
    paddingTop: 16,
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
  fallbackScroll: {
    flex: 1,
    backgroundColor: colors.background.primary,
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
  originalButtonInline: {
    marginBottom: 0,
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
  browserModal: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  browserHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  browserCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  browserHeaderCenter: {
    flex: 1,
    marginHorizontal: 4,
  },
  browserHeaderTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  browserHeaderSubtitle: {
    ...typography.body,
    color: colors.text.primary,
    marginTop: 4,
  },
  browserHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browserActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  browserWebView: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  browserLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  browserLoadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  browserHtmlScroll: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  browserHtmlContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  browserHtmlText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 24,
  },
  originalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  originalActions: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  webViewLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
    backgroundColor: colors.background.primary,
  },
  articleCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 20,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  articleTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  articleText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 24,
  },
  inlineNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.24)',
    marginBottom: 20,
  },
  inlineNoticeText: {
    flex: 1,
    ...typography.small,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  errorText: {
    flex: 1,
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  noUrlContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noUrlText: {
    marginTop: 16,
    textAlign: 'center',
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  originalPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  originalPromptTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: 24,
    marginBottom: 12,
    fontWeight: '700',
  },
  originalPromptText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
});


