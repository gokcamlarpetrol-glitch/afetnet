/**
 * PREMIUM BUTTON COMPONENT
 * Unicorn app-level premium button with animations and effects
 */

import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PremiumButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const PremiumButton: React.FC<PremiumButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const getVariantStyles = () => {
    switch (variant) {
    case 'primary':
      return {
        gradient: ['#3b82f6', '#2563eb', '#1e40af'] as [string, string, string],
        textColor: '#fff',
        shadowColor: '#3b82f6',
      };
    case 'secondary':
      return {
        gradient: ['#1e293b', '#0f172a'] as [string, string],
        textColor: '#fff',
        shadowColor: '#334155',
      };
    case 'danger':
      return {
        gradient: ['#ef4444', '#dc2626', '#b91c1c'] as [string, string, string],
        textColor: '#fff',
        shadowColor: '#ef4444',
      };
    case 'success':
      return {
        gradient: ['#10b981', '#059669', '#047857'] as [string, string, string],
        textColor: '#fff',
        shadowColor: '#10b981',
      };
    case 'ghost':
      return {
        gradient: ['transparent', 'transparent'] as [string, string],
        textColor: '#3b82f6',
        shadowColor: 'transparent',
      };
    default:
      return {
        gradient: ['#3b82f6', '#2563eb'] as [string, string],
        textColor: '#fff',
        shadowColor: '#3b82f6',
      };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
    case 'small':
      return {
        paddingVertical: 10,
        paddingHorizontal: 16,
        fontSize: 14,
        iconSize: 16,
      };
    case 'medium':
      return {
        paddingVertical: 14,
        paddingHorizontal: 24,
        fontSize: 16,
        iconSize: 20,
      };
    case 'large':
      return {
        paddingVertical: 18,
        paddingHorizontal: 32,
        fontSize: 18,
        iconSize: 24,
      };
    default:
      return {
        paddingVertical: 14,
        paddingHorizontal: 24,
        fontSize: 16,
        iconSize: 20,
      };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator 
          size="small" 
          color={variant === 'ghost' ? variantStyles.textColor : '#fff'} 
        />
      );
    }

    return (
      <>
        {icon && iconPosition === 'left' && (
          <Ionicons 
            name={icon} 
            size={sizeStyles.iconSize} 
            color={variantStyles.textColor} 
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={[
          styles.text,
          { 
            color: variantStyles.textColor,
            fontSize: sizeStyles.fontSize,
            fontWeight: '700',
          },
        ]}>
          {title}
        </Text>
        {icon && iconPosition === 'right' && (
          <Ionicons 
            name={icon} 
            size={sizeStyles.iconSize} 
            color={variantStyles.textColor} 
            style={{ marginLeft: 8 }}
          />
        )}
      </>
    );
  };

  if (variant === 'ghost') {
    return (
      <AnimatedPressable
        style={[
          styles.container,
          styles.ghostContainer,
          {
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            width: fullWidth ? '100%' : 'auto',
          },
          style,
          animatedStyle,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: disabled || loading }}
        accessibilityHint={disabled ? 'Bu buton şu anda devre dışı' : `${title} butonuna basmak için dokunun`}
      >
        {renderContent()}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      style={[
        styles.container,
        {
          width: fullWidth ? '100%' : 'auto',
          shadowColor: variantStyles.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
        style,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityHint={disabled ? 'Bu buton şu anda devre dışı' : `${title} butonuna basmak için dokunun`}
    >
      <LinearGradient
        colors={variantStyles.gradient.length === 3 
          ? variantStyles.gradient as [string, string, string]
          : [...variantStyles.gradient, variantStyles.gradient[1]] as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          {
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {renderContent()}
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default PremiumButton;

