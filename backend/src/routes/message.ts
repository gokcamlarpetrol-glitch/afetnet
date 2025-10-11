import { backendLogger } from '../utils/productionLogger';
import express, { Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sanitizeInput, validate } from '../middleware/validation';
import { prisma } from '../utils/prisma';

const router = express.Router();

// GET /api/messages - Get user messages
router.get(
  '/',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1-200'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Invalid offset'),
    query('type').optional().isIn(['text', 'sos', 'location', 'image']).withMessage('Invalid type'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const type = req.query.type as string;

      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: req.user!.id },
            { receiverId: req.user!.id },
          ],
          ...(type && { type }),
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          sender: {
            select: {
              afnId: true,
              name: true,
            },
          },
          receiver: {
            select: {
              afnId: true,
              name: true,
            },
          },
        },
      });

      res.json(messages);
    } catch (error) {
      backendLogger.error('❌ Message fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
);

// GET /api/messages/conversation/:afnId - Get conversation with specific user
router.get(
  '/conversation/:afnId',
  authenticate,
  [
    param('afnId')
      .trim()
      .matches(/^AFN-[0-9A-Z]{8}$/).withMessage('Invalid AFN-ID format'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be 1-200'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const otherUser = await prisma.user.findUnique({
        where: { afnId: req.params.afnId },
      });

      if (!otherUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: req.user!.id, receiverId: otherUser.id },
            { senderId: otherUser.id, receiverId: req.user!.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      // Mark messages as read
      await prisma.message.updateMany({
        where: {
          receiverId: req.user!.id,
          senderId: otherUser.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      res.json(messages);
    } catch (error) {
      backendLogger.error('❌ Conversation fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  }
);

// POST /api/messages - Send message
router.post(
  '/',
  authenticate,
  [
    body('receiverAfnId')
      .trim()
      .notEmpty().withMessage('receiverAfnId is required')
      .matches(/^AFN-[0-9A-Z]{8}$/).withMessage('Invalid AFN-ID format'),
    body('content')
      .trim()
      .notEmpty().withMessage('Content is required')
      .isLength({ min: 1, max: 5000 }).withMessage('Content must be between 1-5000 characters'),
    body('type')
      .optional()
      .isIn(['text', 'sos', 'location', 'image']).withMessage('Invalid message type'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const receiverAfnId = sanitizeInput(req.body.receiverAfnId);
      const content = sanitizeInput(req.body.content);
      const { type, latitude, longitude } = req.body;

      // Find receiver
      const receiver = await prisma.user.findUnique({
        where: { afnId: receiverAfnId },
        include: {
          fcmTokens: true,
        },
      });

      if (!receiver) {
        return res.status(404).json({ error: 'Receiver not found' });
      }

      // CRITICAL: Don't allow sending to self
      if (receiver.id === req.user!.id) {
        return res.status(400).json({ error: 'Cannot send message to yourself' });
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          senderId: req.user!.id,
          receiverId: receiver.id,
          content,
          type: type || 'text',
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          isEncrypted: true, // Always encrypted
          isSent: true,
          isDelivered: false,
          isRead: false,
        },
        include: {
          sender: {
            select: {
              afnId: true,
              name: true,
            },
          },
        },
      });

      // Send push notification to receiver
      if (receiver.fcmTokens.length > 0) {
        const { sendMulticastNotification } = await import('../services/firebase');
        const tokens = receiver.fcmTokens.map((t: { token: string }) => t.token);
        await sendMulticastNotification(tokens, {
          title: `💬 ${message.sender.name}`,
          body: content.length > 100 ? content.substring(0, 100) + '...' : content,
          data: {
            type: 'message',
            messageId: message.id,
            senderAfnId: message.sender.afnId,
          },
        }).catch((err: Error) => {
          backendLogger.error('⚠️  Message notification error (non-blocking):', err);
        });
      }

      backendLogger.debug(`📨 Message sent: ${req.user!.afnId} → ${receiverAfnId}`);

      res.status(201).json(message);
    } catch (error) {
      backendLogger.error('❌ Message send error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// PUT /api/messages/:id/read - Mark message as read
router.put(
  '/:id/read',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const message = await prisma.message.findUnique({
        where: { id: req.params.id },
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Only receiver can mark as read
      if (message.receiverId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const updated = await prisma.message.update({
        where: { id: req.params.id },
        data: { isRead: true },
      });

      res.json(updated);
    } catch (error) {
      backendLogger.error('❌ Message read error:', error);
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  }
);

// DELETE /api/messages/:id - Delete message
router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const message = await prisma.message.findUnique({
        where: { id: req.params.id },
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Only sender can delete
      if (message.senderId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await prisma.message.delete({
        where: { id: req.params.id },
      });

      res.json({ success: true });
    } catch (error) {
      backendLogger.error('❌ Message delete error:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
);

export default router;