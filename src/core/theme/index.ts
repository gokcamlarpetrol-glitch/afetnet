/**
 * THEME SYSTEM
 * Export all theme tokens
 */

export { colors, withOpacity } from './colors';
export { typography } from './typography';
export { spacing, borderRadius, shadows } from './spacing';

// Combined theme object
import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, shadows } from './spacing';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export type Theme = typeof theme;

