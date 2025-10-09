import express, { Request, Response } from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validation';
import { prisma } from '../utils/prisma';

const router = express.Router();

// In-memory cache for earthquake data - CRITICAL: Reduces database load
let earthquakeCache: any[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

// GET /api/earthquakes - Get earthquakes (public endpoint)
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1-500'),
    query('minMagnitude').optional().isFloat({ min: 0, max: 10 }).withMessage('Invalid magnitude'),
    query('source').optional().isIn(['AFAD', 'USGS', 'KANDILLI']).withMessage('Invalid source'),
    query('hours').optional().isInt({ min: 1, max: 168 }).withMessage('Hours must be between 1-168'),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const minMagnitude = req.query.minMagnitude ? parseFloat(req.query.minMagnitude as string) : undefined;
      const source = req.query.source as string;
      const hours = parseInt(req.query.hours as string) || 24;

      // CRITICAL: Use cache if fresh (reduces database load)
      const now = Date.now();
      if (earthquakeCache.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
        let filtered = earthquakeCache;

        if (minMagnitude) {
          filtered = filtered.filter((q) => q.magnitude >= minMagnitude);
        }

        if (source) {
          filtered = filtered.filter((q) => q.source === source);
        }

        return res.json(filtered.slice(0, limit));
      }

      // Fetch from database
      const cutoffTime = new Date(Date.now() - hours * 3600000);

      const earthquakes = await prisma.earthquake.findMany({
        where: {
          timestamp: { gte: cutoffTime },
          ...(minMagnitude && { magnitude: { gte: minMagnitude } }),
          ...(source && { source }),
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      // Update cache
      earthquakeCache = earthquakes;
      cacheTimestamp = now;

      res.json(earthquakes);
    } catch (error) {
      console.error('❌ Earthquake fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch earthquakes' });
    }
  }
);

// GET /api/earthquakes/:id - Get earthquake details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const earthquake = await prisma.earthquake.findUnique({
      where: { id: req.params.id },
    });

    if (!earthquake) {
      return res.status(404).json({ error: 'Earthquake not found' });
    }

    res.json(earthquake);
  } catch (error) {
    console.error('❌ Earthquake detail fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch earthquake' });
  }
});

// GET /api/earthquakes/nearby/:lat/:lon - Get nearby earthquakes
router.get(
  '/nearby/:lat/:lon',
  [
    query('radius').optional().isInt({ min: 1, max: 5000 }).withMessage('Radius must be between 1-5000 km'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.params.lat);
      const lon = parseFloat(req.params.lon);
      const radius = parseInt(req.query.radius as string) || 500; // km
      const limit = parseInt(req.query.limit as string) || 50;

      // Validate coordinates
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: 'Invalid latitude' });
      }

      if (isNaN(lon) || lon < -180 || lon > 180) {
        return res.status(400).json({ error: 'Invalid longitude' });
      }

      // Fetch recent earthquakes
      const earthquakes = await prisma.earthquake.findMany({
        where: {
          timestamp: { gte: new Date(Date.now() - 7 * 24 * 3600000) }, // Last 7 days
        },
        orderBy: { timestamp: 'desc' },
        take: 500, // Get more for distance calculation
      });

      // Calculate distance and filter
      const nearby = earthquakes
        .map((quake: any) => {
          const distance = calculateDistance(lat, lon, quake.latitude, quake.longitude);
          return { ...quake, distance };
        })
        .filter((quake: any) => quake.distance <= radius)
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, limit);

      res.json(nearby);
    } catch (error) {
      console.error('❌ Nearby earthquakes error:', error);
      res.status(500).json({ error: 'Failed to fetch nearby earthquakes' });
    }
  }
);

// GET /api/earthquakes/stats/summary - Get earthquake statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 3600000);
    const oneWeekAgo = new Date(now - 7 * 24 * 3600000);

    const [last24h, last7days, maxMagnitude, totalCount] = await Promise.all([
      prisma.earthquake.count({ where: { timestamp: { gte: oneDayAgo } } }),
      prisma.earthquake.count({ where: { timestamp: { gte: oneWeekAgo } } }),
      prisma.earthquake.findFirst({
        where: { timestamp: { gte: oneWeekAgo } },
        orderBy: { magnitude: 'desc' },
        select: { magnitude: true, place: true, timestamp: true },
      }),
      prisma.earthquake.count(),
    ]);

    res.json({
      last24Hours: last24h,
      last7Days: last7days,
      maxMagnitude: maxMagnitude || null,
      totalCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Earthquake stats error:', error);
    res.status(500).json({ error: 'Failed to fetch earthquake statistics' });
  }
});

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

export default router;