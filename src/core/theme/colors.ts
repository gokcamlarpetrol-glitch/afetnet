/**
 * COLOR SYSTEM - Premium Dark Theme
 * Based on old design, enhanced for premium feel
 */

export const colors = {
  // Background layers
  background: {
    primary: '#0f172a',      // Main background
    secondary: '#1e293b',    // Card background
    tertiary: '#1f2937',     // Button background
    input: '#111827',        // Input background
    modal: '#0b1220',        // Modal background
    overlay: 'rgba(15, 23, 42, 0.95)', // Overlay
  },

  // Text colors
  text: {
    primary: '#ffffff',      // Main text
    secondary: '#e5e7eb',    // Secondary text
    tertiary: '#94a3b8',     // Tertiary text
    muted: '#64748b',        // Muted text
    disabled: '#475569',     // Disabled text
  },

  // Brand colors
  brand: {
    primary: '#3b82f6',      // Blue
    secondary: '#2563eb',    // Dark blue
    accent: '#60a5fa',       // Light blue
  },

  // Status colors
  status: {
    success: '#10b981',      // Green
    warning: '#f59e0b',      // Yellow/Orange
    danger: '#ef4444',       // Red
    info: '#3b82f6',         // Blue
  },

  // Earthquake magnitude colors
  earthquake: {
    minor: '#eab308',        // Yellow (< 4.0)
    moderate: '#f97316',     // Orange (4.0-5.0)
    strong: '#ef4444',       // Red (> 5.0)
  },

  // Triage colors
  triage: {
    red: '#ef4444',          // Critical
    yellow: '#f59e0b',       // Delayed
    green: '#10b981',        // Minor
    black: '#6b7280',        // Deceased
  },

  // Border colors
  border: {
    primary: '#334155',
    secondary: '#444',
    light: '#475569',
  },

  // Semantic colors
  online: '#22c55e',         // Online status
  offline: '#64748b',        // Offline status
  premium: '#fbbf24',        // Premium gold
  free: '#94a3b8',           // Free tier

  // Gradient colors for premium elements
  gradient: {
    start: '#3b82f6',
    middle: '#2563eb',
    end: '#1e40af',
  },
};

// Helper function for opacity
export const withOpacity = (color: string, opacity: number): string => {
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
};

