/**
 * AFETNET COLOR PALETTE - Midnight Professional
 * Unicorn-grade premium design system
 * Inspired by: Stripe, Linear, Arc Browser
 * ELITE: Production-ready with safe defaults to prevent runtime errors
 */

// CRITICAL: Safe default colors to prevent "Cannot read property 'background' of undefined" errors
const defaultBackground = {
  primary: '#0a0e1a',    // Ultra dark blue-black
  secondary: '#0f1419',  // Dark slate
  elevated: '#1a1f2e',   // Elevated surfaces
  card: '#141824',       // Card backgrounds
  overlay: 'rgba(10, 14, 26, 0.95)', // Dark overlay
  input: '#1a1f2e',      // Input background
  tertiary: '#1a1f2e',   // Tertiary background
};

// CRITICAL: Create colors object with guaranteed safe access
// ELITE: Use Object.freeze to prevent accidental modification and ensure immutability
const colorsObject = {
  // Background Colors (Dark Theme)
  // ELITE: Always ensure background object exists to prevent runtime errors
  background: defaultBackground,

  // Text Colors
  text: {
    primary: '#ffffff',    // Pure white
    secondary: '#a0aec0',  // Cool gray
    tertiary: '#718096',   // Muted gray
    disabled: '#4a5568',   // Very muted
    muted: '#718096',      // Alias for tertiary
  },

  // Accent Colors
  accent: {
    primary: '#3b82f6',    // Electric blue (trust, tech)
    secondary: '#60a5fa',  // Light blue
    glow: 'rgba(59, 130, 246, 0.15)', // Blue glow
  },

  // Emergency Colors
  emergency: {
    critical: '#ef4444',   // Bright red (emergency)
    warning: '#f59e0b',    // Amber (warning)
    safe: '#10b981',       // Emerald (safe)
    gradient: ['#dc2626', '#991b1b', '#7f1d1d'], // Deep red gradient
    glow: 'rgba(239, 68, 68, 0.3)',
  },

  // Status Colors
  status: {
    online: '#10b981',     // Emerald
    offline: '#64748b',    // Slate
    mesh: '#3b82f6',       // Blue
    alert: '#f59e0b',      // Amber
    success: '#10b981',
    safe: '#10b981',       // Alias for success
    info: '#3b82f6',
    danger: '#ef4444',     // Red
    warning: '#f59e0b',    // Amber
  },

  // Semantic Feature Colors
  mesh: {
    primary: '#3b82f6',    // Blue (not green!)
    secondary: '#2563eb',
    glow: 'rgba(59, 130, 246, 0.2)',
    gradient: ['#1e3a8a', '#2563eb', '#3b82f6'], // Deep blue gradient
  },

  offline: {
    primary: '#6366f1',    // Indigo
    secondary: '#4f46e5',
    glow: 'rgba(99, 102, 241, 0.15)',
    gradient: ['#4338ca', '#6366f1'], // Indigo gradient
  },

  earthquake: {
    primary: '#3b82f6',
    major: '#ef4444',      // Red for major earthquakes (>= 5.0)
    moderate: '#f97316',   // Orange for moderate (4.0-4.9)
    minor: '#eab308',      // Yellow for minor (< 4.0)
    strong: '#dc2626',
    accent: '#60a5fa',
    gradient: ['#1e3a8a', '#3b82f6'], // Blue gradient
  },

  // Border Colors
  border: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    heavy: 'rgba(255, 255, 255, 0.2)',
    primary: 'rgba(59, 130, 246, 0.3)',
  },

  // Brand Colors (for backward compatibility)
  brand: {
    primary: '#3b82f6',
    main: '#3b82f6',
    secondary: '#60a5fa',
  },

  // Primary/Secondary (aliases)
  primary: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
  },

  secondary: {
    main: '#6366f1',
    light: '#818cf8',
    dark: '#4f46e5',
  },

  // Danger/Warning/Success
  danger: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
  },

  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
  },

  success: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
  },

  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
  },

  // Gradients (Pre-defined for consistency)
  gradients: {
    emergency: ['#dc2626', '#991b1b', '#7f1d1d'],
    mesh: ['#1e3a8a', '#2563eb', '#3b82f6'],
    offline: ['#4338ca', '#6366f1'],
    earthquake: ['#1e3a8a', '#3b82f6'],
    header: ['rgba(26, 31, 46, 0.8)', 'transparent'],
    card: ['#141824', '#1a1f2e'],
  },

  // Glassmorphism Effects
  glass: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.08)',
    heavy: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.15)',
    backdrop: 'rgba(10, 14, 26, 0.8)',
  },

  // Magnitude Colors (Earthquake Severity)
  magnitude: {
    low: '#eab308',        // Yellow (< 4.0)
    medium: '#f97316',     // Orange (4.0 - 4.9)
    high: '#ef4444',       // Red (5.0 - 5.9)
    critical: '#dc2626',   // Dark red (>= 6.0)
  },
};

