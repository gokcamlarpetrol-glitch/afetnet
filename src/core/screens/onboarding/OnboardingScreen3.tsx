/**
 * ONBOARDING SCREEN 3 - AI News Summary
 * "Yapay Zeka Destekli Son Dakika Haberleri"
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
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import PaginationIndicator from '../../components/onboarding/PaginationIndicator';
import SkipButton from '../../components/onboarding/SkipButton';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OnboardingScreen3');

interface OnboardingScreen3Props {
  navigation: {
    navigate: (screen: string) => void;
    replace: (screen: string) => void;
  };
}

export default function OnboardingScreen3({ navigation }: OnboardingScreen3Props) {
  const insets = useSafeAreaInsets();
  const glowAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    // Track screen view
    const trackScreenView = async () => {
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_screen_view', {
          screen: 'onboarding_3',
          screen_name: 'AI News Summary',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
    };
    trackScreenView();

    const glowLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();

    return () => {
      glowLoop.stop();
    };
  }, [glowAnim]);

  const handleContinue = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('Onboarding4');
    } catch (error) {
      logger.error('Navigation error:', error);
    }
  }, [navigation]);

  const glowOpacity = useMemo(
    () =>
      glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.2, 0.5],
      }),
    [glowAnim]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} accessibilityLabel="Onboarding Ekranı 3">
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
        {/* AI Icon */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.iconContainer}>
          <RNAnimated.View style={[styles.iconWrapper, { opacity: glowOpacity }]}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.4)', 'rgba(139, 92, 246, 0.1)', 'transparent']}
              style={styles.iconGradient}
            >
              <Ionicons name="sparkles" size={64} color="#8b5cf6" />
            </LinearGradient>
          </RNAnimated.View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text style={styles.title} accessibilityRole="header">Haberleri Takip Et, Bilgi Kirliliğinden Uzak Kal</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Text style={styles.subtitle}>
            Afet ve depremle ilgili son dakika haberlerini yapay zeka senin için tarar, özetler ve en kritik bilgileri anında bildirir.
          </Text>
        </Animated.View>

        {/* Mock News Card */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.cardContainer}>
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
              style={styles.cardGradient}
            >
              {/* News Header */}
              <View style={styles.cardHeader}>
                <View style={styles.newsBadge}>
                  <Ionicons name="newspaper" size={16} color={colors.accent.primary} />
                  <Text style={styles.newsBadgeText}>Son Dakika</Text>
                </View>
                <Text style={styles.cardTime}>5 dakika önce</Text>
              </View>

              {/* News Title */}
              <Text style={styles.newsTitle}>
                Marmara Bölgesi'nde Deprem Uyarısı
              </Text>

              {/* AI Summary Section */}
              <View style={styles.aiSummaryContainer}>
                <View style={styles.aiSummaryHeader}>
                  <Ionicons name="sparkles" size={18} color="#8b5cf6" />
                  <Text style={styles.aiSummaryLabel}>AI Özeti</Text>
                </View>
                <Text style={styles.aiSummaryText}>
                  AFAD tarafından yapılan açıklamaya göre, Marmara Denizi'nde meydana gelen 4.2 büyüklüğündeki deprem için herhangi bir tsunami riski bulunmuyor. Bölgedeki vatandaşların sakin kalması öneriliyor.
                </Text>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
            <Text style={styles.featureText}>Kaynaklardaki karmaşayı temizler</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
            <Text style={styles.featureText}>Anlaşılır bir 'AI Özeti' sunar</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
            <Text style={styles.featureText}>Önemli gelişmeleri kaçırmaman için akıllı bildirimler</Text>
          </View>
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
        <PaginationIndicator currentStep={3} totalSteps={5} />
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
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  title: {
    ...typography.h1,
    fontSize: 26,
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
    marginBottom: spacing[6],
    maxWidth: 320,
    lineHeight: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    marginBottom: spacing[6],
  },
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  cardGradient: {
    padding: spacing[5],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  newsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  newsBadgeText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '700',
  },
  cardTime: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  newsTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing[4],
    lineHeight: 22,
  },
  aiSummaryContainer: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  aiSummaryLabel: {
    ...typography.label,
    color: '#8b5cf6',
    fontWeight: '700',
  },
  aiSummaryText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 320,
    gap: spacing[2],
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  featureText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
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

