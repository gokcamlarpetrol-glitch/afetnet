/**
 * EARTHQUAKES API ENDPOINT
 * Provides earthquake data from backend sources (EMSC, KOERI)
 * Frontend uses this to get multi-source verification data
 * 
 * NO COST - Backend already fetches this data
 */

import { Router } from 'express';
import { earthquakeDetectionService } from '../earthquake-detection';

const router = Router();

/**
 * GET /api/earthquakes
 * Returns earthquakes from backend sources (EMSC, KOERI)
 * 
 * Query params:
 * - since: timestamp (ms) - only return earthquakes after this time
 * - minmagnitude: minimum magnitude (default: 3.0)
 * - limit: maximum number of results (default: 100)
 */
router.get('/', async (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since as string, 10) : Date.now() - 2 * 60 * 60 * 1000; // Last 2 hours
    const minMagnitude = req.query.minmagnitude ? parseFloat(req.query.minmagnitude as string) : 3.0;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    
    // Get verified events from backend detection service
    const verifiedEvents = earthquakeDetectionService.getVerifiedEvents(120); // Last 2 minutes
    
    // Filter by time and magnitude
    const filteredEvents = verifiedEvents
      .filter(event => event.timestamp >= since && event.magnitude >= minMagnitude)
      .slice(0, limit)
      .map(event => ({
        id: `backend-${event.source}-${event.timestamp}`,
        source: event.source,
        magnitude: event.magnitude,
        latitude: event.latitude,
        longitude: event.longitude,
        depth: event.depth,
        depthKm: event.depth,
        region: event.region,
        timestamp: event.timestamp,
        issuedAt: event.timestamp,
        verified: event.verified,
      }));
    
    res.json({
      ok: true,
      earthquakes: filteredEvents,
      sources: ['emsc', 'koeri'], // Backend sources
      count: filteredEvents.length,
      since: new Date(since).toISOString(),
    });
  } catch (error) {
    console.error('❌ Earthquakes API error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch earthquakes',
      earthquakes: [],
      sources: [],
      count: 0,
    });
  }
});

export default router;

