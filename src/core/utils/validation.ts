/**
 * VALIDATION UTILITIES - ELITE INPUT VALIDATION
 * Centralized validation functions for type safety and security
 */

/**
 * Validate that a value is a non-empty string
 */
export function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Validate that a value is a valid integer
 */
export function isValidInteger(value: unknown): value is number {
  return isValidNumber(value) && Number.isInteger(value);
}

/**
 * Validate that a value is a valid positive number
 */
export function isValidPositiveNumber(value: unknown): value is number {
  return isValidNumber(value) && value > 0;
}

/**
 * Validate that a value is a valid latitude (-90 to 90)
 */
export function isValidLatitude(value: unknown): value is number {
  return isValidNumber(value) && value >= -90 && value <= 90;
}

/**
 * Validate that a value is a valid longitude (-180 to 180)
 */
export function isValidLongitude(value: unknown): value is number {
  return isValidNumber(value) && value >= -180 && value <= 180;
}

/**
 * Validate that a value is a valid timestamp (positive number)
 */
export function isValidTimestamp(value: unknown): value is number {
  return isValidPositiveNumber(value) && value <= Date.now() + 86400000; // Max 1 day in future
}

/**
 * Validate that a value is a valid email format
 */
export function isValidEmail(value: unknown): value is string {
  if (!isValidString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate that a value is a valid phone number format
 */
export function isValidPhoneNumber(value: unknown): value is string {
  if (!isValidString(value)) return false;
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(value.replace(/[\s-()]/g, ''));
}

/**
 * Validate that a value is a valid object (not null, not array)
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate that a value is a valid array
 */
export function isValidArray<T>(value: unknown, validator?: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false;
  if (validator) {
    return value.every(item => validator(item));
  }
  return true;
}

/**
 * Validate HTTP request body structure
 */
export function validateRequestBody(body: unknown): body is Record<string, unknown> {
  return isValidObject(body);
}

/**
 * Validate device ID format
 */
export function isValidDeviceId(value: unknown): value is string {
  if (!isValidString(value)) return false;
  // Device ID should be alphanumeric and reasonable length
  return /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

/**
 * Validate user ID format
 */
export function isValidUserId(value: unknown): value is string {
  return isValidDeviceId(value); // Same format as device ID
}

/**
 * Sanitize string input (remove dangerous characters)
 * @param input - String to sanitize
 * @param maxLength - Optional maximum length (default: no limit)
 */
export function sanitizeString(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    return '';
  }
  // Remove null bytes, control characters, and trim
  let sanitized = input
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
  
  // Apply max length if provided
  if (maxLength !== undefined && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize device ID (alphanumeric, underscore, hyphen only)
 * @param input - Device ID to sanitize
 * @param maxLength - Optional maximum length (default: 100)
 */
export function sanitizeDeviceId(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    return '';
  }
  const limit = maxLength ?? 100;
  // Only allow alphanumeric, underscore, hyphen
  return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, limit);
}

/**
 * Validate message content
 */
export function validateMessageContent(content: unknown): content is string {
  if (!isValidString(content)) {
    return false;
  }
  // Message should be reasonable length
  return content.length <= 10000; // Max 10KB
}
