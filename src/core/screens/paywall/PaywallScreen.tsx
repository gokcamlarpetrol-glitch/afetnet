/**
 * PAYWALL SCREEN - Premium Subscription
 * Apple-style premium design with glassmorphism and animations
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { useTrialStore } from '../../stores/trialStore';
import { usePremiumStore } from '../../stores/premiumStore';
import { premiumService } from '../../services/PremiumService';
import { ENV } from '../../config/env';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import * as Clipboard from 'expo-clipboard';

const logger = createLogger('PaywallScreen');

// Elite: Safe WebBrowser import with fallback
// CRITICAL: Silent fallback - don't log warnings in production
let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
} catch (error) {
  // Silent fallback - Linking will be used instead
  // Only log in development to avoid console spam
  if (__DEV__) {
    logger.debug('expo-web-browser not available, using Linking fallback');
  }
}

/**
 * Elite: Open URL with in-app browser (if available) or fallback to system browser
 * Apple requires functional Terms/Privacy links - this ensures they always work
 */
const openURL = async (url: string, title: string) => {
  try {
    // Try in-app browser first (preferred for Apple review)
    if (WebBrowser && WebBrowser.openBrowserAsync) {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle?.FORM_SHEET || 'formSheet',
        controlsColor: '#3b82f6',
        toolbarColor: '#0f172a',
        enableBarCollapsing: false,
      });
      return;
    }
    
    // Fallback to system browser (works everywhere)
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error('Cannot open URL');
    }
  } catch (error) {
    logger.error(`Failed to open ${title}:`, error);
    Alert.alert(
      'Hata',
      `${title} açılamadı. Lütfen daha sonra tekrar deneyin veya tarayıcınızdan şu adresi ziyaret edin:\n\n${url}`,
      [
        { text: 'Tamam', style: 'default' },
        {
          text: 'Kopyala',
          onPress: async () => {
            try {
              await Clipboard.setStringAsync(url);
              Alert.alert('Başarılı', 'URL panoya kopyalandı');
            } catch (clipError) {
              logger.error('Failed to copy URL:', clipError);
            }
          },
        },
      ]
    );
  }
};

