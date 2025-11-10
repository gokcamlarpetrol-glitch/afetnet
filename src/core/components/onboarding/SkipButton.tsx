/**
 * SKIP BUTTON - Onboarding Skip Option
 * Allows users to skip onboarding
 */

import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';
import * as haptics from '../../utils/haptics';
import { setOnboardingCompleted } from '../../utils/onboardingStorage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SkipButton');

interface SkipButtonProps {
  onSkip: () => void;
  navigation: {
    replace: (screen: string) => void;
  };
}

export default function SkipButton({ onSkip, navigation }: SkipButtonProps) {
  const handleSkip = async () => {
    try {
      haptics.impactLight();
      
      // Track analytics
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_skipped', {
          screen: 'onboarding',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }

      // Complete onboarding
      await setOnboardingCompleted();
      
      // ELITE: Don't navigate directly - App.tsx will detect onboarding completion
      // and switch to main app automatically via state update
      // This prevents navigation errors when MainTabs is in a different navigator
      
      // Call optional callback
      onSkip();
    } catch (error) {
      logger.error('Skip onboarding error:', error);
      // ELITE: Still complete onboarding - App.tsx will handle navigation
      await setOnboardingCompleted();
    }
  };

  return (
    <Pressable
      onPress={handleSkip}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Onboarding'i atla"
      accessibilityHint="Onboarding'i atlayarak ana uygulamaya geç"
    >
      <Text style={styles.text}>Atla</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  buttonPressed: {
    opacity: 0.7,
  },
  text: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    fontSize: 14,
  },
});

