/**
 * VIEWPORT DATA HOOK
 * Elite: Viewport-based data loading hook for performance optimization
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { getViewportBounds, filterByViewport, ViewportBounds, ViewportRegion } from '../utils/viewportUtils';

interface UseViewportDataOptions<T> {
  data: T[];
  region: ViewportRegion | null;
  enabled?: boolean;
  buffer?: number; // Buffer percentage (default: 0.2 = 20%)
}

/**
 * Hook for viewport-based data filtering
 * Only loads data visible in current viewport + buffer
 */
export function useViewportData<T extends { latitude: number; longitude: number }>({
  data,
  region,
  enabled = true,
  buffer = 0.2,
}: UseViewportDataOptions<T>) {
  const [viewportData, setViewportData] = useState<T[]>([]);
  const lastRegionRef = useRef<ViewportRegion | null>(null);

  useEffect(() => {
    if (!enabled || !region || data.length === 0) {
      setViewportData(data);
      return;
    }

    // ELITE: Check if region changed significantly
    const lastRegion = lastRegionRef.current;
    if (lastRegion) {
      const latDiff = Math.abs(lastRegion.latitude - region.latitude);
      const lngDiff = Math.abs(lastRegion.longitude - region.longitude);
      const latDeltaDiff = Math.abs(lastRegion.latitudeDelta - region.latitudeDelta);
      const lngDeltaDiff = Math.abs(lastRegion.longitudeDelta - region.longitudeDelta);
      
      // ELITE: More strict thresholds to prevent unnecessary updates
      // Only update if significant change (more than 5% for delta, 1% for center)
      const deltaThreshold = 0.05; // 5% threshold for delta
      const centerThreshold = 0.01; // 1% threshold for center
      
      const hasSignificantChange = 
        latDiff > centerThreshold ||
        lngDiff > centerThreshold ||
        latDeltaDiff > lastRegion.latitudeDelta * deltaThreshold ||
        lngDeltaDiff > lastRegion.longitudeDelta * deltaThreshold;
      
      if (!hasSignificantChange) {
        return; // No significant change, skip update
      }
    }

    lastRegionRef.current = region;

    // Calculate bounds with buffer
    const bounds = getViewportBounds({
      ...region,
      latitudeDelta: region.latitudeDelta * (1 + buffer),
      longitudeDelta: region.longitudeDelta * (1 + buffer),
    });

    // Filter data by viewport
    const filtered = filterByViewport(data, bounds);
    setViewportData(filtered);
  }, [data, region, enabled, buffer]);

  return viewportData;
}


