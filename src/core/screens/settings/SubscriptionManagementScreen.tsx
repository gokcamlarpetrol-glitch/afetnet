/**
 * SUBSCRIPTION MANAGEMENT SCREEN - Elite Premium Design
 * Apple App Store requirement: Users must be able to manage subscriptions
 * Modern, professional, and elegant subscription management interface
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { usePremiumStore } from '../../stores/premiumStore';
import { premiumService } from '../../services/PremiumService';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SubscriptionManagementScreen');

export default function SubscriptionManagementScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    const checkStatus = () => {
      const premiumState = usePremiumStore.getState();
      setIsPremium(premiumState.isPremium);
      setSubscriptionType(premiumState.subscriptionType);
      setExpiresAt(premiumState.expiresAt);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRestorePurchases = async () => {
    setIsLoading(true);
    haptics.impactMedium();

    try {
      const success = await premiumService.restorePurchases();
      if (success) {
        Alert.alert(
          'Başarılı',
          'Satın alımlarınız başarıyla geri yüklendi.',
          [{ text: 'Tamam' }]
        );
      } else {
        Alert.alert(
          'Bilgi',
          'Geri yüklenecek satın alım bulunamadı.',
          [{ text: 'Tamam' }]
        );
      }
    } catch (error) {
      logger.error('Restore purchases error:', error);
      Alert.alert(
        'Hata',
        'Satın alımları geri yüklerken bir hata oluştu. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscriptions = async () => {
    haptics.impactMedium();

    try {
      // CRITICAL FIX: Apple prefers Settings app for subscription management
      // This is more reliable than web URL and Apple's preferred method
      if (Platform.OS === 'ios') {
        // Try to open Settings app directly (iOS 8.0+)
        // This is the most reliable method for subscription management
        try {
          await Linking.openSettings();
        } catch (settingsError) {
          // Fallback: Try App Store deep link (iOS 10.3+)
          try {
            const appStoreUrl = 'itms-apps://apps.apple.com/account/subscriptions';
            const canOpen = await Linking.canOpenURL(appStoreUrl);
            if (canOpen) {
              await Linking.openURL(appStoreUrl);
            } else {
              // Final fallback: Show instructions
              Alert.alert(
                'Abonelik Yönetimi',
                'Aboneliklerinizi yönetmek için:\n\n1. Ayarlar uygulamasını açın\n2. Apple ID\'nize dokunun\n3. Abonelikler bölümüne gidin',
                [{ text: 'Tamam' }]
              );
            }
          } catch (appStoreError) {
            logger.error('App Store URL error:', appStoreError);
            Alert.alert(
              'Abonelik Yönetimi',
              'Aboneliklerinizi yönetmek için:\n\n1. Ayarlar uygulamasını açın\n2. Apple ID\'nize dokunun\n3. Abonelikler bölümüne gidin',
              [{ text: 'Tamam' }]
            );
          }
        }
      } else {
        // Android: Google Play subscription management
        const url = 'https://play.google.com/store/account/subscriptions';
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert(
            'Bilgi',
            'Abonelik yönetimi için Google Play Store\'a yönlendirilemiyorsunuz. Lütfen Play Store uygulamasından yönetin.',
            [{ text: 'Tamam' }]
          );
        }
      }
    } catch (error) {
      logger.error('Manage subscriptions error:', error);
      Alert.alert(
        'Hata',
        'Abonelik yönetim sayfası açılamadı. Lütfen Ayarlar > Apple ID > Abonelikler bölümünden yönetin.',
        [{ text: 'Tamam' }]
      );
    }
  };

  const formatExpirationDate = (timestamp: number | null) => {
    if (!timestamp) return 'Bilinmiyor';
    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSubscriptionTypeText = (type: string | null) => {
    if (!type) return 'Ömür Boyu';
    switch (type) {
      case 'monthly':
        return 'Aylık';
      case 'yearly':
        return 'Yıllık';
      case 'lifetime':
        return 'Ömür Boyu';
      default:
        return 'Bilinmiyor';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#334155']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header with Blur */}
      <BlurView intensity={80} tint="dark" style={styles.headerBlur}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => {
              haptics.impactLight();
              navigation.goBack();
            }}
            style={styles.backButton}
            accessibilityLabel="Geri"
            accessibilityRole="button"
          >
            <View style={styles.backButtonContainer}>
              <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
            </View>
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Abonelik Yönetimi</Text>
            <Text style={styles.headerSubtitle}>Premium üyelik durumunuz</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      </BlurView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Subscription Status - Enhanced */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <View style={styles.statusCard}>
            <LinearGradient
              colors={
                isPremium
                  ? ['#3b82f6', '#2563eb', '#1e40af']
                  : ['#475569', '#334155', '#1e293b']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statusGradient}
            >
              {/* Premium Badge */}
              <View style={styles.premiumBadge}>
                <LinearGradient
                  colors={isPremium ? ['#fbbf24', '#f59e0b'] : ['#64748b', '#475569']}
                  style={styles.badgeGradient}
                >
                  <Ionicons
                    name={isPremium ? 'star' : 'star-outline'}
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.badgeText}>
                    {isPremium ? 'PREMIUM' : 'STANDART'}
                  </Text>
                </LinearGradient>
              </View>

              {/* Status Icon */}
              <View style={styles.statusIconContainer}>
                <View style={styles.statusIconBackground}>
                  <Ionicons
                    name={isPremium ? 'checkmark-circle' : 'time-outline'}
                    size={64}
                    color="#ffffff"
                  />
                </View>
              </View>

              {/* Status Text */}
              <Text style={styles.statusTitle}>
                {isPremium ? 'Premium Aktif' : 'Premium Aktif Değil'}
              </Text>

              {isPremium && subscriptionType && (
                <>
                  <View style={styles.subscriptionInfoContainer}>
                    <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.statusSubtitle}>
                      {getSubscriptionTypeText(subscriptionType)} Abonelik
                    </Text>
                  </View>
                  {expiresAt && (
                    <View style={styles.expiryContainer}>
                      <Ionicons name="time" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.statusExpiry}>
                        {formatExpirationDate(expiresAt)}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {!isPremium && (
                <Text style={styles.statusDescription}>
                  Premium özelliklerden yararlanmak için abonelik satın alın
                </Text>
              )}
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Actions - Enhanced */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.actionsContainer}>
          {/* Upgrade Button - Prominent */}
          {!isPremium && (
            <Pressable
              onPress={() => {
                haptics.impactMedium();
                navigation.navigate('Paywall');
              }}
              style={({ pressed }) => [
                styles.actionButton,
                styles.upgradeButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityLabel="Premium'a yükselt"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706', '#b45309']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeButtonGradient}
              >
                <View style={styles.upgradeIconContainer}>
                  <Ionicons name="star" size={24} color="#ffffff" />
                </View>
                <View style={styles.upgradeTextContainer}>
                  <Text style={styles.upgradeButtonTitle}>Premium'a Yükselt</Text>
                  <Text style={styles.upgradeButtonSubtitle}>
                    Tüm özelliklere erişim kazanın
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ffffff" />
              </LinearGradient>
            </Pressable>
          )}

          {/* Manage Subscriptions Button */}
          <Pressable
            onPress={() => {
              haptics.impactMedium();
              handleManageSubscriptions();
            }}
            style={({ pressed }) => [
              styles.actionButton,
              styles.manageButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityLabel="Abonelikleri yönet"
            accessibilityRole="button"
          >
            <BlurView intensity={20} tint="dark" style={styles.manageButtonBlur}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="settings-outline" size={22} color={colors.brand.primary} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionButtonTitle}>
                  {Platform.OS === 'ios' ? 'App Store\'da Yönet' : 'Play Store\'da Yönet'}
                </Text>
                <Text style={styles.actionButtonSubtitle}>
                  Abonelikleri iptal et veya değiştir
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </BlurView>
          </Pressable>

          {/* Restore Purchases Button */}
          <Pressable
            onPress={handleRestorePurchases}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.actionButton,
              styles.restoreButton,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
            accessibilityLabel="Satın alımları geri yükle"
            accessibilityRole="button"
          >
            <BlurView intensity={20} tint="dark" style={styles.restoreButtonBlur}>
              <View style={styles.actionIconContainer}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.text.secondary} />
                ) : (
                  <Ionicons name="refresh-outline" size={22} color={colors.text.secondary} />
                )}
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionButtonTitle}>Satın Alımları Geri Yükle</Text>
                <Text style={styles.actionButtonSubtitle}>
                  Önceki satın alımlarınızı geri getirin
                </Text>
              </View>
            </BlurView>
          </Pressable>
        </Animated.View>

        {/* Information Card - Enhanced */}
        <Animated.View entering={FadeInUp.delay(300).duration(600)}>
          <View style={styles.infoCard}>
            <BlurView intensity={20} tint="dark" style={styles.infoCardBlur}>
              <View style={styles.infoIconContainer}>
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.1)']}
                  style={styles.infoIconGradient}
                >
                  <Ionicons name="information-circle" size={24} color={colors.brand.primary} />
                </LinearGradient>
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Abonelik Yönetimi</Text>
                <Text style={styles.infoText}>
                  Aboneliklerinizi yönetmek için {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} hesabınıza giriş yapmanız gerekir.
                  {'\n\n'}
                  İptal etmek veya değiştirmek için yukarıdaki "Yönet" butonuna tıklayın.
                </Text>
              </View>
            </BlurView>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBlur: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingBottom: spacing[16],
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: 2,
    fontSize: 13,
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[20],
    paddingBottom: spacing[32],
    gap: spacing[20],
  },
  statusCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: spacing[8],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  statusGradient: {
    padding: spacing[28],
    alignItems: 'center',
    gap: spacing[16],
    position: 'relative',
  },
  premiumBadge: {
    position: 'absolute',
    top: spacing[20],
    right: spacing[20],
    borderRadius: 20,
    overflow: 'hidden',
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    gap: spacing[6],
  },
  badgeText: {
    ...typography.small,
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusIconContainer: {
    marginTop: spacing[8],
    marginBottom: spacing[8],
  },
  statusIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  statusTitle: {
    ...typography.h1,
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: spacing[8],
  },
  subscriptionInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginTop: spacing[4],
  },
  statusSubtitle: {
    ...typography.body,
    color: '#ffffff',
    opacity: 0.95,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    marginTop: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusExpiry: {
    ...typography.small,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    fontSize: 13,
  },
  statusDescription: {
    ...typography.body,
    color: '#ffffff',
    opacity: 0.8,
    textAlign: 'center',
    marginTop: spacing[8],
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: spacing[16],
  },
  actionButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeButton: {
    marginBottom: spacing[4],
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[20],
    paddingHorizontal: spacing[24],
    gap: spacing[16],
  },
  upgradeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeTextContainer: {
    flex: 1,
  },
  upgradeButtonTitle: {
    ...typography.h3,
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 2,
  },
  upgradeButtonSubtitle: {
    ...typography.small,
    color: '#ffffff',
    opacity: 0.9,
    fontSize: 13,
  },
  manageButton: {
    backgroundColor: 'transparent',
  },
  manageButtonBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[18],
    paddingHorizontal: spacing[20],
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  restoreButton: {
    backgroundColor: 'transparent',
  },
  restoreButtonBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[18],
    paddingHorizontal: spacing[20],
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
    marginLeft: spacing[16],
  },
  actionButtonTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  infoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: spacing[8],
  },
  infoCardBlur: {
    flexDirection: 'row',
    padding: spacing[20],
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoIconContainer: {
    marginRight: spacing[16],
  },
  infoIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing[8],
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
});


