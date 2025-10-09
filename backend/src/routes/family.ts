import express, { Response } from 'express';
import { body, query } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sanitizeInput, validate } from '../middleware/validation';
import { prisma } from '../utils/prisma';

const router = express.Router();

// GET /api/family - Get family members
router.get(
  '/',
  authenticate,
  [
    query('includeOffline').optional().isBoolean().withMessage('Invalid includeOffline'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const members = await prisma.familyMember.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
      });

      res.json(members);
    } catch (error) {
      console.error('❌ Family fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch family members' });
    }
  }
);

// POST /api/family - Add family member
router.post(
  '/',
  authenticate,
  [
    body('memberAfnId')
      .trim()
      .notEmpty().withMessage('memberAfnId is required')
      .matches(/^AFN-[0-9A-Z]{8}$/).withMessage('Invalid AFN-ID format'),
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters'),
    body('relation')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('Relation too long'),
    body('phone')
      .optional()
      .trim()
      .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone format'),
    body('connectionMethod')
      .optional()
      .isIn(['qr', 'afn-id', 'manual']).withMessage('Invalid connection method'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const memberAfnId = sanitizeInput(req.body.memberAfnId);
      const name = sanitizeInput(req.body.name);
      const relation = req.body.relation ? sanitizeInput(req.body.relation) : null;
      const phone = req.body.phone ? sanitizeInput(req.body.phone) : null;
      const connectionMethod = req.body.connectionMethod || 'manual';

      // CRITICAL: Prevent adding yourself as family member
      if (memberAfnId === req.user!.afnId) {
        return res.status(400).json({ error: 'Cannot add yourself as family member' });
      }

      // Check if member exists
      const memberUser = await prisma.user.findUnique({
        where: { afnId: memberAfnId },
      });

      if (!memberUser) {
        return res.status(404).json({ error: 'User with this AFN-ID not found' });
      }

      // Check if already added
      const existing = await prisma.familyMember.findFirst({
        where: {
          userId: req.user!.id,
          memberAfnId,
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Family member already added' });
      }

      // CRITICAL: Check family member limit (max 20 for free, unlimited for premium)
      const memberCount = await prisma.familyMember.count({
        where: { userId: req.user!.id },
      });

      if (!req.user!.isPremium && memberCount >= 20) {
        return res.status(403).json({
          error: 'Family member limit reached',
          message: 'Free users can add up to 20 family members. Upgrade to premium for unlimited.',
        });
      }

      // Create family member
      const member = await prisma.familyMember.create({
        data: {
          userId: req.user!.id,
          memberAfnId,
          name,
          relation,
          phone,
          connectionMethod,
          isVerified: connectionMethod === 'qr', // QR connections are auto-verified
        },
      });

      console.log(`👨‍👩‍👧‍👦 Family member added: ${req.user!.afnId} → ${memberAfnId}`);

      res.status(201).json(member);
    } catch (error) {
      console.error('❌ Family add error:', error);
      res.status(500).json({ error: 'Failed to add family member' });
    }
  }
);

// PUT /api/family/:id - Update family member
router.put(
  '/:id',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Invalid name'),
    body('relation').optional().trim().isLength({ max: 50 }).withMessage('Relation too long'),
    body('phone').optional().trim().matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone format'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if member exists and belongs to user
      const existing = await prisma.familyMember.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Family member not found' });
      }

      if (existing.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Update
      const updates: any = {};
      if (req.body.name) updates.name = sanitizeInput(req.body.name);
      if (req.body.relation) updates.relation = sanitizeInput(req.body.relation);
      if (req.body.phone) updates.phone = sanitizeInput(req.body.phone);

      const member = await prisma.familyMember.update({
        where: { id: req.params.id },
        data: updates,
      });

      res.json(member);
    } catch (error) {
      console.error('❌ Family update error:', error);
      res.status(500).json({ error: 'Failed to update family member' });
    }
  }
);

// DELETE /api/family/:id - Remove family member
router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if member exists and belongs to user
      const existing = await prisma.familyMember.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Family member not found' });
      }

      // CRITICAL: Only owner can delete
      if (existing.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await prisma.familyMember.delete({
        where: { id: req.params.id },
      });

      console.log(`🗑️  Family member removed: ${req.user!.afnId} removed ${existing.memberAfnId}`);

      res.json({ success: true });
    } catch (error) {
      console.error('❌ Family delete error:', error);
      res.status(500).json({ error: 'Failed to remove family member' });
    }
  }
);

// PUT /api/family/:id/verify - Verify family member
router.put(
  '/:id/verify',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.familyMember.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Family member not found' });
      }

      if (existing.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const member = await prisma.familyMember.update({
        where: { id: req.params.id },
        data: { isVerified: true },
      });

      console.log(`✅ Family member verified: ${existing.memberAfnId}`);

      res.json(member);
    } catch (error) {
      console.error('❌ Family verify error:', error);
      res.status(500).json({ error: 'Failed to verify family member' });
    }
  }
);

export default router;