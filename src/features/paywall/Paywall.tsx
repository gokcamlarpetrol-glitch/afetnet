// REVENUECAT PAYWALL COMPONENT
// Full-featured paywall with RevenueCat integration
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getCurrentOfferings,
  fetchOfferings,
  purchasePackage,
  restorePurchases,
  PurchasesPackage,
  Purchases,
} from '../../lib/revenuecat';
import { usePremium } from '../premium/usePremium';
import { logger } from '../../utils/productionLogger';

export default function Paywall({ navigation }: { navigation?: any }) {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isPremium, isLoading: isPremiumLoading } = usePremium();
  
  // Get current offerings
  const offerings = getCurrentOfferings();
  const currentOffering = offerings?.current;

  // Load offerings on mount
  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const fetchedOfferings = await fetchOfferings();
        
        if (fetchedOfferings?.current && fetchedOfferings.current.availablePackages.length > 0) {
          // Auto-select the first package
          const firstPackage = fetchedOfferings.current.availablePackages[0];
          setSelectedPackageId(firstPackage.identifier);
          
          logger.info('📦 Offerings loaded:', fetchedOfferings.current.availablePackages.length);
        }
      } catch (error) {
        logger.error('❌ Failed to load offerings:', error);
        Alert.alert('⚠️ Error', 'Failed to load subscription options. Please try again later.');
      }
    };

    loadOfferings();
  }, []);

  // Handle purchase
  const handlePurchase = useCallback(async () => {
    if (!selectedPackageId || !currentOffering) {
      Alert.alert('⚠️ Seçim Gerekli', 'Lütfen bir abonelik planı seçin.');
      return;
    }

    const packageToPurchase = currentOffering.availablePackages.find(
      (pkg) => pkg.identifier === selectedPackageId,
    );

    if (!packageToPurchase) {
      Alert.alert('❌ Hata', 'Seçilen paket bulunamadı.');
      return;
    }

    if (isProcessing) {
      logger.warn('Purchase already in progress');
      return;
    }

    try {
      setIsProcessing(true);
      logger.info('🛒 Starting purchase for package:', packageToPurchase.identifier);

      // Purchase package - purchasePackage already handles alerts internally
      const success = await purchasePackage(
        packageToPurchase,
        () => {
          // Success callback - Premium status will be updated via listener
          logger.info('✅ Purchase successful, premium should be active');
          // Refresh premium status
          if (isPremium !== undefined) {
            // Status will update automatically via listener
          }
        },
        (error) => {
          // Error callback - purchasePackage already shows alert
          logger.error('❌ Purchase failed:', error);
        }
      );

      // Note: purchasePackage already shows alerts, so we don't need to show again
      // But we can log the result
      if (success) {
        logger.info('✅ Purchase completed successfully');
      }
    } catch (error: any) {
      logger.error('❌ Purchase error:', error);
      // Only show alert if purchasePackage didn't handle it
      if (error.message && !error.userCancelled && !error.purchaseAlreadyOwned) {
        Alert.alert('❌ Hata', error.message || 'Satın alma başarısız oldu.');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPackageId, currentOffering, isProcessing, isPremium]);

  // Handle restore
  const handleRestore = useCallback(async () => {
    if (isProcessing) {
      logger.warn('Restore already in progress');
      return;
    }

    try {
      setIsProcessing(true);
      logger.info('🔄 Starting restore purchases...');

      const success = await restorePurchases();

      // restorePurchases already shows alerts internally
      if (success) {
        logger.info('✅ Purchases restored successfully');
      } else {
        logger.info('ℹ️ No purchases found to restore');
      }
    } catch (error: any) {
      logger.error('❌ Restore error:', error);
      // restorePurchases already shows alert, but show additional info if needed
      if (error.message && !error.message.includes('No active purchases')) {
        Alert.alert('❌ Hata', error.message || 'Satın alımlar geri yüklenemedi.');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isPremium, isProcessing]);

  // Loading state
  if (isPremiumLoading || !currentOffering) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Abonelik seçenekleri yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If already premium, show success message
  if (isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Geri"
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={styles.premiumActiveContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.premiumHeader}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          <Text style={styles.premiumTitle}>Premium Aktif</Text>
          <Text style={styles.premiumSubtitle}>Tüm premium özelliklere tam erişiminiz var</Text>
          </View>

          <View style={styles.featuresList}>
            <Text style={styles.featuresTitle}>Premium Özellikler:</Text>
            {[
              'Offline Haritalar',
              'BLE Mesh İletişim',
              'Deprem Erken Uyarı',
              'Aile Takibi',
              'Gelişmiş Konum Servisleri',
              'Öncelikli Destek',
            ].map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isProcessing}
          >
            <Text style={styles.restoreButtonText}>
              {isProcessing ? 'Yenileniyor...' : 'Satın Alımları Yenile'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const { monthly, yearly, lifetime } = currentOffering.availablePackages.reduce(
    (acc, pkg) => {
      if (pkg.identifier.includes('monthly')) acc.monthly = pkg;
      else if (pkg.identifier.includes('yearly')) acc.yearly = pkg;
      else if (pkg.identifier.includes('lifetime')) acc.lifetime = pkg;
      return acc;
    },
    {} as Record<string, PurchasesPackage>,
  );

  // Display packages
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Premium'a Geç</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentHeader}>
          <Text style={styles.title}>Premium Abonelik</Text>
          <Text style={styles.subtitle}>Tüm premium özelliklerin kilidini aç</Text>
        </View>

        {/* Monthly Plan */}
        {monthly && (
          <Pressable
            style={[
              styles.planCard,
              selectedPackageId === monthly.identifier && styles.selectedPlan,
            ]}
            onPress={() => {
              if (!isProcessing) {
                setSelectedPackageId(monthly.identifier);
              }
            }}
            disabled={isProcessing}
            accessibilityRole="button"
            accessibilityLabel={`${monthly.product.title} planını seç`}
            accessibilityState={{ selected: selectedPackageId === monthly.identifier, disabled: isProcessing }}
          >
            <View style={styles.planInfo}>
              <Text style={styles.planTitle}>{monthly.product.title}</Text>
              <Text style={styles.planDescription}>{monthly.product.description}</Text>
            </View>
            <View style={styles.planPrice}>
              <Text style={styles.priceText}>{monthly.product.priceString}</Text>
            </View>
            {selectedPackageId === monthly.identifier && (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            )}
          </Pressable>
        )}

        {/* Yearly Plan */}
        {yearly && (
          <Pressable
            style={[
              styles.planCard,
              selectedPackageId === yearly.identifier && styles.selectedPlan,
            ]}
            onPress={() => {
              if (!isProcessing) {
                setSelectedPackageId(yearly.identifier);
              }
            }}
            disabled={isProcessing}
            accessibilityRole="button"
            accessibilityLabel={`${yearly.product.title} planını seç`}
            accessibilityState={{ selected: selectedPackageId === yearly.identifier, disabled: isProcessing }}
          >
            <View style={styles.planInfo}>
              <Text style={styles.planTitle}>{yearly.product.title}</Text>
              <Text style={styles.planDescription}>{yearly.product.description}</Text>
            </View>
            <View style={styles.planPrice}>
              <Text style={styles.priceText}>{yearly.product.priceString}</Text>
            </View>
            {selectedPackageId === yearly.identifier && (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            )}
          </Pressable>
        )}

        {/* Lifetime Plan */}
        {lifetime && (
          <Pressable
            style={[
              styles.planCard,
              selectedPackageId === lifetime.identifier && styles.selectedPlan,
            ]}
            onPress={() => {
              if (!isProcessing) {
                setSelectedPackageId(lifetime.identifier);
              }
            }}
            disabled={isProcessing}
            accessibilityRole="button"
            accessibilityLabel={`${lifetime.product.title} planını seç`}
            accessibilityState={{ selected: selectedPackageId === lifetime.identifier, disabled: isProcessing }}
          >
            <View style={styles.planInfo}>
              <Text style={styles.planTitle}>{lifetime.product.title}</Text>
              <Text style={styles.planDescription}>{lifetime.product.description}</Text>
            </View>
            <View style={styles.planPrice}>
              <Text style={styles.priceText}>{lifetime.product.priceString}</Text>
            </View>
            {selectedPackageId === lifetime.identifier && (
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            )}
          </Pressable>
        )}

        {/* Purchase Button */}
        <Pressable
          style={[styles.purchaseButton, (isProcessing || !selectedPackageId) && styles.disabledButton]}
          onPress={handlePurchase}
          disabled={isProcessing || !selectedPackageId}
          accessibilityRole="button"
          accessibilityLabel="Premium abonelik satın al"
          accessibilityState={{ disabled: isProcessing || !selectedPackageId }}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              Abone Ol
            </Text>
          )}
        </Pressable>

        {/* Restore Button */}
        <Pressable
          style={[styles.restoreButton, isProcessing && styles.disabledButton]}
          onPress={handleRestore}
          disabled={isProcessing}
          accessibilityRole="button"
          accessibilityLabel="Satın alımları geri yükle"
          accessibilityState={{ disabled: isProcessing }}
        >
          <Text style={styles.restoreButtonText}>
            {isProcessing ? 'Geri yükleniyor...' : 'Satın Alımları Geri Yükle'}
          </Text>
        </Pressable>

        {/* Terms */}
        <Text style={styles.termsText}>
          Abonelik Apple ID hesabınızdan ücretlendirilecektir. Abonelik, mevcut dönemin sonundan en az 24 saat önce iptal edilmediği sürece otomatik olarak yenilenir. Abonelikleri Hesap Ayarları'ndan yönetebilirsiniz.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  scrollView: {
    flex: 1,
  },
  contentHeader: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedPlan: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  planPrice: {
    marginRight: 12,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  purchaseButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  restoreButton: {
    padding: 16,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    lineHeight: 18,
  },
  premiumActiveContainer: {
    flex: 1,
    padding: 20,
  },
  premiumHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  premiumTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  premiumSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  featuresList: {
    marginTop: 24,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#E2E8F0',
    marginLeft: 12,
  },
});

