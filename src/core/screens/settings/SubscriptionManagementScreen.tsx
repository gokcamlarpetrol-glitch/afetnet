/**
 * SUBSCRIPTION MANAGEMENT SCREEN
 * Apple App Store requirement: Users must be able to manage subscriptions
 * This screen provides subscription management functionality
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
      // Apple App Store subscription management URL
      if (Platform.OS === 'ios') {
        const url = 'https://apps.apple.com/account/subscriptions';
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert(
            'Bilgi',
            'Abonelik yönetimi için App Store\'a yönlendirilemiyorsunuz. Lütfen Ayarlar > Apple ID > Abonelikler bölümünden yönetin.',
            [{ text: 'Tamam' }]
          );
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
        'Abonelik yönetim sayfası açılamadı. Lütfen daha sonra tekrar deneyin.',
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
        colors={[colors.background.primary, colors.background.secondary]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Geri"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Abonelik Yönetimi</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Subscription Status */}
        <View style={styles.statusCard}>
          <LinearGradient
            colors={isPremium ? ['#3b82f6', '#1e40af'] : ['#64748b', '#475569']}
            style={styles.statusGradient}
          >
            <Ionicons
              name={isPremium ? 'checkmark-circle' : 'close-circle'}
              size={48}
              color="#ffffff"
            />
            <Text style={styles.statusTitle}>
              {isPremium ? 'Premium Aktif' : 'Premium Aktif Değil'}
            </Text>
            {isPremium && subscriptionType && (
              <>
                <Text style={styles.statusSubtitle}>
                  {getSubscriptionTypeText(subscriptionType)} Abonelik
                </Text>
                {expiresAt && (
                  <Text style={styles.statusExpiry}>
                    Bitiş Tarihi: {formatExpirationDate(expiresAt)}
                  </Text>
                )}
              </>
            )}
          </LinearGradient>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
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
            {isLoading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color={colors.text.primary} />
                <Text style={styles.actionButtonText}>Satın Alımları Geri Yükle</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleManageSubscriptions}
            style={({ pressed }) => [
              styles.actionButton,
              styles.manageButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityLabel="Abonelikleri yönet"
            accessibilityRole="button"
          >
            <Ionicons name="settings" size={20} color={colors.text.primary} />
            <Text style={styles.actionButtonText}>
              {Platform.OS === 'ios' ? 'App Store\'da Yönet' : 'Play Store\'da Yönet'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Paywall')}
            style={({ pressed }) => [
              styles.actionButton,
              styles.upgradeButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityLabel="Premium'a yükselt"
            accessibilityRole="button"
          >
            <Ionicons name="star" size={20} color={colors.text.primary} />
            <Text style={styles.actionButtonText}>Premium'a Yükselt</Text>
          </Pressable>
        </View>

        {/* Information */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.brand.primary} />
          <Text style={styles.infoText}>
            Aboneliklerinizi yönetmek için {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} hesabınıza giriş yapmanız gerekir.
            {'\n\n'}
            İptal etmek veya değiştirmek için yukarıdaki "Yönet" butonuna tıklayın.
          </Text>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  backButton: {
    padding: spacing[8],
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[16],
    gap: spacing[16],
  },
  statusCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing[8],
  },
  statusGradient: {
    padding: spacing[24],
    alignItems: 'center',
    gap: spacing[12],
  },
  statusTitle: {
    ...typography.h2,
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
  },
  statusSubtitle: {
    ...typography.body,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
  },
  statusExpiry: {
    ...typography.small,
    color: '#ffffff',
    opacity: 0.8,
    textAlign: 'center',
    marginTop: spacing[4],
  },
  actionsContainer: {
    gap: spacing[12],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    paddingHorizontal: spacing[20],
    borderRadius: borderRadius.lg,
    gap: spacing[12],
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  restoreButton: {
    backgroundColor: colors.background.secondary,
  },
  manageButton: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  upgradeButton: {
    backgroundColor: colors.status.warning,
    borderColor: colors.status.warning,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing[16],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    gap: spacing[12],
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
});


