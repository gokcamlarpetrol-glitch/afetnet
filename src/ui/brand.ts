/**
 * AfetNet Brand Identity System
 * Emergency services inspired design with trust, safety, and clarity
 */

export const brandPalette = {
  // Primary Colors
  primary: {
    main: '#C62828', // Deep red - emergency/urgent
    light: '#EF5350',
    dark: '#B71C1C',
    contrast: '#FFFFFF',
  },
  
  // Secondary Colors
  secondary: {
    main: '#263238', // Blue-gray - professional/trustworthy
    light: '#546E7A',
    dark: '#1C2833',
    contrast: '#FFFFFF',
  },
  
  // Accent Colors
  accent: {
    main: '#FFCA28', // Amber - attention/important
    light: '#FFF176',
    dark: '#F57F17',
    contrast: '#212121',
  },
  
  // Background Colors
  background: {
    primary: '#FAFAFA', // Clean white
    secondary: '#F5F5F5', // Light gray
    tertiary: '#EEEEEE', // Medium gray
    dark: '#212121', // Dark for offline mode
  },
  
  // Text Colors
  text: {
    primary: '#212121', // Dark gray - high contrast
    secondary: '#757575', // Medium gray
    disabled: '#BDBDBD', // Light gray
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onAccent: '#212121',
    onDark: '#FFFFFF',
  },
  
  // Status Colors
  success: {
    main: '#388E3C',
    light: '#66BB6A',
    dark: '#2E7D32',
    contrast: '#FFFFFF',
  },
  
  warning: {
    main: '#F57C00',
    light: '#FFB74D',
    dark: '#EF6C00',
    contrast: '#FFFFFF',
  },
  
  error: {
    main: '#D32F2F',
    light: '#EF5350',
    dark: '#C62828',
    contrast: '#FFFFFF',
  },
  
  // Border Colors
  border: {
    primary: '#E0E0E0',
    secondary: '#BDBDBD',
    accent: '#FFCA28',
    error: '#D32F2F',
    success: '#388E3C',
  },
} as const;

export const typography = {
  fontFamily: {
    primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace',
  },
  
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },

  // Legacy heading styles for backward compatibility
  h1: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 1.2,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 1.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 1.4,
  },
  h4: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 1.4,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 1.5,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 1.4,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const animation = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// Component-specific theme extensions
export const componentTheme = {
  button: {
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 48,
    shadow: shadows.md,
    shadowDisabled: false, // Disabled in UltraBattery mode
  },
  
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadow: shadows.sm,
    borderWidth: 1,
    borderColor: brandPalette.border.primary,
    priorityBorderColor: brandPalette.border.accent,
  },
  
  statusBanner: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontWeight: typography.fontWeight.semibold,
    critical: {
      backgroundColor: brandPalette.error.main,
      color: brandPalette.text.onPrimary,
    },
    info: {
      backgroundColor: brandPalette.secondary.main,
      color: brandPalette.text.onSecondary,
    },
    success: {
      backgroundColor: brandPalette.success.main,
      color: brandPalette.text.onPrimary,
    },
  },
  
  offlineScreen: {
    backgroundColor: brandPalette.background.dark,
    iconColor: brandPalette.accent.main,
    textColor: brandPalette.text.onDark,
  },
} as const;

// Accessibility helpers
export const accessibility = {
  minTouchTarget: 44, // iOS HIG minimum
  minFontSize: 16, // Minimum readable size
  highContrastRatio: 4.5, // WCAG AA minimum
} as const;

// Emergency-specific design tokens
export const emergency = {
  sos: {
    backgroundColor: brandPalette.error.main,
    color: brandPalette.text.onPrimary,
    animation: 'pulse',
  },
  
  critical: {
    backgroundColor: brandPalette.error.dark,
    color: brandPalette.text.onPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  
  warning: {
    backgroundColor: brandPalette.warning.main,
    color: brandPalette.text.onPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  
  safe: {
    backgroundColor: brandPalette.success.main,
    color: brandPalette.text.onPrimary,
    fontWeight: typography.fontWeight.medium,
  },
} as const;

export default {
  brandPalette,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  componentTheme,
  accessibility,
  emergency,
};
