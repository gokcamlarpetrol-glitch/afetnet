import express, { Response } from 'express';
import { body, query } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { prisma } from '../utils/prisma';

const router = express.Router();

// POST /api/mesh/relay - Relay mesh message
router.post(
  '/relay',
  authenticate,
  [
    body('meshId')
      .trim()
      .notEmpty().withMessage('meshId is required')
      .isLength({ min: 10, max: 100 }).withMessage('Invalid meshId'),
    body('type')
      .trim()
      .notEmpty().withMessage('type is required')
      .isIn(['SOS', 'PING', 'ACK', 'MSG', 'LOCATION']).withMessage('Invalid message type'),
    body('payload')
      .notEmpty().withMessage('payload is required')
      .custom((value) => {
        if (typeof value === 'object') return true;
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      }).withMessage('Invalid payload format'),
    body('ttl')
      .optional()
      .isInt({ min: 1, max: 10 }).withMessage('TTL must be between 1-10'),
    body('toAfnId')
      .optional()
      .trim()
      .matches(/^AFN-[0-9A-Z]{8}$/).withMessage('Invalid AFN-ID format'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { meshId, type, payload, ttl, toAfnId } = req.body;

      // CRITICAL: Check if message already exists (prevent duplicates)
      const existing = await prisma.meshMessage.findUnique({
        where: { meshId },
      });

      if (existing) {
        return res.status(409).json({ error: 'Message already relayed', message: existing });
      }

      // CRITICAL: Calculate expiration based on TTL
      const ttlMinutes = (ttl || 5) * 12; // Each TTL hop = 12 minutes
      const expiresAt = new Date(Date.now() + ttlMinutes * 60000);

      // Create mesh message
      const message = await prisma.meshMessage.create({
        data: {
          meshId,
          fromAfnId: req.user!.afnId,
          toAfnId: toAfnId || null,
          type,
          payload: typeof payload === 'string' ? JSON.parse(payload) : payload,
          ttl: ttl || 5,
          hopCount: 0,
          relayedBy: [],
          expiresAt,
        },
      });

      console.log(`📡 Mesh message relayed: ${meshId} (${type}) from ${req.user!.afnId}`);

      res.status(201).json(message);
    } catch (error) {
      console.error('❌ Mesh relay error:', error);
      res.status(500).json({ error: 'Failed to relay mesh message' });
    }
  }
);

// GET /api/mesh/messages - Get mesh messages
router.get(
  '/messages',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1-200'),
    query('type').optional().isIn(['SOS', 'PING', 'ACK', 'MSG', 'LOCATION']).withMessage('Invalid type'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const type = req.query.type as string;

      const messages = await prisma.meshMessage.findMany({
        where: {
          OR: [
            { fromAfnId: req.user!.afnId },
            { toAfnId: req.user!.afnId },
            { toAfnId: null }, // Broadcast messages
          ],
          expiresAt: { gt: new Date() }, // Only non-expired
          ...(type && { type }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json(messages);
    } catch (error) {
      console.error('❌ Mesh messages fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch mesh messages' });
    }
  }
);

// PUT /api/mesh/messages/:meshId/hop - Increment hop count (when relayed)
router.put(
  '/messages/:meshId/hop',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const message = await prisma.meshMessage.findUnique({
        where: { meshId: req.params.meshId },
      });

      if (!message) {
        return res.status(404).json({ error: 'Mesh message not found' });
      }

      // CRITICAL: Check if TTL exceeded
      if (message.hopCount >= message.ttl) {
        return res.status(400).json({ error: 'TTL exceeded, message expired' });
      }

      // CRITICAL: Check if already relayed by this user
      if (message.relayedBy.includes(req.user!.afnId)) {
        return res.status(400).json({ error: 'Already relayed by this user' });
      }

      // Update hop count and relayer list
      const updated = await prisma.meshMessage.update({
        where: { meshId: req.params.meshId },
        data: {
          hopCount: message.hopCount + 1,
          relayedBy: [...message.relayedBy, req.user!.afnId],
        },
      });

      console.log(`🔄 Mesh message hopped: ${req.params.meshId} (hop ${updated.hopCount}/${updated.ttl})`);

      res.json(updated);
    } catch (error) {
      console.error('❌ Mesh hop error:', error);
      res.status(500).json({ error: 'Failed to update mesh message' });
    }
  }
);

// GET /api/mesh/stats - Get mesh network statistics
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [totalMessages, activeMessages, sosMessages, avgHops] = await Promise.all([
      prisma.meshMessage.count(),
      prisma.meshMessage.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.meshMessage.count({ where: { type: 'SOS', expiresAt: { gt: new Date() } } }),
      prisma.meshMessage.aggregate({
        where: { expiresAt: { gt: new Date() } },
        _avg: { hopCount: true },
      }),
    ]);

    res.json({
      totalMessages,
      activeMessages,
      sosMessages,
      averageHops: avgHops._avg.hopCount || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Mesh stats error:', error);
    res.status(500).json({ error: 'Failed to fetch mesh statistics' });
  }
});

export default router;