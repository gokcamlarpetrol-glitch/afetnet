export const colors = {
  // Dark theme colors (primary)
  background: {
    primary: '#1a1a1a',
    secondary: '#2c2c2e',
    tertiary: '#3a3a3c',
  },
  
  text: {
    primary: '#ffffff',
    secondary: '#ebebf5',
    tertiary: '#ebebf599',
    quaternary: '#ebebf54d',
  },
  
  // Status colors
  status: {
    critical: '#FF3B30', // Red
    high: '#FF9500',     // Orange
    normal: '#007AFF',   // Blue
    safe: '#34C759',     // Green
    warning: '#FFCC00',  // Yellow
    info: '#5AC8FA',     // Light Blue
  },
  
  // Priority colors
  priority: {
    critical: '#FF3B30', // Red
    high: '#FF9500',     // Orange
    normal: '#007AFF',   // Blue
  },
  
  // Interactive colors
  interactive: {
    primary: '#007AFF',
    secondary: '#5856d6',
    destructive: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
  },
  
  // Map colors
  map: {
    background: '#1a1a1a',
    water: '#2c5aa0',
    roads: {
      primary: '#4a90e2',
      secondary: '#7bb3f0',
      tertiary: '#a8d0f0',
    },
    buildings: '#666666',
    parks: '#4a7c59',
    heatmap: {
      critical: '#FF3B30',
      high: '#FF9500',
      normal: '#007AFF',
    },
  },
  
  // UI elements
  border: {
    primary: '#38383a',
    secondary: '#48484a',
  },
  
  overlay: {
    light: 'rgba(0, 0, 0, 0.3)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.7)',
  },
  
  // Resource type colors
  resources: {
    water: '#007AFF',
    food: '#34C759',
    blanket: '#FF9500',
    powerbank: '#5856d6',
    med: '#FF3B30',
  },
  
  // P2P status colors
  p2p: {
    connected: '#34C759',
    scanning: '#FFCC00',
    disconnected: '#FF3B30',
    lowBattery: '#FF9500',
  },
  
  // Accessibility
  accessibility: {
    focus: '#007AFF',
    selected: '#007AFF',
    disabled: '#8E8E93',
  },
};

// Light theme colors (fallback)
export const lightColors = {
  background: {
    primary: '#ffffff',
    secondary: '#f2f2f7',
    tertiary: '#ffffff',
  },
  
  text: {
    primary: '#000000',
    secondary: '#3c3c43',
    tertiary: '#3c3c4399',
    quaternary: '#3c3c434d',
  },
  
  status: colors.status,
  priority: colors.priority,
  interactive: colors.interactive,
  map: {
    ...colors.map,
    background: '#f2f2f7',
  },
  border: {
    primary: '#c6c6c8',
    secondary: '#d1d1d6',
  },
  overlay: {
    light: 'rgba(255, 255, 255, 0.3)',
    medium: 'rgba(255, 255, 255, 0.5)',
    dark: 'rgba(255, 255, 255, 0.7)',
  },
  resources: colors.resources,
  p2p: colors.p2p,
  accessibility: colors.accessibility,
};
