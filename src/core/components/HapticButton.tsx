/**
 * HAPTIC BUTTON - ELITE COMPONENT
 * A Pressable component with built-in haptic feedback and smooth animations.
 *
 * Usage:
 * <HapticButton hapticType="medium" onPress={handlePress}>
 *   <Text>Button Text</Text>
 * </HapticButton>
 */

import React, { memo, useCallback } from 'react';
import { Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as haptics from '../utils/haptics';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

interface HapticButtonProps extends Omit<PressableProps, 'onPress'> {
    hapticType?: HapticType;
    onPress?: () => void;
    children: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
    disabled?: boolean;
    scaleOnPress?: number; // Scale factor when pressed (default 0.96)
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HapticButton: React.FC<HapticButtonProps> = memo(({
  hapticType = 'medium',
  onPress,
  children,
  style,
  disabled = false,
  scaleOnPress = 0.96,
  ...rest
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(scaleOnPress, { damping: 10, stiffness: 300 });
    opacity.value = withTiming(0.8, { duration: 100 });

    // Immediate light feedback on touch down for better responsiveness
    haptics.impactLight();
  }, [disabled, scaleOnPress]);

  const handlePressOut = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 100 });
  }, [disabled]);

  const handlePress = useCallback(async () => {
    if (disabled) return;

    // Trigger chosen haptic feedback
    switch (hapticType) {
    case 'light':
      await haptics.impactLight();
      break;
    case 'medium':
      await haptics.impactMedium();
      break;
    case 'heavy':
      await haptics.impactHeavy();
      break;
    case 'success':
      await haptics.notificationSuccess();
      break;
    case 'warning':
      await haptics.notificationWarning();
      break;
    case 'error':
      await haptics.notificationError();
      break;
    case 'selection':
      await haptics.selectionChanged();
      break;
    }

    // Execute onPress callback
    onPress?.();
  }, [hapticType, onPress, disabled]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.button,
        animatedStyle,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});

HapticButton.displayName = 'HapticButton';

const styles = StyleSheet.create({
  button: {
    // Default styles - override with style prop
  },
  disabled: {
    opacity: 0.5,
  },
});

export default HapticButton;
