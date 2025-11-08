/**
 * ONBOARDING SCREEN 4 - AI Assistant
 * "Yapay Zeka Destekli Afet Asistanı"
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

const logger = createLogger('OnboardingScreen4');

interface OnboardingScreen4Props {
  navigation: {
    navigate: (screen: string) => void;
    replace: (screen: string) => void;
  };
}

export default function OnboardingScreen4({ navigation }: OnboardingScreen4Props) {
  const insets = useSafeAreaInsets();
  const lightAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    // Track screen view
    const trackScreenView = async () => {
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_screen_view', {
          screen: 'onboarding_4',
          screen_name: 'AI Assistant',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
    };
    trackScreenView();

    const lightLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(lightAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        RNAnimated.timing(lightAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    );
    lightLoop.start();

    return () => {
      lightLoop.stop();
    };
  }, [lightAnim]);

  const handleContinue = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('Onboarding5');
    } catch (error) {
      logger.error('Navigation error:', error);
    }
  }, [navigation]);

  const lightOpacity = useMemo(
    () =>
      lightAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 0.7, 0.3],
      }),
    [lightAnim]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} accessibilityLabel="Onboarding Ekranı 4">
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
        {/* AI Light Effect */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.iconContainer}>
          <RNAnimated.View style={[styles.lightEffect, { opacity: lightOpacity }]} />
          <View style={styles.iconWrapper}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.3)', 'rgba(59, 130, 246, 0.2)', 'transparent']}
              style={styles.iconGradient}
            >
              <Ionicons name="bulb" size={64} color="#8b5cf6" />
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text style={styles.title} accessibilityRole="header">Hazırlık Planın ve Risk Skorun Her Zaman Yanında</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Text style={styles.subtitle}>
            Yapay zeka, risk skorunu hesaplar, kişisel afet planını oluşturur ve kriz anında adım adım rehberlik eder.
          </Text>
        </Animated.View>

        {/* Checklist Cards */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.cardsContainer}>
          <View style={styles.checklistCard}>
            <LinearGradient
              colors={['rgba(26, 31, 46, 0.9)', 'rgba(20, 24, 36, 0.9)']}
              style={styles.cardGradient}
            >
              <View style={styles.checklistItem}>
                <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
                <Text style={styles.checklistText}>Risk skoru hesaplama</Text>
              </View>
              <View style={styles.checklistItem}>
                <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
                <Text style={styles.checklistText}>Kişisel hazırlık planı</Text>
              </View>
              <View style={styles.checklistItem}>
                <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
                <Text style={styles.checklistText}>Kriz anında adım adım rehberlik</Text>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Extra Text */}
        <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.extraContainer}>
          <Text style={styles.extraText}>
            Hangi eşyaların çantanda olması gerektiğini, hangi adımları izlemen gerektiğini senin için planlar.
          </Text>
        </Animated.View>

        {/* Slogan */}
        <Animated.View entering={FadeInDown.delay(1000).duration(600)} style={styles.sloganContainer}>
          <Text style={styles.slogan}>Afet anında yalnız değilsin.</Text>
        </Animated.View>
      </View>

      {/* Continue Button */}
      <Animated.View
        entering={FadeInDown.delay(1200).duration(600)}
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
        <PaginationIndicator currentStep={4} totalSteps={5} />
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
    position: 'relative',
  },
  lightEffect: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#8b5cf6',
    alignSelf: 'center',
    top: -40,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
  cardsContainer: {
    width: '100%',
    maxWidth: 340,
    marginBottom: spacing[6],
  },
  checklistCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  cardGradient: {
    padding: spacing[5],
    gap: spacing[3],
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  checklistText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  extraContainer: {
    maxWidth: 320,
    marginBottom: spacing[4],
  },
  extraText: {
    ...typography.bodyMedium,
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  sloganContainer: {
    marginTop: spacing[2],
  },
  slogan: {
    ...typography.h4,
    fontSize: 16,
    color: colors.accent.secondary,
    textAlign: 'center',
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

