/**
 * REANIMATED MOCK - ELITE EDITION
 * Mock for react-native-reanimated in test environment
 */

module.exports = {
  default: {
    call: () => { },
  },
  useSharedValue: (value) => ({ value }),
  useAnimatedStyle: () => ({}),
  useDerivedValue: (getter) => ({ value: getter() }),
  useAnimatedGestureHandler: () => ({}),
  useAnimatedScrollHandler: () => ({}),
  useAnimatedRef: () => ({ current: null }),
  useEvent: () => { },
  useHandler: () => { },
  useWorkletCallback: (callback) => callback,
  useAnimatedReaction: () => { },

  withTiming: (value) => value,
  withSpring: (value) => value,
  withDelay: (_, animation) => animation,
  withSequence: (...animations) => animations[0],
  withRepeat: (animation) => animation,
  withDecay: (config) => config,

  cancelAnimation: () => { },
  measure: () => ({}),
  scrollTo: () => { },

  Easing: {
    linear: (x) => x,
    ease: (x) => x,
    quad: (x) => x,
    cubic: (x) => x,
    poly: () => (x) => x,
    sin: (x) => x,
    circle: (x) => x,
    exp: (x) => x,
    elastic: () => (x) => x,
    back: () => (x) => x,
    bounce: (x) => x,
    bezier: () => (x) => x,
    bezierFn: () => (x) => x,
    inOut: (fn) => fn,
    in: (fn) => fn,
    out: (fn) => fn,
  },

  // Animated components
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',

  createAnimatedComponent: (component) => component,

  // Layout animations
  FadeIn: { duration: () => ({ springify: () => ({}) }) },
  FadeOut: { duration: () => ({ springify: () => ({}) }) },
  FadeInDown: { duration: () => ({ springify: () => ({}) }) },
  FadeInUp: { duration: () => ({ springify: () => ({}) }) },
  SlideInLeft: { duration: () => ({ springify: () => ({}) }) },
  SlideInRight: { duration: () => ({ springify: () => ({}) }) },
  SlideOutLeft: { duration: () => ({ springify: () => ({}) }) },
  SlideOutRight: { duration: () => ({ springify: () => ({}) }) },
  Layout: {
    springify: () => ({}),
    duration: () => ({}),
  },

  // Interpolation
  interpolate: (value, inputRange, outputRange) => {
    return outputRange[0];
  },
  Extrapolation: {
    CLAMP: 'clamp',
    EXTEND: 'extend',
    IDENTITY: 'identity',
  },

  // Keyboard
  useAnimatedKeyboard: () => ({ height: { value: 0 }, state: { value: 0 } }),

  // Shared value operations
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  makeMutable: (value) => ({ value }),

  // Worklet marker (for compatibility)
  __reanimatedWorkletInit: () => { },
};
