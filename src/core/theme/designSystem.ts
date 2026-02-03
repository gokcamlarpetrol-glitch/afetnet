/**
 * Design System - Theme Configuration
 * Centralized theme export for the application
 */

import { colors } from './colors';
import { typography } from './typography';
import { spacing as spacingValues } from './spacing';
import { shadows } from './shadows';
import * as animations from './animations';

// ELITE: Named exports for components that import them directly
export const palette = colors;
export const spacing = spacingValues;
export const layout = {
  screenPadding: 16,
  cardPadding: 12,
  cardMargin: 8,
  borderRadius: 12,
  maxWidth: 400,
  minHeight: 48,
};

export const theme = {
  colors,
  typography,
  spacing: spacingValues,
  shadows,
  animations,
  borderRadius: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
};

export type Theme = typeof theme;

export default theme;
