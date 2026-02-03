/**
 * SHARED ELEMENT TRANSITIONS - ELITE NAVIGATION
 * Provides shared element transition configuration for React Navigation.
 *
 * Usage:
 * Import and apply to navigation screen options.
 */

import { TransitionPresets, CardStyleInterpolators } from '@react-navigation/stack';
import { Animated, Easing } from 'react-native';

/**
 * Elite screen transition config
 */
export const eliteScreenOptions = {
  // Use iOS-style modal transition
  ...TransitionPresets.ModalPresentationIOS,
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  gestureEnabled: true,
  gestureDirection: 'horizontal' as const,
};

/**
 * Modal transition config
 */
export const eliteModalOptions = {
  ...TransitionPresets.ModalSlideFromBottomIOS,
  cardOverlayEnabled: true,
  gestureEnabled: true,
  gestureDirection: 'vertical' as const,
};

/**
 * Fade transition config
 */
export const eliteFadeOptions = {
  cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
  transitionSpec: {
    open: {
      animation: 'timing' as const,
      config: {
        duration: 200,
        easing: Easing.out(Easing.poly(4)),
      },
    },
    close: {
      animation: 'timing' as const,
      config: {
        duration: 150,
        easing: Easing.in(Easing.poly(4)),
      },
    },
  },
};

/**
 * Shared element transition helper
 * Wraps a component with shared transition configuration
 */
export const createSharedElementConfig = (sharedId: string) => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharedElements: (route: any, otherRoute: any, showing: boolean) => {
    if (showing) {
      return [`${sharedId}`];
    }
    return [];
  },
});

/**
 * Generate transition animation values
 */
export const useScreenTransition = (animatedValue: Animated.Value) => {
  return {
    containerStyle: {
      opacity: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
      transform: [
        {
          scale: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.95, 1],
          }),
        },
      ],
    },
  };
};

/**
 * Default transition duration
 */
export const TRANSITION_DURATION = 300;

/**
 * Elite navigation config
 */
export const eliteNavigationConfig = {
  defaultScreenOptions: eliteScreenOptions,
  modalOptions: eliteModalOptions,
  fadeOptions: eliteFadeOptions,
};
