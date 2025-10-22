import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { borderRadius, brandPalette, spacing, typography } from './brand';

export type BannerType = 'critical' | 'info' | 'success' | 'warning';

interface StatusBannerProps {
  type: BannerType;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  textStyle?: TextStyle;
  onPress?: () => void;
}

export default function StatusBanner({
  type,
  message,
  icon,
  style,
  textStyle,
  onPress,
}: StatusBannerProps) {
  const bannerStyles = [
    styles.base,
    styles[type],
    onPress && styles.pressable,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${type}Text`],
    textStyle,
  ];

  const getDefaultIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (type) {
    case 'critical':
      return 'warning';
    case 'warning':
      return 'alert-circle';
    case 'success':
      return 'checkmark-circle';
    case 'info':
    default:
      return 'information-circle';
    }
  };

  const iconColor = getIconColor(type);

  return (
    <View style={bannerStyles} pointerEvents="none">
      <Ionicons
        name={icon || getDefaultIcon()}
        size={20}
        color={iconColor}
        style={styles.icon}
      />
      <Text style={textStyles}>{message}</Text>
    </View>
  );
}

function getIconColor(type: BannerType): string {
  switch (type) {
  case 'critical':
    return brandPalette.text.onPrimary;
  case 'warning':
    return brandPalette.text.onPrimary;
  case 'success':
    return brandPalette.text.onPrimary;
  case 'info':
  default:
    return brandPalette.text.onSecondary;
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  
  // Types
  critical: {
    backgroundColor: brandPalette.error.main,
  },
  warning: {
    backgroundColor: brandPalette.warning.main,
  },
  success: {
    backgroundColor: brandPalette.success.main,
  },
  info: {
    backgroundColor: brandPalette.secondary.main,
  },
  
  // Interactive
  pressable: {
    // Add pressable styles if needed
  },
  
  // Icon
  icon: {
    marginRight: spacing.sm,
  },
  
  // Text
  text: {
    flex: 1,
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  
  // Text colors
  criticalText: {
    color: brandPalette.text.onPrimary,
  },
  warningText: {
    color: brandPalette.text.onPrimary,
  },
  successText: {
    color: brandPalette.text.onPrimary,
  },
  infoText: {
    color: brandPalette.text.onSecondary,
  },
});
