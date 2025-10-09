import CryptoJS from 'crypto-js';

/**
 * Data Encryption Utilities
 * CRITICAL: Encrypts sensitive data at rest (GDPR, HIPAA compliance)
 * Used for: medical info, messages, location history
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this-in-production';

/**
 * Encrypt sensitive data
 * CRITICAL: Use for PII, medical data, messages
 */
export function encrypt(data: string): string {
  if (!data) return data;

  try {
    const encrypted = CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return encryptedData;

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Hash sensitive data (one-way)
 * CRITICAL: Use for data that needs to be compared but not decrypted
 */
export function hash(data: string): string {
  return CryptoJS.SHA256(data).toString();
}

/**
 * Encrypt object fields
 * CRITICAL: Encrypts specific fields in an object
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const encrypted = { ...obj };

  for (const field of fields) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encrypt(encrypted[field] as string) as any;
    }
  }

  return encrypted;
}

/**
 * Decrypt object fields
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const decrypted = { ...obj };

  for (const field of fields) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      try {
        decrypted[field] = decrypt(decrypted[field] as string) as any;
      } catch (error) {
        // If decryption fails, keep original value (might not be encrypted)
        console.warn(`⚠️  Failed to decrypt field: ${String(field)}`);
      }
    }
  }

  return decrypted;
}

/**
 * Mask sensitive data for logging
 * CRITICAL: Never log sensitive data in plain text
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars) return '***';

  const visible = data.substring(0, visibleChars);
  const masked = '*'.repeat(Math.min(data.length - visibleChars, 10));

  return visible + masked;
}

/**
 * Mask email for logging
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';

  const [local, domain] = email.split('@');
  const maskedLocal = maskSensitiveData(local, 2);
  const maskedDomain = domain.split('.').map((part, i, arr) => 
    i === arr.length - 1 ? part : maskSensitiveData(part, 1)
  ).join('.');

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask phone for logging
 */
export function maskPhone(phone: string): string {
  if (!phone) return '***';

  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return '***';

  const last4 = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 4);

  return masked + last4;
}

