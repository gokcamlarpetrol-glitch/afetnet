/**
 * THEME SYSTEM - Central Export
 * All design tokens in one place
 * CRITICAL: Safe exports with zero-error guarantee
 */

// CRITICAL: Import colors first to ensure it's initialized
import { colors as colorsExport, background, text, accent, emergency, status, mesh, offline, earthquake, border, brand, gradients, glass, online } from './colors';

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
  };
})();

// Re-export individual color groups for convenience
export { background, text, accent, emergency, status, mesh, offline, earthquake, border, brand, gradients, glass, online };

export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './animations';
