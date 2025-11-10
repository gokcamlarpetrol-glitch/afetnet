/**
 * ANIMATION SYSTEM - Premium Animations
 * Smooth, professional transitions for disaster app
 */

import { Animated, Easing } from 'react-native';

// Animation durations
export const DURATIONS = {
  fast: 200,
  normal: 300,
  slow: 500,
  verySlow: 800,
};

// Easing functions
export const EASINGS = {
  easeInOut: Easing.bezier(0.42, 0, 0.58, 1),
  easeOut: Easing.bezier(0, 0, 0.58, 1),
  easeIn: Easing.bezier(0.42, 0, 1, 1),
  spring: Easing.elastic(1),
};

/**
 * Fade In Animation
 */
export const fadeIn = (
  animatedValue: Animated.Value,
  duration: number = DURATIONS.normal,
  delay: number = 0
): Animated.CompositeAnimation => {
  return Animated.timing(animatedValue, {
    toValue: 1,
    duration,
    delay,
    easing: EASINGS.easeOut,
    useNativeDriver: true,
  });
};

/**
 * Fade Out Animation
 */
export const fadeOut = (
  animatedValue: Animated.Value,
  duration: number = DURATIONS.normal,
  delay: number = 0
): Animated.CompositeAnimation => {
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    delay,
    easing: EASINGS.easeIn,
    useNativeDriver: true,
  });
};

/**
 * Scale In Animation
 */
export const scaleIn = (
  animatedValue: Animated.Value,
  duration: number = DURATIONS.normal,
  delay: number = 0
): Animated.CompositeAnimation => {
  return Animated.spring(animatedValue, {
    toValue: 1,
    delay,
    useNativeDriver: true,
    friction: 8,
    tension: 40,
  });
};

/**
 * Scale Out Animation
 */
export const scaleOut = (
  animatedValue: Animated.Value,
  duration: number = DURATIONS.normal,
  delay: number = 0
): Animated.CompositeAnimation => {
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    delay,
    easing: EASINGS.easeIn,
    useNativeDriver: true,
  });
};

/**
 * Pulse Animation (Continuous)
 */
export const pulse = (
  animatedValue: Animated.Value,
  minScale: number = 0.95,
  maxScale: number = 1.05,
  duration: number = 1000
): Animated.CompositeAnimation => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: maxScale,
        duration: duration / 2,
        easing: EASINGS.easeInOut,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: minScale,
        duration: duration / 2,
        easing: EASINGS.easeInOut,
        useNativeDriver: true,
      }),
    ])
  );
};

/**
 * Slide In Up Animation
 */
export const slideInUp = (
  animatedValue: Animated.Value,
  fromValue: number = 100,
  duration: number = DURATIONS.normal,
  delay: number = 0
): Animated.CompositeAnimation => {
  animatedValue.setValue(fromValue);
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    delay,
    easing: EASINGS.easeOut,
    useNativeDriver: true,
  });
};

/**
 * Slide In Down Animation
 */
export const slideInDown = (
  animatedValue: Animated.Value,
  fromValue: number = -100,
  duration: number = DURATIONS.normal,
  delay: number = 0
): Animated.CompositeAnimation => {
  animatedValue.setValue(fromValue);
  return Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    delay,
    easing: EASINGS.easeOut,
    useNativeDriver: true,
  });
};

/**
 * Slide Out Up Animation
 */
export const slideOutUp = (
  animatedValue: Animated.Value,
  toValue: number = -100,
  duration: number = DURATIONS.normal,
  delay: number = 0
): Animated.CompositeAnimation => {
  return Animated.timing(animatedValue, {
    toValue,
    duration,
    delay,
    easing: EASINGS.easeIn,
    useNativeDriver: true,
  });
};

/**
 * Staggered Fade In (for lists)
 */
export const staggerFadeIn = (
  animatedValues: Animated.Value[],
  staggerDelay: number = 100,
  duration: number = DURATIONS.normal
): Animated.CompositeAnimation => {
  return Animated.stagger(
    staggerDelay,
    animatedValues.map((value) => fadeIn(value, duration))
  );
};

/**
 * Staggered Slide In (for lists)
 */
export const staggerSlideIn = (
  animatedValues: Animated.Value[],
  staggerDelay: number = 100,
  duration: number = DURATIONS.normal,
  fromValue: number = 50
): Animated.CompositeAnimation => {
  return Animated.stagger(
    staggerDelay,
    animatedValues.map((value) => slideInUp(value, fromValue, duration))
  );
};

/**
 * Rotate Animation (Continuous)
 */
export const rotate = (
  animatedValue: Animated.Value,
  duration: number = 2000
): Animated.CompositeAnimation => {
  return Animated.loop(
    Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  );
};

/**
 * Shake Animation (for errors)
 */
export const shake = (
  animatedValue: Animated.Value,
  intensity: number = 10
): Animated.CompositeAnimation => {
  return Animated.sequence([
    Animated.timing(animatedValue, {
      toValue: intensity,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(animatedValue, {
      toValue: -intensity,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(animatedValue, {
      toValue: intensity,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 50,
      useNativeDriver: true,
    }),
  ]);
};

/**
 * Bounce Animation
 */
export const bounce = (
  animatedValue: Animated.Value,
  toValue: number = 1
): Animated.CompositeAnimation => {
  return Animated.spring(animatedValue, {
    toValue,
    friction: 3,
    tension: 40,
    useNativeDriver: true,
  });
};

/**
 * Create animated value with initial value
 */
export const createAnimatedValue = (initialValue: number = 0): Animated.Value => {
  return new Animated.Value(initialValue);
};

/**
 * Interpolate rotation
 */
export const interpolateRotation = (animatedValue: Animated.Value): Animated.AnimatedInterpolation<string> => {
  return animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
};

