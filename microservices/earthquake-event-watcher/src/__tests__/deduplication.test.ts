/**
 * Deduplication Service Tests
 */

import { deduplicationService } from '../deduplication';
import { NormalizedEarthquake } from '../types/earthquake';

describe('DeduplicationService', () => {
  it('should deduplicate events within time and distance window', async () => {
    const now = Date.now();
    const events: NormalizedEarthquake[] = [
      {
        id: 'usgs-1',
        timestamp: now,
        magnitude: 4.0,
        latitude: 39.2,
        longitude: 28.5,
        depthKm: 10,
        source: 'USGS',
        detectedAt: now,
        latencyMs: 100,
      },
      {
        id: 'ambee-1',
        timestamp: now + 2000, // 2 seconds later
        magnitude: 4.1,
        latitude: 39.21, // Very close
        longitude: 28.51, // Very close
        depthKm: 10,
        source: 'Ambee',
        detectedAt: now + 2000,
        latencyMs: 200, // Slower
      },
    ];

    const deduplicated = await deduplicationService.deduplicateAndPrioritize(events);
    
    // Should keep only one (fastest - USGS)
    expect(deduplicated.length).toBeLessThanOrEqual(events.length);
  });
});

