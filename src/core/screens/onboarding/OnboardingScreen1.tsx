/**
 * ONBOARDING SCREEN 1 - Brand / Trust
 * "AfetNet – Hayat Kurtaran Teknoloji"
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

const logger = createLogger('OnboardingScreen1');

interface OnboardingScreen1Props {
  navigation: {
    navigate: (screen: string) => void;
    replace: (screen: string) => void;
  };
}

export default function OnboardingScreen1({ navigation }: OnboardingScreen1Props) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const waveAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    // Track screen view
    const trackScreenView = async () => {
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_screen_view', {
          screen: 'onboarding_1',
          screen_name: 'Brand / Trust',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
    };
    trackScreenView();

    // Pulse animation for logo
    const pulseLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Wave animation
    const waveLoop = RNAnimated.loop(
      RNAnimated.timing(waveAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );
    waveLoop.start();

    return () => {
      pulseLoop.stop();
      waveLoop.stop();
    };
  }, [pulseAnim, waveAnim]);

  const handleContinue = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('Onboarding2');
    } catch (error) {
      logger.error('Navigation error:', error);
    }
  }, [navigation]);

  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.1, 0.3, 0.1],
  });

  const waveScale = useMemo(
    () =>
      waveAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.2, 1],
      }),
    [waveAnim]
  );

  const waveOpacityMemo = useMemo(
    () =>
      waveAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.1, 0.3, 0.1],
      }),
    [waveAnim]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} accessibilityLabel="Onboarding Ekranı 1">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Skip Button */}
      <View style={[styles.skipContainer, { paddingTop: insets.top + spacing[2] }]}>
        <SkipButton onSkip={() => {}} navigation={navigation} />
      </View>
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#0a0e1a', '#0f1419', '#1a1f2e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Wave Effect */}
      <RNAnimated.View
        style={[
          styles.waveContainer,
          {
            opacity: waveOpacityMemo,
            transform: [{ scale: waveScale }],
          },
        ]}
        accessibilityElementsHidden={true}
      >
        <View style={styles.wave} />
      </RNAnimated.View>

      <View style={styles.content}>
        {/* Logo Container */}
        <Animated.View
          entering={FadeIn.duration(800)}
          style={styles.logoContainer}
        >
          <RNAnimated.View
            style={[
              styles.logoWrapper,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.1)', 'transparent']}
              style={styles.logoGradient}
            >
              <Ionicons name="shield-checkmark" size={80} color={colors.accent.primary} />
            </LinearGradient>
          </RNAnimated.View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text style={styles.title} accessibilityRole="header">AfetNet</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Text style={styles.subtitle}>Hayat Kurtaran Teknoloji</Text>
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.descriptionContainer}>
          <Text style={styles.description}>
            Deprem ve afet anında seni ve sevdiklerini korumak için tasarlandı.
          </Text>
        </Animated.View>

        {/* Extra Text */}
        <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.extraContainer}>
          <Text style={styles.extraText}>
            Türkiye için, afet anları için, hazırlıklı olmak isteyen herkes için.
          </Text>
        </Animated.View>

        {/* Slogan */}
        <Animated.View entering={FadeInDown.delay(1000).duration(600)} style={styles.sloganContainer}>
          <Text style={styles.slogan}>Hazırlıklı ol, güvende kal.</Text>
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
        <PaginationIndicator currentStep={1} totalSteps={6} />
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
  waveContainer: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: 300,
    height: 300,
  },
  wave: {
    width: '100%',
    height: '100%',
    borderRadius: 150,
    backgroundColor: colors.accent.primary,
    opacity: 0.1,
  },
  logoContainer: {
    marginBottom: spacing[8],
  },
  logoWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  title: {
    ...typography.display,
    fontSize: 42,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[2],
    textShadowColor: 'rgba(59, 130, 246, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  subtitle: {
    ...typography.h2,
    fontSize: 22,
    color: colors.accent.primary,
    textAlign: 'center',
    marginBottom: spacing[6],
    fontWeight: '700',
  },
  descriptionContainer: {
    marginBottom: spacing[4],
    maxWidth: 320,
  },
  description: {
    ...typography.body,
    fontSize: 17,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  extraContainer: {
    marginTop: spacing[4],
    marginBottom: spacing[6],
    maxWidth: 320,
  },
  extraText: {
    ...typography.bodyMedium,
    fontSize: 15,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  sloganContainer: {
    marginTop: spacing[6],
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

