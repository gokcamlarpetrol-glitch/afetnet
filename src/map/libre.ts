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
  } catch {
    return false;
  }
}

const mapStyleUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL;

export const baseStyleLight = mapStyleUrl ? mapStyleUrl : {
  version: 8,
  name: 'AfetNet Light',
  sources: {
    'osm': {
      type: 'raster' as const,
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: {
        'background-color': '#f8f9fa',
      },
    },
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
    },
  ],
};
