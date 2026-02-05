/**
 * INPUT SANITIZER TESTS - ELITE EDITION
 * Security tests for user input validation
 */

describe('InputSanitizer', () => {
    // XSS Prevention
    describe('XSS Prevention', () => {
        const sanitizeHTML = (input: string): string => {
            return input
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
        };

        test('should escape HTML tags', () => {
            const malicious = '<script>alert("xss")</script>';
            const sanitized = sanitizeHTML(malicious);

            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        test('should escape event handlers', () => {
            const malicious = '<img src=x onerror="alert(1)">';
            const sanitized = sanitizeHTML(malicious);

            expect(sanitized).not.toContain('onerror');
            expect(sanitized).toContain('&lt;img');
        });

        test('should handle safe text unchanged', () => {
            const safe = 'Hello, World! This is normal text.';
            const sanitized = sanitizeHTML(safe);

            expect(sanitized).toBe(safe);
        });
    });

    // SQL Injection Prevention
    describe('SQL Injection Prevention', () => {
        const sanitizeSQL = (input: string): string => {
            // Remove or escape dangerous SQL characters
            return input
                .replace(/'/g, "''")
                .replace(/;/g, '')
                .replace(/--/g, '')
                .replace(/\/\*/g, '')
                .replace(/\*\//g, '');
        };

        test('should escape single quotes', () => {
            const malicious = "'; DROP TABLE users; --";
            const sanitized = sanitizeSQL(malicious);

            expect(sanitized).not.toContain('; DROP TABLE');
            expect(sanitized).not.toContain('--');
        });

        test('should escape comment markers', () => {
            const malicious = "admin'/*comment*/";
            const sanitized = sanitizeSQL(malicious);

            expect(sanitized).not.toContain('/*');
            expect(sanitized).not.toContain('*/');
        });
    });

    // Phone Number Validation
    describe('Phone Number Validation', () => {
        const isValidTurkishPhone = (phone: string): boolean => {
            // Turkish mobile: 05XX XXX XX XX
            const cleaned = phone.replace(/\s/g, '').replace(/-/g, '');
            return /^(0?5\d{9}|905\d{9}|\+905\d{9})$/.test(cleaned);
        };

        test('should validate Turkish mobile numbers', () => {
            expect(isValidTurkishPhone('05551234567')).toBe(true);
            expect(isValidTurkishPhone('5551234567')).toBe(true);
            expect(isValidTurkishPhone('+905551234567')).toBe(true);
            expect(isValidTurkishPhone('905551234567')).toBe(true);
        });

        test('should reject invalid phone numbers', () => {
            expect(isValidTurkishPhone('123')).toBe(false);
            expect(isValidTurkishPhone('abcdefghijk')).toBe(false);
            expect(isValidTurkishPhone('02121234567')).toBe(false); // Landline
        });
    });

    // Email Validation
    describe('Email Validation', () => {
        const isValidEmail = (email: string): boolean => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        };

        test('should validate correct emails', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
            expect(isValidEmail('user+tag@gmail.com')).toBe(true);
        });

        test('should reject invalid emails', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('@nodomain.com')).toBe(false);
            expect(isValidEmail('no@domain')).toBe(false);
            expect(isValidEmail('spaces in@email.com')).toBe(false);
        });
    });

    // Password Strength
    describe('Password Validation', () => {
        const isStrongPassword = (password: string): boolean => {
            // Min 8 chars, 1 uppercase, 1 lowercase, 1 number
            const hasMinLength = password.length >= 8;
            const hasUppercase = /[A-Z]/.test(password);
            const hasLowercase = /[a-z]/.test(password);
            const hasNumber = /[0-9]/.test(password);

            return hasMinLength && hasUppercase && hasLowercase && hasNumber;
        };

        test('should accept strong passwords', () => {
            expect(isStrongPassword('Password123')).toBe(true);
            expect(isStrongPassword('MySecure8Pass')).toBe(true);
        });

        test('should reject weak passwords', () => {
            expect(isStrongPassword('pass')).toBe(false); // Too short
            expect(isStrongPassword('password')).toBe(false); // No uppercase/number
            expect(isStrongPassword('PASSWORD')).toBe(false); // No lowercase/number
            expect(isStrongPassword('12345678')).toBe(false); // No letters
        });
    });

    // Length Limits
    describe('Input Length Limits', () => {
        const truncateInput = (input: string, maxLength: number): string => {
            if (input.length <= maxLength) return input;
            return input.substring(0, maxLength) + '...';
        };

        test('should truncate long inputs', () => {
            const longText = 'A'.repeat(1000);
            const truncated = truncateInput(longText, 100);

            expect(truncated.length).toBe(103); // 100 + '...'
            expect(truncated.endsWith('...')).toBe(true);
        });

        test('should not modify short inputs', () => {
            const shortText = 'Hello';
            const result = truncateInput(shortText, 100);

            expect(result).toBe(shortText);
        });
    });
});
