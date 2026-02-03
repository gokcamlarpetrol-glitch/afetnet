/**
 * BUTTON COMPONENT
 * Premium button with variants
 */

import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityHint={disabled ? 'Bu buton şu anda devre dışı' : `${children} butonuna basmak için dokunun`}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        styles[size],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' && !disabled && !loading ? (
        <LinearGradient
          colors={(colors.gradients?.mesh || [colors.primary.main, colors.primary.dark]) as any}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      ) : null}

      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.brand.primary : (variant === 'primary' ? (colors.text as any).inverse : colors.text.primary)} />
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden', // Needed for gradient
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  large: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    color: (colors.text as any).inverse, // Cream text on Navy button
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

