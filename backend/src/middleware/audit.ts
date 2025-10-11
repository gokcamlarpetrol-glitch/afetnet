import { backendLogger } from '../utils/productionLogger';
import { NextFunction, Request, Response } from 'express';
import { logSecurity } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { AuthRequest } from './auth';

/**
 * Audit Log Middleware
 * CRITICAL: Logs all sensitive operations for security and compliance
 */

export const auditLog = (action: string, resource?: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalSend = res.json.bind(res);
    const startTime = Date.now();

    // Capture response
    res.json = function (body: any) {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;

      // Log to database (non-blocking)
      prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action,
          resource,
          resourceId: req.params.id || null,
          ipAddress: (req as any).ip || (req as any).socket?.remoteAddress || null,
          userAgent: (req as any).headers?.['user-agent'] || null,
          success,
          errorMessage: success ? null : body?.error || null,
        },
      }).catch((err: Error) => {
        backendLogger.error('❌ Audit log failed:', err);
      });

      // Log security events
      if (!success) {
        logSecurity(`Failed ${action}`, {
          userId: req.user?.id,
          afnId: req.user?.afnId,
          resource,
          statusCode: res.statusCode,
          duration,
        });
      }

      return originalSend(body);
    };

    next();
  };
};

/**
 * Log critical operations - CRITICAL: SOS, payments, account changes
 */
export const auditCritical = auditLog;

/**
 * Log authentication attempts
 */
export const auditAuth = (action: 'login' | 'register' | 'logout') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.json.bind(res);

    res.json = function (body: any) {
      const success = res.statusCode < 400;

      // Log authentication attempt
      prisma.auditLog.create({
        data: {
          userId: body?.user?.id || null,
          action: `auth_${action}`,
          resource: 'user',
          ipAddress: (req as any).ip || (req as any).socket?.remoteAddress || null,
          userAgent: (req as any).headers?.['user-agent'] || null,
          success,
          errorMessage: success ? null : body?.error || null,
        },
      }).catch((err: Error) => {
        backendLogger.error('❌ Auth audit log failed:', err);
      });

      // Log failed attempts
      if (!success) {
        logSecurity(`Failed ${action} attempt`, {
          email: req.body?.email,
          phone: req.body?.phone,
          afnId: req.body?.afnId,
          ip: (req as any).ip,
        });

        // CRITICAL: Track failed login attempts
        if (action === 'login' && req.body?.email) {
          prisma.user.findUnique({
            where: { email: req.body.email },
          }).then((user: any) => {
            if (user) {
              const attempts = user.failedLoginAttempts + 1;
              const updates: any = { failedLoginAttempts: attempts };

              // CRITICAL: Lock account after 5 failed attempts
              if (attempts >= 5) {
                updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
                logSecurity('Account locked due to failed attempts', {
                  userId: user.id,
                  afnId: user.afnId,
                  attempts,
                });
              }

              prisma.user.update({
                where: { id: user.id },
                data: updates,
              }).catch(console.error);
            }
          }).catch(console.error);
        }
      } else if (action === 'login' && body?.user?.id) {
        // Reset failed attempts on successful login
        prisma.user.update({
          where: { id: body.user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        }).catch(console.error);
      }

      return originalSend(body);
    };

    next();
  };
};
