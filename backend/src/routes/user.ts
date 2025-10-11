import { backendLogger } from '../utils/productionLogger';
import express, { Response } from 'express';
import { body } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sanitizeInput, validate } from '../middleware/validation';
import { prisma } from '../utils/prisma';

const router = express.Router();

// GET /api/users/me - Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        afnId: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        bloodType: true,
        allergies: true,
        medications: true,
        emergencyContact: true,
        address: true,
        isPremium: true,
        premiumExpiry: true,
        createdAt: true,
        lastSeenAt: true,
        _count: {
          select: {
            familyMembers: true,
            sentMessages: true,
            receivedMessages: true,
            sosAlerts: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    backendLogger.error('❌ User fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/me - Update user profile
router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Invalid name'),
    body('email').optional().trim().isEmail().withMessage('Invalid email'),
    body('phone').optional().trim().matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone'),
    body('bloodType').optional().trim().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood type'),
    body('allergies').optional().trim().isLength({ max: 500 }).withMessage('Allergies too long'),
    body('medications').optional().trim().isLength({ max: 500 }).withMessage('Medications too long'),
    body('emergencyContact').optional().trim().matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid emergency contact'),
    body('address').optional().trim().isLength({ max: 500 }).withMessage('Address too long'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const updates: any = {};

      // Sanitize all string inputs
      if (req.body.name) updates.name = sanitizeInput(req.body.name);
      if (req.body.email) updates.email = sanitizeInput(req.body.email);
      if (req.body.phone) updates.phone = sanitizeInput(req.body.phone);
      if (req.body.bloodType) updates.bloodType = sanitizeInput(req.body.bloodType);
      if (req.body.allergies) updates.allergies = sanitizeInput(req.body.allergies);
      if (req.body.medications) updates.medications = sanitizeInput(req.body.medications);
      if (req.body.emergencyContact) updates.emergencyContact = sanitizeInput(req.body.emergencyContact);
      if (req.body.address) updates.address = sanitizeInput(req.body.address);

      // CRITICAL: Check if email/phone already taken by another user
      if (updates.email) {
        const existingEmail = await prisma.user.findFirst({
          where: {
            email: updates.email,
            NOT: { id: req.user!.id },
          },
        });

        if (existingEmail) {
          return res.status(400).json({ error: 'Email already in use' });
        }
      }

      if (updates.phone) {
        const existingPhone = await prisma.user.findFirst({
          where: {
            phone: updates.phone,
            NOT: { id: req.user!.id },
          },
        });

        if (existingPhone) {
          return res.status(400).json({ error: 'Phone already in use' });
        }
      }

      // Update user
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: updates,
      });

      backendLogger.debug(`📝 Profile updated: ${req.user!.afnId}`);

      res.json(user);
    } catch (error) {
      backendLogger.error('❌ User update error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// GET /api/users/:afnId - Get public user profile
router.get(
  '/:afnId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const afnId = sanitizeInput(req.params.afnId);

      // Validate AFN-ID format
      if (!/^AFN-[0-9A-Z]{8}$/.test(afnId)) {
        return res.status(400).json({ error: 'Invalid AFN-ID format' });
      }

      const user = await prisma.user.findUnique({
        where: { afnId },
        select: {
          afnId: true,
          name: true,
          avatar: true,
          lastSeenAt: true,
          // Only show sensitive info if family member
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if this user is in requester's family
      const isFamilyMember = await prisma.familyMember.findFirst({
        where: {
          userId: req.user!.id,
          memberAfnId: afnId,
        },
      });

      // If family member, show more details
      if (isFamilyMember) {
        const detailedUser = await prisma.user.findUnique({
          where: { afnId },
          select: {
            afnId: true,
            name: true,
            avatar: true,
            phone: true,
            bloodType: true,
            allergies: true,
            medications: true,
            emergencyContact: true,
            lastSeenAt: true,
          },
        });

        return res.json(detailedUser);
      }

      res.json(user);
    } catch (error) {
      backendLogger.error('❌ User profile fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  }
);

// DELETE /api/users/me - Delete account (GDPR compliance)
router.delete(
  '/me',
  authenticate,
  [
    body('confirmation')
      .notEmpty().withMessage('Confirmation required')
      .equals('DELETE_MY_ACCOUNT').withMessage('Invalid confirmation'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // CRITICAL: Delete all user data (GDPR compliance)
      await prisma.user.delete({
        where: { id: req.user!.id },
      });

      backendLogger.debug(`🗑️  CRITICAL: Account deleted: ${req.user!.afnId}`);

      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      backendLogger.error('❌ Account deletion error:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }
);

export default router;