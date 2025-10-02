import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '@/app/theme/colors';
import { spacing } from '@/app/theme/spacing';
import { textStyles } from '@/app/theme/typography';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'primary' | 'secondary';
  size?: 'small' | 'medium';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export function Chip({
  label,
  selected = false,
  onPress,
  variant = 'default',
  size = 'medium',
  style,
  textStyle,
  disabled = false,
}: ChipProps) {
  const chipStyle = [
    styles.base,
    styles[variant],
    styles[size],
    selected && styles.selected,
    disabled && styles.disabled,
    style,
  ];

  const chipTextStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    selected && styles.selectedText,
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={chipStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={chipTextStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  
  // Variants
  default: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.border.primary,
  },
  primary: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.interactive.primary,
  },
  secondary: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.border.secondary,
  },
  
  // Sizes
  small: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 28,
  },
  medium: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },
  
  // Text styles
  text: {
    textAlign: 'center',
  },
  defaultText: {
    ...textStyles.label,
    color: colors.text.secondary,
  },
  primaryText: {
    ...textStyles.label,
    color: colors.interactive.primary,
  },
  secondaryText: {
    ...textStyles.label,
    color: colors.text.primary,
  },
  
  // Size text styles
  smallText: {
    fontSize: 12,
  },
  mediumText: {
    fontSize: 14,
  },
  
  // Selected state
  selected: {
    backgroundColor: colors.interactive.primary,
    borderColor: colors.interactive.primary,
  },
  selectedText: {
    color: colors.text.primary,
  },
  
  // Disabled state
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});
