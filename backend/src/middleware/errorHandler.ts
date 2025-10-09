import { NextFunction, Request, Response } from 'express';
import { logCritical, logger, logSecurity } from '../utils/logger';
import { AuthRequest } from './auth';

/**
 * Comprehensive Error Handler
 * CRITICAL: Handles all errors gracefully and logs them properly
 */

export const errorHandler = (
  error: any,
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Log error with full context
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    afnId: req.user?.afnId,
    body: req.body,
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';

  // Handle specific error types
  
  // Prisma errors - CRITICAL: Database errors
  if (error.name === 'PrismaClientKnownRequestError') {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        message = 'Resource already exists';
        errorCode = 'DUPLICATE_RESOURCE';
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        message = 'Resource not found';
        errorCode = 'NOT_FOUND';
        break;
      case 'P2003': // Foreign key constraint failed
        statusCode = 400;
        message = 'Invalid reference';
        errorCode = 'INVALID_REFERENCE';
        break;
      case 'P2014': // Relation violation
        statusCode = 400;
        message = 'Cannot delete resource with dependencies';
        errorCode = 'RELATION_VIOLATION';
        break;
      default:
        statusCode = 500;
        message = 'Database error';
        errorCode = 'DATABASE_ERROR';
    }
  }

  // Prisma validation errors
  if (error.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid data format';
    errorCode = 'VALIDATION_ERROR';
  }

  // JWT errors - CRITICAL: Authentication errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
    errorCode = 'VALIDATION_ERROR';
  }

  // Stripe errors - CRITICAL: Payment errors
  if (error.type && error.type.startsWith('Stripe')) {
    statusCode = 400;
    message = error.message;
    errorCode = 'PAYMENT_ERROR';
    
    logCritical('Stripe error', {
      type: error.type,
      message: error.message,
      userId: req.user?.id,
    });
  }

  // Rate limit errors
  if (error.name === 'TooManyRequestsError') {
    statusCode = 429;
    message = 'Too many requests, please try again later';
    errorCode = 'RATE_LIMIT_EXCEEDED';
    
    logSecurity('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: req.user?.id,
    });
  }

  // CRITICAL: Log 5xx errors
  if (statusCode >= 500) {
    logCritical('Server error', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      statusCode,
    });
  }

  // Send error response
  const errorResponse: any = {
    error: errorCode,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper - CRITICAL: Catches async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not Found Handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  });
};