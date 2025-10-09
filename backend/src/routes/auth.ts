import bcrypt from 'bcryptjs';
import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import * as jwt from 'jsonwebtoken';
import { auditAuth } from '../middleware/audit';
import { sanitizeInput, validate } from '../middleware/validation';
import { logger, logSecurity } from '../utils/logger';
import { prisma } from '../utils/prisma';

const router = express.Router();

// Generate AFN-ID
const generateAfnId = (): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id = 'AFN-';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

// POST /api/auth/register
router.post(
  '/register',
  auditAuth('register'),
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('phone')
      .optional()
      .trim()
      .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone format'),
    body('password')
      .optional()
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      // Sanitize inputs
      const name = sanitizeInput(req.body.name);
      const email = req.body.email ? sanitizeInput(req.body.email) : undefined;
      const phone = req.body.phone ? sanitizeInput(req.body.phone) : undefined;
      const { password } = req.body;

    // Check if user exists
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return res.status(400).json({ error: 'Phone already registered' });
      }
    }

    // Generate AFN-ID
    let afnId = generateAfnId();
    while (await prisma.user.findUnique({ where: { afnId } })) {
      afnId = generateAfnId();
    }

    // Hash password
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Create user
    const user = await prisma.user.create({
      data: {
        afnId,
        name,
        email,
        phone,
        passwordHash,
      },
    });

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-this';
      const token = jwt.sign(
        {
          id: user.id,
          afnId: user.afnId,
          isPremium: user.isPremium,
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      logger.info(`✅ New user registered: ${user.afnId}`);

      res.status(201).json({
      user: {
        id: user.id,
        afnId: user.afnId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPremium: user.isPremium,
      },
      token,
    });
  } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  auditAuth('login'),
  [
    body('email').optional().trim().isEmail().withMessage('Invalid email format'),
    body('phone').optional().trim().matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone format'),
    body('afnId').optional().trim().matches(/^AFN-[0-9A-Z]{8}$/).withMessage('Invalid AFN-ID format'),
    body('password').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const email = req.body.email ? sanitizeInput(req.body.email) : undefined;
      const phone = req.body.phone ? sanitizeInput(req.body.phone) : undefined;
      const afnId = req.body.afnId ? sanitizeInput(req.body.afnId) : undefined;
      const { password } = req.body;

    // Find user
    let user;
    if (afnId) {
      user = await prisma.user.findUnique({ where: { afnId } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    } else if (phone) {
      user = await prisma.user.findUnique({ where: { phone } });
    }

      if (!user) {
        logSecurity('Login failed - User not found', {
          email, phone, afnId,
          ip: req.ip,
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // CRITICAL: Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        logSecurity('Login failed - Account locked', {
          userId: user.id,
          afnId: user.afnId,
          lockedUntil: user.lockedUntil,
        });
        return res.status(403).json({
          error: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked. Please try again later.',
          lockedUntil: user.lockedUntil,
        });
      }

      // CRITICAL: Check if account is active
      if (!user.isActive) {
        logSecurity('Login failed - Account inactive', {
          userId: user.id,
          afnId: user.afnId,
        });
        return res.status(403).json({
          error: 'ACCOUNT_INACTIVE',
          message: 'Account is deactivated. Please contact support.',
        });
      }

      // Verify password
      if (password && user.passwordHash) {
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          // CRITICAL: Increment failed login attempts
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: user.failedLoginAttempts + 1,
            },
          });

          logSecurity('Login failed - Invalid password', {
            userId: user.id,
            afnId: user.afnId,
            attempts: user.failedLoginAttempts + 1,
          });

          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-this';
    const token = jwt.sign(
      {
        id: user.id,
        afnId: user.afnId,
        isPremium: user.isPremium,
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

      // CRITICAL: Reset failed login attempts and update last seen
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastSeenAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      logger.info(`✅ User logged in: ${user.afnId}`);

    res.json({
      user: {
        id: user.id,
        afnId: user.afnId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPremium: user.isPremium,
        premiumExpiry: user.premiumExpiry,
      },
      token,
    });
  } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// POST /api/auth/fcm-token
router.post(
  '/fcm-token',
  [
    body('userId').trim().notEmpty().withMessage('userId is required').isUUID().withMessage('Invalid userId format'),
    body('token').trim().notEmpty().withMessage('token is required').isLength({ min: 10 }).withMessage('Invalid token'),
    body('platform').optional().trim().isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userId, token, platform } = req.body;

    // Upsert FCM token
    await prisma.fcmToken.upsert({
      where: { token },
      update: {
        userId,
        platform: platform || 'unknown',
        updatedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform: platform || 'unknown',
      },
    });

    res.json({ success: true });
  } catch (error) {
      console.error('FCM token error:', error);
      res.status(500).json({ error: 'Failed to register FCM token' });
    }
  }
);

export default router;
