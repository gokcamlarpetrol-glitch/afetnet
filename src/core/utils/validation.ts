/**
 * VALIDATION & SANITIZATION UTILITIES
 * Input validation and sanitization for security
 */

/**
 * Sanitize string input - remove dangerous characters
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters
  let sanitized = input
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate latitude (-90 to 90)
 */
export function validateLatitude(lat: number): boolean {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude (-180 to 180)
 */
export function validateLongitude(lng: number): boolean {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
}

/**
 * Validate coordinates
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return validateLatitude(lat) && validateLongitude(lng);
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0 && Number.isInteger(value);
}

/**
 * Validate priority level
 */
export function validatePriority(priority: string): priority is 'low' | 'med' | 'high' {
  return priority === 'low' || priority === 'med' || priority === 'high';
}

/**
 * Validate message content
 */
export function validateMessageContent(content: string): boolean {
  if (typeof content !== 'string') return false;
  const sanitized = sanitizeString(content, 5000);
  return sanitized.length > 0 && sanitized.length <= 5000;
}

/**
 * Validate SOS data
 */
export interface SOSDataValidation {
  note?: string;
  people?: number;
  priority?: 'low' | 'med' | 'high';
  latitude?: number;
  longitude?: number;
}

export function validateSOSData(data: any): data is SOSDataValidation {
  if (!data || typeof data !== 'object') return false;

  // Validate note (optional)
  if (data.note !== undefined && typeof data.note !== 'string') return false;
  if (data.note && sanitizeString(data.note, 500).length === 0) return false;

  // Validate people (optional, must be positive integer)
  if (data.people !== undefined && !validatePositiveInteger(data.people)) return false;
  if (data.people !== undefined && data.people > 1000) return false; // Reasonable limit

  // Validate priority (optional)
  if (data.priority !== undefined && !validatePriority(data.priority)) return false;

  // Validate coordinates (optional, but if provided must be valid)
  if (data.latitude !== undefined && !validateLatitude(data.latitude)) return false;
  if (data.longitude !== undefined && !validateLongitude(data.longitude)) return false;
  if ((data.latitude !== undefined || data.longitude !== undefined) && 
      !validateCoordinates(data.latitude || 0, data.longitude || 0)) {
    return false;
  }

  return true;
}

/**
 * Sanitize SOS data
 */
export function sanitizeSOSData(data: any): SOSDataValidation | null {
  if (!validateSOSData(data)) return null;

  return {
    note: data.note ? sanitizeString(data.note, 500) : undefined,
    people: data.people !== undefined ? Math.max(1, Math.min(1000, Math.floor(data.people))) : undefined,
    priority: data.priority && validatePriority(data.priority) ? data.priority : undefined,
    latitude: data.latitude !== undefined ? Math.max(-90, Math.min(90, data.latitude)) : undefined,
    longitude: data.longitude !== undefined ? Math.max(-180, Math.min(180, data.longitude)) : undefined,
  };
}

/**
 * Validate device ID format
 */
export function validateDeviceId(deviceId: string): boolean {
  if (typeof deviceId !== 'string') return false;
  // Format: AFN-XXXXXXXX (8 hex chars)
  return /^AFN-[0-9A-Fa-f]{8}$/.test(deviceId);
}

/**
 * Sanitize device ID
 */
export function sanitizeDeviceId(deviceId: string): string {
  if (typeof deviceId !== 'string') return '';
  // Remove all non-alphanumeric and dash characters
  return deviceId.replace(/[^A-Za-z0-9-]/g, '').substring(0, 20);
}


