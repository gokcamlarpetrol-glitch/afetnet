import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { iapService, PREMIUM_PLANS, PremiumPlanId } from '../services/iapService';
import { palette, spacing } from '../ui/theme';
import Card from '../ui/Card';

const { width } = Dimensions.get('window');

export default function PremiumActiveScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlanId>('monthly');
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    initializeIAP();
    checkPremiumStatus();
  }, []);

  const initializeIAP = async () => {
    try {
      setIsLoading(true);
      const success = await iapService.initialize();
      
      if (success) {
        const products = await iapService.getAvailableProducts();
        setAvailableProducts(products);
        logger.info('IAP initialized successfully');
      } else {
        Alert.alert('❌ Hata', 'Satın alma sistemi başlatılamadı.');
      }
    } catch (error) {
      logger.error('IAP initialization failed:', error);
      Alert.alert('❌ Hata', 'Satın alma sistemi başlatılamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPremiumStatus = async () => {
    try {
      const premium = await iapService.checkPremiumStatus();
      setIsPremium(premium);
    } catch (error) {
      logger.error('Failed to check premium status:', error);
    }
  };

  const handlePurchase = async (planId: PremiumPlanId) => {
    try {
      setIsLoading(true);
      const success = await iapService.purchasePlan(planId);
      
      if (success) {
        logger.info('Purchase initiated for plan:', planId);
      }
    } catch (error) {
      logger.error('Purchase failed:', error);
      Alert.alert('❌ Hata', 'Satın alma işlemi başlatılamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsLoading(true);
      const success = await iapService.restorePurchases();
      
      if (success) {
        await checkPremiumStatus();
      }
    } catch (error) {
      logger.error('Restore failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
              <Text style={styles.featureDescription}>Tüm premium özellikleriniz aktif durumda.</Text>
            </View>
          </Card>

          <Pressable style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreButtonText}>Satın Alımları Geri Yükle</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
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
            <Card 
              key={planId} 
              style={[
                styles.planCard,
                selectedPlan === planId && styles.selectedPlan
              ]}
            >
              <Pressable 
                style={styles.planContent}
                onPress={() => setSelectedPlan(planId as PremiumPlanId)}
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
                    <Ionicons name="checkmark-circle" size={20} color={palette.success.main} />
                    <Text style={styles.selectedText}>Seçildi</Text>
                  </View>
                )}
              </Pressable>
            </Card>
          ))}
        </View>

        {/* Premium Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Premium Özellikler:</Text>
          
          {[
            {
              icon: 'people',
              title: 'Sınırsız Aile Takibi',
              description: 'Sınırsız aile üyesi, gerçek zamanlı konum takibi'
            },
            {
              icon: 'notifications',
              title: 'Öncelikli Deprem Uyarıları',
              description: 'En hızlı bildirimler, özelleştirilebilir filtreler'
            },
            {
              icon: 'map',
              title: 'Gelişmiş Çevrimdışı Haritalar',
              description: 'Yüksek çözünürlüklü offline haritalar'
            },
            {
              icon: 'shield-checkmark',
              title: 'Gelişmiş Güvenlik',
              description: 'End-to-end şifreleme, güvenli mesajlaşma'
            }
          ].map((feature, index) => (
            <Card key={index} style={styles.featureCard}>
              <Ionicons name={feature.icon as any} size={32} color={palette.primary.main} />
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
              ₺{PREMIUM_PLANS[selectedPlan].price} - {PREMIUM_PLANS[selectedPlan].title} Satın Al
            </Text>
          )}
        </Pressable>

        {/* Restore Button */}
        <Pressable style={styles.restoreButton} onPress={handleRestore}>
          <Text style={styles.restoreButtonText}>Satın Alımları Geri Yükle</Text>
        </Pressable>

        <Text style={styles.termsText}>
          Satın alma işlemi Apple/Google hesabınızdan ücretlendirilecektir.
          Abonelik otomatik olarak yenilenir, iptal etmediğiniz sürece.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.main,
  },
  content: {
    padding: spacing.md,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  messageCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  message: {
    textAlign: 'center',
    color: palette.text.secondary,
    fontSize: 16,
    lineHeight: 24,
  },
  plansContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  plansTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  planCard: {
    marginBottom: spacing.md,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPlan: {
    borderColor: palette.primary.main,
    backgroundColor: palette.primary.main + '10',
  },
  planContent: {
    padding: spacing.md,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.primary.main,
  },
  currency: {
    fontSize: 14,
    color: palette.text.secondary,
  },
  planDescription: {
    fontSize: 14,
    color: palette.text.secondary,
    marginBottom: spacing.sm,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  selectedText: {
    marginLeft: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: palette.success.main,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
    maxWidth: 400,
  },
  featureTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    fontSize: 14,
    color: palette.text.secondary,
  },
  purchaseButton: {
    backgroundColor: palette.primary.main,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  restoreButtonText: {
    color: palette.primary.main,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  termsText: {
    fontSize: 12,
    color: palette.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginHorizontal: spacing.md,
  },
});
