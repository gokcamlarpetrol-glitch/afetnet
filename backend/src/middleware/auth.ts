import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { logSecurity } from '../utils/logger';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    afnId: string;
    isPremium: boolean;
    isActive: boolean;
  };
  params: any;
  route: any;
  path: string;
  method: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logSecurity('Authentication failed - No token', {
        path: req.path,
        ip: req.ip,
      });
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      afnId: string;
      isPremium: boolean;
    };

    // CRITICAL: Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        afnId: true,
        isPremium: true,
        isActive: true,
        lockedUntil: true,
        premiumExpiry: true,
      },
    });

    if (!user) {
      logSecurity('Authentication failed - User not found', {
        userId: decoded.id,
        afnId: decoded.afnId,
      });
      return res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'User account not found',
      });
    }

    // CRITICAL: Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logSecurity('Authentication failed - Account locked', {
        userId: user.id,
        afnId: user.afnId,
        lockedUntil: user.lockedUntil,
      });
      return res.status(403).json({
        error: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to failed login attempts',
        lockedUntil: user.lockedUntil,
      });
    }

    // CRITICAL: Check if account is active
    if (!user.isActive) {
      logSecurity('Authentication failed - Account inactive', {
        userId: user.id,
        afnId: user.afnId,
      });
      return res.status(403).json({
        error: 'ACCOUNT_INACTIVE',
        message: 'Account is deactivated',
      });
    }

    // CRITICAL: Update premium status if expired
    if (user.isPremium && user.premiumExpiry && user.premiumExpiry < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: false },
      });
      user.isPremium = false;
    }

    req.user = {
      id: user.id,
      afnId: user.afnId,
      isPremium: user.isPremium,
      isActive: user.isActive,
    };

    next();
  } catch (error: any) {
    logSecurity('Authentication failed - Invalid token', {
      error: error.message,
      path: req.path,
      ip: req.ip,
    });
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Token verification failed',
    });
  }
};

export const requirePremium = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.isPremium) {
    logSecurity('Premium feature access denied', {
      userId: req.user?.id,
      afnId: req.user?.afnId,
      path: req.path,
    });
    return res.status(403).json({
      error: 'PREMIUM_REQUIRED',
      message: 'This feature requires a premium subscription',
      upgradeUrl: '/api/payments/plans',
    });
  }
  next();
};

/**
 * Check if user account is verified
 * CRITICAL: Some features require verified accounts
 */
export const requireVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isVerified: true },
    });

    if (!user?.isVerified) {
      return res.status(403).json({
        error: 'VERIFICATION_REQUIRED',
        message: 'Please verify your account to use this feature',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
