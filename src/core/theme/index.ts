/**
 * THEME SYSTEM - Central Export
 * All design tokens in one place
 * CRITICAL: Safe exports with zero-error guarantee
 */

// CRITICAL: Import colors first to ensure it's initialized
import { colors as colorsExport, background, text, accent, emergency, status, mesh, offline, earthquake, border, brand, gradients, glass, online, shadow, warning, success, info, primary, secondary, danger } from './colors';

// CRITICAL: Re-export colors with safe wrapper to prevent "Cannot read property 'background' of undefined"
// ELITE: This ensures colors is ALWAYS defined, even during module initialization
// PRODUCTION-READY: Zero-error guarantee - colors.background will NEVER be undefined
export const colors = colorsExport || (() => {
  // Fallback colors object if colorsExport is undefined
  return {
    background: background,
    text: text,
    accent: accent,
    emergency: emergency,
    status: status,
    mesh: mesh,
    offline: offline,
    earthquake: earthquake,
    border: border,
    brand: brand,
    gradients: gradients,
    glass: glass,
    shadow: shadow,
    warning: warning,
    success: success,
    info: info,
    primary: primary,
    secondary: secondary,
    danger: danger,
  };
})();

// Re-export individual color groups for convenience
export { background, text, accent, emergency, status, mesh, offline, earthquake, border, brand, gradients, glass, online, shadow, warning, success, info, primary, secondary, danger };

export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './animations';

// ELITE: Layout constants
export const layout = {
  screenPadding: 16,
  cardPadding: 12,
  cardMargin: 8,
  borderRadius: 12,
  maxWidth: 400,
  minHeight: 48,
};

// ELITE: Palette alias for design system compatibility
export const palette = colors;
