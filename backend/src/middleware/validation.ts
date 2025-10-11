/**
 * Enterprise-Grade Input Validation Middleware
 * 
 * Features:
 * - SQL Injection prevention
 * - XSS attack prevention
 * - Rate limiting per endpoint
 * - Request size limits
 * - Type validation
 * - Sanitization
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Validate request and sanitize inputs
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors for client
    const formattedErrors = errors.array().map(err => ({
      field: 'param' in err ? err.param : 'unknown',
      message: err.msg,
      value: 'value' in err ? err.value : undefined
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
  };
};

/**
 * SQL Injection prevention
 * Validates that input doesn't contain SQL keywords or patterns
 */
export function preventSQLInjection(value: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(;|\-\-|\/\*|\*\/|xp_|sp_)/gi,
    /('|('')|;|<|>|&|\|)/gi
  ];

  return !sqlPatterns.some(pattern => pattern.test(value));
}

/**
 * XSS prevention
 * Sanitizes HTML and script tags
 */
export function sanitizeHTML(input: string): string {
  if (!input) return input;
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize user input
 * Trims whitespace and removes potentially dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .slice(0, 5000); // Max length to prevent DOS
}

/**
 * Validate AFN-ID format
 */
export function isValidAfnId(afnId: string): boolean {
  const pattern = /^AFN-[0-9A-Z]{8}$/;
  return pattern.test(afnId);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate phone number (international format)
 */
export function isValidPhone(phone: string): boolean {
  const pattern = /^\+?[1-9]\d{1,14}$/;
  return pattern.test(phone);
}

/**
 * Validate coordinates
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

/**
 * Rate limiting configuration per endpoint
 */
export const rateLimits = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many authentication attempts, please try again later'
  },
  sos: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 SOS per minute max
    message: 'Too many SOS requests'
  },
  mesh: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 mesh messages per minute
    message: 'Too many mesh relay requests'
  },
  message: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // 50 messages per minute
    message: 'Too many messages sent'
  },
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: 'Too many API requests'
  }
};

/**
 * Validate JSON payload size
 */
export function validatePayloadSize(maxSizeKB: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = maxSizeKB * 1024;
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: 'Payload too large',
        maxSize: `${maxSizeKB}KB`,
        received: `${Math.round(contentLength / 1024)}KB`
      });
    }
    
    next();
  };
}

/**
 * Validate required fields
 */
export function validateRequiredFields(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingFields = fields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        fields: missingFields
      });
    }
    
    next();
  };
}

/**
 * Advanced validation utilities
 */
export const validators = {
  /**
   * Validate latitude
   */
  isLatitude: (value: number) => {
    return typeof value === 'number' && value >= -90 && value <= 90;
  },

  /**
   * Validate longitude
   */
  isLongitude: (value: number) => {
    return typeof value === 'number' && value >= -180 && value <= 180;
  },

  /**
   * Validate UUID format
   */
  isUUID: (value: string) => {
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return pattern.test(value);
  },

  /**
   * Validate date string
   */
  isDateString: (value: string) => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  /**
   * Validate positive integer
   */
  isPositiveInteger: (value: number) => {
    return Number.isInteger(value) && value > 0;
  }
};

export default {
  validate,
  preventSQLInjection,
  sanitizeHTML,
  sanitizeInput,
  isValidAfnId,
  isValidEmail,
  isValidPhone,
  isValidCoordinate,
  rateLimits,
  validatePayloadSize,
  validateRequiredFields,
  validators
};
