import { backendLogger } from '../utils/productionLogger';
import express, { Response } from 'express';
import { body, param, query } from 'express-validator';
import { auditCritical } from '../middleware/audit';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sanitizeInput, validate, validators } from '../middleware/validation';
import { sendMulticastNotification } from '../services/firebase';
import { logSOS } from '../utils/logger';
import { prisma } from '../utils/prisma';

const router = express.Router();

// GET /api/sos - Get active SOS alerts
router.get(
  '/',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
    query('status').optional().isIn(['active', 'resolved', 'false_alarm']).withMessage('Invalid status'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string || 'active';

      const alerts = await prisma.sosAlert.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              afnId: true,
              name: true,
            },
          },
        },
      });

      res.json(alerts);
    } catch (error) {
      backendLogger.error('❌ SOS fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch SOS alerts' });
    }
  }
);

// POST /api/sos - Create SOS alert
router.post(
  '/',
  authenticate,
  auditCritical('sos_created', 'sos'),
  [
    body('latitude')
      .notEmpty().withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude')
      .notEmpty().withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('accuracy')
      .optional()
      .isFloat({ min: 0 }).withMessage('Accuracy must be positive'),
    body('message')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Message too long (max 500 chars)')
      .custom((value) => !/<script|javascript:|on\w+=/i.test(value)).withMessage('Invalid message content'),
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
      .custom((tags: string[]) => tags.every((t: string) => typeof t === 'string' && t.length <= 50))
      .withMessage('Invalid tags format'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { latitude, longitude, accuracy, tags } = req.body;
      const message = req.body.message ? sanitizeInput(req.body.message) : null;

      // CRITICAL: Validate coordinates are real
      if (!validators.isLatitude(parseFloat(latitude)) || !validators.isLongitude(parseFloat(longitude))) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }

      // CRITICAL: Rate limit - Check if user has active SOS
      const existingActive = await prisma.sosAlert.findFirst({
        where: {
          userId: req.user!.id,
          status: 'active',
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
        },
      });

      if (existingActive) {
        return res.status(429).json({ 
          error: 'You already have an active SOS alert',
          existingAlertId: existingActive.id,
        });
      }

      // CRITICAL: Create SOS alert
      const alert = await prisma.sosAlert.create({
        data: {
          userId: req.user!.id,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          accuracy: accuracy ? parseFloat(accuracy) : null,
          message: message || null,
          tags: tags || ['sos'],
          status: 'active',
          priority: 'critical',
        },
        include: {
          user: {
            select: {
              afnId: true,
              name: true,
            },
          },
        },
      });

      // CRITICAL: Log SOS creation
      logSOS('SOS Alert Created', {
        sosId: alert.id,
        userId: req.user!.id,
        afnId: req.user!.afnId,
        latitude,
        longitude,
        accuracy,
        message: message || 'No message',
        tags: tags || ['sos'],
      });

      // CRITICAL: Notify all family members immediately
      try {
        const familyMembers = await prisma.familyMember.findMany({
          where: { userId: req.user!.id },
          include: {
            user: {
              include: {
                fcmTokens: true,
              },
            },
          },
        });

        const tokens = familyMembers.flatMap((m: any) =>
          m.user.fcmTokens.map((t: { token: string }) => t.token)
        );

        if (tokens.length > 0) {
          await sendMulticastNotification(tokens, {
            title: '🆘 ACİL DURUM!',
            body: `${alert.user.name} (${alert.user.afnId}) yardım istiyor!`,
            data: {
              type: 'sos',
              sosId: alert.id,
              afnId: alert.user.afnId,
              latitude: alert.latitude.toString(),
              longitude: alert.longitude.toString(),
              message: alert.message || '',
            },
          });

          backendLogger.debug(`📱 CRITICAL: SOS notifications sent to ${tokens.length} family members`);
        }
      } catch (notifError) {
        backendLogger.error('⚠️  SOS notification error (non-blocking):', notifError);
        // Don't fail the request if notification fails
      }

      res.status(201).json(alert);
    } catch (error) {
      backendLogger.error('❌ CRITICAL: SOS creation failed:', error);
      res.status(500).json({ error: 'Failed to create SOS alert' });
    }
  }
);

// PUT /api/sos/:id/resolve - Resolve SOS alert
router.put(
  '/:id/resolve',
  authenticate,
  [
    param('id').trim().isUUID().withMessage('Invalid SOS ID'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Notes too long')
      .custom((value) => !/<script|javascript:/i.test(value)).withMessage('Invalid notes content'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { notes } = req.body;

      // Check if SOS exists
      const existing = await prisma.sosAlert.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'SOS alert not found' });
      }

      if (existing.status === 'resolved') {
        return res.status(400).json({ error: 'SOS alert already resolved' });
      }

      // Resolve SOS
      const alert = await prisma.sosAlert.update({
        where: { id: req.params.id },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: req.user!.afnId,
          responders: [...(existing.responders || []), req.user!.afnId],
        },
      });

      backendLogger.debug(`✅ SOS Alert ${req.params.id} resolved by ${req.user!.afnId}`);

      res.json(alert);
    } catch (error) {
      backendLogger.error('❌ SOS resolve error:', error);
      res.status(500).json({ error: 'Failed to resolve SOS alert' });
    }
  }
);

// PUT /api/sos/:id/respond - Respond to SOS (I'm coming to help)
router.put(
  '/:id/respond',
  authenticate,
  [
    param('id').trim().isUUID().withMessage('Invalid SOS ID'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.sosAlert.findUnique({
        where: { id: req.params.id },
        include: {
          user: {
            include: {
              fcmTokens: true,
            },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'SOS alert not found' });
      }

      // Add responder
      const alert = await prisma.sosAlert.update({
        where: { id: req.params.id },
        data: {
          responders: [...(existing.responders || []), req.user!.afnId],
        },
      });

      // Notify SOS creator that help is coming
      if (existing.user.fcmTokens.length > 0) {
        const tokens = existing.user.fcmTokens.map((t: { token: string }) => t.token);
        await sendMulticastNotification(tokens, {
          title: '✅ Yardım Yolda!',
          body: `${req.user!.afnId} size yardıma geliyor!`,
          data: {
            type: 'sos_response',
            sosId: alert.id,
            responderAfnId: req.user!.afnId,
          },
        });
      }

      backendLogger.debug(`🚑 ${req.user!.afnId} responding to SOS ${req.params.id}`);

      res.json(alert);
    } catch (error) {
      backendLogger.error('❌ SOS respond error:', error);
      res.status(500).json({ error: 'Failed to respond to SOS alert' });
    }
  }
);

export default router;