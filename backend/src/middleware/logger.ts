import { NextFunction, Response } from 'express';
import { logger, logRequest } from '../utils/logger';
import { AuthRequest } from './auth';

/**
 * Enhanced Request Logger Middleware
 * CRITICAL: Comprehensive request logging for debugging and security
 */

export const requestLogger = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  const { method, path, ip, headers } = req;

  // Log request start
  logger.http(`→ ${method} ${path} from ${ip}`);

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const userId = req.user?.id;

    // Log request completion
    logRequest(method, path, statusCode, duration, userId);

    // CRITICAL: Log slow requests (>1000ms)
    if (duration > 1000) {
      logger.warn(`⚠️  SLOW REQUEST: ${method} ${path} took ${duration}ms`, {
        userId,
        statusCode,
      });
    }

    // CRITICAL: Log failed requests
    if (statusCode >= 400) {
      logger.warn(`❌ FAILED REQUEST: ${method} ${path} ${statusCode}`, {
        userId,
        ip,
        userAgent: headers['user-agent'],
        duration,
      });
    }
  });

  next();
};

/**
 * Log API errors with full context
 * CRITICAL: Detailed error logging for debugging
 */
export const logApiError = (
  error: Error,
  req: AuthRequest,
  context?: string
) => {
  logger.error(`API Error${context ? ` [${context}]` : ''}: ${error.message}`, {
    error: error.name,
    stack: error.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    afnId: req.user?.afnId,
    body: req.body,
    query: req.query,
    params: req.params,
  });
};