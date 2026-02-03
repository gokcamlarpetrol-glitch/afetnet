/**
 * INPUT SANITIZER
 * Kullanıcı girdilerini temizler ve güvenli hale getirir
 * XSS, SQL Injection, Command Injection saldırılarına karşı koruma
 */

import { safeLowerCase } from './safeString';
import { createLogger } from './logger';

const logger = createLogger('InputSanitizer');

/**
 * HTML karakterlerini escape eder (XSS koruması)
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * SQL injection karakterlerini temizler
 */
export function sanitizeSQL(input: string): string {
  if (!input) return '';

  // SQL özel karakterlerini escape et
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/sp_/gi, '');
}

/**
 * Telefon numarasını temizler (sadece rakamlar)
 */
export function sanitizePhone(input: string): string {
  if (!input) return '';
  return input.replace(/[^0-9+]/g, '');
}

/**
 * Email adresini validate eder ve temizler
 */
export function sanitizeEmail(input: string): string {
  if (!input) return '';

  // Küçük harfe çevir ve boşlukları temizle
  const cleaned = safeLowerCase(input).trim();

  // Basit email regex kontrolü
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

  if (!emailRegex.test(cleaned)) {
    throw new Error('Invalid email format');
  }

  return cleaned;
}

/**
 * URL'yi validate eder ve temizler
 */
export function sanitizeURL(input: string): string {
  if (!input) return '';

  try {
    const url = new URL(input);

    // Sadece http ve https protokollerine izin ver
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }

    return url.toString();
  } catch (error) {
    throw new Error('Invalid URL format');
  }
}

/**
 * Dosya adını temizler (path traversal koruması)
 */
export function sanitizeFilename(input: string): string {
  if (!input) return '';

  // Path traversal karakterlerini temizle
  return input
    .replace(/\.\./g, '')
    .replace(/\//g, '')
    .replace(/\\/g, '')
    .replace(/:/g, '')
    .replace(/\*/g, '')
    .replace(/\?/g, '')
    .replace(/"/g, '')
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/\|/g, '');
}

/**
 * Genel metin temizleme (alfanumerik + bazı özel karakterler)
 */
export function sanitizeText(input: string, allowedChars: string = ''): string {
  if (!input) return '';

  // Sadece alfanumerik, boşluk ve izin verilen karakterlere izin ver
  const regex = new RegExp(`[^a-zA-Z0-9\\s${allowedChars}]`, 'g');
  return input.replace(regex, '');
}

/**
 * Türkçe karakterleri koruyarak metin temizleme
 */
export function sanitizeTurkishText(input: string, allowedChars: string = ''): string {
  if (!input) return '';

  // Türkçe karakterler + alfanumerik + izin verilen karakterler
  const regex = new RegExp(`[^a-zA-Z0-9\\sğüşıöçĞÜŞİÖÇ${allowedChars}]`, 'g');
  return input.replace(regex, '');
}

/**
 * Koordinat değerini validate eder
 */
export function sanitizeCoordinate(input: number, type: 'lat' | 'lon'): number {
  if (typeof input !== 'number' || isNaN(input)) {
    throw new Error('Invalid coordinate: not a number');
  }

  if (type === 'lat') {
    if (input < -90 || input > 90) {
      throw new Error('Invalid latitude: must be between -90 and 90');
    }
  } else {
    if (input < -180 || input > 180) {
      throw new Error('Invalid longitude: must be between -180 and 180');
    }
  }

  return input;
}

/**
 * JSON string'i güvenli şekilde parse eder
 */
export function sanitizeJSON<T = any>(input: string): T | null {
  if (!input) return null;

  try {
    // JSON parse depth limit kontrolü
    const parsed = JSON.parse(input);

    // Çok derin nested objeler güvenlik riski
    const maxDepth = 10;
    const checkDepth = (obj: unknown, depth: number = 0): boolean => {
      if (depth > maxDepth) return false;
      if (typeof obj !== 'object' || obj === null) return true;

      for (const key in obj) {
        if (!checkDepth(obj[key], depth + 1)) return false;
      }
      return true;
    };

    if (!checkDepth(parsed)) {
      throw new Error('JSON depth exceeds maximum allowed');
    }

    return parsed as T;
  } catch (error) {
    logger.error('JSON sanitization error:', error);
    return null;
  }
}

/**
 * API key'i mask eder (loglama için)
 */
export function maskAPIKey(key: string): string {
  if (!key || key.length < 8) return '***';

  const start = key.substring(0, 4);
  const end = key.substring(key.length - 4);
  return `${start}...${end}`;
}

/**
 * Kredi kartı numarasını mask eder
 */
export function maskCreditCard(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) return '****';

  const last4 = cardNumber.slice(-4);
  return `**** **** **** ${last4}`;
}

/**
 * Kullanıcı adını temizler
 */
export function sanitizeUsername(input: string): string {
  if (!input) return '';

  // Sadece alfanumerik, alt çizgi ve tire
  const cleaned = safeLowerCase(input).trim();
  const regex = /[^a-z0-9_-]/g;
  const sanitized = cleaned.replace(regex, '');

  // Minimum 3, maksimum 30 karakter
  if (sanitized.length < 3 || sanitized.length > 30) {
    throw new Error('Username must be between 3 and 30 characters');
  }

  return sanitized;
}

/**
 * Şifre güvenlik kontrolü
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

