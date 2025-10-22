// PREMIUM SCREEN - WORLD-CLASS DESIGN
// Elite level implementation with comprehensive feature showcase
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { iapService, PREMIUM_PLANS, PremiumPlanId } from '../services/iapService';
import { usePremium, usePremiumFeatures } from '../store/premium';
import { logger } from '../utils/productionLogger';
import { useTranslation } from 'react-i18next';
import { IAP_PRODUCTS } from '../../shared/iap/products';

export default function PremiumActiveScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlanId>(IAP_PRODUCTS.monthly);
  const [initError, setInitError] = useState<string | null>(null);
  
  // Use premium store
  const { isPremium, currentPlan, subscriptionEndDate } = usePremium();
  
  // Use translations
  const { t } = useTranslation();

  // Initialize IAP with comprehensive error handling
  const initializeIAP = useCallback(async () => {
    try {
      setIsInitializing(true);
      setInitError(null);

      logger.info('🚀 Initializing IAP service...');

      const success = await iapService.initialize();

      if (success) {
        logger.info('✅ IAP initialized successfully');

        // Fetch available products
        const products = await iapService.getAvailableProducts();

        logger.info('📦 Products loaded:', products.length);
      } else {
        logger.error('❌ IAP initialization failed');
        setInitError('Satın alma sistemi başlatılamadı.');
      }
    } catch (error) {
      logger.error('❌ IAP initialization error:', error);
      setInitError('Satın alma sistemi başlatılamadı.');
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Check premium status with error handling
  const checkPremiumStatus = useCallback(async () => {
    try {
      logger.info('🔍 Checking premium status...');
      // Premium status is managed by the store
      logger.info('📊 Premium status:', isPremium);
    } catch (error) {
      logger.error('❌ Failed to check premium status:', error);
      // Don't show error to user - gracefully degrade
    }
  }, [isPremium]);

  // Initialize on mount with cleanup
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (isMounted) {
        await initializeIAP();
        await checkPremiumStatus();
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      isMounted = false;
    };
  }, [initializeIAP, checkPremiumStatus]);

  // Handle purchase with comprehensive error handling
  const handlePurchase = useCallback(async (planId: PremiumPlanId) => {
    try {
      // Prevent multiple simultaneous purchases
      if (isLoading) {
        logger.warn('⚠️ Purchase already in progress');
        return;
      }

      setIsLoading(true);
      logger.info('🛒 Starting purchase for plan:', planId);

      const success = await iapService.purchasePlan(planId);

      if (success) {
        logger.info('✅ Purchase initiated successfully');
        // Status will be updated via purchase listener
      } else {
        logger.error('❌ Purchase failed');
      }
    } catch (error) {
      logger.error('❌ Purchase error:', error);

      Alert.alert(
        '❌ Hata',
        'Satın alma işlemi başlatılamadı. Lütfen tekrar deneyin.',
        [{ text: 'Tamam', style: 'default' }],
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Handle restore with comprehensive error handling
  const handleRestore = useCallback(async () => {
    try {
      // Prevent multiple simultaneous restores
      if (isLoading) {
        logger.warn('⚠️ Restore already in progress');
        return;
      }

      setIsLoading(true);
      logger.info('🔄 Restoring purchases...');

      const success = await iapService.restorePurchases();

      if (success) {
        logger.info('✅ Purchases restored successfully');
        // Re-check premium status
        await checkPremiumStatus();
      } else {
        logger.error('❌ Restore failed');
      }
    } catch (error) {
      logger.error('❌ Restore error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, checkPremiumStatus]);

  // Retry initialization
  const handleRetry = useCallback(async () => {
    await initializeIAP();
  }, [initializeIAP]);

  // Loading state
  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state with retry
  if (initError) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>{t('common.error')}</Text>
          <Text style={styles.errorMessage}>{initError}</Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>{t('Tekrar Dene')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Premium active state - Show comprehensive features overview
  if (isPremium) {
    return (
      <View style={styles.premiumActiveContainer}>
        <StatusBar barStyle="light-content" />
        
        {/* Premium Active Header */}
        <View style={styles.premiumHeader}>
          <View style={styles.premiumHeaderContent}>
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={24} color="#FFD700" />
              <Text style={styles.premiumBadgeText}>{t('premium.premium_active')}</Text>
            </View>
            <Text style={styles.premiumTitle}>{t('premium.title')}</Text>
            <Text style={styles.premiumSubtitle}>{t('premium.world_class_badge')}</Text>
            {currentPlan && (
              <Text style={styles.currentPlan}>
                {t(`premium.plans.${selectedPlan}.title`)} • {subscriptionEndDate ? `${t('premium.subscription_end')}: ${new Date(subscriptionEndDate).toLocaleDateString()}` : t('premium.unlimited')}
              </Text>
            )}
          </View>
        </View>

        <ScrollView style={styles.premiumScrollView} showsVerticalScrollIndicator={false}>
          {/* World-Class Features Showcase */}
          <View style={styles.featuresShowcase}>
            <Text style={styles.showcaseTitle}>🎯 {t('premium.features.title')}</Text>
            <Text style={styles.showcaseSubtitle}>200+ {t('premium.subtitle')}</Text>
            
            {/* Feature Categories */}
            {[
              {
                categoryKey: 'emergency',
                features: [
                  { icon: 'alert-circle', nameKey: 'sos_system', descKey: 'instant_help' },
                  { icon: 'shield-checkmark', nameKey: 'critical_alarm', descKey: 'silent_mode_bypass' },
                  { icon: 'medical', nameKey: 'medical_info', descKey: 'ice_data' },
                  { icon: 'people', nameKey: 'rescue_coordination', descKey: 'sar_triage' },
                ],
              },
              {
                categoryKey: 'family',
                features: [
                  { icon: 'people', nameKey: 'unlimited_family_tracking', descKey: 'realtime_location' },
                  { icon: 'chatbubbles', nameKey: 'family_messaging', descKey: 'encrypted_communication' },
                  { icon: 'heart', nameKey: 'proximity_detection', descKey: 'family_alerts' },
                  { icon: 'location', nameKey: 'family_map', descKey: 'all_members_map' },
                ],
              },
              {
                categoryKey: 'maps',
                features: [
                  { icon: 'map', nameKey: 'offline_maps', descKey: 'without_internet' },
                  { icon: 'navigate', nameKey: 'route_planning', descKey: 'advanced_optimization' },
                  { icon: 'trail-sign', nameKey: 'pdr_tracking', descKey: 'step_based_location' },
                  { icon: 'location', nameKey: 'topographic_maps', descKey: 'high_resolution_offline' },
                ],
              },
              {
                categoryKey: 'mesh',
                features: [
                  { icon: 'radio', nameKey: 'ble_mesh_network', descKey: 'bluetooth_mesh' },
                  { icon: 'wifi', nameKey: 'wifi_direct', descKey: 'direct_connection' },
                  { icon: 'chatbubble', nameKey: 'p2p_messaging', descKey: 'network_free_communication' },
                  { icon: 'repeat', nameKey: 'message_relay', descKey: 'automatic_forwarding' },
                ],
              },
              {
                categoryKey: 'ai',
                features: [
                  { icon: 'brain', nameKey: 'ai_decision_support', descKey: 'smart_analysis' },
                  { icon: 'analytics', nameKey: 'smart_recommendations', descKey: 'personalized' },
                  { icon: 'eye', nameKey: 'situation_analysis', descKey: 'risk_assessment' },
                  { icon: 'bulb', nameKey: 'automatic_decisions', descKey: 'ai_powered' },
                ],
              },
              {
                categoryKey: 'security',
                features: [
                  { icon: 'lock-closed', nameKey: 'end_to_end_encryption', descKey: 'full_security' },
                  { icon: 'finger-print', nameKey: 'biometric_security', descKey: 'fingerprint_face' },
                  { icon: 'shield', nameKey: 'secure_storage', descKey: 'encrypted_data' },
                  { icon: 'key', nameKey: 'secure_identity', descKey: 'afn_id_system' },
                ],
              },
            ].map((category, categoryIndex) => (
              <View key={categoryIndex} style={styles.categoryCard}>
                <Text style={styles.categoryTitle}>{t(`premium.features.categories.${category.categoryKey}.title`)}</Text>
                <View style={styles.featuresGrid}>
                  {category.features.map((feature, featureIndex) => (
                    <View key={featureIndex} style={styles.featureItem}>
                      <View style={styles.featureIconContainer}>
                        <Ionicons name={feature.icon as any} size={20} color="#10B981" />
                      </View>
                      <View style={styles.featureContent}>
                        <Text style={styles.featureName}>{t(`premium.features.categories.${category.categoryKey}.features.${featureIndex}`)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Premium Stats */}
          <View style={styles.premiumStats}>
            <Text style={styles.statsTitle}>📊 {t('premium.stats.title')}</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>200+</Text>
                <Text style={styles.statLabel}>{t('premium.stats.features')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>24/7</Text>
                <Text style={styles.statLabel}>{t('premium.stats.support')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>∞</Text>
                <Text style={styles.statLabel}>{t('premium.stats.usage')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>100%</Text>
                <Text style={styles.statLabel}>{t('premium.stats.security')}</Text>
              </View>
            </View>
          </View>

          {/* Restore Button */}
          <Pressable
            style={[styles.restoreButton, isLoading && styles.disabledButton]}
            onPress={handleRestore}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <Text style={styles.restoreButtonText}>{t('premium.actions.restore')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Purchase screen - World-class design with comprehensive features
  return (
    <View style={styles.purchaseContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <Text style={styles.heroBadgeText}>{t('premium.world_class_badge')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('premium.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('premium.subtitle')}</Text>
          <Text style={styles.heroDescription}>
            {t('premium.description')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.purchaseScrollView} showsVerticalScrollIndicator={false}>
        {/* Premium Plans */}
        <View style={styles.premiumPlansSection}>
          <Text style={styles.sectionTitle}>💎 Premium Planlar</Text>
          
          {Object.entries(PREMIUM_PLANS).map(([planId, plan]) => (
            <Pressable
              key={planId}
              style={[
                styles.premiumPlanCard,
                selectedPlan === planId && styles.selectedPlanCard,
              ]}
              onPress={() => setSelectedPlan(planId as PremiumPlanId)}
              disabled={isLoading}
            >
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>
                <View style={styles.priceSection}>
                  <Text style={styles.planPrice}>₺{plan.price}</Text>
                  <Text style={styles.planCurrency}>{plan.currency}</Text>
                </View>
              </View>
              
              {selectedPlan === planId && (
                <View style={styles.selectedIndicator}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.selectedText}>Seçildi</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Comprehensive Features Showcase */}
        <View style={styles.featuresShowcase}>
          <Text style={styles.sectionTitle}>🚀 Premium Özellikler</Text>
          <Text style={styles.sectionSubtitle}>Dünyanın en kapsamlı afet uygulaması</Text>
          
          {/* Major Feature Categories */}
          {[
            {
              category: '🚨 Acil Durum & Kurtarma',
              color: '#EF4444',
              features: [
                'SOS Sistemi - Anında yardım çağrısı',
                'Kritik Alarm - Sessiz modu aşan alarmlar',
                'Kurtarma Koordinasyonu - SAR ve triaj',
                'Medikal Bilgi - ICE verileri',
                'Enkaz Modu - Hareketsizlik algılama',
                'Ses Ping - Enkaz altı iletişim',
              ],
            },
            {
              category: '👨‍👩‍👧‍👦 Aile & Sosyal',
              color: '#3B82F6',
              features: [
                'Sınırsız Aile Takibi - Gerçek zamanlı konum',
                'Aile Mesajlaşması - Şifreli iletişim',
                'Yakınlık Algılama - Aile uyarıları',
                'Aile Haritası - Tüm üyelerin haritası',
                'Grup Yönetimi - Takım koordinasyonu',
                'Sosyal Güvenlik - Topluluk desteği',
              ],
            },
            {
              category: '🗺️ Harita & Navigasyon',
              color: '#10B981',
              features: [
                'Offline Haritalar - İnternet olmadan',
                'Topografik Haritalar - Yüksek çözünürlük',
                'Rota Planlama - Gelişmiş optimizasyon',
                'PDR İz Takibi - Adım bazlı konum',
                'GPS Fusion - Çoklu sensör birleşimi',
                'Konum Paylaşımı - Gerçek zamanlı',
              ],
            },
            {
              category: '📡 Mesh Ağ & İletişim',
              color: '#8B5CF6',
              features: [
                'BLE Mesh Ağı - Bluetooth mesh',
                'WiFi Direct - Doğrudan bağlantı',
                'P2P Mesajlaşma - Şebekesiz iletişim',
                'Mesaj Rölesi - Otomatik iletim',
                'Çevrimdışı Senkronizasyon - Veri senkronu',
                'Kritik Mesajlar - Öncelikli iletim',
              ],
            },
            {
              category: '🤖 AI & Akıllı Sistemler',
              color: '#F59E0B',
              features: [
                'AI Karar Desteği - Akıllı analiz',
                'Durum Analizi - Risk değerlendirmesi',
                'Akıllı Öneriler - Kişiselleştirilmiş',
                'Otomatik Kararlar - AI destekli',
                'Makine Öğrenmesi - Adaptif sistem',
                'Öngörücü Analiz - Gelecek tahmini',
              ],
            },
            {
              category: '🔒 Güvenlik & Şifreleme',
              color: '#06B6D4',
              features: [
                'End-to-End Şifreleme - Tam güvenlik',
                'Biyometrik Güvenlik - Parmak izi/yüz',
                'Güvenli Depolama - Şifreli veri',
                'AFN-ID Sistemi - Güvenli kimlik',
                'Çok Faktörlü Doğrulama - 2FA',
                'Güvenli İletişim - Şifreli mesajlar',
              ],
            },
            {
              category: '🎯 Gelişmiş Özellikler',
              color: '#84CC16',
              features: [
                'Drone Koordinasyonu - Uzaktan kontrol',
                'Lojistik Yönetimi - Tedarik takibi',
                'Eğitim Simülasyonları - Hazırlık',
                'Raporlama & Analitik - Detaylı analiz',
                'Erişilebilirlik - Özel ihtiyaçlar',
                'Çok Dilli Destek - 20+ dil',
              ],
            },
          ].map((category, index) => (
            <View key={index} style={styles.featureCategoryCard}>
              <View style={[styles.categoryHeader, { backgroundColor: category.color + '15' }]}>
                <Text style={[styles.categoryTitleText, { color: category.color }]}>
                  {category.category}
                </Text>
              </View>
              <View style={styles.categoryFeatures}>
                {category.features.map((feature, featureIndex) => (
                  <View key={featureIndex} style={styles.categoryFeatureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.categoryFeatureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Premium Stats */}
        <View style={styles.premiumStatsSection}>
          <Text style={styles.sectionTitle}>📊 Premium Avantajları</Text>
          <View style={styles.purchaseStatsGrid}>
            <View style={styles.purchaseStatItem}>
              <Text style={styles.purchaseStatNumber}>200+</Text>
              <Text style={styles.purchaseStatLabel}>Premium Özellik</Text>
            </View>
            <View style={styles.purchaseStatItem}>
              <Text style={styles.purchaseStatNumber}>24/7</Text>
              <Text style={styles.purchaseStatLabel}>Öncelikli Destek</Text>
            </View>
            <View style={styles.purchaseStatItem}>
              <Text style={styles.purchaseStatNumber}>∞</Text>
              <Text style={styles.purchaseStatLabel}>Sınırsız Kullanım</Text>
            </View>
            <View style={styles.purchaseStatItem}>
              <Text style={styles.purchaseStatNumber}>100%</Text>
              <Text style={styles.purchaseStatLabel}>Güvenli & Şifreli</Text>
            </View>
          </View>
        </View>

        {/* Purchase Button */}
        <Pressable
          style={[styles.premiumPurchaseButton, isLoading && styles.disabledButton]}
          onPress={() => handlePurchase(selectedPlan)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.purchaseButtonText}>
                Premium Satın Al - ₺{PREMIUM_PLANS[selectedPlan].price}
              </Text>
              <Text style={styles.purchaseButtonSubtext}>
                {PREMIUM_PLANS[selectedPlan].description}
              </Text>
            </>
          )}
        </Pressable>

        {/* Restore Button */}
        <Pressable
          style={[styles.restoreButton, isLoading && styles.disabledButton]}
          onPress={handleRestore}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#3B82F6" />
          ) : (
            <Text style={styles.restoreButtonText}>Satın Alımları Geri Yükle</Text>
          )}
        </Pressable>

        <Text style={styles.termsText}>
          Satın alma işlemi Apple hesabınızdan ücretlendirilecektir. Abonelik, 
          mevcut dönemin bitiminden en az 24 saat önce iptal edilmediği sürece 
          otomatik olarak yenilenir. Hesabınız, mevcut dönemin bitiminden 24 saat 
          önce yenileme için ücretlendirilecektir.{'\n\n'}
          Abonelikleri yönetmek ve otomatik yenilemeyi kapatmak için satın alma 
          işleminden sonra Hesap Ayarlarınıza gidin.{'\n\n'}
          <Text style={[styles.termsText, { color: '#3B82F6', textDecorationLine: 'underline' }]} 
            onPress={() => {
              Linking.openURL('https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html').catch(err => {
                Alert.alert('Hata', 'Gizlilik Politikası açılamadı');
                logger.error('Failed to open privacy policy:', err);
              });
            }}>
            Gizlilik Politikası
          </Text>
          {' • '}
          <Text style={[styles.termsText, { color: '#3B82F6', textDecorationLine: 'underline' }]}
            onPress={() => {
              Linking.openURL('https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html').catch(err => {
                Alert.alert('Hata', 'Kullanım Koşulları açılamadı');
                logger.error('Failed to open terms of service:', err);
              });
            }}>
            Kullanım Koşulları
          </Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Original container styles
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#0F172A',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Premium Active Styles
  premiumActiveContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  premiumHeader: {
    backgroundColor: '#1E293B',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  premiumHeaderContent: {
    alignItems: 'center',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  premiumBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  premiumTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  premiumSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 8,
    textAlign: 'center',
  },
  currentPlan: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  premiumScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  featuresShowcase: {
    marginTop: 24,
  },
  showcaseTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  showcaseSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  categoryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    padding: 16,
    textAlign: 'center',
  },
  featuresGrid: {
    padding: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 14,
    color: '#94A3B8',
  },
  premiumStats: {
    marginTop: 24,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Purchase Screen Styles
  purchaseContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  heroSection: {
    backgroundColor: '#1E293B',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#10B981',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  heroDescription: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  purchaseScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  premiumPlansSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  premiumPlanCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  selectedPlanCard: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 2,
  },
  planCurrency: {
    fontSize: 14,
    color: '#94A3B8',
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  selectedText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },

  // Feature Categories
  featureCategoryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  categoryHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  categoryTitleText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryFeatures: {
    padding: 16,
  },
  categoryFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryFeatureText: {
    fontSize: 14,
    color: '#E2E8F0',
    marginLeft: 8,
    flex: 1,
  },

  // Premium Stats Section
  premiumStatsSection: {
    marginTop: 24,
  },
  purchaseStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  purchaseStatItem: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  purchaseStatNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 4,
  },
  purchaseStatLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Buttons
  premiumPurchaseButton: {
    backgroundColor: '#10B981',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 32,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  purchaseButtonSubtext: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
  },
  restoreButton: {
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  termsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginHorizontal: 20,
    marginBottom: 32,
  },
});
