// PREMIUM SCREEN - PRODUCTION READY
// Elite level implementation with crash prevention
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { iapService, PREMIUM_PLANS, PremiumPlanId } from '../services/iapService';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';
import { logger } from '../utils/productionLogger';

const { width } = Dimensions.get('window');

export default function PremiumActiveScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlanId>('monthly');
  const [isPremium, setIsPremium] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

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
        setAvailableProducts(products);

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
      const premium = await iapService.checkPremiumStatus();
      setIsPremium(premium);
      logger.info('📊 Premium status:', premium);
    } catch (error) {
      logger.error('❌ Failed to check premium status:', error);
      // Don't show error to user - gracefully degrade
    }
  }, []);

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
        [{ text: 'Tamam', style: 'default' }]
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
          <ActivityIndicator size="large" color={palette.primary.main} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
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
          <Ionicons name="alert-circle" size={64} color={palette.error.main} />
          <Text style={styles.errorTitle}>Bağlantı Hatası</Text>
          <Text style={styles.errorMessage}>{initError}</Text>
          <Pressable style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Premium active state
  if (isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Ionicons name="star" size={64} color={palette.warning.main} />
            <Text style={styles.title}>Premium Üyesiniz! 🎉</Text>
            <Text style={styles.subtitle}>Tüm premium özellikler aktif</Text>
          </View>

          <Card style={styles.featureCard}>
            <Ionicons name="checkmark-circle" size={32} color={palette.success.main} />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Premium Aktif</Text>
              <Text style={styles.featureDescription}>
                Tüm premium özellikleriniz aktif durumda.
              </Text>
            </View>
          </Card>

          <Pressable
            style={[styles.restoreButton, isLoading && styles.disabledButton]}
            onPress={handleRestore}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={palette.primary.main} />
            ) : (
              <Text style={styles.restoreButtonText}>Satın Alımları Geri Yükle</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Purchase screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="star" size={64} color={palette.warning.main} />
          <Text style={styles.title}>Premium Özellikler</Text>
          <Text style={styles.subtitle}>Hayat kurtaran özellikler</Text>
        </View>

        <Card style={styles.messageCard}>
          <Text style={styles.message}>
            Premium üyelik ile tüm gelişmiş özelliklerden yararlanın!
          </Text>
        </Card>

        {/* Premium Plans */}
        <View style={styles.plansContainer}>
          <Text style={styles.plansTitle}>Premium Planlar</Text>

          {Object.entries(PREMIUM_PLANS).map(([planId, plan]) => (
            <View
              key={planId}
              style={
                selectedPlan === planId
                  ? [styles.planCard, styles.selectedPlan]
                  : styles.planCard
              }
            >
              <Pressable
                style={styles.planContent}
                onPress={() => setSelectedPlan(planId as PremiumPlanId)}
                disabled={isLoading}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.price}>₺{plan.price}</Text>
                    <Text style={styles.currency}>{plan.currency}</Text>
                  </View>
                </View>
                <Text style={styles.planDescription}>{plan.description}</Text>

                {selectedPlan === planId && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={palette.success.main}
                    />
                    <Text style={styles.selectedText}>Seçildi</Text>
                  </View>
                )}
              </Pressable>
            </View>
          ))}
        </View>

        {/* Premium Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Premium Özellikler:</Text>

          {[
            {
              icon: 'people' as const,
              title: 'Sınırsız Aile Takibi',
              description: 'Sınırsız aile üyesi, gerçek zamanlı konum takibi'
            },
            {
              icon: 'notifications' as const,
              title: 'Öncelikli Deprem Uyarıları',
              description: 'En hızlı bildirimler, özelleştirilebilir filtreler'
            },
            {
              icon: 'map' as const,
              title: 'Gelişmiş Çevrimdışı Haritalar',
              description: 'Yüksek çözünürlüklü offline haritalar'
            },
            {
              icon: 'shield-checkmark' as const,
              title: 'Gelişmiş Güvenlik',
              description: 'End-to-end şifreleme, güvenli mesajlaşma'
            }
          ].map((feature, index) => (
            <Card key={index} style={styles.featureCard}>
              <Ionicons name={feature.icon} size={32} color={palette.primary.main} />
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </Card>
          ))}
        </View>

        {/* Purchase Button */}
        <Pressable
          style={[styles.purchaseButton, isLoading && styles.disabledButton]}
          onPress={() => handlePurchase(selectedPlan)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              ₺{PREMIUM_PLANS[selectedPlan].price} - {PREMIUM_PLANS[selectedPlan].title}{' '}
              Satın Al
            </Text>
          )}
        </Pressable>

        {/* Restore Button */}
        <Pressable
          style={[styles.restoreButton, isLoading && styles.disabledButton]}
          onPress={handleRestore}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={palette.primary.main} />
          ) : (
            <Text style={styles.restoreButtonText}>Satın Alımları Geri Yükle</Text>
          )}
        </Pressable>

        <Text style={styles.termsText}>
          Satın alma işlemi Apple/Google hesabınızdan ücretlendirilecektir. Abonelik
          otomatik olarak yenilenir, iptal etmediğiniz sürece.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.primary
  },
  content: {
    padding: spacing.md,
    alignItems: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: palette.text.secondary
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginTop: spacing.md,
    textAlign: 'center'
  },
  errorMessage: {
    fontSize: 16,
    color: palette.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: palette.primary.main as string,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginTop: spacing.md,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  messageCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
    maxWidth: 400
  },
  message: {
    textAlign: 'center',
    color: palette.text.secondary,
    fontSize: 16,
    lineHeight: 24
  },
  plansContainer: {
    width: '100%',
    marginBottom: spacing.lg
  },
  plansTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center'
  },
  planCard: {
    marginBottom: spacing.md,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: palette.background.secondary,
    borderRadius: 12,
    padding: 0
  },
  selectedPlan: {
    borderColor: palette.primary.main as string,
    backgroundColor: (palette.primary.main as string) + '10'
  },
  planContent: {
    padding: spacing.md
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary
  },
  priceContainer: {
    alignItems: 'flex-end'
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.primary.main
  },
  currency: {
    fontSize: 14,
    color: palette.text.secondary
  },
  planDescription: {
    fontSize: 14,
    color: palette.text.secondary,
    marginBottom: spacing.sm
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm
  },
  selectedText: {
    marginLeft: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: palette.success.main
  },
  featuresContainer: {
    width: '100%',
    marginBottom: spacing.lg
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center'
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
    maxWidth: 400
  },
  featureTextContainer: {
    marginLeft: spacing.md,
    flex: 1
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.xs
  },
  featureDescription: {
    fontSize: 14,
    color: palette.text.secondary
  },
  purchaseButton: {
    backgroundColor: palette.primary.main as string,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center'
  },
  disabledButton: {
    opacity: 0.6
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold'
  },
  restoreButton: {
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  restoreButtonText: {
    color: palette.primary.main,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  termsText: {
    fontSize: 12,
    color: palette.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginHorizontal: spacing.md
  }
});
