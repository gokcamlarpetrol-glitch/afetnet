/**
 * SEISMIC HEATMAP - ELITE EDITION
 * Cross-platform heatmap with iOS Circle fallback
 * 
 * Android: Native Heatmap component
 * iOS: Gradient Circle overlay (Apple Maps compatible)
 */

import React from 'react';
import { Platform } from 'react-native';
import { Circle } from 'react-native-maps';

// ELITE: Dynamic import for Android Heatmap
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Heatmap: any = null;
try {
  if (Platform.OS === 'android') {
    const rnMaps = require('react-native-maps');
    Heatmap = rnMaps.Heatmap;
  }
} catch {
  // Heatmap not available
}

interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

interface SeismicHeatmapProps {
  points: HeatmapPoint[];
  enabled: boolean;
}

/**
 * ELITE: Calculate circle radius based on magnitude
 * Higher magnitude = larger visual impact
 */
const getCircleRadius = (weight: number): number => {
  // weight is magnitude (typically 0-10)
  // Convert to radius in meters (5km - 50km based on magnitude)
  const baseRadius = 5000; // 5km base
  const scaleFactor = 5000; // 5km per magnitude unit
  return baseRadius + weight * scaleFactor;
};

/**
 * ELITE: Get gradient color based on magnitude
 * Uses earthquake severity colors
 */
const getHeatColor = (weight: number): string => {
  if (weight >= 7.0) return 'rgba(127, 29, 29, 0.5)';   // Critical - dark red
  if (weight >= 6.0) return 'rgba(239, 68, 68, 0.45)';  // Severe - red
  if (weight >= 5.0) return 'rgba(249, 115, 22, 0.4)';  // Strong - orange
  if (weight >= 4.0) return 'rgba(253, 224, 71, 0.35)'; // Moderate - yellow
  if (weight >= 3.0) return 'rgba(163, 230, 53, 0.3)';  // Light - lime
  return 'rgba(34, 197, 94, 0.25)';                      // Minor - green
};

/**
 * ELITE: Get stroke color for circle border
 */
const getStrokeColor = (weight: number): string => {
  if (weight >= 7.0) return 'rgba(127, 29, 29, 0.8)';
  if (weight >= 6.0) return 'rgba(239, 68, 68, 0.7)';
  if (weight >= 5.0) return 'rgba(249, 115, 22, 0.6)';
  if (weight >= 4.0) return 'rgba(253, 224, 71, 0.5)';
  return 'rgba(34, 197, 94, 0.4)';
};

/**
 * iOS Fallback: Gradient circles for each earthquake point
 * Creates a visual "heatmap" effect using overlapping circles
 */
const IOSHeatmapFallback = ({ points }: { points: HeatmapPoint[] }) => {
  // Sort by weight ascending so larger earthquakes are on top
  const sortedPoints = [...points].sort((a, b) => a.weight - b.weight);

  return (
    <>
      {sortedPoints.map((point, index) => (
        <Circle
          key={`heatmap-circle-${index}-${point.latitude}-${point.longitude}`}
          center={{
            latitude: point.latitude,
            longitude: point.longitude,
          }}
          radius={getCircleRadius(point.weight)}
          fillColor={getHeatColor(point.weight)}
          strokeColor={getStrokeColor(point.weight)}
          strokeWidth={1}
          zIndex={Math.round(point.weight * 10)} // Higher magnitude on top
        />
      ))}
    </>
  );
};

/**
 * Android: Native Heatmap component
 * Uses Google Maps Heatmap for optimal performance
 */
const AndroidHeatmap = ({ points }: { points: HeatmapPoint[] }) => {
  if (!Heatmap) return null;

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

/**
 * Main Component: Cross-platform Seismic Heatmap
 */
export const SeismicHeatmap = ({ points, enabled }: SeismicHeatmapProps) => {
  if (!enabled || points.length === 0) return null;

  // ELITE: Platform-specific rendering
  if (Platform.OS === 'ios') {
    return <IOSHeatmapFallback points={points} />;
  }

  // Android with native heatmap
  if (Platform.OS === 'android' && Heatmap) {
    return <AndroidHeatmap points={points} />;
  }

  // Fallback for web or unsupported platforms
  return <IOSHeatmapFallback points={points} />;
};
