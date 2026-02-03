import React from 'react';
// Ideally we import Heatmap from react-native-maps
// But to be safe with types and availability:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Heatmap: any = null;
try {
  const rnMaps = require('react-native-maps');
  Heatmap = rnMaps.Heatmap;
} catch (e) {
  // ELITE: Heatmap component is optional - may not be available on all platforms
}

interface SeismicHeatmapProps {
  points: { latitude: number; longitude: number; weight: number }[];
  enabled: boolean;
}

import { Platform } from 'react-native';

// ...

export const SeismicHeatmap = ({ points, enabled }: SeismicHeatmapProps) => {
  // Heatmaps are only supported on Google Maps. 
  // On iOS, apple maps is default and doesn't support it.
  // To avoid crash: Invariant Violation: View config not found for component AIRMapHeatmap
  const isSupported = Platform.OS === 'android' || (Platform.OS === 'ios' && false); // Assume apple maps for now on iOS

  if (!enabled || !isSupported || !Heatmap || points.length === 0) return null;

  return (
    <Heatmap
      points={points}
      opacity={0.6}
      radius={40}
      gradient={{
        colors: ['#00000000', '#FDE047', '#F97316', '#EF4444', '#7F1D1D'],
        startPoints: [0, 0.25, 0.5, 0.75, 1],
        colorMapSize: 256,
      }}
    />
  );
};
