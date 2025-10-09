import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID Middleware
 * CRITICAL: Enables distributed tracing across microservices
 * Used for debugging and monitoring in production
 */

export interface RequestWithId extends Request {
  id?: string;
}

export const requestId = (req: RequestWithId, res: Response, next: NextFunction) => {
  // Use existing request ID from header (for distributed tracing)
  // or generate a new one
  const existingId = req.headers['x-request-id'] as string;
  req.id = existingId || uuidv4();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Add request ID to all logs
  (req as any).requestId = req.id;

  next();
};

