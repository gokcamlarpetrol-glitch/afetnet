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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTrialStore } from '../../stores/trialStore';
import { usePremiumStore } from '../../stores/premiumStore';
import { premiumService } from '../../services/PremiumService';
import { ENV } from '../../config/env';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import * as Clipboard from 'expo-clipboard';

const logger = createLogger('PaywallScreen');

// Elite: Safe WebBrowser import with fallback
let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
} catch (error) {
  logger.warn('expo-web-browser not available, using Linking fallback');
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
  { 
    icon: 'sparkles', 
    title: 'AI Asistan', 
    description: 'Yapay zeka destekli risk analizi ve öneriler',
    color: '#fbbf24',
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
    description: 'Aile üyelerinizin konumu ve durumu',
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
];

export default function PaywallScreen({ navigation }: any) {
  const daysRemaining = useTrialStore((state) => state.getRemainingDays());
  const hoursRemaining = useTrialStore((state) => state.getRemainingHours());
  const isTrialActive = useTrialStore((state) => state.isTrialActive);
  const isPremium = usePremiumStore((state) => state.isPremium);
  const [selectedPackage, setSelectedPackage] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer animation (continuous)
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePurchase = async () => {
    haptics.impactMedium();
    setPurchasing(true);
    
    try {
      logger.info('Starting purchase:', selectedPackage);
      
      // Map package selection to RevenueCat package IDs
      const packageMap = {
        monthly: '$rc_monthly',
        yearly: '$rc_annual',
        lifetime: 'lifetime',
      };
      
      const success = await premiumService.purchasePackage(packageMap[selectedPackage]);
      
      if (success) {
        haptics.notificationSuccess();
        Alert.alert(
          'Başarılı! 🎉',
          'Premium üyeliğiniz aktif edildi. Tüm özelliklere erişebilirsiniz.',
          [
            {
              text: 'Harika!',
              onPress: () => navigation?.goBack?.(),
            },
          ]
        );
      } else {
        throw new Error('Purchase failed');
      }
    } catch (error: any) {
      logger.error('Purchase error:', error);
      haptics.notificationError();
      
      // User cancelled
      if (error.userCancelled) {
        logger.info('User cancelled purchase');
        return;
      }
      
      Alert.alert(
        'Satın Alma Başarısız',
        'Bir hata oluştu. Lütfen tekrar deneyin veya App Store ayarlarınızı kontrol edin.',
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
          'Geri Yüklendi! ✅',
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

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <View style={styles.container}>
      {/* Animated gradient background */}
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            haptics.impactLight();
            navigation?.goBack?.();
          }}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={28} color="#f1f5f9" />
        </Pressable>
        
        {!isPremium && (
          <Pressable 
            onPress={handleRestore}
            style={styles.restoreButton}
            disabled={purchasing}
          >
            <Text style={styles.restoreButtonText}>Geri Yükle</Text>
          </Pressable>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
          {/* Trial Status Banner */}
          {isTrialActive && !isPremium && (
            <View style={styles.trialBanner}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
                style={styles.trialBannerGradient}
              >
                <Ionicons name="time-outline" size={20} color="#10b981" />
                <Text style={styles.trialBannerText}>
                  {daysRemaining > 0 
                    ? `${daysRemaining} gün ücretsiz deneme kaldı` 
                    : `${hoursRemaining} saat ücretsiz deneme kaldı`}
                </Text>
              </LinearGradient>
            </View>
          )}

          {isPremium && (
            <View style={styles.premiumBanner}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.2)', 'rgba(251, 191, 36, 0.1)']}
                style={styles.premiumBannerGradient}
              >
                <Ionicons name="checkmark-circle" size={24} color="#fbbf24" />
                <Text style={styles.premiumBannerText}>
                  Premium üyeliğiniz aktif! 🎉
                </Text>
              </LinearGradient>
            </View>
          )}

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#fbbf24', '#f59e0b']}
                style={styles.iconGradient}
              >
                <Ionicons name="star" size={56} color="#fff" />
              </LinearGradient>
            </View>
            
            <Text style={styles.title}>AfetNet Premium</Text>
            <Text style={styles.subtitle}>
              Acil durumlarda hayat kurtaran özelliklere tam erişim
            </Text>
          </View>

          {/* Features Grid */}
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
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(30, 41, 59, 0.8)', 'rgba(30, 41, 59, 0.4)']}
                  style={styles.featureCardGradient}
                >
                  <View style={[styles.featureIconContainer, { backgroundColor: feature.color + '20' }]}>
                    <Ionicons name={feature.icon as any} size={28} color={feature.color} />
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </LinearGradient>
              </Animated.View>
            ))}
          </View>

          {/* Pricing Section */}
          {!isPremium && (
            <>
              <View style={styles.pricingSection}>
                <Text style={styles.pricingSectionTitle}>Planınızı Seçin</Text>
                
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
                >
                  <LinearGradient
                    colors={
                      selectedPackage === 'yearly'
                        ? ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.1)']
                        : ['rgba(30, 41, 59, 0.8)', 'rgba(30, 41, 59, 0.4)']
                    }
                    style={styles.pricingCardGradient}
                  >
                    <View style={styles.pricingBadgeContainer}>
                      <LinearGradient
                        colors={['#fbbf24', '#f59e0b']}
                        style={styles.popularBadge}
                      >
                        <Text style={styles.popularBadgeText}>EN POPÜLER</Text>
                      </LinearGradient>
                    </View>
                    
                    <View style={styles.pricingContent}>
                      <View style={styles.pricingLeft}>
                        <Text style={styles.pricingTitle}>Yıllık</Text>
                        <Text style={styles.pricingSavings}>%17 tasarruf</Text>
                      </View>
                      <View style={styles.pricingRight}>
                        <Text style={styles.pricingPrice}>₺499,99</Text>
                        <Text style={styles.pricingPeriod}>/ yıl</Text>
                      </View>
                    </View>
                    
                    <View style={styles.pricingFooter}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={styles.pricingFooterText}>Ayda sadece ₺41,66</Text>
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
                >
                  <LinearGradient
                    colors={
                      selectedPackage === 'monthly'
                        ? ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.1)']
                        : ['rgba(30, 41, 59, 0.8)', 'rgba(30, 41, 59, 0.4)']
                    }
                    style={styles.pricingCardGradient}
                  >
                    <View style={styles.pricingContent}>
                      <View style={styles.pricingLeft}>
                        <Text style={styles.pricingTitle}>Aylık</Text>
                        <Text style={styles.pricingSubtext}>Esnek plan</Text>
                      </View>
                      <View style={styles.pricingRight}>
                        <Text style={styles.pricingPrice}>₺49,99</Text>
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
                >
                  <LinearGradient
                    colors={
                      selectedPackage === 'lifetime'
                        ? ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.1)']
                        : ['rgba(30, 41, 59, 0.8)', 'rgba(30, 41, 59, 0.4)']
                    }
                    style={styles.pricingCardGradient}
                  >
                    <View style={styles.pricingBadgeContainer}>
                      <LinearGradient
                        colors={['#8b5cf6', '#7c3aed']}
                        style={styles.lifetimeBadge}
                      >
                        <Text style={styles.lifetimeBadgeText}>EN İYİ DEĞER</Text>
                      </LinearGradient>
                    </View>
                    
                    <View style={styles.pricingContent}>
                      <View style={styles.pricingLeft}>
                        <Text style={styles.pricingTitle}>Ömür Boyu</Text>
                        <Text style={styles.pricingSavings}>Tek ödeme</Text>
                      </View>
                      <View style={styles.pricingRight}>
                        <Text style={styles.pricingPrice}>₺999,99</Text>
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

              {/* CTA Button */}
              <Pressable 
                style={[styles.ctaButton, purchasing && styles.ctaButtonDisabled]}
                onPress={handlePurchase}
                disabled={purchasing}
              >
                <LinearGradient
                  colors={purchasing ? ['#64748b', '#475569'] : ['#3b82f6', '#2563eb']}
                  style={styles.ctaButtonGradient}
                >
                  {/* Shimmer effect */}
                  {!purchasing && (
                    <Animated.View
                      style={[
                        styles.shimmer,
                        {
                          transform: [{ translateX: shimmerTranslate }],
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
                  <Text style={styles.trustBadgeText}>10,000+ Kullanıcı</Text>
                </View>
              </View>
            </>
          )}

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
    padding: 20,
    paddingTop: 60,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  content: {
    padding: 24,
    paddingTop: 0,
  },
  animatedContent: {
    flex: 1,
  },
  trialBanner: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  trialBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  trialBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
  },
  premiumBanner: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  premiumBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#fbbf24',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 40,
  },
  featureCard: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  pricingSection: {
    marginBottom: 24,
  },
  pricingSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 16,
    textAlign: 'center',
  },
  pricingCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  pricingCardSelected: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  pricingCardGradient: {
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  pricingBadgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  popularBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  lifetimeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  lifetimeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  pricingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingLeft: {
    flex: 1,
  },
  pricingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  pricingSavings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  pricingSubtext: {
    fontSize: 14,
    color: '#94a3b8',
  },
  pricingRight: {
    alignItems: 'flex-end',
  },
  pricingPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  pricingPeriod: {
    fontSize: 14,
    color: '#94a3b8',
  },
  pricingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
  },
  pricingFooterText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  ctaButton: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  ctaButtonDisabled: {
    shadowOpacity: 0.1,
  },
  ctaButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustBadgeText: {
    fontSize: 12,
    color: '#94a3b8',
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
