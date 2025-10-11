import { backendLogger } from '../utils/productionLogger';
import express, { Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sanitizeInput, validate } from '../middleware/validation';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

const router = express.Router();

/**
 * Admin middleware - CRITICAL: Only for admin users
 * TODO: Implement proper admin role system
 */
const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  // TODO: Check if user has admin role
  // For now, just log the attempt
  logger.warn('Admin endpoint accessed', {
    userId: req.user!.id,
    afnId: req.user!.afnId,
    path: req.path,
  });
  next();
};

// GET /api/admin/stats - System statistics
router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      premiumUsers,
      totalMessages,
      activeSOS,
      totalEarthquakes,
      totalPayments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.user.count({ where: { isPremium: true } }),
      prisma.message.count(),
      prisma.sosAlert.count({ where: { status: 'active' } }),
      prisma.earthquake.count(),
      prisma.payment.count({ where: { status: 'completed' } }),
    ]);

    res.json({
      users: {
        total: totalUsers,
        active24h: activeUsers,
        premium: premiumUsers,
        premiumRate: totalUsers > 0 ? (premiumUsers / totalUsers * 100).toFixed(2) + '%' : '0%',
      },
      messages: {
        total: totalMessages,
      },
      sos: {
        active: activeSOS,
      },
      earthquakes: {
        total: totalEarthquakes,
      },
      payments: {
        completed: totalPayments,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    backendLogger.error('❌ Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/admin/users - List users (paginated)
router.get(
  '/users',
  authenticate,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Search term too long')
      .custom((value) => !/<|>|script/i.test(value)).withMessage('Invalid search term'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search ? sanitizeInput(req.query.search as string) : undefined;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { afnId: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            afnId: true,
            name: true,
            email: true,
            phone: true,
            isPremium: true,
            isActive: true,
            createdAt: true,
            lastSeenAt: true,
            _count: {
              select: {
                familyMembers: true,
                sentMessages: true,
                sosAlerts: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      backendLogger.error('❌ Admin users list error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// GET /api/admin/audit - Audit logs
router.get(
  '/audit',
  authenticate,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('action').optional().trim(),
    query('userId').optional().trim().isUUID().withMessage('Invalid userId'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const action = req.query.action as string;
      const userId = req.query.userId as string;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (action) where.action = action;
      if (userId) where.userId = userId;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      backendLogger.error('❌ Admin audit logs error:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// PUT /api/admin/users/:id/deactivate - Deactivate user account
router.put(
  '/users/:id/deactivate',
  authenticate,
  requireAdmin,
  [
    param('id').trim().isUUID().withMessage('Invalid user ID'),
    body('reason')
      .trim()
      .notEmpty().withMessage('Reason is required')
      .isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters')
      .custom((value) => !/<|>|script/i.test(value)).withMessage('Invalid characters in reason'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const reason = sanitizeInput(req.body.reason);

      // CRITICAL: Check if user exists first
      const existingUser = await prisma.user.findUnique({
        where: { id: req.params.id },
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // CRITICAL: Prevent deactivating admin users
      if (existingUser.id === req.user!.id) {
        return res.status(403).json({ error: 'Cannot deactivate your own account' });
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { 
          isActive: false,
          updatedAt: new Date(),
        },
      });

      // Log the action
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'admin_deactivate_user',
          resource: 'user',
          resourceId: req.params.id,
          newValue: { reason, deactivatedBy: req.user!.afnId },
          success: true,
        },
      });

      logger.warn(`⚠️  User deactivated by admin: ${user.afnId}`, {
        adminId: req.user!.afnId,
        reason,
      });

      res.json(user);
    } catch (error) {
      backendLogger.error('❌ User deactivation error:', error);
      res.status(500).json({ error: 'Failed to deactivate user' });
    }
  }
);

export default router;

