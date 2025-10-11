import { backendLogger } from '../utils/productionLogger';
import express, { Response } from 'express';
import { body, query, param } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, sanitizeInput, validators } from '../middleware/validation';
import { prisma } from '../utils/prisma';

const router = express.Router();

// POST /api/analytics/event - Track analytics event
router.post(
  '/event',
  authenticate,
  [
    body('eventType')
      .trim()
      .notEmpty().withMessage('eventType is required')
      .isLength({ max: 50 }).withMessage('eventType too long'),
    body('platform').optional().trim().isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
    body('version').optional().trim().isLength({ max: 20 }).withMessage('Version too long'),
    body('metadata').optional().isObject().withMessage('metadata must be an object'),
    body('duration').optional().isInt({ min: 0 }).withMessage('Invalid duration'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { eventType, platform, version, metadata, duration, success } = req.body;

      await prisma.analytics.create({
        data: {
          eventType,
          userId: req.user!.id,
          platform,
          version,
          metadata,
          duration,
          success: success !== false,
        },
      });

      res.status(201).json({ success: true });
    } catch (error) {
      backendLogger.error('❌ Analytics event error:', error);
      res.status(500).json({ error: 'Failed to track event' });
    }
  }
);

// GET /api/analytics/stats - Get analytics statistics (admin only)
router.get(
  '/stats',
  authenticate,
  [
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('eventType').optional().trim(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const eventType = req.query.eventType as string;

      const [totalEvents, eventsByType, platformDistribution, successRate] = await Promise.all([
        // Total events
        prisma.analytics.count({
          where: {
            createdAt: { gte: startDate, lte: endDate },
            ...(eventType && { eventType }),
          },
        }),

        // Events by type
        prisma.analytics.groupBy({
          by: ['eventType'],
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
          _count: true,
          orderBy: {
            _count: {
              eventType: 'desc',
            },
          },
          take: 10,
        }),

        // Platform distribution
        prisma.analytics.groupBy({
          by: ['platform'],
          where: {
            createdAt: { gte: startDate, lte: endDate },
            platform: { not: null },
          },
          _count: true,
        }),

        // Success rate
        prisma.analytics.aggregate({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
          _avg: {
            duration: true,
          },
        }),
      ]);

      res.json({
        period: {
          start: startDate,
          end: endDate,
        },
        totalEvents,
        eventsByType,
        platformDistribution,
        averageDuration: successRate._avg.duration || 0,
      });
    } catch (error) {
      backendLogger.error('❌ Analytics stats error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
);

// GET /api/analytics/user - Get user's own analytics
router.get('/user', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const events = await prisma.analytics.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        eventType: true,
        platform: true,
        version: true,
        success: true,
        createdAt: true,
      },
    });

    res.json(events);
  } catch (error) {
    backendLogger.error('❌ User analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

export default router;

