/**
 * NEWS DETAIL SCREEN
 * Displays news article with AI summary and original content
 * Premium feature with 2 tabs: AI Summary + Original Article (WebView)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  StatusBar,
  Alert,
} from 'react-native';
import type { WebViewProps } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RenderHTML from 'react-native-render-html';
import { useNavigation } from '@react-navigation/core';
// ELITE: expo-web-browser kullanımı kaldırıldı - native modül hatası nedeniyle
// Sadece Linking.openURL kullanılıyor (her zaman çalışır, native modül gerektirmez)
import { colors, spacing, typography } from '../../theme';
import { NewsArticle } from '../../ai/types/news.types';
import { newsAggregatorService } from '../../ai/services/NewsAggregatorService';
import { openAIService } from '../../ai/services/OpenAIService';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import ErrorBoundary from '../../components/ErrorBoundary';

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
  
  // CRITICAL: Validate route params and article
  const article = route?.params?.article;
  if (!article || typeof article !== 'object') {
    logger.error('Invalid article in route params:', route?.params);
    // Navigate back if article is invalid
    if (navigation && 'goBack' in navigation) {
      navigation.goBack();
    }
    return null;
  }
  const insets = useSafeAreaInsets();
  
  // CRITICAL: Validate URL with comprehensive type check
  const hasValidUrl = Boolean(
    article && 
    typeof article === 'object' &&
    article.url && 
    typeof article.url === 'string' && 
    article.url.trim() !== '' && 
    article.url !== '#'
  );
  
  // ELITE: Varsayılan olarak AI Özeti sekmesi açık (eskisi gibi)
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
  const [isFullScreen, setIsFullScreen] = useState(false); // ELITE: Tam ekran modu - sadece orijinal haber sekmesine tıklandığında aktif
  const [webViewKey, setWebViewKey] = useState(0); // CRITICAL: WebView'i zorla yeniden yüklemek için key
  const [inAppBrowserVisible, setInAppBrowserVisible] = useState(false); // ELITE: In-app browser modal state
  const [inAppBrowserUrl, setInAppBrowserUrl] = useState<string>(''); // ELITE: In-app browser URL
  const [inAppBrowserWebView, setInAppBrowserWebView] = useState<React.ComponentType<WebViewProps> | null>(null); // ELITE: In-app browser WebView component
  const scrollViewRef = useRef<ScrollView>(null); // ELITE: ScrollView ref for scroll to top
  const webViewRef = useRef<any>(null); // CRITICAL: WebView ref for direct URL loading
  const inAppWebViewRef = useRef<any>(null); // ELITE: In-app browser WebView ref
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
  const ignoredDomTags = useMemo(() => ['script', 'style', 'link', 'form', 'input', 'button', 'iframe', 'svg', 'path', 'c-wiz', 'cwiz', 'c-data'], []);

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
    // CRITICAL: Validate input
    if (!html || typeof html !== 'string') {
      return '';
    }
    
    // CRITICAL: Limit HTML length to prevent DoS
    const MAX_INPUT_LENGTH = 10 * 1024 * 1024; // 10MB max input
    if (html.length > MAX_INPUT_LENGTH) {
      logger.warn('HTML input too large, truncating:', html.length, 'bytes');
      html = html.substring(0, MAX_INPUT_LENGTH);
    }

    let sanitized = html;
    // ELITE: Google News özel tag'lerini temizle
    sanitized = sanitized.replace(/<c-wiz[^>]*>/gi, '<div>');
    sanitized = sanitized.replace(/<\/c-wiz>/gi, '</div>');
    sanitized = sanitized.replace(/<c-data[^>]*>/gi, '');
    sanitized = sanitized.replace(/<\/c-data>/gi, '');
    
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
    // CRITICAL: Validate input
    if (!html || typeof html !== 'string') {
      return '';
    }
    
    // CRITICAL: Limit HTML length to prevent DoS
    const MAX_INPUT_LENGTH = 10 * 1024 * 1024; // 10MB max input
    if (html.length > MAX_INPUT_LENGTH) {
      logger.warn('HTML input too large for text extraction, truncating:', html.length, 'bytes');
      html = html.substring(0, MAX_INPUT_LENGTH);
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
    logger.info('🔵 loadArticleContent çağrıldı');
    // CRITICAL: Validate article and URL
    if (!article || typeof article !== 'object') {
      logger.error('Invalid article in loadArticleContent:', article);
      setArticleHtml('');
      setArticlePlainText('');
      setArticleContentError('Geçersiz haber verisi.');
      setArticleContentLoading(false);
      return;
    }
    
    if (!article.url || typeof article.url !== 'string' || article.url.trim() === '' || article.url === '#') {
      logger.warn('⚠️ Geçersiz URL:', article.url);
      setArticleHtml('');
      setArticlePlainText('');
      setArticleContentError('Bu haber için tam metin bağlantısı sağlanmamış.');
      setArticleContentLoading(false);
      return;
    }
    
    logger.info('🚀 İçerik yükleniyor:', article.url);
    
    // CRITICAL: Validate URL format
    let validatedUrl: string;
    try {
      const urlObj = new URL(article.url.trim());
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setArticleHtml('');
        setArticlePlainText('');
        setArticleContentError('Geçersiz haber bağlantısı.');
        setArticleContentLoading(false);
        return;
      }
      validatedUrl = urlObj.toString();
    } catch (urlError) {
      logger.error('Invalid URL format:', article.url, urlError);
      setArticleHtml('');
      setArticlePlainText('');
      setArticleContentError('Geçersiz haber bağlantısı formatı.');
      setArticleContentLoading(false);
      return;
    }

    // CRITICAL: Declare timeoutId in outer scope for cleanup
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      setArticleContentLoading(true);
      setArticleContentError(null);
      setArticleHtml('');
      setArticlePlainText('');

      // Add timeout for article content fetch
      const controller = new AbortController();
      
      timeoutId = setTimeout(() => {
        controller.abort();
      }, 15000); // 15 second timeout

      const response = await fetch(validatedUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'AfetNet/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      // CRITICAL: Clear timeout on success
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const rawHtml = await response.text();
      
      // CRITICAL: Validate response text
      if (!rawHtml || typeof rawHtml !== 'string' || rawHtml.trim().length === 0) {
        throw new Error('Empty response from server');
      }

      // CRITICAL: Validate HTML content length (prevent DoS)
      const MAX_HTML_LENGTH = 5 * 1024 * 1024; // 5MB max
      if (rawHtml.length > MAX_HTML_LENGTH) {
        logger.warn('Article HTML too large, truncating:', rawHtml.length, 'bytes');
        // Use first 5MB for processing
        const truncatedHtml = rawHtml.substring(0, MAX_HTML_LENGTH);
        const sanitizedHtml = sanitizeArticleHtml(truncatedHtml);
        const plainText = sanitizeArticleText(sanitizedHtml);
        
        if (sanitizedHtml && sanitizedHtml.length > 0) {
          setArticleHtml(`<div class="afetnet-article">${sanitizedHtml}</div>`);
        }
        if (plainText && plainText.length > 0) {
          setArticlePlainText(plainText);
        }
        setArticleContentError(null);
        return;
      }

      const sanitizedHtml = sanitizeArticleHtml(rawHtml);
      const plainText = sanitizeArticleText(sanitizedHtml);

      // CRITICAL: Validate sanitized content
      logger.info('🔵 İçerik işlendi:', {
        sanitizedHtmlLength: sanitizedHtml?.length || 0,
        plainTextLength: plainText?.length || 0,
      });
      
      if ((sanitizedHtml && sanitizedHtml.length > 0) || (plainText && plainText.length > 0)) {
        if (sanitizedHtml && sanitizedHtml.length > 0) {
          const finalHtml = `<div class="afetnet-article">${sanitizedHtml}</div>`;
          setArticleHtml(finalHtml);
          logger.info('✅ HTML içeriği set edildi:', finalHtml.length, 'karakter');
        }
        if (plainText && plainText.length > 0) {
          // Limit plain text length to prevent UI issues
          const MAX_PLAINTEXT_LENGTH = 50000; // 50KB max
          const finalPlainText = plainText.length > MAX_PLAINTEXT_LENGTH
            ? plainText.substring(0, MAX_PLAINTEXT_LENGTH) + '\n\n[... İçerik çok uzun, tam metin için dış tarayıcıdan açın ...]'
            : plainText;
          setArticlePlainText(finalPlainText);
          logger.info('✅ Plain text içeriği set edildi:', finalPlainText.length, 'karakter');
        }
        setArticleContentError(null);
        logger.info('✅ İçerik başarıyla yüklendi');
      } else {
        logger.warn('⚠️ İçerik boş veya geçersiz');
        setArticleHtml('');
        setArticlePlainText('');
        setArticleContentError('Haber içeriği çözümlenemedi. Dış tarayıcıdan açmayı deneyin.');
      }
    } catch (err: any) {
      // CRITICAL: Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      logger.error('Failed to fetch article content:', err);
      
      // Handle different error types
      if (err?.name === 'AbortError' || err?.message?.includes('timeout')) {
        setArticleContentError('Haber içeriği yüklenirken zaman aşımı oluştu. Dış tarayıcıdan açmayı deneyin.');
      } else if (err?.message?.includes('Network request failed') || err?.message?.includes('network')) {
        setArticleContentError('İnternet bağlantısı sorunu. Lütfen bağlantınızı kontrol edin.');
      } else {
        setArticleContentError('Haber içeriği yüklenemedi. Dış tarayıcıdan açmayı deneyin.');
      }
      
      setArticleHtml('');
      setArticlePlainText('');
    } finally {
      // CRITICAL: Ensure timeout is cleared in finally block
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setArticleContentLoading(false);
    }
  }, [article.url]);

  useEffect(() => {
    // Load AI summary when component mounts or article changes
    loadAISummary();
    
    // ELITE: Scroll to top when article changes - ensure content starts from top
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id]); // Re-load if article changes (loadAISummary is memoized with article dependency)
  
  // ELITE: Orijinal haber sekmesine geçildiğinde Safari'de aç (HTML parse yerine)
  useEffect(() => {
    if (activeTab === 'original' && hasValidUrl && article.url) {
      logger.info('✅ Orijinal haber sekmesi aktif, Safari\'de açılıyor:', article.url);
      
      // ELITE: HTML parse etmek yerine direkt Safari'de aç
      // Bu Google News gibi karmaşık siteler için daha güvenilir
      const openInSafari = async () => {
        try {
          // ELITE: Linking.openURL kullan (her zaman çalışır, native modül gerektirmez)
          logger.info('🚀 Opening URL in Safari using Linking:', article.url);
          const canOpen = await Linking.canOpenURL(article.url);
          
          if (canOpen) {
            await Linking.openURL(article.url);
            logger.info('✅ URL opened in Safari successfully');
          } else {
            logger.warn('⚠️ URL cannot be opened, falling back to HTML parse');
            // Son fallback: HTML parse et
            if (!articleHtml && !articlePlainText && !articleContentLoading) {
              loadArticleContent().catch((error) => {
                logger.error('Failed to load article content:', error);
              });
            }
          }
        } catch (error: any) {
          logger.error('⚠️ Failed to open URL in Safari:', error?.message);
          // Son fallback: HTML parse et
          if (!articleHtml && !articlePlainText && !articleContentLoading) {
            loadArticleContent().catch((err) => {
              logger.error('Failed to load article content:', err);
            });
          }
        }
      };
      
      // Küçük bir delay ile aç (UI hazır olsun)
      const timeoutId = setTimeout(() => {
        openInSafari();
      }, 300);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hasValidUrl, article.url]);
  
  useEffect(() => {
    // ELITE: Scroll to top when tab changes to summary - ensure content starts from top
    if (activeTab === 'summary' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 50);
    }
  }, [activeTab]);
  
  // ELITE: Scroll to top on initial mount
  useEffect(() => {
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
    }, 100);
  }, []);

  // ELITE: WebView'i sadece "Orijinal Haber" sekmesi aktif olduğunda yükle
  useEffect(() => {
    if (!hasValidUrl || activeTab !== 'original') {
      if (activeTab !== 'original') {
        logger.debug('AI Özeti sekmesi aktif, WebView yüklenmiyor');
        return;
      }
      if (webViewStatus !== 'unavailable') {
        setWebViewStatus('unavailable');
      }
      return undefined;
    }

    // WebView zaten yüklenmişse tekrar yükleme
    if (webViewStatus === 'ready' || webViewStatus === 'loading') {
      return undefined;
    }

    // WebView'i hemen yükle (tab değişikliğini bekleme)
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    // CRITICAL: Status'u sadece bir kez set et
    setWebViewStatus('loading');

    // CRITICAL: Önce native WebView modülünü kontrol et
    // Eğer native modül kayıtlı değilse, direkt fallback'e geç (hata verme)
    if (!isNativeWebViewRegistered()) {
      logger.debug('Native WebView module not registered; skipping WebView load, using HTML fallback.');
      if (isMounted) {
        setWebViewComponent(null);
        setWebViewStatus('unavailable');
      }
      return undefined;
    }

    // CRITICAL: Try-catch ile WebView import'unu güvenli şekilde yükle
    const loadWebView = async () => {
      try {
        const module = await import('react-native-webview');
        
        if (!isMounted) {
          return;
        }

        // ELITE: WebView'i farklı şekillerde kontrol et
        let WebView = null;
        
        logger.debug('🔍 loadWebView modül detayları:', {
          hasWebView: !!module?.WebView,
          hasDefault: !!module?.default,
          defaultType: typeof module?.default,
          defaultValue: module?.default,
          keys: Object.keys(module || {}),
          allKeys: Object.getOwnPropertyNames(module || {}),
        });
        
        if (module?.WebView) {
          WebView = module.WebView;
          logger.debug('✅ WebView bulundu (destructure method 1)');
        } else if (module?.default) {
          try {
            const defaultExport = module.default;
            if (defaultExport && typeof defaultExport === 'object' && !Array.isArray(defaultExport) && 'WebView' in defaultExport) {
              WebView = (defaultExport as any).WebView;
              logger.debug('✅ WebView bulundu (destructure method 2a: default.WebView)');
            } else if (typeof defaultExport === 'function' || (defaultExport && typeof (defaultExport as any).render === 'function')) {
              WebView = defaultExport;
              logger.debug('✅ WebView bulundu (destructure method 2b: default as component)');
            } else if (typeof defaultExport === 'object') {
              const { WebView: DestructuredWebView } = defaultExport as any;
              if (DestructuredWebView) {
                WebView = DestructuredWebView;
                logger.debug('✅ WebView bulundu (destructure method 2c: destructured from default)');
              }
            }
          } catch (e: any) {
            logger.debug('Default export işlenirken hata:', e?.message);
          }
        } else if (module?.default && typeof module.default === 'object' && 'WebView' in module.default) {
          WebView = (module.default as any).WebView;
          logger.debug('✅ WebView bulundu (destructure method 3)');
        } else if (module?.default && typeof module.default === 'function') {
          WebView = module.default;
          logger.debug('✅ WebView bulundu (destructure method 4)');
        } else {
          // Fallback: Destructure dene
          try {
            const { WebView: DestructuredWebView } = module;
            if (DestructuredWebView) {
              WebView = DestructuredWebView;
              logger.debug('✅ WebView bulundu (destructure fallback)');
            }
          } catch (e) {
            // Ignore
          }
        }
        
        if (!WebView) {
          logger.warn('⚠️ WebView component not found in module. Modül yapısı:', {
            hasWebView: !!module?.WebView,
            hasDefault: !!module?.default,
            defaultType: typeof module?.default,
            keys: Object.keys(module || {}),
          });
          if (isMounted) {
          setWebViewComponent(null);
          setWebViewStatus('unavailable');
          }
          return;
        }

        // CRITICAL: WebView component'i render edilebilir mi kontrol et
        try {
          // Test render (sadece kontrol için)
          if (typeof WebView !== 'function' && typeof WebView !== 'object') {
            throw new Error('WebView is not a valid component');
          }
        } catch (testError) {
          logger.debug('WebView component validation failed:', testError);
          if (isMounted) {
            setWebViewComponent(null);
            setWebViewStatus('unavailable');
          }
          return;
        }

        logger.info('✅ WebView loaded successfully');
        if (isMounted) {
        setWebViewComponent(() => WebView as React.ComponentType<WebViewProps>);
        setWebViewStatus('ready');
        }
      } catch (error: any) {
        if (!isMounted) {
          return;
        }
        
        // CRITICAL: RNCWebViewModule hatası özel olarak handle et
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('RNCWebViewModule') || errorMessage.includes('TurboModuleRegistry')) {
          logger.debug('⚠️ WebView native module not available (expected in Expo Go), using HTML fallback');
        } else {
          logger.debug('⚠️ react-native-webview module unavailable:', errorMessage);
        }
        
        if (isMounted) {
        setWebViewComponent(null);
        setWebViewStatus('unavailable');
        }
      }
    };

    // CRITICAL: Load WebView with timeout
    timeoutId = setTimeout(() => {
      if (isMounted) {
        logger.debug('WebView load timeout, using HTML fallback');
        setWebViewComponent(null);
        setWebViewStatus('unavailable');
      }
    }, 2000); // 2 second timeout

    loadWebView().finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      });

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // CRITICAL: webViewStatus dependency'sini kaldır - sonsuz döngüyü önlemek için
    // ELITE: activeTab dependency'si eklendi - Orijinal Haber sekmesine geçildiğinde WebView yüklensin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValidUrl, article.url, activeTab]);

  // ELITE: Modal açıldığında WebView'i yükle
  useEffect(() => {
    if (inAppBrowserVisible && inAppBrowserUrl && !NativeWebView && !inAppBrowserWebView) {
      logger.info('🔵 Modal açıldı, WebView yükleniyor...');
      import('react-native-webview')
        .then((module) => {
          logger.info('🔵 react-native-webview modülü yüklendi (useEffect):', !!module);
          
          // ELITE: WebView'i farklı şekillerde kontrol et
          let WebViewComponent = null;
          
          logger.info('🔍 useEffect WebView modül detayları:', {
            hasWebView: !!module?.WebView,
            hasDefault: !!module?.default,
            defaultType: typeof module?.default,
            defaultValue: module?.default,
            keys: Object.keys(module || {}),
            allKeys: Object.getOwnPropertyNames(module || {}),
          });
          
          if (module?.WebView) {
            WebViewComponent = module.WebView;
            logger.info('✅ WebView bulundu (useEffect method 1)');
          } else if (module?.default) {
            try {
              const defaultExport = module.default;
            if (defaultExport && typeof defaultExport === 'object' && !Array.isArray(defaultExport) && 'WebView' in defaultExport) {
              WebViewComponent = (defaultExport as any).WebView;
              logger.info('✅ WebView bulundu (useEffect method 2a: default.WebView)');
            } else if (typeof defaultExport === 'function' || (defaultExport && typeof (defaultExport as any).render === 'function')) {
                WebViewComponent = defaultExport;
                logger.info('✅ WebView bulundu (useEffect method 2b: default as component)');
              } else if (typeof defaultExport === 'object') {
                const { WebView: DestructuredWebView } = defaultExport as any;
                if (DestructuredWebView) {
                  WebViewComponent = DestructuredWebView;
                  logger.info('✅ WebView bulundu (useEffect method 2c: destructured from default)');
                }
              }
            } catch (e: any) {
              logger.warn('⚠️ useEffect default export işlenirken hata:', e?.message);
            }
          } else if (module?.default && typeof module.default === 'object' && 'WebView' in module.default) {
            WebViewComponent = (module.default as any).WebView;
            logger.info('✅ WebView bulundu (useEffect method 3)');
          } else if (module?.default && typeof module.default === 'function') {
            WebViewComponent = module.default;
            logger.info('✅ WebView bulundu (useEffect method 4)');
          }
          
          if (WebViewComponent) {
            const WebViewTyped = WebViewComponent as React.ComponentType<WebViewProps>;
            logger.info('✅ WebView yüklendi (modal useEffect)');
            setInAppBrowserWebView(WebViewTyped);
            if (!NativeWebView) {
              setWebViewComponent(WebViewTyped);
            }
          } else {
            logger.warn('⚠️ Modal useEffect: WebView component bulunamadı. Modül yapısı:', {
              hasWebView: !!module?.WebView,
              hasDefault: !!module?.default,
              keys: Object.keys(module || {}),
            });
          }
        })
        .catch((e: any) => {
          logger.error('❌ Modal useEffect: WebView yüklenemedi:', e?.message || e);
        });
    }
  }, [inAppBrowserVisible, inAppBrowserUrl, NativeWebView, inAppBrowserWebView]);

  useEffect(() => {
    // Load article content when URL is available
    if (article.url && article.url !== '#') {
      loadArticleContent().catch((error) => {
        logger.error('Failed to load article content:', error);
      });
    } else {
      // Clear content if URL is invalid
      setArticleHtml('');
      setArticlePlainText('');
      setArticleContentError('Bu haber için tam metin bağlantısı sağlanmamış.');
    }
  }, [article.url, loadArticleContent]);

  useEffect(() => {
    // CRITICAL: Modal açıldığında içeriği garantili olarak yükle
    if (
      browserVisible &&
      browserMode === 'html' &&
      hasValidUrl &&
      article.url
    ) {
      // İçerik yüklenmemişse veya boşsa, yükle
      const needsLoad = !articleHtml || 
                       !articlePlainText || 
                       (articleHtml && articleHtml.trim().length === 0) ||
                       (articlePlainText && articlePlainText.trim().length === 0);
      
      if (needsLoad && !articleContentLoading) {
        logger.info('🔵 Modal açıldı, HTML içeriği yükleniyor...');
      loadArticleContent().catch((error) => {
        logger.error('Failed to load article content:', error);
      });
      } else {
        logger.info('🔵 Modal açıldı, HTML içeriği durumu:', {
          hasHtml: !!articleHtml,
          hasPlainText: !!articlePlainText,
          isLoading: articleContentLoading,
          htmlLength: articleHtml?.length || 0,
          plainTextLength: articlePlainText?.length || 0,
        });
      }
    }
    // CRITICAL: loadArticleContent zaten memoized, dependency'den çıkar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    browserVisible,
    browserMode,
    hasValidUrl,
    article.url,
    articleHtml,
    articlePlainText,
    articleContentLoading,
  ]);

  const cleanAISummary = (text: string): string => {
    // CRITICAL: Validate input
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Remove HTML tags but preserve text content
    let cleaned = text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // CRITICAL: Limit summary length to prevent overly long summaries
    // Max 2000 characters (approximately 400-500 words)
    const MAX_SUMMARY_LENGTH = 2000;
    if (cleaned.length > MAX_SUMMARY_LENGTH) {
      // Truncate at sentence boundary if possible
      const truncated = cleaned.substring(0, MAX_SUMMARY_LENGTH);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?')
      );
      
      if (lastSentenceEnd > MAX_SUMMARY_LENGTH * 0.8) {
        // If we found a sentence end in the last 20%, use it
        cleaned = truncated.substring(0, lastSentenceEnd + 1) + '...';
      } else {
        // Otherwise, truncate at word boundary
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > MAX_SUMMARY_LENGTH * 0.8) {
          cleaned = truncated.substring(0, lastSpace) + '...';
        } else {
          cleaned = truncated + '...';
        }
      }
    }
    
    return cleaned;
  };

  const loadAISummary = useCallback(async () => {
    try {
      setLoading(true);
      setAiSummary(''); // Clear previous summary
      
      // CRITICAL: Validate article before processing
      if (!article || typeof article !== 'object') {
        logger.error('Invalid article in loadAISummary:', article);
        setAiSummary('Geçersiz haber verisi.');
        setLoading(false);
        return;
      }
      
      // Ensure OpenAI service is initialized
      if (!openAIService.isConfigured()) {
        try {
          await openAIService.initialize();
        } catch (initError) {
          logger.debug('OpenAI initialization attempt failed:', initError);
        }
      }
      
      let summary: string;
      try {
        summary = await newsAggregatorService.summarizeArticle(article);
        // CRITICAL: Validate summary response
        if (!summary || typeof summary !== 'string') {
          throw new Error('Invalid summary response from service');
        }
      } catch (summaryError) {
        logger.error('Failed to get summary from service:', summaryError);
        // Use fallback
        const fallbackTitle = (article.title && typeof article.title === 'string') 
          ? article.title.trim() 
          : '';
        const fallbackSummary = (article.summary && typeof article.summary === 'string')
          ? article.summary.trim()
          : '';
        const fallback = fallbackSummary || fallbackTitle || 'Özet oluşturulamadı.';
        setAiSummary(cleanAISummary(fallback));
        setLoading(false);
        return;
      }
      
      // Clean HTML tags from AI summary
      const cleanedSummary = cleanAISummary(summary);
      
      // CRITICAL: Validate cleaned summary
      if (cleanedSummary && cleanedSummary.trim().length > 0) {
        setAiSummary(cleanedSummary);
      } else {
        // If summary is empty, use fallback with validation
        const fallbackTitle = (article.title && typeof article.title === 'string') 
          ? article.title.trim() 
          : '';
        const fallbackSummary = (article.summary && typeof article.summary === 'string')
          ? article.summary.trim()
          : '';
        const fallback = fallbackSummary || fallbackTitle || 'Özet oluşturulamadı.';
        setAiSummary(cleanAISummary(fallback));
      }
    } catch (error) {
      logger.error('Failed to load AI summary:', error);
      // CRITICAL: Safe fallback with validation
      const fallbackTitle = (article?.title && typeof article.title === 'string') 
        ? article.title.trim() 
        : '';
      const fallbackSummary = (article?.summary && typeof article.summary === 'string')
        ? article.summary.trim()
        : '';
      const fallback = fallbackSummary || fallbackTitle || 'Özet oluşturulamadı.';
      setAiSummary(cleanAISummary(fallback));
    } finally {
      setLoading(false);
    }
  }, [article]);

  const handleShare = async () => {
    haptics.impactLight();
    try {
      // CRITICAL: Validate article and URL before sharing
      if (!article || typeof article !== 'object') {
        logger.error('Invalid article in handleShare');
        return;
      }
      
      const shareTitle = (article.title && typeof article.title === 'string') ? article.title.trim() : 'Haber';
      const shareUrl = (article.url && typeof article.url === 'string' && article.url !== '#') ? article.url.trim() : '';
      
      if (!shareUrl) {
        logger.warn('Cannot share: no valid URL');
        return;
      }
      
      await Share.share({
        title: shareTitle,
        message: `${shareTitle}\n\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      logger.error('Failed to share:', error);
    }
  };

  const openAfetNetBrowser = async () => {
    if (!hasValidUrl) {
      Alert.alert(
        'URL Bulunamadı',
        'Bu haber için geçerli bir bağlantı bulunamadı.',
        [{ text: 'Tamam', style: 'default' }]
      );
      return;
    }

    haptics.impactMedium();

      // ELITE: Linking.openURL kullan (her zaman çalışır, native modül gerektirmez)
    try {
      // CRITICAL: Validate URL before opening
      if (!article || typeof article !== 'object' || !article.url || typeof article.url !== 'string') {
        logger.error('Invalid article or URL in openAfetNetBrowser');
        Alert.alert(
          'Hata',
          'Geçersiz haber verisi.',
          [{ text: 'Tamam', style: 'default' }]
        );
        return;
      }
      
      const urlToOpen = article.url.trim();
      if (urlToOpen === '' || urlToOpen === '#') {
        logger.warn('Cannot open: invalid URL');
        Alert.alert(
          'URL Bulunamadı',
          'Bu haber için geçerli bir bağlantı bulunamadı.',
          [{ text: 'Tamam', style: 'default' }]
        );
        return;
      }
      
      // CRITICAL: Validate URL format
      try {
        const urlObj = new URL(urlToOpen);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          logger.warn('Cannot open: invalid URL protocol');
          Alert.alert(
            'Geçersiz URL',
            'Bu haber bağlantısı geçersiz.',
            [{ text: 'Tamam', style: 'default' }]
          );
          return;
        }
      } catch (urlError) {
        logger.error('Invalid URL format:', urlError);
        Alert.alert(
          'Geçersiz URL',
          'Bu haber bağlantısı geçersiz format.',
          [{ text: 'Tamam', style: 'default' }]
        );
        return;
      }
      
      // ELITE: Linking.openURL ile Safari'de aç (her zaman çalışır)
      const canOpen = await Linking.canOpenURL(urlToOpen);
      if (!canOpen) {
        Alert.alert(
          'Tarayıcı Açılamadı',
          'Bu bağlantıyı açmak için uygun bir tarayıcı bulunamadı.',
          [{ text: 'Tamam', style: 'default' }]
        );
        return;
      }
      
      await Linking.openURL(urlToOpen);
      logger.info(`✅ Opening URL in external browser:`, urlToOpen);
    } catch (error: any) {
      logger.error('Failed to open URL:', error);
      Alert.alert(
        'Hata',
        'Haber bağlantısı açılırken bir hata oluştu. Lütfen tekrar deneyin.',
        [
          { 
            text: 'Tekrar Dene', 
            onPress: openAfetNetBrowser,
            style: 'default'
          },
          { text: 'Tamam', style: 'cancel' }
        ]
      );
    }
  };

  // BASIT: Uygulama içinde web sitesi açmak - tüm uygulamalarda olduğu gibi
  const openExternalBrowser = useCallback(async () => {
    logger.info('🔵 openExternalBrowser çağrıldı');
    haptics.impactMedium();

    if (!hasValidUrl || !article?.url) {
      logger.warn('⚠️ URL bulunamadı');
      Alert.alert('URL Bulunamadı', 'Bu haber için geçerli bir bağlantı bulunamadı.');
        return;
      }
      
    let url = article.url.trim();
    if (!url || url === '#') {
      logger.warn('⚠️ Geçersiz URL:', url);
      Alert.alert('URL Bulunamadı', 'Bu haber için geçerli bir bağlantı bulunamadı.');
        return;
      }
      
    // URL'i düzelt
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    logger.info('🚀 URL açılıyor:', url);
    
    try {
      // ELITE: Linking.openURL kullan (her zaman çalışır, native modül gerektirmez)
      // Önce Linking.openURL ile Safari'de açmayı dene
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          logger.info('✅ URL opened in Safari using Linking');
          return;
        }
      } catch (linkingError: any) {
        logger.debug('Linking.openURL failed, trying WebView fallback:', linkingError?.message);
      }
      
      logger.info('🔵 Linking.openURL başarısız, WebView deneniyor...');
      
      // 2. SONRA: WebView Modal (fallback)
      // WebView'i dinamik olarak yükle
      let webViewToUse = NativeWebView || inAppBrowserWebView;
      logger.info('🔵 Mevcut WebView:', { NativeWebView: !!NativeWebView, inAppBrowserWebView: !!inAppBrowserWebView });
      
      if (!webViewToUse) {
        logger.info('🔵 WebView yok, dinamik yükleniyor...');
        try {
          const webViewModule = await import('react-native-webview');
          logger.info('🔵 react-native-webview modülü yüklendi:', !!webViewModule);
          
          // ELITE: WebView'i farklı şekillerde kontrol et
          let WebViewComponent = null;
          
          logger.info('🔍 WebView modül detayları:', {
            hasWebView: !!webViewModule?.WebView,
            hasDefault: !!webViewModule?.default,
            defaultType: typeof webViewModule?.default,
            defaultValue: webViewModule?.default,
            moduleType: typeof webViewModule,
            keys: Object.keys(webViewModule || {}),
            allKeys: Object.getOwnPropertyNames(webViewModule || {}),
          });
          
          // Method 1: webViewModule.WebView
          if (webViewModule?.WebView) {
            WebViewComponent = webViewModule.WebView;
            logger.info('✅ WebView bulundu (method 1: WebView)');
          }
          // Method 2: Destructure from default
          else if (webViewModule?.default) {
            try {
              const defaultExport = webViewModule.default;
              // Try to get WebView from default
              if (defaultExport && typeof defaultExport === 'object' && !Array.isArray(defaultExport) && 'WebView' in defaultExport) {
                WebViewComponent = (defaultExport as any).WebView;
                logger.info('✅ WebView bulundu (method 2a: default.WebView)');
              }
              // Try default as WebView component itself
              else if (typeof defaultExport === 'function' || (defaultExport && typeof (defaultExport as any).render === 'function')) {
                WebViewComponent = defaultExport;
                logger.info('✅ WebView bulundu (method 2b: default as component)');
              }
              // Try destructuring from default
              else if (typeof defaultExport === 'object') {
                const { WebView: DestructuredWebView } = defaultExport as any;
                if (DestructuredWebView) {
                  WebViewComponent = DestructuredWebView;
                  logger.info('✅ WebView bulundu (method 2c: destructured from default)');
                }
              }
            } catch (e: any) {
              logger.warn('⚠️ Default export işlenirken hata:', e?.message);
            }
          }
          // Method 3: webViewModule.default?.WebView (fallback)
          else if (webViewModule?.default && typeof webViewModule.default === 'object' && 'WebView' in webViewModule.default) {
            WebViewComponent = (webViewModule.default as any).WebView;
            logger.info('✅ WebView bulundu (method 3: default.WebView)');
          }
          // Method 4: webViewModule (eğer direkt component ise)
          else if (typeof webViewModule === 'function') {
            WebViewComponent = webViewModule;
            logger.info('✅ WebView bulundu (method 4: module as component)');
          }
          // Method 5: Try require syntax (for compatibility)
          else {
            try {
              // @ts-ignore
              const requireModule = require('react-native-webview');
              if (requireModule?.WebView) {
                WebViewComponent = requireModule.WebView;
                logger.info('✅ WebView bulundu (method 5: require.WebView)');
              } else if (requireModule?.default?.WebView) {
                WebViewComponent = requireModule.default.WebView;
                logger.info('✅ WebView bulundu (method 5: require.default.WebView)');
              }
            } catch (requireError: any) {
              logger.debug('Require method failed:', requireError?.message);
            }
          }
          
          if (WebViewComponent) {
            webViewToUse = WebViewComponent as React.ComponentType<WebViewProps>;
            logger.info('✅ WebView component hazır, state güncelleniyor...');
            setInAppBrowserWebView(webViewToUse);
            // Ana WebView component'ini de güncelle
            if (!NativeWebView) {
              setWebViewComponent(webViewToUse);
            }
            logger.info('✅ WebView state güncellendi');
          } else {
            logger.warn('⚠️ WebView component modülde bulunamadı. Modül yapısı:', {
              hasWebView: !!webViewModule?.WebView,
              hasDefault: !!webViewModule?.default,
              defaultType: typeof webViewModule?.default,
              moduleType: typeof webViewModule,
              keys: Object.keys(webViewModule || {}),
            });
          }
        } catch (e: any) {
          logger.error('❌ WebView yüklenemedi:', e?.message || e);
        }
      }
      
      if (webViewToUse) {
        // WebView yüklü, modal'ı aç (uygulama içinde)
        logger.info('✅ WebView hazır, modal açılıyor (uygulama içinde)...');
        setInAppBrowserUrl(url);
        setInAppBrowserVisible(true);
        logger.info('✅ WebView modal açıldı (uygulama içinde)');
        return;
      }
      
      // CRITICAL: WebView yoksa eski browser modal'ı kullan (HTML fallback ile)
      logger.warn('⚠️ WebView yüklenemedi, HTML fallback modal açılıyor...');
      logger.info('🔵 HTML fallback modal açılıyor - browserVisible:', browserVisible);
      
      // CRITICAL: Önce içeriği yükle, sonra modal'ı aç
      // İçerik yüklenmemişse veya yükleniyorsa, modal açıldıktan sonra yüklenecek
      setBrowserMode('html');
      setBrowserVisible(true);
      logger.info('✅ browserVisible set to true');
      
      // CRITICAL: İçeriği garantili olarak yükle (her zaman)
      // useEffect hook'u da kontrol edecek ama burada da yükleyelim
      if (!articleHtml && !articlePlainText && !articleContentLoading) {
        logger.info('🔵 HTML içeriği yükleniyor (openExternalBrowser)...');
        loadArticleContent().catch((error) => {
          logger.error('Failed to load article content for HTML fallback:', error);
        });
      } else {
        logger.info('🔵 HTML içeriği durumu:', {
          hasHtml: !!articleHtml,
          hasPlainText: !!articlePlainText,
          isLoading: articleContentLoading,
          htmlLength: articleHtml?.length || 0,
          plainTextLength: articlePlainText?.length || 0,
        });
        // İçerik varsa ama boşsa, tekrar yükle
        if ((articleHtml && articleHtml.trim().length === 0) || (articlePlainText && articlePlainText.trim().length === 0)) {
          logger.info('🔵 HTML içeriği boş, tekrar yükleniyor...');
          loadArticleContent().catch((error) => {
            logger.error('Failed to reload article content:', error);
          });
        }
      }
      logger.info('✅ HTML fallback modal açıldı ve içerik yükleniyor');
      return;
      
      // NOT REACHED: External browser fallback kaldırıldı - her zaman uygulama içinde açılmalı
      logger.warn('⚠️ Tüm in-app yöntemler başarısız, external browser deneniyor...');
      
      // 3. SON ÇARE: External browser (sadece gerçekten gerekirse)
      try {
        const canOpen = await Promise.race([
          Linking.canOpenURL(url),
          new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        
        if (canOpen) {
          await Promise.race([
            Linking.openURL(url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
          logger.info('✅ External browser ile açıldı');
        } else {
          throw new Error('URL açılamıyor');
        }
    } catch (error: any) {
        logger.error('❌ External browser hatası:', error?.message || error);
        Alert.alert('Hata', 'Web sayfası açılamadı. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.');
      }
    } catch (error: any) {
      logger.error('❌ Tüm yöntemler başarısız:', error?.message || error);
      Alert.alert('Hata', 'Web sayfası açılamadı. Lütfen tekrar deneyin.');
    }
  }, [article?.url, hasValidUrl, NativeWebView, inAppBrowserWebView, loadArticleContent, articleHtml, articlePlainText, articleContentLoading, browserVisible]);

  const closeBrowser = () => {
    setBrowserVisible(false);
  };

  const switchTab = (tab: TabType) => {
    haptics.impactLight();
    setActiveTab(tab);
    // ELITE: Tam ekran modunu kaldır - AI Özet sayfası gibi normal görünüm
    setIsFullScreen(false);
    if (tab === 'original') {
      // CRITICAL: Orijinal haber içeriğini otomatik yükle (hem WebView hem HTML fallback için)
      if (hasValidUrl) {
        // WebView için içerik yükleme (eğer yüklenmediyse)
        if (!articleHtml && !articlePlainText && !articleContentLoading) {
          logger.info('Orijinal haber sekmesine geçildi, içerik yükleniyor...', article.url);
          loadArticleContent().catch((error) => {
            logger.error('Failed to auto-load article content:', error);
          });
        }
        // CRITICAL: WebView'i zorla yeniden yükle (eğer hazırsa)
        if (webViewStatus === 'ready' && NativeWebView && article.url) {
          logger.info('WebView hazır, URL zorla yükleniyor:', article.url);
          // CRITICAL: WebView key'ini değiştirerek zorla yeniden yükle
          setWebViewKey(prev => prev + 1);
          // CRITICAL: WebView ref ile direkt URL yükle
          setTimeout(() => {
            if (webViewRef.current && article.url) {
              try {
                webViewRef.current.reload();
                logger.info('WebView reload edildi:', article.url);
              } catch (error) {
                logger.warn('WebView reload hatası:', error);
              }
            }
          }, 100);
        } else if (webViewStatus === 'unavailable' && hasValidUrl) {
          // WebView yoksa HTML fallback içeriğini yükle
          logger.info('WebView yok, HTML fallback içeriği yükleniyor...', article.url);
          if (!articleHtml && !articlePlainText && !articleContentLoading) {
            loadArticleContent().catch((error) => {
              logger.error('Failed to load HTML fallback content:', error);
            });
          }
        } else if (webViewStatus === 'idle' && hasValidUrl) {
          // WebView henüz yüklenmediyse, yüklemeyi tetikle
          logger.info('WebView henüz yüklenmedi, yükleme tetikleniyor...', article.url);
          // useEffect otomatik olarak yükleyecek
        }
      }
    } else {
      // AI Özeti sekmesine geçildiğinde tam ekran modunu kapat
      setIsFullScreen(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ELITE: StatusBar - her zaman göster */}
      <StatusBar 
        translucent={true} 
        barStyle="light-content" 
        backgroundColor="transparent"
      />
      
      {/* ELITE: Header ve tabs her zaman gösterilir */}
      <>
      {/* Header */}
      <LinearGradient
        colors={[colors.gradients.header[0], colors.gradients.header[1]]}
            style={[styles.header, { paddingTop: Math.max(insets.top - 24, 0) }]}
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
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {(article.source && typeof article.source === 'string') ? article.source : 'Haber'}
          </Text>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Article Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>
          {(article.title && typeof article.title === 'string') ? article.title : 'Haber'}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {(article.source && typeof article.source === 'string') ? article.source : 'Kaynak'}
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>
            {article.publishedAt && typeof article.publishedAt === 'number' && !isNaN(article.publishedAt)
              ? new Date(article.publishedAt).toLocaleDateString('tr-TR')
              : 'Tarih bilgisi yok'}
          </Text>
          {article.magnitude && typeof article.magnitude === 'number' && !isNaN(article.magnitude) && (
            <>
              <Text style={styles.metaDot}>•</Text>
              <View style={styles.magnitudeBadge}>
                <Text style={styles.magnitudeText}>{article.magnitude.toFixed(1)}</Text>
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
      </>

      {/* Content */}
      {activeTab === 'summary' ? (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          contentContainerStyle={styles.contentPadding}
          showsVerticalScrollIndicator={true}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
        >
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
                {aiSummary && aiSummary.trim().length > 0 ? (
                  <Text style={styles.summaryText} selectable={true}>{aiSummary}</Text>
                ) : (
                  <View style={styles.emptySummaryContainer}>
                    <Ionicons name="information-circle-outline" size={24} color={colors.text.tertiary} />
                    <Text style={styles.emptySummaryText}>
                      Özet oluşturulamadı. Orijinal haber sekmesinden haberin tamamını okuyabilirsiniz.
                    </Text>
                  </View>
                )}
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
        // ELITE: Orijinal haber - Safari View Controller açılıyor (HTML parse yerine)
        <>
          {!hasValidUrl ? (
            <View style={styles.noUrlContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
              <Text style={styles.noUrlText}>Orijinal haber bağlantısı bulunamadı.</Text>
            </View>
          ) : (
            // ELITE: Safari View Controller açılıyor - içerik Safari'de gösterilecek
            <ScrollView 
              ref={scrollViewRef}
              style={styles.content} 
              contentContainerStyle={styles.contentPadding}
              showsVerticalScrollIndicator={true}
              contentInsetAdjustmentBehavior="never"
              bounces={false}
            >
              <View style={styles.htmlFallbackContainer}>
              {(() => {
                // ELITE: Safari'de açılıyor mesajı
                return (
                  <View style={styles.emptyContentContainer}>
                    <Ionicons name="globe-outline" size={64} color={colors.accent.primary} />
                    <Text style={styles.emptyContentText}>
                      Haber içeriği Safari'de açılıyor...
                    </Text>
                    <Text style={[styles.emptyContentText, { marginTop: 8, fontSize: 14 }]}>
                      Safari açılmadıysa, aşağıdaki butona tıklayın.
                    </Text>
                    <TouchableOpacity
                      style={styles.originalButton}
                      onPress={openExternalBrowser}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[colors.accent.primary, colors.accent.secondary]}
                        style={styles.originalButtonGradient}
                      >
                        <Ionicons name="open-outline" size={20} color="#fff" />
                        <Text style={styles.originalButtonText}>Orijinal Sitede Aç</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                );
                
              })()}
              </View>
            </ScrollView>
          )}
        </>
      )}
      <Modal
        visible={browserVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeBrowser}
        statusBarTranslucent
        onShow={() => {
          logger.info('✅ Browser modal gösterildi (onShow callback)');
        }}
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
              <Pressable 
                style={styles.browserActionButton} 
                onPress={() => {
                  logger.info('🔵 Browser header button tıklandı');
                  openExternalBrowser();
                }} 
                hitSlop={12}
              >
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
                  renderersProps={{
                    img: {
                      enableExperimentalPercentWidth: true,
                    },
                  }}
                />
              ) : articlePlainText ? (
                <Text style={styles.browserHtmlText} selectable={true}>{articlePlainText}</Text>
              ) : articleContentError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="warning-outline" size={18} color="#f87171" />
                  <Text style={styles.errorText}>
                    {articleContentError || 'Haber içeriği gösterilemedi. Dış tarayıcıdan açmayı deneyebilirsiniz.'}
                  </Text>
                  {hasValidUrl && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => {
                        loadArticleContent().catch((error) => {
                          // ELITE: Use logger instead of console.error
                          const logger = require('../../utils/logger').createLogger('NewsDetailScreen');
                          logger.error('Failed to retry loading article content:', error);
                        });
                      }}
                    >
                      <Ionicons name="refresh" size={16} color={colors.accent.primary} />
                      <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.emptyContentContainer}>
                  <Ionicons name="newspaper-outline" size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyContentText}>İçerik yüklenemedi.</Text>
                  {hasValidUrl && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => {
                        loadArticleContent().catch((error) => {
                          // ELITE: Use logger instead of console.error
                          const logger = require('../../utils/logger').createLogger('NewsDetailScreen');
                          logger.error('Failed to retry loading article content:', error);
                        });
                      }}
                    >
                      <Ionicons name="refresh" size={16} color={colors.accent.primary} />
                      <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ELITE: In-App Browser Modal - WebView ile uygulama içinde aç */}
      <Modal
        visible={inAppBrowserVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setInAppBrowserVisible(false);
          setInAppBrowserUrl('');
        }}
      >
        <View style={styles.inAppBrowserContainer}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          
          {/* ELITE: Header with back button - yukardan başla */}
          <View style={[styles.inAppBrowserHeader, { paddingTop: Math.max(insets.top - 28, 0) }]}>
            <TouchableOpacity
              style={styles.inAppBrowserBackButton}
              onPress={() => {
                haptics.impactLight();
                setInAppBrowserVisible(false);
                setInAppBrowserUrl('');
              }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            
            <View style={styles.inAppBrowserHeaderCenter}>
              <Text style={styles.inAppBrowserHeaderTitle} numberOfLines={1}>
                {inAppBrowserUrl ? (() => {
                  try {
                    return new URL(inAppBrowserUrl).hostname;
                  } catch {
                    return inAppBrowserUrl.substring(0, 30) + '...';
                  }
                })() : 'Web Sayfası'}
              </Text>
            </View>

            <View style={styles.inAppBrowserHeaderActions}>
              <TouchableOpacity
                style={styles.inAppBrowserActionButton}
                onPress={() => {
                  haptics.impactLight();
                  if (inAppBrowserUrl) {
                    Share.share({
                      message: inAppBrowserUrl,
                      url: inAppBrowserUrl,
                    }).catch((error) => {
                      logger.error('Failed to share URL:', error);
                    });
                  }
                }}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.text.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.inAppBrowserActionButton}
                onPress={() => {
                  haptics.impactLight();
                  if (inAppBrowserUrl) {
                    Linking.openURL(inAppBrowserUrl).catch((error) => {
                      logger.error('Failed to open URL in external browser:', error);
                    });
                  }
                }}
              >
                <Ionicons name="open-outline" size={18} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ELITE: WebView - internet bağlantısı ile aç */}
          {inAppBrowserUrl ? (
            (NativeWebView || inAppBrowserWebView) ? (
              (() => {
                const WebViewComponent = NativeWebView || inAppBrowserWebView;
                if (!WebViewComponent) {
                  logger.warn('⚠️ WebView component null');
                  return (
                    <View style={styles.inAppBrowserLoading}>
                      <Ionicons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
                      <Text style={styles.inAppBrowserLoadingText}>WebView yüklenemedi</Text>
                      <TouchableOpacity
                        style={styles.originalButton}
                        onPress={() => {
                          Linking.openURL(inAppBrowserUrl).catch((error) => {
                            logger.error('Failed to open URL:', error);
                          });
                        }}
                      >
                        <LinearGradient
                          colors={[colors.accent.primary, colors.accent.secondary]}
                          style={styles.originalButtonGradient}
                        >
                          <Ionicons name="open-outline" size={20} color="#fff" />
                          <Text style={styles.originalButtonText}>Dış Tarayıcıda Aç</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  );
                }
                const WebViewComponentTyped = WebViewComponent as any;
                return (
                  <WebViewComponentTyped
                    ref={inAppWebViewRef}
                    source={{ uri: inAppBrowserUrl }}
                    style={styles.inAppBrowserWebView}
                    startInLoadingState
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowsBackForwardNavigationGestures={true}
                    renderLoading={() => (
                      <View style={styles.inAppBrowserLoading}>
                        <ActivityIndicator size="large" color={colors.accent.primary} />
                        <Text style={styles.inAppBrowserLoadingText}>Sayfa yükleniyor...</Text>
                      </View>
                    )}
                    onError={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      logger.error('In-app browser WebView error:', nativeEvent);
                    }}
                    onHttpError={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      logger.warn('In-app browser WebView HTTP error:', nativeEvent.statusCode);
                    }}
                    onLoadStart={() => {
                      logger.info('🔵 In-app browser WebView load started:', inAppBrowserUrl);
                    }}
                    onLoadEnd={() => {
                      logger.info('✅ In-app browser WebView load ended');
                    }}
                  />
                );
              })()
            ) : (
              <View style={styles.inAppBrowserLoading}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
                <Text style={styles.inAppBrowserLoadingText}>WebView hazırlanıyor...</Text>
              </View>
            )
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    paddingTop: 0, // ELITE: Tam ekran, üstte boşluk yok
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 0, // insets.top dinamik olarak ekleniyor
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    minHeight: 32, // ELITE: Minimum touch target height
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 0,
  },
  shareButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: 4,
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
    paddingVertical: 12,
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
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
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
    fontSize: 15,
  },
  emptySummaryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 12,
  },
  emptySummaryText: {
    flex: 1,
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
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
  htmlFallbackContainer: {
    width: '100%',
    backgroundColor: colors.background.primary,
    paddingBottom: 100, // Alt buton için boşluk
    minHeight: 400, // ELITE: Minimum yükseklik garantisi
  },
  htmlFallbackContainerFullScreen: {
    // ELITE: Tam ekran modu - HTML fallback tam ekran, EN ÜSTTEN BAŞLA
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    paddingTop: 0, // En üstten başla - boşluk yok
    marginTop: 0, // Margin yok
    backgroundColor: colors.background.primary,
  },
  browserHtmlScroll: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  browserHtmlContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100, // Alt buton için boşluk
    gap: 16,
  },
  browserHtmlContentFullScreen: {
    paddingTop: 60, // Tam ekran modunda üstte floating header için boşluk
  },
  fullScreenBottomButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 25,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0, // Safe area padding inline'da ekleniyor
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  fullScreenBottomButtonInner: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullScreenBottomButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  fullScreenBottomButtonText: {
    ...typography.button,
    color: '#fff',
  },
  browserHtmlText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 24,
  },
  htmlContentWrapper: {
    width: '100%',
    minHeight: 200, // CRITICAL: İçeriğin görünür olması için minimum yükseklik
    backgroundColor: colors.background.primary,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  originalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  originalContainerFullScreen: {
    // ELITE: Tam ekran modu - tüm ekranı kapla, en üstten başla, siyah kısmı kaldır
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingTop: 0, // En üstten başla
    backgroundColor: colors.background.primary,
  },
  fullScreenFloatingHeader: {
    // ELITE: Tam ekran modunda floating header (sadece kontroller için) - EN ÜSTTEN BAŞLA
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: 'transparent', // Arka plan şeffaf
  },
  fullScreenFloatingHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Gradient efekti için hafif arka plan
  },
  fullScreenFloatingBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenFloatingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fullScreenFloatingActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  fullScreenHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  fullScreenBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  fullScreenHeaderCenter: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  fullScreenHeaderTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  fullScreenHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullScreenActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  originalActions: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    paddingBottom: 80, // Buton için yer bırak
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  webViewWrapperFullScreen: {
    // ELITE: Tam ekran modu - tüm ekranı kapla, en üstten başla, siyah kısmı kaldır
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    paddingTop: 0, // En üstten başla - boşluk yok
    marginTop: 0, // Margin yok
    backgroundColor: colors.background.primary,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  webViewFullScreen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  webViewButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    zIndex: 10,
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
  },
  safariInfoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    marginBottom: 24,
    backgroundColor: colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  safariInfoTitle: {
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  safariInfoText: {
    textAlign: 'center',
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 20,
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    ...typography.body,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  emptyContentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    minHeight: 300, // ELITE: Minimum yükseklik garantisi
  },
  emptyContentText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  // ELITE: In-App Browser Styles
  inAppBrowserContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  inAppBrowserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.primary,
    minHeight: 32,
  },
  inAppBrowserBackButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
  },
  inAppBrowserHeaderCenter: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  inAppBrowserHeaderTitle: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  inAppBrowserHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inAppBrowserActionButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
  },
  inAppBrowserWebView: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  inAppBrowserLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    gap: 16,
  },
  inAppBrowserLoadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 12,
  },
});


