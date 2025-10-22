import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { brandPalette, spacing, borderRadius, shadows } from './brand';

interface BrandedCardProps {
  children: React.ReactNode;
  title?: string;
  priority?: boolean;
  style?: ViewStyle;
  padding?: keyof typeof spacing;
  shadowDisabled?: boolean; // For UltraBattery mode
}

export default function BrandedCard({
  children,
  priority = false,
  style,
  shadowDisabled = false,
}: BrandedCardProps) {
  const cardStyles = [
    styles.base,
    priority && styles.priority,
    !shadowDisabled && styles.shadow,
    style,
  ];

  return (
    <View style={cardStyles}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: brandPalette.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: brandPalette.border.primary,
  },
  
  priority: {
    borderColor: brandPalette.border.accent,
    borderWidth: 2,
  },
  
  shadow: shadows.sm,
});
