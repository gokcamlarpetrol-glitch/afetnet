// APPLE COMPLIANCE: Premium screen temporarily disabled
// Will be replaced with Apple IAP implementation
import { Ionicons } from '@expo/vector-icons';
// DISABLED: import { useStripe } from '@stripe/stripe-react-native';
import { useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PAYMENT_METHODS, paymentService } from '../services/payment';
import { PREMIUM_PLANS, PremiumPlan, usePremium } from '../store/premium';

const { width } = Dimensions.get('window');

export default function PremiumScreen() {
  const { isPremium, currentPlan, setPremium, subscriptionEndDate } = usePremium();
  // DISABLED: const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan['id'] | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'apple' | 'google'>('card');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleSelectPlan = (planId: PremiumPlan['id']) => {
    setSelectedPlan(planId);
    setShowPaymentModal(true);
  };

  const handlePurchase = async (planId: PremiumPlan['id']) => {
    if (isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    
    try {
      if (selectedPaymentMethod === 'card') {
        // Use Stripe Payment Sheet for card payments
        await handleStripePayment(planId);
      } else {
        // Use our payment service for Apple Pay and Google Pay
        const result = await paymentService.purchaseSubscription(planId, selectedPaymentMethod);
        
        if (result.success) {
          setPremium(true, planId);
          setShowPaymentModal(false);
          setSelectedPlan(null);
          
          Alert.alert(
            '🎉 Premium Aktif!',
            `Tüm premium özellikler artık kullanımınızda!\n\nİşlem ID: ${result.transactionId}`,
            [{ text: 'Harika!' }]
          );
        } else {
          Alert.alert(
            'Ödeme Başarısız',
            result.error || 'Ödeme işlemi tamamlanamadı. Lütfen tekrar deneyin.',
            [{ text: 'Tamam' }]
          );
        }
      }
    } catch (error) {
      Alert.alert('Hata', 'Ödeme işlemi sırasında bir hata oluştu.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStripePayment = async (planId: PremiumPlan['id']) => {
    try {
      const pricing = paymentService.getPlanPricing(planId);
      
      // Create payment intent
      const paymentIntent = await paymentService.createPaymentIntent(planId, pricing.price);
      
      if (paymentIntent.error) {
        Alert.alert('Hata', paymentIntent.error);
        return;
      }

      // Initialize payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'AfetNet Premium',
        paymentIntentClientSecret: paymentIntent.clientSecret,
        defaultBillingDetails: {
          name: 'AfetNet Kullanıcısı',
        },
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        Alert.alert('Hata', initError.message);
        return;
      }

      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Ödeme Hatası', presentError.message);
        }
        return;
      }

      // Payment successful
      setPremium(true, planId);
      setShowPaymentModal(false);
      setSelectedPlan(null);
      
      Alert.alert(
        '🎉 Premium Aktif!',
        `Tüm premium özellikler artık kullanımınızda!\n\nPlan: ${PREMIUM_PLANS.find(p => p.id === planId)?.name}`,
        [{ text: 'Harika!' }]
      );

    } catch (error) {
      Alert.alert('Hata', 'Stripe ödeme işlemi başarısız oldu.');
    }
  };

  const renderPlanCard = (plan: PremiumPlan) => {
    const isPopular = plan.popular;
    const isSelected = selectedPlan === plan.id;
    const isCurrentPlan = currentPlan === plan.id;

    return (
      <Pressable accessible={true}
          accessibilityRole="button"
        key={plan.id}
        onPress={() => handleSelectPlan(plan.id)}
        disabled={isCurrentPlan || isProcessingPayment}
        style={[
          styles.planCard,
          isPopular && styles.popularCard,
          isSelected && styles.selectedCard,
          isCurrentPlan && styles.currentCard,
        ]}
      >
        {/* Popular Badge */}
        {isPopular && (
          <View style={styles.popularBadge}>
            <Ionicons name="star" size={16} color="#FFFFFF" />
            <Text style={styles.popularBadgeText}>ÖNERİLEN</Text>
          </View>
        )}

        {/* Current Plan Badge */}
        {isCurrentPlan && (
          <View style={styles.currentBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.currentBadgeText}>AKTİF PLAN</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <View style={styles.planIcon}>
            <Ionicons 
              name={plan.id === 'monthly' ? 'calendar' : plan.id === 'yearly' ? 'calendar-outline' : 'shield-checkmark'} 
              size={32} 
              color={isPopular ? "#FFD700" : "#3B82F6"} 
            />
          </View>
          
          <View style={styles.planInfo}>
            <Text style={[styles.planName, isPopular && styles.popularPlanName]}>
              {plan.name}
            </Text>
            <Text style={styles.planDescription}>
              {plan.description}
            </Text>
          </View>
        </View>

        <View style={styles.planPricing}>
          {plan.originalPrice && (
            <Text style={styles.originalPrice}>
              {plan.originalPrice.toFixed(2)} ₺
            </Text>
          )}
          <View style={styles.priceContainer}>
            <Text style={[styles.planPrice, isPopular && styles.popularPrice]}>
              {plan.priceFormatted}
            </Text>
            <Text style={styles.planPeriod}>/{plan.period}</Text>
          </View>
          
          {plan.discount && (
            <View style={styles.discountContainer}>
              <Text style={styles.discountText}>
                %{plan.discount} İNDİRİM
              </Text>
            </View>
          )}
        </View>

        <View style={styles.planFeatures}>
          {plan.features.slice(0, 4).map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
          {plan.features.length > 4 && (
            <Text style={styles.moreFeatures}>
              +{plan.features.length - 4} özellik daha
            </Text>
          )}
        </View>

        <View style={styles.planButton}>
          {isCurrentPlan ? (
            <View style={styles.currentPlanButton}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={styles.currentPlanButtonText}>Aktif Plan</Text>
            </View>
          ) : (
            <View style={[
              styles.selectPlanButton,
              isPopular && styles.popularButton,
            ]}>
              <Text style={[
                styles.selectPlanButtonText,
                isPopular && styles.popularButtonText,
              ]}>
                {isProcessingPayment ? 'İşleniyor...' : 'Planı Seç'}
              </Text>
              <Ionicons 
                name="arrow-forward" 
                size={16} 
                color={isPopular ? "#FFFFFF" : "#3B82F6"} 
              />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderPaymentModal = () => (
    <Modal
          accessible={true}
          accessibilityViewIsModal={true}
      visible={showPaymentModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPaymentModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable accessible={true}
          accessibilityRole="button"
            onPress={() => setShowPaymentModal(false)}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </Pressable>
          
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitle}>Premium Abonelik</Text>
            <Text style={styles.modalSubtitle}>
              {selectedPlan && PREMIUM_PLANS.find(p => p.id === selectedPlan)?.name}
            </Text>
          </View>
          
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Selected Plan Summary */}
          {selectedPlan && (
            <View style={styles.selectedPlanSummary}>
              <View style={styles.summaryHeader}>
                <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                <Text style={styles.summaryTitle}>Seçilen Plan</Text>
              </View>
              
              <View style={styles.summaryPlan}>
                <Text style={styles.summaryPlanName}>
                  {PREMIUM_PLANS.find(p => p.id === selectedPlan)?.name}
                </Text>
                <Text style={styles.summaryPlanPrice}>
                  {PREMIUM_PLANS.find(p => p.id === selectedPlan)?.priceFormatted}
                </Text>
                <Text style={styles.summaryPlanPeriod}>
                  / {PREMIUM_PLANS.find(p => p.id === selectedPlan)?.period}
                </Text>
              </View>
            </View>
          )}

          {/* Payment Methods */}
          <View style={styles.paymentMethodsSection}>
            <Text style={styles.sectionTitle}>Ödeme Yöntemi</Text>
            
            {PAYMENT_METHODS.map((method) => (
              <Pressable accessible={true}
          accessibilityRole="button"
                key={method.id}
                onPress={() => setSelectedPaymentMethod(method.id as any)}
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === method.id && styles.selectedPaymentMethod,
                ]}
              >
                <View style={styles.paymentMethodIcon}>
                  <Ionicons 
                    name={config.icon} 
                    size={24} 
                    color={selectedPaymentMethod === method.id ? "#3B82F6" : "#6B7280"} 
                  />
                </View>
                
                <View style={styles.paymentMethodInfo}>
                  <Text style={[
                    styles.paymentMethodName,
                    selectedPaymentMethod === method.id && styles.selectedPaymentMethodName,
                  ]}>
                    {method.name}
                  </Text>
                  <Text style={styles.paymentMethodDescription}>
                    {method.description}
                  </Text>
                </View>
                
                <View style={styles.paymentMethodRadio}>
                  <View style={[
                    styles.radioButton,
                    selectedPaymentMethod === method.id && styles.radioButtonSelected,
                  ]}>
                    {selectedPaymentMethod === method.id && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Purchase Button */}
          <Pressable accessible={true}
          accessibilityRole="button"
            onPress={() => selectedPlan && handlePurchase(selectedPlan)}
            disabled={!selectedPlan || isProcessingPayment}
            style={[
              styles.purchaseButton,
              (!selectedPlan || isProcessingPayment) && styles.purchaseButtonDisabled,
            ]}
          >
            <Text style={[
              styles.purchaseButtonText,
              (!selectedPlan || isProcessingPayment) && styles.purchaseButtonTextDisabled,
            ]}>
              {isProcessingPayment ? 'İşleniyor...' : 'Premium\'a Geç'}
            </Text>
            <Ionicons 
              name="arrow-forward" 
              size={20} 
              color={(!selectedPlan || isProcessingPayment) ? "#9CA3AF" : "#FFFFFF"} 
            />
          </Pressable>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            <Text style={styles.securityNoticeText}>
              Güvenli ödeme • SSL korumalı • İstediğiniz zaman iptal edebilirsiniz
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        
        {/* Premium Active Header */}
        <View style={styles.activeHeader}>
          <View style={styles.activeHeaderContent}>
            <View style={styles.activeIconContainer}>
                <Ionicons name="shield-checkmark" size={32} color="#10B981" />
            </View>
            
            <View style={styles.activeInfo}>
              <Text style={styles.activeTitle}>Premium Aktif</Text>
              <Text style={styles.activeSubtitle}>
                {currentPlan && PREMIUM_PLANS.find(p => p.id === currentPlan)?.name}
              </Text>
              {subscriptionEndDate && (
                <Text style={styles.activeExpiry}>
                  Yenilenme: {formatDate(subscriptionEndDate)}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>AKTİF</Text>
          </View>
        </View>

        {/* Premium Features */}
        <ScrollView style={styles.activeContent} showsVerticalScrollIndicator={false}>
          <View style={styles.activeFeaturesSection}>
            <Text style={styles.sectionTitle}>Premium Özellikler</Text>
            
            <View style={styles.activeFeaturesGrid}>
              <View style={styles.activeFeatureCard}>
                <Ionicons name="flash" size={24} color="#3B82F6" />
                <Text style={styles.activeFeatureTitle}>Sınırsız SOS</Text>
                <Text style={styles.activeFeatureDesc}>Acil durumlarda sınırsız yardım çağrısı</Text>
              </View>
              
              <View style={styles.activeFeatureCard}>
                <Ionicons name="chatbubbles" size={24} color="#10B981" />
                <Text style={styles.activeFeatureTitle}>Mesh Mesajlaşma</Text>
                <Text style={styles.activeFeatureDesc}>İnternet olmadan mesajlaşma</Text>
              </View>
              
              <View style={styles.activeFeatureCard}>
                <Ionicons name="people" size={24} color="#F59E0B" />
                <Text style={styles.activeFeatureTitle}>Aile Takibi</Text>
                <Text style={styles.activeFeatureDesc}>Sınırsız aile üyesi ekleme</Text>
              </View>
              
              <View style={styles.activeFeatureCard}>
                <Ionicons name="map" size={24} color="#8B5CF6" />
                <Text style={styles.activeFeatureTitle}>Offline Harita</Text>
                <Text style={styles.activeFeatureDesc}>İnternet olmadan harita kullanımı</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={28} color="#10B981" />
          </View>
          
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>AfetNet Premium</Text>
            <Text style={styles.headerSubtitle}>
              Hayat kurtaran özellikler, sınırsız erişim
            </Text>
          </View>
        </View>
        
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>PREMIUM</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={48} color="#10B981" />
          </View>
          
          <Text style={styles.heroTitle}>
            Ailenizi ve Sevdiklerinizi Koruyun
          </Text>
          
          <Text style={styles.heroDescription}>
            Premium özelliklerle acil durumlarda daha hızlı ve etkili yardım alın. 
            Sınırsız mesajlaşma, offline harita ve gelişmiş güvenlik özellikleri.
          </Text>
        </View>

        {/* Plans Section */}
        <View style={styles.plansSection}>
          <Text style={styles.sectionTitle}>Premium Planları</Text>
          <Text style={styles.sectionSubtitle}>
            İhtiyacınıza uygun planı seçin
          </Text>
          
          <View style={styles.plansContainer}>
            {PREMIUM_PLANS.map(renderPlanCard)}
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Premium Avantajları</Text>
          
          <View style={styles.featuresGrid}>
            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Ionicons name="flash" size={24} color="#EF4444" />
              </View>
              <Text style={styles.featureTitle}>Acil Yardım</Text>
              <Text style={styles.featureDescription}>
                Sınırsız SOS gönderimi ile acil durumlarda anında yardım
              </Text>
            </View>
            
            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Ionicons name="radio" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.featureTitle}>Mesh Ağı</Text>
              <Text style={styles.featureDescription}>
                İnternet olmadan BLE mesh ağı ile mesajlaşma
              </Text>
            </View>
            
            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Ionicons name="people" size={24} color="#10B981" />
              </View>
              <Text style={styles.featureTitle}>Aile Takibi</Text>
              <Text style={styles.featureDescription}>
                Sınırsız aile üyesi ekleme ve gerçek zamanlı takip
              </Text>
            </View>
            
            <View style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Ionicons name="map" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.featureTitle}>Offline Harita</Text>
              <Text style={styles.featureDescription}>
                İnternet bağlantısı olmadan harita kullanımı
              </Text>
            </View>
          </View>
        </View>

        {/* Free vs Premium Comparison */}
        <View style={styles.comparisonSection}>
          <Text style={styles.sectionTitle}>Ücretsiz vs Premium</Text>
          
          <View style={styles.comparisonTable}>
            <View style={styles.comparisonHeader}>
              <Text style={styles.comparisonHeaderText}>Özellik</Text>
              <Text style={styles.comparisonHeaderText}>Ücretsiz</Text>
              <Text style={styles.comparisonHeaderText}>Premium</Text>
            </View>
            
            {[
              { feature: 'Deprem Bildirimi', free: '✅', premium: '✅' },
              { feature: 'SOS Gönderimi', free: '❌', premium: '✅ Sınırsız' },
              { feature: 'BLE Mesajlaşma', free: '❌', premium: '✅ Sınırsız' },
              { feature: 'Aile Üyesi', free: '❌', premium: '✅ Sınırsız' },
              { feature: 'Offline Harita', free: '❌', premium: '✅ Sınırsız' },
              { feature: 'Enkaz Algılama', free: '❌', premium: '✅ Gelişmiş' },
            ].map((item, index) => (
              <View key={index} style={styles.comparisonRow}>
                <Text style={styles.comparisonFeature}>{item.feature}</Text>
                <Text style={styles.comparisonFree}>{item.free}</Text>
                <Text style={styles.comparisonPremium}>{item.premium}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {renderPaymentModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 44, // Status bar için
    paddingBottom: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  headerBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  
  // Content Styles
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80, // Alt navigation bar için boşluk
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 0,
    backgroundColor: '#1E293B',
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  heroDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  
  // Section Styles
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  
  // Plans Section
  plansSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  plansContainer: {
    gap: 8,
  },
  
  // Plan Card Styles
  planCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
  },
  popularCard: {
    borderColor: '#FFD700',
    backgroundColor: '#1E293B',
  },
  selectedCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  currentCard: {
    borderColor: '#10B981',
    backgroundColor: '#064E3B',
  },
  
  // Badges
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  currentBadge: {
    position: 'absolute',
    top: -8,
    right: 20,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  
  // Plan Header
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  planIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  popularPlanName: {
    color: '#FFD700',
  },
  planDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  
  // Plan Pricing
  planPricing: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  originalPrice: {
    fontSize: 16,
    color: '#6B7280',
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  popularPrice: {
    color: '#FFD700',
  },
  planPeriod: {
    fontSize: 16,
    color: '#94A3B8',
    marginLeft: 4,
  },
  discountContainer: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Plan Features
  planFeatures: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#E2E8F0',
    marginLeft: 8,
    flex: 1,
  },
  moreFeatures: {
    fontSize: 14,
    color: '#3B82F6',
    fontStyle: 'italic',
    marginTop: 8,
  },
  
  // Plan Button
  planButton: {
    marginTop: 'auto',
  },
  selectPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  popularButton: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  selectPlanButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
    marginRight: 8,
  },
  popularButtonText: {
    color: '#0F172A',
  },
  currentPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  currentPlanButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  // Features Section
  featuresSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    backgroundColor: '#1E293B',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureCard: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    width: (width - 56) / 2,
    alignItems: 'center',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Comparison Section
  comparisonSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  comparisonTable: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  comparisonHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  comparisonFeature: {
    flex: 2,
    fontSize: 14,
    color: '#E2E8F0',
  },
  comparisonFree: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  comparisonPremium: {
    flex: 1,
    fontSize: 14,
    color: '#10B981',
    textAlign: 'center',
    fontWeight: '600',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Selected Plan Summary
  selectedPlanSummary: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  summaryPlan: {
    alignItems: 'center',
  },
  summaryPlanName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3B82F6',
    marginBottom: 8,
  },
  summaryPlanPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  summaryPlanPeriod: {
    fontSize: 16,
    color: '#94A3B8',
  },
  
  // Payment Methods
  paymentMethodsSection: {
    marginBottom: 32,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPaymentMethod: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  selectedPaymentMethodName: {
    color: '#3B82F6',
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  paymentMethodRadio: {
    marginLeft: 16,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#3B82F6',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  
  // Purchase Button
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
  },
  purchaseButtonDisabled: {
    backgroundColor: '#374151',
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  purchaseButtonTextDisabled: {
    color: '#9CA3AF',
  },
  
  // Security Notice
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  securityNoticeText: {
    fontSize: 14,
    color: '#10B981',
    marginLeft: 12,
    flex: 1,
  },
  
  // Active Premium Styles
  activeHeader: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  activeHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activeInfo: {
    flex: 1,
  },
  activeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFD700',
    marginBottom: 4,
  },
  activeSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  activeExpiry: {
    fontSize: 14,
    color: '#94A3B8',
  },
  activeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  
  activeContent: {
    flex: 1,
  },
  activeFeaturesSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  activeFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 20,
  },
  activeFeatureCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    width: (width - 56) / 2,
    alignItems: 'center',
  },
  activeFeatureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 12,
    textAlign: 'center',
  },
  activeFeatureDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});