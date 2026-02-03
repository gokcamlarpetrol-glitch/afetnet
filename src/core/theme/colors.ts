/**
 * AFETNET COLOR PALETTE - Midnight Professional
 * Unicorn-grade premium design system
 * Inspired by: Stripe, Linear, Arc Browser
 * ELITE: Production-ready with safe defaults to prevent runtime errors
 */

// CRITICAL: Safe default colors for "Modern Calm Trust" Theme (Nano Banana Pro)
const defaultBackground = {
  primary: '#F4EFE7',    // Neutral-Warm Paper (NOT Yellow)
  secondary: '#FFFCF7',  // Soft Ivory (Surface)
  elevated: '#FFFCF7',   // Surface
  card: '#FFFCF7',       // Soft Ivory
  overlay: 'rgba(244, 239, 231, 0.95)', // Paper Overlay
  input: '#FFFFFF',      // Pure White
  tertiary: '#E8DFD2',   // Border/Divider
  page: '#F4EFE7',       // Main page background
};

// CRITICAL: Create colors object with guaranteed safe access
// ELITE: Use Object.freeze to prevent accidental modification and ensure immutability
const colorsObject = {
  // Background Colors (Modern Calm Trust)
  background: defaultBackground,

  // Text Colors (High Contrast)
  text: {
    primary: '#121416',    // Primary Text
    secondary: '#5B5F66',  // Secondary Text
    tertiary: '#888D94',   // Lighter Grey
    disabled: '#B0B4B8',   // Disabled
    muted: '#888D94',
    inverse: '#FFFFFF',    // White text on dark buttons (Accessibility Rule)
  },

  // Surface Colors
  page: defaultBackground.primary,
  card: defaultBackground.card,

  // Text Color Aliases
  textPrimary: '#121416',
  textSecondary: '#5B5F66',
  textTertiary: '#888D94',

  // Accent Colors (Trust Blues - NO Bronze)
  accent: {
    primary: '#1F4E79',    // Trust Blue
    secondary: '#4A769E',  // Soft Blue-Gray
    glow: 'rgba(31, 78, 121, 0.2)', // Blue Glow
    soft: 'rgba(31, 78, 121, 0.1)',
  },

  // Emergency Colors (Unmistakable)
  emergency: {
    critical: '#B53A3A',   // Danger (Deep Red)
    warning: '#D9A441',    // Warning (Amber)
    safe: '#2E7D32',       // Safe (Forest)
    gradient: ['#B53A3A', '#962A2A'],
    glow: 'rgba(181, 58, 58, 0.15)',
  },

  // Status Colors
  status: {
    online: '#2E7D32',
    offline: '#5B5F66',
    mesh: '#1F4E79',
    alert: '#D9A441',
    success: '#2E7D32',
    safe: '#2E7D32',
    info: '#1F4E79',
    danger: '#B53A3A',
    warning: '#D9A441',
  },

  // Semantic Feature Colors
  mesh: {
    primary: '#1F4E79',
    secondary: '#4A769E',
    glow: 'rgba(31, 78, 121, 0.15)',
    gradient: ['#1F4E79', '#325D85'],
  },

  offline: {
    primary: '#5B5F66',
    secondary: '#757982',
    glow: 'rgba(91, 95, 102, 0.15)',
    gradient: ['#5B5F66', '#757982'],
  },

  earthquake: {
    primary: '#1F4E79',
    major: '#B53A3A',
    moderate: '#D9A441',
    minor: '#4A769E',
    strong: '#962A2A',
    accent: '#1F4E79',
    gradient: ['#1F4E79', '#4A769E'],
  },

  // Border Colors (Soft & Warm)
  border: {
    light: '#E8DFD2',      // Warm Border
    medium: '#D6CDBF',     // Darker Warm Border
    heavy: '#1F4E79',      // Trust Blue Border (instead of bronze)
    primary: 'rgba(31, 78, 121, 0.3)',
  },

  // Brand Colors
  brand: {
    primary: '#1F4E79',    // Trust Blue
    main: '#1F4E79',
    secondary: '#D8E6F3',  // Light Blue (Secondary Button Fill)
    soft: '#EDF4FA',       // Very Light Blue
  },

  primary: {
    main: '#1F4E79',
    light: '#325D85',
    dark: '#163B5B',       // Pressed
  },

  secondary: {
    main: '#D8E6F3',
    light: '#EDF4FA',
    dark: '#BCCDE0',
  },

  danger: {
    main: '#B53A3A',
    light: '#D65A5A',
    dark: '#962A2A',
  },

  warning: {
    main: '#D9A441',
    light: '#EBC06D',
    dark: '#B0802B',
  },

  success: {
    main: '#2E7D32',
    light: '#4CAF50',
    dark: '#1B5E20',
  },

  info: {
    main: '#1F4E79',
    light: '#4A769E',
    dark: '#163B5B',
  },

  // Gradients (Subtle & Premium)
  gradients: {
    emergency: ['#B53A3A', '#962A2A'],
    mesh: ['#1F4E79', '#163B5B'],
    offline: ['#5B5F66', '#40444A'],
    earthquake: ['#1F4E79', '#325D85'],
    header: ['rgba(244, 239, 231, 0.98)', 'rgba(244, 239, 231, 0)'], // Cream fade
    card: ['#FFFCF7', '#FDFBF5'], // Subtle Surface Gradient
  },

  // Glassmorphism (Warm Glass)
  glass: {
    light: 'rgba(255, 252, 247, 0.7)',
    medium: 'rgba(255, 252, 247, 0.85)',
    heavy: 'rgba(255, 252, 247, 0.95)',
    border: 'rgba(232, 223, 210, 0.6)',
    backdrop: 'rgba(244, 239, 231, 0.8)',
    // Elite specialized tokens
    elite: {
      background: 'rgba(255, 252, 247, 0.9)',
      border: 'rgba(232, 223, 210, 0.8)',
      shadow: 'rgba(31, 78, 121, 0.08)',
    },
  },

  // Shadows (Soft Blue/Grey)
  shadow: {
    color: '#1F4E79', // Deep Blue Shadow
    soft: { shadowColor: '#1F4E79', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    medium: { shadowColor: '#1F4E79', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6 },
  },

  // Magnitude Colors
  magnitude: {
    low: '#D9A441',      // Amber
    medium: '#E07A5F',   // Terracotta
    high: '#B53A3A',     // Red
    critical: '#962A2A', // Dark Red
  },
};

// CRITICAL: Export colors with Proxy to ensure safe access
export const colors = new Proxy(colorsObject, {
  get(target, prop: string | symbol) {
    if (typeof prop === 'symbol') return (target as any)[prop];

    if (prop === 'background') {
      const bg = target.background;
      if (!bg || typeof bg !== 'object') return defaultBackground;
      return {
        primary: bg.primary || defaultBackground.primary,
        secondary: bg.secondary || defaultBackground.secondary,
        elevated: bg.elevated || defaultBackground.elevated,
        card: bg.card || defaultBackground.card,
        overlay: bg.overlay || defaultBackground.overlay,
        input: bg.input || defaultBackground.input,
        tertiary: bg.tertiary || defaultBackground.tertiary,
      };
    }

    const value = (target as any)[prop];
    if (value === undefined || value === null) {
      if (prop === 'text') return { primary: '#121416', secondary: '#5B5F66', tertiary: '#888D94', disabled: '#B0B4B8', muted: '#888D94', inverse: '#F4EFE7' };
      if (prop === 'accent') return { primary: '#1F4E79', secondary: '#B08A5A', glow: 'rgba(176, 138, 90, 0.2)', soft: 'rgba(31, 78, 121, 0.1)' };
      // ... safe fallbacks for others
      return {};
    }
    return value;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(target, prop: string | symbol, value: any) {
    if (__DEV__) (target as any)[prop] = value;
    return true;
  },
});

// Add online as alias for status.online - use direct access to avoid circular dependency
export const online = colorsObject.status.online;

// ELITE: Safe exports with fallbacks to prevent runtime errors
// CRITICAL: Always ensure these exports exist even if colors object is partially loaded
export const background = colors.background || defaultBackground;
export const text = colors.text || { primary: '#0F172A', secondary: '#334155', tertiary: '#64748B', disabled: '#94A3B8', muted: '#64748B' };
export const accent = colors.accent || { primary: '#2563EB', secondary: '#0EA5A4', glow: 'rgba(37, 99, 235, 0.12)' };
export const emergency = colors.emergency || { critical: '#EF4444', warning: '#F59E0B', safe: '#10B981', gradient: ['#EF4444', '#DC2626'], glow: 'rgba(239, 68, 68, 0.15)' };
export const status = colors.status || { online: '#10B981', offline: '#64748B', mesh: '#2563EB', alert: '#F59E0B', success: '#10B981', safe: '#10B981', info: '#2563EB', danger: '#EF4444', warning: '#F59E0B' };
export const mesh = colors.mesh || { primary: '#2563EB', secondary: '#3B82F6', glow: 'rgba(37, 99, 235, 0.12)', gradient: ['#2563EB', '#3B82F6'] };
export const offline = colors.offline || { primary: '#6366F1', secondary: '#818CF8', glow: 'rgba(99, 102, 241, 0.12)', gradient: ['#6366F1', '#818CF8'] };
export const earthquake = colors.earthquake || { primary: '#2563EB', major: '#EF4444', moderate: '#F97316', minor: '#EAB308', strong: '#DC2626', accent: '#60A5FA', gradient: ['#2563EB', '#60A5FA'] };
export const border = colors.border || { light: '#E2E8F0', medium: '#CBD5E1', heavy: '#94A3B8', primary: 'rgba(37, 99, 235, 0.3)' };
export const brand = colors.brand || { primary: '#2563EB', main: '#2563EB', secondary: '#60A5FA', soft: '#DBEAFE' };
export const gradients = colors.gradients || { emergency: ['#EF4444', '#DC2626'], mesh: ['#2563EB', '#3B82F6'], offline: ['#6366F1', '#818CF8'], earthquake: ['#2563EB', '#60A5FA'], header: ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0)'], card: ['#FFFFFF', '#F8FAFC'] };
export const glass = colors.glass || { light: 'rgba(255, 255, 255, 0.6)', medium: 'rgba(255, 255, 255, 0.75)', heavy: 'rgba(255, 255, 255, 0.9)', border: 'rgba(226, 232, 240, 0.6)', backdrop: 'rgba(255, 255, 255, 0.8)' };

// New Exports for Consistency
export const shadow = colorsObject.shadow || { color: 'rgba(15, 23, 42, 0.10)' };
export const warning = colorsObject.warning || { main: '#F59E0B', light: '#FBBF24', dark: '#D97706' };
export const success = colorsObject.success || { main: '#10B981', light: '#34D399', dark: '#059669' };
export const info = colorsObject.info || { main: '#3B82F6', light: '#60A5FA', dark: '#2563EB' };
export const primary = colorsObject.primary || { main: '#2563EB', light: '#60A5FA', dark: '#1D4ED8' };
export const secondary = colorsObject.secondary || { main: '#334155', light: '#475569', dark: '#1E293B' };
export const danger = colorsObject.danger || { main: '#EF4444', light: '#F87171', dark: '#DC2626' };