const PREMIUM_FEATURES = [
  // Temel Premium Özellikler
  { 
    icon: 'sparkles', 
    title: 'AI Asistan', 
    description: 'Yapay zeka destekli risk analizi ve öneriler',
    color: '#fbbf24',
  },
  { 
    icon: 'newspaper', 
    title: 'AI Haber Özeti', 
    description: 'Yapay zeka ile acil durum haberlerinin otomatik özetlenmesi ve analizi',
    color: '#3b82f6',
  },
  { 
    icon: 'map', 
    title: 'Gelişmiş Harita', 
    description: 'Offline haritalar ve detaylı deprem verileri',
    color: '#3b82f6',
  },
  { 
    icon: 'people', 
    title: 'Aile Takibi', 
    description: 'Aile üyelerinizin gerçek zamanlı konumu ve durumu',
    color: '#10b981',
  },
  { 
    icon: 'chatbubbles', 
    title: 'Offline Mesajlaşma', 
    description: 'BLE mesh ile şebeke olmadan iletişim',
    color: '#8b5cf6',
  },
  { 
    icon: 'shield-checkmark', 
    title: 'Öncelikli Uyarılar', 
    description: 'Deprem anında ilk siz haberdar olun',
    color: '#ef4444',
  },
  { 
    icon: 'heart', 
    title: 'Sağlık Profili', 
    description: 'Tıbbi bilgilerinizi güvenle saklayın',
    color: '#ec4899',
  },
  // Gelişmiş Özellikler
  { 
    icon: 'medical', 
    title: 'Triage Sistemi', 
    description: 'Hızlı yaralı sınıflandırma ve önceliklendirme',
    color: '#ef4444',
  },
  { 
    icon: 'warning', 
    title: 'Tehlike Bölgeleri', 
    description: 'Risk alanlarını işaretle ve paylaş',
    color: '#f59e0b',
  },
  { 
    icon: 'cube', 
    title: 'Lojistik Yönetimi', 
    description: 'Malzeme talep ve teklif sistemi',
    color: '#3b82f6',
  },
  { 
    icon: 'search', 
    title: 'SAR Modu', 
    description: 'Arama kurtarma operasyonları için özel araçlar',
    color: '#10b981',
  },
  { 
    icon: 'home', 
    title: 'Enkaz Modu', 
    description: 'Enkaz altı otomatik SOS ve konum paylaşımı',
    color: '#dc2626',
  },
  { 
    icon: 'notifications', 
    title: 'Erken Uyarı Sistemi', 
    description: 'Deprem öncesi bildirim ve geri sayım',
    color: '#f59e0b',
  },
  { 
    icon: 'stats-chart', 
    title: 'Seismic Sensor', 
    description: 'Telefon sensörleri ile deprem algılama',
    color: '#8b5cf6',
  },
  { 
    icon: 'navigate', 
    title: 'PDR Konum Takibi', 
    description: 'GPS olmadan adım sayarak konum belirleme',
    color: '#6366f1',
  },
  { 
    icon: 'location', 
    title: 'Yakınlık Uyarıları', 
    description: 'Yakındaki acil durumlar için otomatik bildirim',
    color: '#10b981',
  },
  { 
    icon: 'alert-circle', 
    title: 'Tehlike Çıkarımı', 
    description: 'AI ile otomatik tehlike bölgesi tespiti',
    color: '#ef4444',
  },
  { 
    icon: 'document', 
    title: 'ICE Bilgileri', 
    description: 'Acil durum kişileri ve tıbbi bilgiler',
    color: '#ec4899',
  },
];

