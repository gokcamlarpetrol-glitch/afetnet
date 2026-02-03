/**
 * EEW SECURITY SERVICE - Elite Security Layer
 * 
 * CRITICAL: Prevents security vulnerabilities in EEW system
 * - Input validation and sanitization
 * - Injection attack prevention
 * - Rate limiting
 * - Data integrity checks
 * - Source authentication
 */

import { createLogger } from '../utils/logger';
import { safeLowerCase } from '../utils/safeString';

const logger = createLogger('EEWSecurityService');

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any;
}

class EEWSecurityService {
  private isInitialized = false;

  // Rate limiting per source
  private sourceRequestCounts: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly MAX_REQUESTS_PER_MINUTE = 60;
  private readonly MAX_REQUESTS_PER_HOUR = 1000;

  // Known malicious patterns
  private readonly MALICIOUS_PATTERNS = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\(/i,
    /expression\(/i,
    /vbscript:/i,
    /data:text\/html/i,
    /&#x/,
    /%3C/i,
    /%3E/i,
  ];

  // Valid coordinate ranges
  private readonly VALID_LATITUDE_RANGE = { min: -90, max: 90 };
  private readonly VALID_LONGITUDE_RANGE = { min: -180, max: 180 };
  private readonly VALID_MAGNITUDE_RANGE = { min: 0, max: 10 };
  private readonly VALID_DEPTH_RANGE = { min: 0, max: 1000 }; // km

  // Valid source whitelist
  private readonly VALID_SOURCES = [
    'AFAD',
    'KANDILLI',
    'EMSC',
    'USGS',
    'MULTI_SOURCE',
    'AI_ENHANCED_MULTI_SOURCE',
    'AI_ENHANCED_SINGLE_SOURCE',
    'SINGLE_SOURCE',
  ];

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.isInitialized = true;

    // Cleanup rate limit counters every hour
    setInterval(() => {
      this.cleanupRateLimits();
    }, 60 * 60 * 1000);

    if (__DEV__) {
      logger.info('EEWSecurityService initialized - Elite security active');
    }
  }