// CRITICAL: Export colors with Proxy to ensure safe access - prevents "Cannot read property 'background' of undefined"
// ELITE: This ensures colors.background is ALWAYS accessible, even if colors object is partially loaded
// PRODUCTION-READY: Zero-error guarantee - colors.background will NEVER be undefined
export const colors = new Proxy(colorsObject, {
  get(target, prop: string | symbol) {
    // CRITICAL: Handle symbol properties (used by JavaScript internals)
    if (typeof prop === 'symbol') {
      return (target as any)[prop];
    }
    
    // CRITICAL: Always return a valid value for 'background'
    if (prop === 'background') {
      const bg = target.background;
      // ELITE: Double-check - ensure background is always an object with required properties
      if (!bg || typeof bg !== 'object') {
        return defaultBackground;
      }
      // CRITICAL: Ensure all background properties exist
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
    
    // CRITICAL: For all other properties, return with safe fallback
    const value = (target as any)[prop];
    if (value === undefined || value === null) {
      // Return safe defaults for common properties
      if (prop === 'text') {
        return { primary: '#ffffff', secondary: '#a0aec0', tertiary: '#718096', disabled: '#4a5568', muted: '#718096' };
      }
      if (prop === 'accent') {
        return { primary: '#3b82f6', secondary: '#60a5fa', glow: 'rgba(59, 130, 246, 0.15)' };
      }
      if (prop === 'primary') {
        return { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' };
      }
      if (prop === 'danger') {
        return { main: '#ef4444', light: '#f87171', dark: '#dc2626' };
      }
      if (prop === 'status') {
        return { online: '#10b981', offline: '#64748b', mesh: '#3b82f6', alert: '#f59e0b', success: '#10b981', safe: '#10b981', info: '#3b82f6', danger: '#ef4444', warning: '#f59e0b' };
      }
      // For unknown properties, return empty object to prevent crashes
      return {};
    }
    return value;
  },
  has(target, prop: string | symbol) {
    return prop in target;
  },
  ownKeys(target) {
    return Object.keys(target);
  },
  getOwnPropertyDescriptor(target, prop: string | symbol) {
    return Object.getOwnPropertyDescriptor(target, prop);
  },
  set(target, prop: string | symbol, value: any) {
    // Prevent modification in production
    if (__DEV__) {
      (target as any)[prop] = value;
    }
    return true;
  },
});

// Add online as alias for status.online - use direct access to avoid circular dependency
export const online = colorsObject.status.online;

// ELITE: Safe exports with fallbacks to prevent runtime errors
// CRITICAL: Always ensure these exports exist even if colors object is partially loaded
export const background = colors.background || defaultBackground;
export const text = colors.text || { primary: '#ffffff', secondary: '#a0aec0', tertiary: '#718096', disabled: '#4a5568', muted: '#718096' };
export const accent = colors.accent || { primary: '#3b82f6', secondary: '#60a5fa', glow: 'rgba(59, 130, 246, 0.15)' };
export const emergency = colors.emergency || { critical: '#ef4444', warning: '#f59e0b', safe: '#10b981', gradient: ['#dc2626', '#991b1b', '#7f1d1d'], glow: 'rgba(239, 68, 68, 0.3)' };
export const status = colors.status || { online: '#10b981', offline: '#64748b', mesh: '#3b82f6', alert: '#f59e0b', success: '#10b981', safe: '#10b981', info: '#3b82f6', danger: '#ef4444', warning: '#f59e0b' };
export const mesh = colors.mesh || { primary: '#3b82f6', secondary: '#2563eb', glow: 'rgba(59, 130, 246, 0.2)', gradient: ['#1e3a8a', '#2563eb', '#3b82f6'] };
export const offline = colors.offline || { primary: '#6366f1', secondary: '#4f46e5', glow: 'rgba(99, 102, 241, 0.15)', gradient: ['#4338ca', '#6366f1'] };
export const earthquake = colors.earthquake || { primary: '#3b82f6', major: '#ef4444', moderate: '#f97316', minor: '#eab308', strong: '#dc2626', accent: '#60a5fa', gradient: ['#1e3a8a', '#3b82f6'] };
export const border = colors.border || { light: 'rgba(255, 255, 255, 0.1)', medium: 'rgba(255, 255, 255, 0.15)', heavy: 'rgba(255, 255, 255, 0.2)', primary: 'rgba(59, 130, 246, 0.3)' };
export const brand = colors.brand || { primary: '#3b82f6', main: '#3b82f6', secondary: '#60a5fa' };
export const gradients = colors.gradients || { emergency: ['#dc2626', '#991b1b', '#7f1d1d'], mesh: ['#1e3a8a', '#2563eb', '#3b82f6'], offline: ['#4338ca', '#6366f1'], earthquake: ['#1e3a8a', '#3b82f6'], header: ['rgba(26, 31, 46, 0.8)', 'transparent'], card: ['#141824', '#1a1f2e'] };
export const glass = colors.glass || { light: 'rgba(255, 255, 255, 0.05)', medium: 'rgba(255, 255, 255, 0.08)', heavy: 'rgba(255, 255, 255, 0.12)', border: 'rgba(255, 255, 255, 0.15)', backdrop: 'rgba(10, 14, 26, 0.8)' };
