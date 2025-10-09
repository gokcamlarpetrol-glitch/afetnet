import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { brandPalette, typography, spacing, borderRadius, shadows } from './brand';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BrandedButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  shadowDisabled?: boolean; // For UltraBattery mode
}

export default function BrandedButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
  shadowDisabled = false,
}: BrandedButtonProps) {
  const buttonStyles = [
    styles.base,
    styles[size],
    styles[variant],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    !shadowDisabled && styles.shadow,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${size}Text`],
    styles[`${variant}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? brandPalette.primary.main : brandPalette.text.onPrimary}
        />
      ) : (
        <Text style={textStyles}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
  },
  
  // Sizes
  sm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },
  md: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  lg: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 56,
  },
  
  // Variants
  primary: {
    backgroundColor: brandPalette.primary.main,
    borderColor: brandPalette.primary.main,
  },
  secondary: {
    backgroundColor: brandPalette.secondary.main,
    borderColor: brandPalette.secondary.main,
  },
  accent: {
    backgroundColor: brandPalette.accent.main,
    borderColor: brandPalette.accent.main,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: brandPalette.primary.main,
  },
  danger: {
    backgroundColor: brandPalette.error.main,
    borderColor: brandPalette.error.main,
  },
  
  // States
  disabled: {
    backgroundColor: brandPalette.background.tertiary,
    borderColor: brandPalette.border.secondary,
  },
  
  // Layout
  fullWidth: {
    width: '100%',
  },
  
  // Shadow
  shadow: shadows.md,
  
  // Text styles
  text: {
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  
  // Text sizes
  smText: {
    fontSize: typography.fontSize.sm,
  },
  mdText: {
    fontSize: typography.fontSize.base,
  },
  lgText: {
    fontSize: typography.fontSize.lg,
  },
  
  // Text variants
  primaryText: {
    color: brandPalette.text.onPrimary,
  },
  secondaryText: {
    color: brandPalette.text.onSecondary,
  },
  accentText: {
    color: brandPalette.text.onAccent,
  },
  ghostText: {
    color: brandPalette.primary.main,
  },
  dangerText: {
    color: brandPalette.text.onPrimary,
  },
  disabledText: {
    color: brandPalette.text.disabled,
  },
});
