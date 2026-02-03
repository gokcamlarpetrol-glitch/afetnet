/**
 * EARTHQUAKE DEDUPLICATOR - ELITE MODULAR
 * Deduplicates earthquakes from multiple sources
 */

import { Earthquake } from '../../stores/earthquakeStore';
import { calculateDistance } from './EarthquakeDataProcessor';

/**
 * ELITE: Deduplicate earthquakes based on similar location and time
 * More flexible deduplication ensures rapid successive earthquakes are not missed
 */
export function deduplicateEarthquakes(earthquakes: Earthquake[]): Earthquake[] {
  const unique: Earthquake[] = [];
  const seen = new Map<string, Earthquake>();

  for (const eq of earthquakes) {
    // ELITE: More flexible deduplication - 1 minute buckets
    const timeKey = Math.floor(eq.time / (1 * 60 * 1000)); // 1 minute buckets
    const latKey = Math.round(eq.latitude * 10); // ~0.1km precision
    const lonKey = Math.round(eq.longitude * 10); // ~0.1km precision
    const magKey = Math.round(eq.magnitude * 10); // 0.1 magnitude precision
    const key = `${timeKey}-${latKey}-${lonKey}-${magKey}`;

    const existing = seen.get(key);
    if (!existing) {
      // First occurrence - add it
      seen.set(key, eq);
      unique.push(eq);
    } else {
      // Duplicate detected - prefer AFAD if available
      if (existing.source === eq.source) {
        // Same source duplicate - skip
        continue;
      } else {
        // Different sources reporting same earthquake
        const timeDiff = Math.abs(existing.time - eq.time);
        const distance = calculateDistance(
          existing.latitude, existing.longitude,
          eq.latitude, eq.longitude,
        );
        
        // ELITE: More lenient duplicate detection - within 1 minute and 10km
        // CRITICAL: Keep both AFAD and Kandilli sources for filtering purposes
        // Users should be able to filter by source, so we need both versions
        if (timeDiff < 60 * 1000 && distance < 10) {
          // Same earthquake from different sources - keep both for source filtering
          // Only skip if it's the exact same source
          if (existing.source !== eq.source) {
            // Different sources - keep both (user can filter by source)
            unique.push(eq);
          }
          // Same source duplicate - already skipped above
        } else {
          // Different enough to be separate earthquakes - keep both
          unique.push(eq);
        }
      }
    }
  }

  return unique;
}

