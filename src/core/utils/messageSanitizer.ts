/**
 * MESSAGE SANITIZER - ELITE EDITION
 * Content sanitization for safe message rendering
 * 
 * Features:
 * - Unicode normalization
 * - Control character removal
 * - Invisible character detection
 * - HTML entity escaping (for web views)
 * - Length limiting
 * - Link detection & validation
 */

// ELITE: Unicode control characters to remove
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g;

// ELITE: Zero-width characters that can be used for tracking
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\u2060\uFEFF]/g;

// ELITE: Dangerous or confusing unicode
const DANGEROUS_UNICODE = /[\u202A-\u202E\u2066-\u2069]/g; // Bidirectional override chars

// ELITE: Max message length
const MAX_MESSAGE_LENGTH = 10000;
const MAX_DISPLAY_LENGTH = 5000;

/**
 * Sanitize message content for safe display
 */
export function sanitizeMessage(content: string): string {
    if (!content) return '';

    let sanitized = content;

    // 1. Normalize unicode (NFC form)
    try {
        sanitized = sanitized.normalize('NFC');
    } catch {
        // Fallback if normalization fails
    }

    // 2. Remove control characters
    sanitized = sanitized.replace(CONTROL_CHARS, '');

    // 3. Remove zero-width characters (can be used for tracking)
    sanitized = sanitized.replace(ZERO_WIDTH_CHARS, '');

    // 4. Remove bidirectional override characters (text direction exploits)
    sanitized = sanitized.replace(DANGEROUS_UNICODE, '');

    // 5. Trim excessive whitespace
    sanitized = sanitized.replace(/\s{10,}/g, '          '); // Max 10 consecutive spaces
    sanitized = sanitized.replace(/\n{5,}/g, '\n\n\n\n'); // Max 4 consecutive newlines

    // 6. Limit length
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
        sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
    }

    // 7. Trim
    sanitized = sanitized.trim();

    return sanitized;
}

/**
 * Sanitize for display (more restrictive)
 */
export function sanitizeForDisplay(content: string): string {
    let sanitized = sanitizeMessage(content);

    // Additional display-specific limits
    if (sanitized.length > MAX_DISPLAY_LENGTH) {
        sanitized = sanitized.substring(0, MAX_DISPLAY_LENGTH) + '…';
    }

    return sanitized;
}

/**
 * Escape HTML entities (for web views)
 */
export function escapeHtml(content: string): string {
    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };

    return content.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Detect and validate URLs in message
 */
export function extractUrls(content: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>[\]{}|\\^`"']+/gi;
    const matches = content.match(urlRegex) || [];

    // Validate each URL
    return matches.filter(url => {
        try {
            const parsed = new URL(url);
            // Allow only http/https
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    });
}

/**
 * Check if content contains suspicious patterns
 */
export function containsSuspiciousContent(content: string): {
    suspicious: boolean;
    reasons: string[];
} {
    const reasons: string[] = [];

    // Check for excessive unicode escapes
    const unicodeEscapes = (content.match(/\\u[0-9a-fA-F]{4}/g) || []).length;
    if (unicodeEscapes > 10) {
        reasons.push('Excessive unicode escapes');
    }

    // Check for homograph attacks (mixed scripts)
    const hasCyrillic = /[\u0400-\u04FF]/.test(content);
    const hasLatin = /[a-zA-Z]/.test(content);
    if (hasCyrillic && hasLatin) {
        reasons.push('Mixed Cyrillic and Latin characters');
    }

    // Check for invisible characters
    const invisibleCount = (content.match(/[\u200B-\u200D\uFEFF\u2060]/g) || []).length;
    if (invisibleCount > 5) {
        reasons.push('Excessive invisible characters');
    }

    // Check for suspicious patterns (base64-like long strings)
    const longBase64 = /[A-Za-z0-9+/=]{100,}/g.test(content);
    if (longBase64) {
        reasons.push('Suspicious long encoded string');
    }

    return {
        suspicious: reasons.length > 0,
        reasons,
    };
}

/**
 * Truncate message for preview
 */
export function truncateForPreview(content: string, maxLength = 100): string {
    const sanitized = sanitizeMessage(content);

    // Replace newlines with spaces for preview
    const singleLine = sanitized.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    if (singleLine.length <= maxLength) {
        return singleLine;
    }

    // Find word boundary
    const truncated = singleLine.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
        return truncated.substring(0, lastSpace) + '…';
    }

    return truncated + '…';
}

/**
 * Validate message before sending
 */
export function validateMessage(content: string): {
    valid: boolean;
    error?: string;
    sanitized: string;
} {
    // Empty check
    if (!content || !content.trim()) {
        return { valid: false, error: 'Mesaj boş olamaz', sanitized: '' };
    }

    // Length check
    if (content.length > MAX_MESSAGE_LENGTH) {
        return {
            valid: false,
            error: `Mesaj çok uzun (max ${MAX_MESSAGE_LENGTH} karakter)`,
            sanitized: content.substring(0, MAX_MESSAGE_LENGTH),
        };
    }

    // Sanitize
    const sanitized = sanitizeMessage(content);

    // Check if sanitization removed everything
    if (!sanitized) {
        return { valid: false, error: 'Mesaj geçersiz karakterler içeriyor', sanitized: '' };
    }

    // Check for suspicious content
    const suspicious = containsSuspiciousContent(sanitized);
    if (suspicious.suspicious) {
        // Still valid, but log for monitoring
        console.warn('Suspicious message content:', suspicious.reasons);
    }

    return { valid: true, sanitized };
}

export default {
    sanitizeMessage,
    sanitizeForDisplay,
    escapeHtml,
    extractUrls,
    containsSuspiciousContent,
    truncateForPreview,
    validateMessage,
};
