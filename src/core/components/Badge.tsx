/**
 * BADGE COMPONENT
 * Status badges
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../theme';

interface BadgeProps {
  children: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  style?: ViewStyle;
}

export default function Badge({ children, variant = 'default', style }: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.badge,
  },

  // Variants
  default: {
    backgroundColor: colors.background.tertiary,
  },
  success: {
    backgroundColor: colors.status.success,
  },
  warning: {
    backgroundColor: colors.status.warning,
  },
  danger: {
    backgroundColor: colors.status.danger,
  },
  info: {
    backgroundColor: colors.status.info,
  },

  // Text colors
  defaultText: {
    color: colors.text.primary,
  },
  successText: {
    color: colors.text.primary,
  },
  warningText: {
    color: colors.text.primary,
  },
  dangerText: {
    color: colors.text.primary,
  },
  infoText: {
    color: colors.text.primary,
  },
});

