import { Platform } from 'react-native';

export function hasVectorSupport(): boolean {
  try {
    // Check if MapLibre native module is available
    if (Platform.OS === 'web') {
      return false; // MapLibre GL JS would be needed for web
    }
    
    // In a real implementation, you would check for the native module
    // For now, we'll return true for mobile platforms
    return Platform.OS === 'ios' || Platform.OS === 'android';
  } catch (error) {
    return false;
  }
}

export const baseStyleLight = {
  version: 8,
  name: "AfetNet Light",
  sources: {
    "vector-local": {
      type: "vector" as const,
      tiles: ["vector://local/{z}/{x}/{y}"],
      minzoom: 0,
      maxzoom: 14
    }
  },
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: {
        "background-color": "#f8f9fa"
      }
    },
    {
      id: "roads",
      type: "line" as const,
      source: "vector-local",
      "source-layer": "roads",
      paint: {
        "line-color": "#666666",
        "line-width": 1
      }
    },
    {
      id: "buildings",
      type: "fill" as const,
      source: "vector-local",
      "source-layer": "buildings",
      paint: {
        "fill-color": "#e0e0e0",
        "fill-outline-color": "#cccccc"
      }
    },
    {
      id: "water",
      type: "fill" as const,
      source: "vector-local",
      "source-layer": "water",
      paint: {
        "fill-color": "#b3d9ff"
      }
    }
  ]
};
