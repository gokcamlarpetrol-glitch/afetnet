/**
 * BUTTON COMPONENT
 * Premium button with variants
 */

import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../theme';

interface ButtonProps {
  onPress: () => void;
  children: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        styles[size],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.brand.primary : colors.text.primary} />
      ) : (
        <Text style={[
          styles.text,
          styles[`${variant}Text`],
          styles[`${size}Text`],
          textStyle,
        ]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  // Variants
  primary: {
    backgroundColor: colors.brand.primary,
  },
  secondary: {
    backgroundColor: colors.background.tertiary,
  },
  danger: {
    backgroundColor: colors.status.danger,
  },
  success: {
    backgroundColor: colors.status.success,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },

  // Sizes
  small: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  medium: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  large: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },

  // States
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },

  // Text styles
  text: {
    ...typography.button,
    color: colors.text.primary,
  },
  primaryText: {
    color: colors.text.primary,
  },
  secondaryText: {
    color: colors.text.primary,
  },
  dangerText: {
    color: colors.text.primary,
  },
  successText: {
    color: colors.text.primary,
  },
  outlineText: {
    color: colors.brand.primary,
  },

  // Size text
  smallText: {
    ...typography.buttonSmall,
  },
  mediumText: {
    ...typography.button,
  },
  largeText: {
    ...typography.button,
    fontSize: 18,
  },
});