export default function PaywallScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const daysRemaining = useTrialStore((state) => state.getRemainingDays());
  const hoursRemaining = useTrialStore((state) => state.getRemainingHours());
  const isTrialActive = useTrialStore((state) => state.isTrialActive);
  const isPremium = usePremiumStore((state) => state.isPremium);
  const [selectedPackage, setSelectedPackage] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<Video>(null);
  
  // ELITE: Premium Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;
  const parallaxAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ELITE: Sophisticated entrance animation with easing
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // ELITE: Premium shimmer animation with smooth easing
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // ELITE: Icon rotation animation (subtle, continuous)
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconRotateAnim, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(iconRotateAnim, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // ELITE: Icon pulse animation (subtle breathing effect)
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulseAnim, {
          toValue: 1.08,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(iconPulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // ELITE: Parallax scroll animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(parallaxAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(parallaxAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePurchase = async () => {
    if (purchasing) return; // Prevent double-tap
    
    haptics.impactMedium();
    setPurchasing(true);
    
    try {
      logger.info('Starting purchase:', selectedPackage);
      
      // Map package selection to RevenueCat package IDs
      // These must match the package identifiers configured in RevenueCat dashboard
      const packageMap: Record<'monthly' | 'yearly' | 'lifetime', string> = {
        monthly: '$rc_monthly',      // Monthly subscription package
        yearly: '$rc_annual',        // Annual subscription package  
        lifetime: 'lifetime',        // Lifetime package (custom identifier)
      };
      
      const packageId = packageMap[selectedPackage];
      logger.info(`Purchasing package: ${packageId} (${selectedPackage})`);
      
      const success = await premiumService.purchasePackage(packageId);
      
      if (success) {
        haptics.notificationSuccess();
        logger.info('Purchase successful!');
        
        // Update premium status immediately
        await premiumService.checkPremiumStatus();
        
        Alert.alert(
          'Başarılı',
          'Premium üyeliğiniz aktif edildi. Tüm özelliklere erişebilirsiniz.',
          [
            {
              text: 'Harika',
              onPress: () => {
                navigation?.goBack?.();
              },
            },
          ]
        );
      } else {
        logger.warn('Purchase returned false - user may have cancelled or error occurred');
        // Don't show error if user cancelled (handled below)
      }
    } catch (error: any) {
      logger.error('Purchase error:', error);
      haptics.notificationError();
      
      // User cancelled - don't show error
      if (error?.userCancelled || error?.code === 'USER_CANCELLED') {
        logger.info('User cancelled purchase');
        return;
      }
      
      // Network error
      if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('network')) {
        Alert.alert(
          'Bağlantı Hatası',
          'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
          [{ text: 'Tamam' }]
        );
        return;
      }
      
      // Product not available
      if (error?.code === 'PRODUCT_NOT_AVAILABLE' || error?.message?.includes('not available')) {
        Alert.alert(
          'Ürün Mevcut Değil',
          'Seçtiğiniz paket şu anda mevcut değil. Lütfen başka bir paket seçin.',
          [{ text: 'Tamam' }]
        );
        return;
      }
      
      // Generic error
      Alert.alert(
        'Satın Alma Başarısız',
        error?.message || 'Bir hata oluştu. Lütfen tekrar deneyin veya App Store ayarlarınızı kontrol edin.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    haptics.impactLight();
    setPurchasing(true);
    
    try {
      logger.info('Restoring purchases');
      const success = await premiumService.restorePurchases();
      
      if (success) {
        haptics.notificationSuccess();
        Alert.alert(
          'Geri Yüklendi',
          'Premium üyeliğiniz başarıyla geri yüklendi.',
          [
            {
              text: 'Tamam',
              onPress: () => navigation?.goBack?.(),
            },
          ]
        );
      } else {
        Alert.alert(
          'Satın Alma Bulunamadı',
          'Bu cihazda daha önce yapılmış bir satın alma bulunamadı.',
          [{ text: 'Tamam' }]
        );
      }
    } catch (error) {
      logger.error('Restore error:', error);
      haptics.notificationError();
      Alert.alert(
        'Geri Yükleme Başarısız',
        'Bir hata oluştu. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setPurchasing(false);
    }
  };


  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" hidden={false} />
      
      {/* Premium gradient background - Deep space aesthetic */}
      <LinearGradient
        colors={['#000000', '#0a0e1a', '#0f172a', '#1a1f2e', '#0f172a', '#0a0e1a', '#000000']}
        locations={[0, 0.15, 0.3, 0.5, 0.7, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Premium depth layers */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: shimmerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.18],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(59, 130, 246, 0.12)', 'rgba(139, 92, 246, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Subtle radial gradient overlay */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(251, 191, 36, 0.05)', 'transparent', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Minimal Header - Floating */}
      <View style={[styles.header, { paddingTop: insets.top - 8 }]}>
        {/* X Button - Left */}
        <Pressable 
          onPress={() => {
            haptics.impactLight();
            navigation?.goBack?.();
          }}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          accessibilityHint="Premium ekranını kapatır"
        >
          <View style={styles.closeButtonInner}>
            <Ionicons name="close" size={22} color="#f1f5f9" />
          </View>
        </Pressable>
        
        {/* Premium Banner - Right */}
        {isPremium ? (
          <View style={styles.premiumBannerCompact}>
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)', 'rgba(139, 92, 246, 0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumBannerGradientCompact}
            >
              <View style={styles.premiumIconContainerCompact}>
                <LinearGradient
                  colors={['#60a5fa', '#3b82f6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.premiumIconGradientCompact}
                >
                  <Ionicons name="checkmark-circle" size={12} color="#ffffff" />
                </LinearGradient>
              </View>
              <Text style={styles.premiumBannerTextCompact}>
                Premium aktif
              </Text>
            </LinearGradient>
          </View>
        ) : (
          <Pressable 
            onPress={handleRestore}
            style={styles.restoreButton}
            disabled={purchasing}
            accessibilityRole="button"
            accessibilityLabel="Satın alımları geri yükle"
            accessibilityHint="Önceki satın alımlarınızı geri yükler"
            accessibilityState={{ disabled: purchasing }}
          >
            <Text style={styles.restoreButtonText}>Geri Yükle</Text>
          </Pressable>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingTop: insets.top - 20 }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={false}
        style={{ flex: 1 }}
      >
        <Animated.View 
          style={[
            styles.animatedContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Trial Status Banner - Premium Design */}
          {isTrialActive && !isPremium && (
            <View style={styles.trialBanner}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.08)', 'rgba(16, 185, 129, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.trialBannerGradient}
              >
                <View style={styles.trialIconContainer}>
                  <Ionicons name="time" size={18} color="#10b981" />
                </View>
                <Text style={styles.trialBannerText}>
                  {daysRemaining > 0 
                    ? `${daysRemaining} gün ücretsiz deneme kaldı` 
                    : `${hoursRemaining} saat ücretsiz deneme kaldı`}
                </Text>
              </LinearGradient>
            </View>
          )}


          {/* Hero Section - Elite Premium Design */}
          <View style={styles.heroSection}>
            {/* Premium World Video - Elite Design */}
            <Animated.View 
              style={[
                styles.iconContainer,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      scale: scaleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1],
                      }),
                    },
                    {
                      translateY: parallaxAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -8],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* World Video Container - Clean Design */}
              <View style={styles.videoContainer}>
                <Video
                  ref={videoRef}
                  source={require('../../../../assets/videos/globe.mp4')}
                  style={styles.video}
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  isMuted
                  shouldPlay
                  onLoadStart={() => {
                    logger.info('World video loading started');
                  }}
                  onLoad={() => {
                    logger.info('World video loaded');
                    setVideoLoaded(true);
                  }}
                  onError={(error) => {
                    logger.warn('World video load error:', error);
                    setVideoLoaded(false);
                  }}
                />
                
                {/* Fallback: Video yüklenene kadar gradient göster */}
                {!videoLoaded && (
                  <View style={styles.videoFallback}>
                    <LinearGradient
                      colors={['rgba(59, 130, 246, 0.3)', 'rgba(139, 92, 246, 0.2)', 'rgba(59, 130, 246, 0.3)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="globe" size={64} color="rgba(255, 255, 255, 0.5)" />
                  </View>
                )}
              </View>
            </Animated.View>
            
            <Text style={styles.title}>AfetNet Premium</Text>
            <Text style={styles.subtitle}>
              Acil durumlarda hayat kurtaran profesyonel özelliklere tam erişim. AI destekli risk analizi, gelişmiş haritalar, offline mesajlaşma ve daha fazlası ile kendinizi ve sevdiklerinizi koruyun.
            </Text>
            
            {/* Premium badge - Refined */}
            <View style={styles.premiumBadge}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)', 'rgba(139, 92, 246, 0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumBadgeGradient}
              >
                <View style={styles.premiumBadgeIcon}>
                  <LinearGradient
                    colors={['#60a5fa', '#3b82f6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.premiumBadgeIconGradient}
                  >
                    <Ionicons name="diamond" size={14} color="#ffffff" />
                  </LinearGradient>
                </View>
                <Text style={styles.premiumBadgeText}>Profesyonel Çözüm</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Features Section - Premium Design */}
          <View style={styles.featuresSection}>
            <View style={styles.featuresSectionHeader}>
              <View style={styles.featuresSectionTitleContainer}>
                <LinearGradient
                  colors={['rgba(251, 191, 36, 0.2)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.featuresSectionTitleGradient}
                />
                <Text style={styles.featuresSectionTitle}>Premium Özellikler</Text>
              </View>
            </View>
            <Text style={styles.featuresSectionSubtitle}>
              Deprem, sel, yangın ve diğer acil durumlarda hayat kurtaran teknolojiler. AI destekli erken uyarı sistemi, offline iletişim ağı ve profesyonel hazırlık araçları ile kendinizi ve ailenizi koruyun.
            </Text>
            
            {/* Features Grid - Premium Design */}
            <View style={styles.featuresGrid}>
              {PREMIUM_FEATURES.map((feature, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.featureCard,
                    {
                      opacity: fadeAnim,
                      transform: [
                        {
                          translateY: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [50, 0],
                          }),
                        },
                        {
                          scale: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(30, 41, 59, 0.95)', 'rgba(30, 41, 59, 0.7)', 'rgba(30, 41, 59, 0.5)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.featureCardGradient}
                  >
                    {/* Premium Icon Container */}
                    <View style={[styles.featureIconContainer, { backgroundColor: feature.color + '20' }]}>
                      <LinearGradient
                        colors={[feature.color + '40', feature.color + '20']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.featureIconGradient}
                      >
                        <Ionicons name={feature.icon as any} size={26} color={feature.color} />
                      </LinearGradient>
                    </View>
                    
                    {/* Feature Title */}
                    <Text style={styles.featureTitle} numberOfLines={1}>{feature.title}</Text>
                    
                    {/* Feature Description */}
                    <Text style={styles.featureDescription} numberOfLines={2}>
                      {feature.description}
                    </Text>
                    
                    {/* Premium Accent Line */}
                    <View style={[styles.featureAccentLine, { backgroundColor: feature.color + '40' }]} />
                  </LinearGradient>
                </Animated.View>
              ))}
            </View>
          </View>

          {/* Pricing Section - Always Visible */}
          <View style={styles.pricingSection}>
            <View style={styles.pricingSectionHeader}>
              <Text style={styles.pricingSectionTitle}>Planınızı Seçin</Text>
              {isPremium && (
                <View style={styles.premiumActiveIndicator}>
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.premiumActiveIndicatorGradient}
                  >
                    <Ionicons name="checkmark-circle" size={14} color="#60a5fa" />
                    <Text style={styles.premiumActiveIndicatorText}>Aktif</Text>
                  </LinearGradient>
                </View>
              )}
            </View>
            
            <View style={styles.pricingCardsContainer}>
                {/* Yearly - Most Popular */}
                <Pressable 
                  style={[
                    styles.pricingCard,
                    selectedPackage === 'yearly' && styles.pricingCardSelected,
                  ]}
                  onPress={() => {
                    haptics.impactLight();
                    setSelectedPackage('yearly');
                  }}
                  disabled={purchasing}
                  accessibilityRole="button"
                  accessibilityLabel="Yıllık plan seç, 999 TL, en popüler"
                  accessibilityHint="Yıllık premium planı seçer, ayda 83 TL"
                  accessibilityState={{ selected: selectedPackage === 'yearly', disabled: purchasing }}
                >
                  <LinearGradient
                    colors={
                      selectedPackage === 'yearly'
                        ? ['rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0.15)', 'rgba(30, 41, 59, 0.8)']
                        : ['rgba(30, 41, 59, 0.9)', 'rgba(30, 41, 59, 0.5)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.pricingCardGradient,
                      {
                        borderWidth: selectedPackage === 'yearly' ? 2.5 : 2,
                        borderColor: selectedPackage === 'yearly' 
                          ? 'rgba(59, 130, 246, 0.5)' 
                          : 'rgba(51, 65, 85, 0.5)',
                      },
                    ]}
                  >
                    <View style={styles.pricingContent}>
                      <View style={styles.pricingLeft}>
                        <View style={styles.pricingTitleRow}>
                          <Text style={styles.pricingTitle}>Yıllık</Text>
                          <View style={styles.pricingBadgeInline}>
                            <LinearGradient
                              colors={['#fbbf24', '#f59e0b']}
                              style={styles.popularBadge}
                            >
                              <Text style={styles.popularBadgeText}>EN POPÜLER</Text>
                            </LinearGradient>
                          </View>
                        </View>
                        <Text style={styles.pricingSavings}>%16 tasarruf</Text>
                      </View>
                      <View style={styles.pricingRight}>
                        <Text style={styles.pricingPrice}>₺999</Text>
                        <Text style={styles.pricingPeriod}>/ yıl</Text>
                      </View>
                    </View>
                    
                    <View style={styles.pricingFooter}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={styles.pricingFooterText}>Ayda sadece ₺83,25</Text>
                    </View>
                  </LinearGradient>
                </Pressable>

                {/* Monthly */}
                <Pressable 
                  style={[
                    styles.pricingCard,
                    selectedPackage === 'monthly' && styles.pricingCardSelected,
                  ]}
                  onPress={() => {
                    haptics.impactLight();
                    setSelectedPackage('monthly');
                  }}
                  disabled={purchasing}
                  accessibilityRole="button"
                  accessibilityLabel="Aylık plan seç, 99 TL"
                  accessibilityHint="Aylık premium planı seçer, esnek plan"
                  accessibilityState={{ selected: selectedPackage === 'monthly', disabled: purchasing }}
                >
                  <LinearGradient
                    colors={
                      selectedPackage === 'monthly'
                        ? ['rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0.15)', 'rgba(30, 41, 59, 0.8)']
                        : ['rgba(30, 41, 59, 0.9)', 'rgba(30, 41, 59, 0.5)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.pricingCardGradient,
                      {
                        borderWidth: selectedPackage === 'monthly' ? 2.5 : 2,
                        borderColor: selectedPackage === 'monthly' 
                          ? 'rgba(59, 130, 246, 0.5)' 
                          : 'rgba(51, 65, 85, 0.5)',
                      },
                    ]}
                  >
                    <View style={styles.pricingContent}>
                      <View style={styles.pricingLeft}>
                        <Text style={styles.pricingTitle}>Aylık</Text>
                        <Text style={styles.pricingSubtext}>Esnek plan</Text>
                      </View>
                      <View style={styles.pricingRight}>
                        <Text style={styles.pricingPrice}>₺99</Text>
                        <Text style={styles.pricingPeriod}>/ ay</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>

                {/* Lifetime */}
                <Pressable 
                  style={[
                    styles.pricingCard,
                    selectedPackage === 'lifetime' && styles.pricingCardSelected,
                  ]}
                  onPress={() => {
                    haptics.impactLight();
                    setSelectedPackage('lifetime');
                  }}
                  disabled={purchasing}
                  accessibilityRole="button"
                  accessibilityLabel="Ömür boyu plan seç, 1999 TL, en iyi değer"
                  accessibilityHint="Ömür boyu premium planı seçer, tek ödeme"
                  accessibilityState={{ selected: selectedPackage === 'lifetime', disabled: purchasing }}
                >
                  <LinearGradient
                    colors={
                      selectedPackage === 'lifetime'
                        ? ['rgba(139, 92, 246, 0.4)', 'rgba(139, 92, 246, 0.15)', 'rgba(30, 41, 59, 0.8)']
                        : ['rgba(30, 41, 59, 0.9)', 'rgba(30, 41, 59, 0.5)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.pricingCardGradient,
                      {
                        borderWidth: selectedPackage === 'lifetime' ? 2.5 : 2,
                        borderColor: selectedPackage === 'lifetime' 
                          ? 'rgba(139, 92, 246, 0.5)' 
                          : 'rgba(51, 65, 85, 0.5)',
                      },
                    ]}
                  >
                    <View style={styles.pricingContent}>
                      <View style={styles.pricingLeft}>
                        <View style={styles.pricingTitleRow}>
                          <Text style={styles.pricingTitle}>Ömür Boyu</Text>
                          <View style={styles.pricingBadgeInline}>
                            <LinearGradient
                              colors={['#8b5cf6', '#7c3aed']}
                              style={styles.lifetimeBadge}
                            >
                              <Text style={styles.lifetimeBadgeText}>EN İYİ DEĞER</Text>
                            </LinearGradient>
                          </View>
                        </View>
                        <Text style={styles.pricingSavings}>Tek ödeme</Text>
                      </View>
                      <View style={styles.pricingRight}>
                        <Text style={styles.pricingPrice}>₺1.999</Text>
                        <Text style={styles.pricingPeriod}>sınırsız</Text>
                      </View>
                    </View>
                    
                    <View style={styles.pricingFooter}>
                      <Ionicons name="infinite" size={16} color="#8b5cf6" />
                      <Text style={styles.pricingFooterText}>Sınırsız erişim, tek ödeme</Text>
                    </View>
                  </LinearGradient>
                </Pressable>
            </View>
          </View>

          {/* CTA Button */}
              {!isPremium && (
              <Pressable 
                style={[styles.ctaButton, purchasing && styles.ctaButtonDisabled]}
                onPress={handlePurchase}
                disabled={purchasing}
                accessibilityRole="button"
                accessibilityLabel={purchasing ? "Satın alınıyor" : `Premium satın al, ${selectedPackage === 'monthly' ? '99 TL' : selectedPackage === 'yearly' ? '999 TL' : '1999 TL'}`}
                accessibilityHint="Seçili premium planı satın alır"
                accessibilityState={{ disabled: purchasing }}
              >
                <LinearGradient
                  colors={purchasing ? ['#64748b', '#475569'] : ['#3b82f6', '#2563eb', '#1e40af']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaButtonGradient}
                >
                  {/* ELITE: Premium shimmer effect */}
                  {!purchasing && (
                    <Animated.View
                      style={[
                        styles.shimmer,
                        {
                          transform: [
                            { 
                              translateX: shimmerAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-200, 200],
                              }),
                            },
                            {
                              scaleX: shimmerAnim.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0.5, 1, 0.5],
                              }),
                            },
                          ],
                          opacity: shimmerAnim.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0, 0.3, 0],
                          }),
                        },
                      ]}
                    />
                  )}
                  
                  {purchasing ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.ctaButtonText}>Satın alınıyor...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="lock-open" size={24} color="#fff" />
                      <Text style={styles.ctaButtonText}>Premium'a Geç</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
              )}

              {/* Trust Badges */}
              <View style={styles.trustBadges}>
                <View style={styles.trustBadge}>
                  <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                  <Text style={styles.trustBadgeText}>Güvenli Ödeme</Text>
                </View>
                <View style={styles.trustBadge}>
                  <Ionicons name="refresh" size={16} color="#10b981" />
                  <Text style={styles.trustBadgeText}>İstediğiniz Zaman İptal</Text>
                </View>
                <View style={styles.trustBadge}>
                  <Ionicons name="people" size={16} color="#10b981" />
                  <Text style={styles.trustBadgeText}>500,000+ Kullanıcı</Text>
                </View>
              </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Satın alarak{' '}
            <Text 
              style={styles.footerLink}
              onPress={async () => {
                // CRITICAL: Apple requires Terms of Service link to be functional
                const url = ENV.TERMS_OF_SERVICE_URL || 'https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html';
                await openURL(url, 'Kullanım Koşulları');
              }}
            >
              Kullanım Koşulları
            </Text>
            {' '}ve{' '}
            <Text 
              style={styles.footerLink}
              onPress={async () => {
                // CRITICAL: Apple requires Privacy Policy link to be functional
                const url = ENV.PRIVACY_POLICY_URL || 'https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html';
                await openURL(url, 'Gizlilik Politikası');
              }}
            >
              Gizlilik Politikası
            </Text>
            'nı kabul etmiş olursunuz.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  premiumBannerCompact: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
    alignSelf: 'center',
  },
  premiumBannerGradientCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    minHeight: 32,
  },
  premiumIconContainerCompact: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumIconGradientCompact: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9,
  },
  premiumBannerTextCompact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93c5fd',
    letterSpacing: 0.1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  closeButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  restoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
    letterSpacing: 0.3,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  animatedContent: {
    flex: 1,
  },
  trialBanner: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  trialBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  trialIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trialBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#34d399',
    letterSpacing: 0.2,
  },
  premiumBanner: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  premiumBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  premiumIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  premiumBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#93c5fd',
    letterSpacing: 0.1,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 36,
    paddingTop: 0,
  },
  iconContainer: {
    marginBottom: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOuterRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#3b82f6',
    zIndex: 0,
  },
  iconGradient: {
    width: 128,
    height: 128,
    borderRadius: 64,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  iconInnerGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  iconSymbol: {
    zIndex: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  iconInnerRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    zIndex: 0,
  },
  iconParticle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fbbf24',
    zIndex: 3,
  },
  videoContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  video: {
    width: '200%',
    height: '200%',
    position: 'absolute',
    left: '-50%',
    top: '-50%',
  },
  videoFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    borderRadius: 64,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: -1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    fontWeight: '400',
    letterSpacing: 0.1,
    marginTop: 8,
  },
  premiumBadge: {
    marginTop: 24,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  premiumBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  premiumBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBadgeIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  premiumBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#93c5fd',
    letterSpacing: 0.8,
  },
  featuresSection: {
    marginBottom: 48,
  },
  featuresSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  featuresSectionTitleContainer: {
    flex: 1,
    position: 'relative',
  },
  featuresSectionTitleGradient: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  featuresSectionTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.8,
    paddingLeft: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featuresCountBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  featuresCountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fcd34d',
    letterSpacing: 0.5,
  },
  featuresSectionSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 28,
    paddingHorizontal: 4,
    lineHeight: 20,
    fontWeight: '400',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  featureCardGradient: {
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    minHeight: 180,
    position: 'relative',
    overflow: 'hidden',
  },
  featureIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  featureIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  featureDescription: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
    fontWeight: '400',
    flex: 1,
    paddingRight: 4,
  },
  featureAccentLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  pricingSection: {
    marginBottom: 32,
  },
  pricingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  pricingCardsContainer: {
    gap: 16,
    position: 'relative',
  },
  pricingSectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f1f5f9',
    textAlign: 'center',
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  premiumActiveIndicator: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  premiumActiveIndicatorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  premiumActiveIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#93c5fd',
    letterSpacing: 0.3,
  },
  pricingCard: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  pricingCardSelected: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 20,
    transform: [{ scale: 1.02 }],
  },
  pricingCardGradient: {
    padding: 30,
    paddingBottom: 30,
    borderWidth: 2.5,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  pricingBadgeContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  pricingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  pricingBadgeInline: {
    marginTop: -2,
  },
  popularBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  lifetimeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  lifetimeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pricingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    minHeight: 60,
  },
  pricingLeft: {
    flex: 1,
    paddingRight: 8,
  },
  pricingTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f1f5f9',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 30,
  },
  pricingSavings: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.2,
    lineHeight: 20,
    marginTop: 2,
  },
  pricingSubtext: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 2,
  },
  pricingRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 100,
  },
  pricingPrice: {
    fontSize: 36,
    fontWeight: '900',
    color: '#f1f5f9',
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    lineHeight: 42,
  },
  pricingPeriod: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 20,
  },
  pricingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
  },
  pricingFooterText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 20,
    flex: 1,
  },
  ctaButton: {
    marginBottom: 28,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 20,
  },
  ctaButtonDisabled: {
    shadowOpacity: 0.15,
    elevation: 6,
  },
  ctaButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 100,
  },
  ctaButtonText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  trustBadgeText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  footer: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingBottom: 40,
  },
  footerLink: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
});
