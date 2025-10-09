import path from 'path';
import winston from 'winston';

/**
 * Professional Logging System
 * CRITICAL: Comprehensive logging for production debugging and security auditing
 */

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console(),
  
  // Error log file - CRITICAL: All errors logged
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Critical events - CRITICAL: SOS, payments, security events
  new winston.transports.File({
    filename: path.join('logs', 'critical.log'),
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 10,
  }),
];

// Create logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
});

/**
 * Log critical events - CRITICAL: Security and life-safety events
 */
export const logCritical = (event: string, details: any) => {
  logger.error(`🚨 CRITICAL: ${event}`, { ...details, timestamp: new Date().toISOString() });
};

/**
 * Log security events - CRITICAL: Authentication, authorization failures
 */
export const logSecurity = (event: string, details: any) => {
  logger.warn(`🔒 SECURITY: ${event}`, { ...details, timestamp: new Date().toISOString() });
};

/**
 * Log SOS events - CRITICAL: Emergency alerts
 */
export const logSOS = (event: string, details: any) => {
  logger.error(`🆘 SOS: ${event}`, { ...details, timestamp: new Date().toISOString() });
};

/**
 * Log payment events - CRITICAL: Financial transactions
 */
export const logPayment = (event: string, details: any) => {
  logger.info(`💳 PAYMENT: ${event}`, { ...details, timestamp: new Date().toISOString() });
};

/**
 * Log API requests - CRITICAL: Request tracking
 */
export const logRequest = (method: string, path: string, statusCode: number, duration: number, userId?: string) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';
  logger.log(level, `${method} ${path} ${statusCode} ${duration}ms ${userId || 'anonymous'}`);
};

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

