/**
 * GLASS BUTTON COMPONENT - Elite Design
 * A modern, frosted glass button with subtle gradients and blur effects.
 * Designed to work perfectly on dark, rich backgrounds like 'Family Warmth'.
 */

import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, StyleProp, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GlassButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    size?: 'small' | 'medium' | 'large';
    icon?: keyof typeof Ionicons.glyphMap;
    loading?: boolean;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    fullWidth?: boolean;
}

const GlassButton: React.FC<GlassButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Animation handlers
  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 10, stiffness: 300 });
    opacity.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Style configurations - PASTEL & SWEET EDITION
  const getGradientColors = () => {
    if (disabled) return ['rgba(148, 163, 184, 0.1)', 'rgba(148, 163, 184, 0.05)'] as const;

    switch (variant) {
    case 'primary': // Pastel Blue - Slightly richer
      return ['rgba(186, 230, 253, 0.85)', 'rgba(219, 239, 254, 0.75)'] as const;
    case 'secondary': // Pastel Amber - Slightly richer
      return ['rgba(253, 230, 138, 0.85)', 'rgba(254, 243, 199, 0.75)'] as const;
    case 'danger': // Pastel Rose - Slightly richer
      return ['rgba(253, 164, 175, 0.85)', 'rgba(255, 228, 230, 0.75)'] as const;
    case 'success': // Pastel Mint - Slightly richer
      return ['rgba(134, 239, 172, 0.85)', 'rgba(187, 247, 208, 0.75)'] as const;
    default:
      return ['rgba(226, 232, 240, 0.8)', 'rgba(241, 245, 249, 0.7)'] as const;
    }
  };

  const getBorderColor = () => {
    if (disabled) return 'rgba(203, 213, 225, 0.2)';
    switch (variant) {
    case 'primary': return 'rgba(56, 189, 248, 0.3)';
    case 'secondary': return 'rgba(245, 158, 11, 0.2)';
    case 'danger': return 'rgba(244, 63, 94, 0.2)';
    case 'success': return 'rgba(16, 185, 129, 0.2)';
    default: return 'rgba(148, 163, 184, 0.2)';
    }
  };

  const getTextColor = () => {
    if (disabled) return '#94a3b8';
    switch (variant) {
    case 'primary': return '#0369a1'; // Deep Sky Blue
    case 'secondary': return '#b45309'; // Deep Amber
    case 'danger': return '#be123c'; // Deep Rose
    case 'success': return '#15803d'; // Deep Green
    default: return '#334155'; // Deep Slate
    }
  };

  // Size props
  const paddingVertical = size === 'small' ? 8 : size === 'large' ? 16 : 12;
  const paddingHorizontal = size === 'small' ? 16 : size === 'large' ? 32 : 24;
  const fontSize = size === 'small' ? 14 : size === 'large' ? 18 : 16;
  const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.container,
        { width: fullWidth ? '100%' : 'auto' },
        animatedStyle,
        style,
      ]}
    >
      <View style={styles.blurContainer}>
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            {
              paddingVertical,
              paddingHorizontal,
              borderColor: getBorderColor(),
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.contentContainer}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={iconSize}
                  color={getTextColor()}
                  style={styles.icon}
                />
              )}
              <Text style={[styles.text, { fontSize, color: getTextColor() }, textStyle]}>
                {title}
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  blurContainer: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)', // Fallback for no blur
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  icon: {
    marginRight: 8,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default GlassButton;
