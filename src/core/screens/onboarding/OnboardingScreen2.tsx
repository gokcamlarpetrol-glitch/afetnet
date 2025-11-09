/**
 * ONBOARDING SCREEN 2 - Real-time Earthquake Tracking
 * "Gerçek Zamanlı Deprem Takibi"
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import PaginationIndicator from '../../components/onboarding/PaginationIndicator';
import SkipButton from '../../components/onboarding/SkipButton';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OnboardingScreen2');
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';

interface OnboardingScreen2Props {
  navigation: {
    navigate: (screen: string) => void;
    replace: (screen: string) => void;
  };
}

export default function OnboardingScreen2({ navigation }: OnboardingScreen2Props) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    // Track screen view
    const trackScreenView = async () => {
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_screen_view', {
          screen: 'onboarding_2',
          screen_name: 'Real-time Earthquake Tracking',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
    };
    trackScreenView();

    const pulseLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim]);

  const handleContinue = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('Onboarding3');
    } catch (error) {
      logger.error('Navigation error:', error);
    }
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} accessibilityLabel="Onboarding Ekranı 2">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Skip Button */}
      <View style={[styles.skipContainer, { paddingTop: insets.top + spacing[2] }]}>
        <SkipButton onSkip={() => {}} navigation={navigation} />
      </View>
      
      <LinearGradient
        colors={['#0a0e1a', '#0f1419', '#1a1f2e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Icon */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.iconContainer}>
          <RNAnimated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.1)', 'transparent']}
              style={styles.iconGradient}
            >
              <Ionicons name="pulse" size={64} color={colors.accent.primary} />
            </LinearGradient>
          </RNAnimated.View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text style={styles.title} accessibilityRole="header">Gerçek Zamanlı Deprem Bilgileri</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Text style={styles.subtitle}>
            AFAD verileriyle entegre sistem, bölgenizdeki depremleri saniyeler içinde gösterir.{' '}
            <Text style={styles.subtitleHighlight}>Deprem bildirimleri</Text> ve{' '}
            <Text style={styles.subtitleHighlight}>AI destekli erken uyarı sistemi</Text> ile deprem olmadan önce uyarı alın.
          </Text>
        </Animated.View>

        {/* Multi-Source Badge */}
        <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.sourceBadgeContainer}>
          <View style={styles.sourceBadge}>
            <LinearGradient
              colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)', 'transparent']}
              style={styles.sourceBadgeGradient}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
              <Text style={styles.sourceBadgeText}>
                <Text style={styles.sourceBadgeNumber}>+6 kaynak</Text>
                {' '}ile doğrulanmış bilgi
              </Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* AI Verification Badge */}
        <Animated.View entering={FadeInDown.delay(550).duration(600)} style={styles.sourceBadgeContainer}>
          <View style={styles.sourceBadge}>
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)', 'transparent']}
              style={styles.sourceBadgeGradient}
            >
              <Ionicons name="sparkles" size={20} color={colors.accent.primary} />
              <Text style={styles.sourceBadgeText}>
                <Text style={styles.sourceBadgeNumber}>AI ile onaylanmış</Text>
                {' '}erken uyarı sistemi
              </Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Mock Earthquake Cards */}
        <Animated.View entering={FadeInDown.delay(650).duration(600)} style={styles.cardsContainer}>
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(26, 31, 46, 0.9)', 'rgba(20, 24, 36, 0.9)']}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={styles.magnitudeBadge}>
                  <Text style={styles.magnitudeText}>4.2</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardLocation}>Marmara Denizi</Text>
                  <Text style={styles.cardTime}>2 dakika önce</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.cardDetail}>
                  <Ionicons name="location" size={14} color={colors.text.tertiary} />
                  <Text style={styles.cardDetailText}>Derinlik: 5.2 km</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={[styles.card, styles.cardSecondary]}>
            <LinearGradient
              colors={['rgba(26, 31, 46, 0.7)', 'rgba(20, 24, 36, 0.7)']}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.magnitudeBadge, styles.magnitudeBadgeMinor]}>
                  <Text style={styles.magnitudeText}>3.5</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardLocation}>İzmit Körfezi</Text>
                  <Text style={styles.cardTime}>15 dakika önce</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Free Features Badge */}
        <Animated.View entering={FadeInDown.delay(750).duration(600)} style={styles.freeBadgeContainer}>
          <View style={styles.freeBadge}>
            <LinearGradient
              colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)', 'transparent']}
              style={styles.freeBadgeGradient}
            >
              <Ionicons name="gift" size={18} color={colors.status.success} />
              <Text style={styles.freeBadgeText}>
                <Text style={styles.freeBadgeBold}>İlk 3 gün ücretsiz:</Text> Tüm premium özellikler
              </Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Extra Text */}
        <Animated.View entering={FadeInDown.delay(850).duration(600)} style={styles.extraContainer}>
          <Text style={styles.extraText}>
            Türkiye'nin en güncel deprem izleme sistemi artık cebinde.
          </Text>
        </Animated.View>
      </View>

      {/* Continue Button */}
      <Animated.View
        entering={FadeInDown.delay(1000).duration(600)}
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}
      >
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Devam Et"
          accessibilityHint="Bir sonraki onboarding ekranına geç"
        >
          <LinearGradient
            colors={['#3b82f6', '#2563eb', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Devam Et</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Pagination Indicator */}
      <View style={styles.paginationContainer}>
        <PaginationIndicator currentStep={2} totalSteps={5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  skipContainer: {
    position: 'absolute',
    top: 0,
    right: spacing[4],
    zIndex: 10,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: spacing[4],
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  iconContainer: {
    marginBottom: spacing[6],
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[4],
    maxWidth: 320,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[4],
    maxWidth: 320,
    lineHeight: 24,
  },
  subtitleHighlight: {
    fontWeight: '700',
    color: colors.accent.primary,
  },
  sourceBadgeContainer: {
    marginBottom: spacing[6],
    width: '100%',
    maxWidth: 320,
  },
  sourceBadge: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  sourceBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  sourceBadgeText: {
    ...typography.bodySmall,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  sourceBadgeNumber: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.status.success,
    fontWeight: '700',
  },
  freeBadgeContainer: {
    marginBottom: spacing[4],
    width: '100%',
    maxWidth: 320,
  },
  freeBadge: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  freeBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  freeBadgeText: {
    ...typography.bodySmall,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  freeBadgeBold: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.status.success,
    fontWeight: '700',
  },
  cardsContainer: {
    width: '100%',
    maxWidth: 340,
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  cardSecondary: {
    opacity: 0.7,
  },
  cardGradient: {
    padding: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  magnitudeBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.emergency.warning,
    justifyContent: 'center',
    alignItems: 'center',
  },
  magnitudeBadgeMinor: {
    backgroundColor: colors.emergency.safe,
  },
  magnitudeText: {
    ...typography.h3,
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
  },
  cardInfo: {
    flex: 1,
  },
  cardLocation: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  cardTime: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  cardFooter: {
    marginTop: spacing[2],
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  cardDetailText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  extraContainer: {
    maxWidth: 320,
  },
  extraText: {
    ...typography.bodyMedium,
    fontSize: 15,
    color: colors.accent.secondary,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
  },
  buttonContainer: {
    paddingHorizontal: spacing[6],
  },
  button: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[8],
    gap: spacing[2],
  },
  buttonText: {
    ...typography.buttonLarge,
    color: '#fff',
    fontSize: 18,
  },
});

