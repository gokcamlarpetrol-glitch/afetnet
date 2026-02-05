/**
 * NEWS DETAIL UTILITIES
 * Helper functions for NewsDetailScreen
 * Extracted for clean code architecture and reusability
 */

import { createLogger } from '../../../utils/logger';

const logger = createLogger('NewsDetailUtils');

// CONSTANTS
export const MAX_INPUT_LENGTH = 10 * 1024 * 1024; // 10MB max input
export const MAX_SUMMARY_LENGTH = 2000; // Max chars for AI summary display

/**
 * Sanitize HTML content for safe display
 * Removes scripts, styles, and dangerous elements
 */
export const sanitizeArticleHtml = (html: string): string => {
    // CRITICAL: Validate input
    if (!html || typeof html !== 'string') {
        return '';
    }

    // CRITICAL: Limit HTML length to prevent DoS
    if (html.length > MAX_INPUT_LENGTH) {
        logger.warn('HTML input too large, truncating:', html.length, 'bytes');
        html = html.substring(0, MAX_INPUT_LENGTH);
    }

    let sanitized = html;

    // ELITE: Google News specific tags
    sanitized = sanitized.replace(/<c-wiz[^>]*>/gi, '<div>');
    sanitized = sanitized.replace(/<\/c-wiz>/gi, '</div>');
    sanitized = sanitized.replace(/<c-data[^>]*>/gi, '');
    sanitized = sanitized.replace(/<\/c-data>/gi, '');

    // Remove document structure elements
    sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '');
    sanitized = sanitized.replace(/<head[\s\S]*?<\/head>/gi, '');
    sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, '');
    sanitized = sanitized.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    sanitized = sanitized.replace(/<header[\s\S]*?<\/header>/gi, '');
    sanitized = sanitized.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    sanitized = sanitized.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

    // Normalize body/html tags
    sanitized = sanitized.replace(/<body[^>]*>/gi, '<div>');
    sanitized = sanitized.replace(/<\/body>/gi, '</div>');
    sanitized = sanitized.replace(/<html[^>]*>/gi, '<div>');
    sanitized = sanitized.replace(/<\/html>/gi, '</div>');

    // Remove inline event handlers and scripts
    sanitized = sanitized.replace(/ on\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/ on\w+='[^']*'/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Normalize line breaks for block-level tags
    sanitized = sanitized.replace(/<(p|div|section|article|h[1-6]|ul|ol|li|blockquote)[^>]*>/gi, '<$1>');

    return sanitized;
};

/**
 * Extract plain text from HTML content
 * Converts HTML to readable text with preserved paragraphs
 */
export const sanitizeArticleText = (html: string): string => {
    // CRITICAL: Validate input
    if (!html || typeof html !== 'string') {
        return '';
    }

    // CRITICAL: Limit HTML length to prevent DoS
    if (html.length > MAX_INPUT_LENGTH) {
        logger.warn('HTML input too large for text extraction, truncating:', html.length, 'bytes');
        html = html.substring(0, MAX_INPUT_LENGTH);
    }

    const withBreaks = html
        .replace(/\r?\n|\r/g, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, '\n\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, ' ');

    const withoutTags = withBreaks
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\u00a0/g, ' ');

    return withoutTags
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n\n');
};

/**
 * Clean AI-generated summary text
 * Removes HTML artifacts and normalizes whitespace
 */
export const cleanAISummary = (text: string): string => {
    // CRITICAL: Validate input
    if (!text || typeof text !== 'string') {
        return '';
    }

    // Remove HTML tags but preserve text content
    let cleaned = text
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .trim();

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // CRITICAL: Limit summary length to prevent overly long summaries
    if (cleaned.length > MAX_SUMMARY_LENGTH) {
        // Truncate at sentence boundary if possible
        const truncated = cleaned.substring(0, MAX_SUMMARY_LENGTH);
        const lastSentenceEnd = Math.max(
            truncated.lastIndexOf('.'),
            truncated.lastIndexOf('!'),
            truncated.lastIndexOf('?'),
        );

        if (lastSentenceEnd > MAX_SUMMARY_LENGTH * 0.8) {
            cleaned = truncated.substring(0, lastSentenceEnd + 1) + '...';
        } else {
            const lastSpace = truncated.lastIndexOf(' ');
            if (lastSpace > MAX_SUMMARY_LENGTH * 0.8) {
                cleaned = truncated.substring(0, lastSpace) + '...';
            } else {
                cleaned = truncated + '...';
            }
        }
    }

    return cleaned;
};

/**
 * Validate URL for safe navigation
 */
export const isValidUrl = (url: string | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Format date for display
 */
export const formatPublishedDate = (dateString: string | undefined): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateString;
    }
};

/**
 * Truncate text to specified length
 */
export const truncateText = (text: string, maxLength: number): string => {
    if (!text || text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > maxLength * 0.8 ? truncated.substring(0, lastSpace) : truncated) + '...';
};
