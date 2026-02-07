/**
 * EARTHQUAKE FUSION SERVICE - ELITE EDITION
 * "The Source of Truth"
 * 
 * Merges data from multiple agencies (AFAD, Kandilli, EMSC)
 * to provide a single, verified, and accurate list.
 */

import { Earthquake } from '../../stores/earthquakeStore';
import { createLogger } from '../../utils/logger';
import { calculateDistance } from '../../utils/locationUtils';

const logger = createLogger('EarthquakeFusionService');

// Thresholds for "Same Event" detection
const TIME_THRESHOLD_MS = 60 * 1000; // 60 seconds diff max
const DISTANCE_THRESHOLD_KM = 30; // 30km diff max (agencies calculate centers differently)

export interface FusedEarthquake extends Earthquake {
    verifiedBy: string[]; // ['AFAD', 'Kandilli']
    isVerified: boolean;
    confidenceScore: number; // 0-100
    originalSources: Earthquake[]; // Keep track of raw data
}

class EarthquakeFusionService {

  /**
     * Fuses multiple lists of earthquakes into a single authoritative list
     */
  fuse(
    afadList: Earthquake[],
    kandilliList: Earthquake[],
    primarySource: 'AFAD' | 'KANDILLI' = 'AFAD',
  ): Earthquake[] {
    const fusedMap = new Map<string, FusedEarthquake>();
    const primaryList = primarySource === 'KANDILLI' ? kandilliList : afadList;
    const secondaryList = primarySource === 'KANDILLI' ? afadList : kandilliList;
    const secondaryLabel = primarySource === 'KANDILLI' ? 'AFAD' : 'KANDILLI';

    // 1. Start with primary authority source
    primaryList.forEach(eq => {
      fusedMap.set(eq.id, {
        ...eq,
        verifiedBy: [primarySource],
        isVerified: false, // Needs multi-source for verification
        confidenceScore: 80, // High base confidence for selected primary
        originalSources: [eq],
      });
    });

    // 2. Merge secondary source as validator
    secondaryList.forEach(secondaryEq => {
      let matchFound = false;

      // Try to match with existing fused event
      for (const [id, fusedEq] of fusedMap.entries()) {
        if (this.isSameEarthquake(fusedEq, secondaryEq)) {
          // MATCH FOUND!
          this.mergeEvent(fusedEq, secondaryEq, primarySource);
          matchFound = true;
          break;
        }
      }

      // If no match, add as new event (but with lower initial confidence/priority if needed)
      if (!matchFound) {
        const normalizedPrefix = secondaryLabel.toLowerCase();
        const newId = secondaryEq.id.startsWith(`${normalizedPrefix}-`)
          ? secondaryEq.id
          : `${normalizedPrefix}-${secondaryEq.id}`;

        fusedMap.set(newId, {
          ...secondaryEq,
          id: newId,
          verifiedBy: [secondaryLabel],
          isVerified: false,
          confidenceScore: 70, // Slightly lower base confidence for secondary source
          originalSources: [secondaryEq],
        });
      }
    });

    // 3. Convert back to array and sort
    return Array.from(fusedMap.values())
      .map(fused => this.finalizeEvent(fused))
      .sort((a, b) => b.time - a.time);
  }

  private isSameEarthquake(eq1: Earthquake, eq2: Earthquake): boolean {
    const timeDiff = Math.abs(eq1.time - eq2.time);
    if (timeDiff > TIME_THRESHOLD_MS) return false;

    const dist = calculateDistance(eq1.latitude, eq1.longitude, eq2.latitude, eq2.longitude);
    return dist < DISTANCE_THRESHOLD_KM;
  }

  private mergeEvent(existing: FusedEarthquake, incoming: Earthquake, primarySource: 'AFAD' | 'KANDILLI') {
    // Add verification source
    if (!existing.verifiedBy.includes(incoming.source)) {
      existing.verifiedBy.push(incoming.source);
    }

    // Store original
    existing.originalSources.push(incoming);

    // BOOST CONFIDENCE - Cross-verified!
    existing.confidenceScore = 95;
    existing.isVerified = true;

    // MAGNITUDE STRATEGY:
    // Users prefer the HIGHER number initially (safety), but AFAD is official.
    // If agencies differ significantly (e.g. 3.5 vs 3.8), we usually keep the Primary (AFAD).
    // However, we can update the title or metadata to show the discrepancy if we wanted.
    // For now, we keep AFAD's magnitude as the "Display" magnitude if it exists,
    // but if the existing was Kandilli and AFAD comes later, we might override.
    // Since we process AFAD first, 'existing' is likely AFAD.

    // Keep selected primary authority as canonical source.
    if (incoming.source === primarySource && existing.source !== primarySource) {
      existing.magnitude = incoming.magnitude;
      existing.depth = incoming.depth;
      existing.location = incoming.location;
      existing.source = primarySource;
      existing.id = incoming.id;
    }
  }

  private finalizeEvent(fused: FusedEarthquake): Earthquake {
    // Convert internal Fused structure back to standard Earthquake
    // but inject the "Verified" status into the location or source text if desired.
    // Actually, the Store expects pure Earthquake objects. 
    // We can append verification data to the location string or use a custom field if we extend the type.

    // For now, standard Earthquake type doesn't have 'verifiedBy'.
    // We will append confirmation to the location for visible proof.

    let displayLocation = fused.location;

    // Only append text if verified by both
    /* 
        if (fused.verifiedBy.length > 1) {
             // We don't want to clutter the UI title. 
             // We will handle the "Verified" badge in the UI based on some logic,
             // or maybe we leave it clean.
        }
        */

    return {
      id: fused.id,
      magnitude: fused.magnitude,
      location: displayLocation,
      date: new Date(fused.time).toISOString(), // Legacy field support if needed
      time: fused.time,
      latitude: fused.latitude,
      longitude: fused.longitude,
      depth: fused.depth,
      source: fused.source,
    };
  }
}

export const earthquakeFusionService = new EarthquakeFusionService();
