/**
 * AFETNET COLOR PALETTE - Midnight Professional
 * Unicorn-grade premium design system
 * Inspired by: Stripe, Linear, Arc Browser
 */

export const colors = {
  // Background Colors (Dark Theme)
  background: {
    primary: '#0a0e1a',    // Ultra dark blue-black
    secondary: '#0f1419',  // Dark slate
    elevated: '#1a1f2e',   // Elevated surfaces
    card: '#141824',       // Card backgrounds
    overlay: 'rgba(10, 14, 26, 0.95)', // Dark overlay
    input: '#1a1f2e',      // Input background
    tertiary: '#1a1f2e',   // Tertiary background
  },

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

// Add online as alias for status.online
export const online = colors.status.online;

// Export individual color groups for convenience
export const { background, text, accent, emergency, status, mesh, offline, earthquake, border, brand, gradients, glass } = colors;