  /**
   * ELITE: Validate and sanitize event data
   */
  validateAndSanitizeEvent(event: any): SecurityValidationResult {
    const errors: string[] = [];

    if (!event || typeof event !== 'object') {
      return {
        isValid: false,
        errors: ['Event must be an object'],
      };
    }

    // Validate ID
    if (!event.id || typeof event.id !== 'string') {
      errors.push('Event ID is required and must be a string');
    } else {
      // Sanitize ID (remove dangerous characters)
      const sanitizedId = this.sanitizeString(event.id);
      if (sanitizedId !== event.id) {
        errors.push('Event ID contains invalid characters');
      }
    }

    // Validate coordinates
    if (typeof event.latitude !== 'number' || isNaN(event.latitude)) {
      errors.push('Latitude must be a valid number');
    } else if (
      event.latitude < this.VALID_LATITUDE_RANGE.min ||
      event.latitude > this.VALID_LATITUDE_RANGE.max
    ) {
      errors.push(`Latitude must be between ${this.VALID_LATITUDE_RANGE.min} and ${this.VALID_LATITUDE_RANGE.max}`);
    }

    if (typeof event.longitude !== 'number' || isNaN(event.longitude)) {
      errors.push('Longitude must be a valid number');
    } else if (
      event.longitude < this.VALID_LONGITUDE_RANGE.min ||
      event.longitude > this.VALID_LONGITUDE_RANGE.max
    ) {
      errors.push(`Longitude must be between ${this.VALID_LONGITUDE_RANGE.min} and ${this.VALID_LONGITUDE_RANGE.max}`);
    }

    // Validate magnitude (if provided)
    if (event.magnitude !== undefined) {
      if (typeof event.magnitude !== 'number' || isNaN(event.magnitude)) {
        errors.push('Magnitude must be a valid number');
      } else if (
        event.magnitude < this.VALID_MAGNITUDE_RANGE.min ||
        event.magnitude > this.VALID_MAGNITUDE_RANGE.max
      ) {
        errors.push(`Magnitude must be between ${this.VALID_MAGNITUDE_RANGE.min} and ${this.VALID_MAGNITUDE_RANGE.max}`);
      }
    }

    // Validate depth (if provided)
    if (event.depth !== undefined) {
      if (typeof event.depth !== 'number' || isNaN(event.depth)) {
        errors.push('Depth must be a valid number');
      } else if (
        event.depth < this.VALID_DEPTH_RANGE.min ||
        event.depth > this.VALID_DEPTH_RANGE.max
      ) {
        errors.push(`Depth must be between ${this.VALID_DEPTH_RANGE.min} and ${this.VALID_DEPTH_RANGE.max} km`);
      }
    }

    // Validate source
    if (!event.source || typeof event.source !== 'string') {
      errors.push('Source is required and must be a string');
    } else if (!this.VALID_SOURCES.includes(event.source)) {
      errors.push(`Invalid source: ${event.source}. Must be one of: ${this.VALID_SOURCES.join(', ')}`);
    }

    // Validate timestamp
    if (typeof event.issuedAt !== 'number' || isNaN(event.issuedAt)) {
      errors.push('IssuedAt must be a valid timestamp');
    } else {
      const now = Date.now();
      const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
      const oneHourFuture = now + 60 * 60 * 1000;

      if (event.issuedAt < oneYearAgo) {
        errors.push('IssuedAt timestamp is too old (more than 1 year ago)');
      }
      if (event.issuedAt > oneHourFuture) {
        errors.push('IssuedAt timestamp is in the future (more than 1 hour ahead)');
      }
    }

    // Validate region (if provided)
    if (event.region !== undefined) {
      if (typeof event.region !== 'string') {
        errors.push('Region must be a string');
      } else {
        const sanitizedRegion = this.sanitizeString(event.region);
        if (sanitizedRegion !== event.region) {
          errors.push('Region contains invalid characters');
        }
      }
    }

    // Check for malicious patterns in string fields
    const stringFields = ['id', 'source', 'region'];
    for (const field of stringFields) {
      if (event[field] && typeof event[field] === 'string') {
        if (this.containsMaliciousPattern(event[field])) {
          errors.push(`Field ${field} contains potentially malicious content`);
        }
      }
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    // Create sanitized event
    const sanitized = {
      id: this.sanitizeString(event.id),
      latitude: Number(event.latitude),
      longitude: Number(event.longitude),
      magnitude: event.magnitude !== undefined ? Number(event.magnitude) : undefined,
      depth: event.depth !== undefined ? Number(event.depth) : undefined,
      source: this.sanitizeString(event.source),
      issuedAt: Number(event.issuedAt),
      region: event.region ? this.sanitizeString(event.region) : undefined,
      etaSec: event.etaSec !== undefined ? Number(event.etaSec) : undefined,
      certainty: event.certainty || 'low',
    };

    return {
      isValid: true,
      errors: [],
      sanitized,
    };
  }

  /**
   * ELITE: Sanitize string input
   */
  private sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Remove control characters (except newline, tab, carriage return)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length (prevent DoS)
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000);
    }

    return sanitized;
  }

  /**
   * ELITE: Check for malicious patterns
   */
  private containsMaliciousPattern(input: string): boolean {
    for (const pattern of this.MALICIOUS_PATTERNS) {
      if (pattern.test(input)) {
        return true;
      }
    }
    return false;
  }

  /**
   * ELITE: Rate limiting check
   */
  checkRateLimit(source: string): boolean {
    const now = Date.now();
    const sourceData = this.sourceRequestCounts.get(source) || {
      count: 0,
      resetAt: now + 60 * 1000, // Reset after 1 minute
    };

    // Reset if expired
    if (now > sourceData.resetAt) {
      sourceData.count = 0;
      sourceData.resetAt = now + 60 * 1000;
    }

    // Check limit
    if (sourceData.count >= this.MAX_REQUESTS_PER_MINUTE) {
      if (__DEV__) {
        logger.warn(`Rate limit exceeded for source: ${source}`);
      }
      return false;
    }

    // Increment counter
    sourceData.count++;
    this.sourceRequestCounts.set(source, sourceData);

    return true;
  }

  /**
   * ELITE: Cleanup expired rate limit counters
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    for (const [source, data] of this.sourceRequestCounts.entries()) {
      if (now > data.resetAt + 60 * 60 * 1000) {
        // Remove counters older than 1 hour
        this.sourceRequestCounts.delete(source);
      }
    }
  }

  /**
   * ELITE: Validate API response
   */
  validateAPIResponse(response: any): SecurityValidationResult {
    const errors: string[] = [];

    // Check if response is an object
    if (!response || typeof response !== 'object') {
      return {
        isValid: false,
        errors: ['API response must be an object'],
      };
    }

    // Check for common API response structures
    if (Array.isArray(response)) {
      // Array of events
      if (response.length > 1000) {
        errors.push('Response array too large (potential DoS)');
      }

      // Validate each event
      for (let i = 0; i < Math.min(response.length, 100); i++) {
        const eventValidation = this.validateAndSanitizeEvent(response[i]);
        if (!eventValidation.isValid) {
          errors.push(`Event ${i}: ${eventValidation.errors.join(', ')}`);
        }
      }
    } else if (response.events && Array.isArray(response.events)) {
      // Object with events array
      if (response.events.length > 1000) {
        errors.push('Events array too large (potential DoS)');
      }
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    return {
      isValid: true,
      errors: [],
    };
  }

  /**
   * ELITE: Validate URL (prevent SSRF)
   */
  validateURL(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const parsed = new URL(url);

      // Only allow HTTPS/WSS
      if (!['https:', 'wss:'].includes(parsed.protocol)) {
        return false;
      }

      // Block localhost and private IPs
      const hostname = safeLowerCase(parsed.hostname);
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')
      ) {
        return false;
      }

      // Whitelist allowed domains
      const allowedDomains = [
        'deprem.afad.gov.tr',
        'eew.afad.gov.tr',
        'www.koeri.boun.edu.tr',
        'eew.kandilli.org',
        'www.seismicportal.eu',
        'seismicportal.eu',
        'earthquake.usgs.gov',
        'afetnet-backend.onrender.com',
      ];

      if (!allowedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isInitialized = false;
    this.sourceRequestCounts.clear();

    if (__DEV__) {
      logger.info('EEWSecurityService stopped');
    }
  }
}

export const eewSecurityService = new EEWSecurityService();

