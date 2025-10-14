import { borderRadius, brandPalette, spacing as brandSpacing, componentTheme, shadows, typography } from './brand';

// Create a spacing function that works with both old and new APIs
const createSpacing = () => {
  const spacingFn = (n: number) => n * 8;
  
  // Add spacing values as properties for backward compatibility
  Object.assign(spacingFn, {
    xs: brandSpacing.xs,
    sm: brandSpacing.sm,
    md: brandSpacing.md,
    lg: brandSpacing.lg,
    xl: brandSpacing.xl,
    '2xl': brandSpacing['2xl'],
    '3xl': brandSpacing['3xl'],
    '4xl': brandSpacing['4xl'],
  });
  
  return spacingFn as typeof spacingFn & typeof brandSpacing;
};

// Legacy palette mapping for backward compatibility
export const palette = {
  bg: brandPalette.background.primary,
  card: brandPalette.background.secondary,
  text: {
    primary: brandPalette.text.primary,
    secondary: brandPalette.text.secondary,
    disabled: brandPalette.text.disabled,
    onPrimary: brandPalette.text.onPrimary,
    onSecondary: brandPalette.text.onSecondary,
    onAccent: brandPalette.text.onAccent,
    onDark: brandPalette.text.onDark,
  },
  textDim: brandPalette.text.secondary,
  primary: {
    main: brandPalette.primary.main,
  },
  danger: brandPalette.error.main,
  error: {
    main: brandPalette.error.main,
  },
  success: {
    main: brandPalette.success.main,
  },
  warning: {
    main: brandPalette.warning.main,
  },
  border: brandPalette.border.primary,
  
  // Extended palette with new brand colors
  background: brandPalette.background,
  textColors: brandPalette.text,
  primaryColors: brandPalette.primary,
  secondaryColors: brandPalette.secondary,
  accentColors: brandPalette.accent,
  successColors: brandPalette.success,
  warningColors: brandPalette.warning,
  errorColors: brandPalette.error,
  borderColors: brandPalette.border,
  
  // Legacy color mappings for backward compatibility
  green: brandPalette.success.main,
  yellow: brandPalette.warning.main,
  surface: brandPalette.background.secondary,
  onWarning: brandPalette.text.onPrimary,
  onError: brandPalette.text.onPrimary,
  onSuccess: brandPalette.text.onPrimary,
};

// Spacing function with both old and new APIs
export const spacing = createSpacing();

// Legacy radius export for backward compatibility
export const radius = borderRadius;

// Export brand system components
export { default as brand } from './brand';
export { borderRadius, componentTheme, shadows, typography };
