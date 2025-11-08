/**
 * PAGINATION INDICATOR - Onboarding Step Indicator
 * Shows current step in onboarding flow
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, spacing, borderRadius } from '../../theme';

interface PaginationIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export default function PaginationIndicator({ currentStep, totalSteps }: PaginationIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, index) => {
        const step = index + 1;
        const isActive = step === currentStep;
        const isPast = step < currentStep;

        return (
          <Animated.View
            key={step}
            entering={FadeIn.delay(index * 50).duration(300)}
            style={[
              styles.dot,
              isActive && styles.dotActive,
              isPast && styles.dotPast,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.medium,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.accent.primary,
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  dotPast: {
    backgroundColor: colors.accent.secondary,
  },
});

