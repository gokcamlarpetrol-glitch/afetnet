/**
 * SAFE STRING UTILITIES TESTS - ELITE TEST SUITE
 * Comprehensive tests for safe string manipulation utilities
 */

import { safeLowerCase, safeIncludes } from '../safeString';

describe('safeString', () => {
  describe('safeLowerCase', () => {
    it('should convert string to lowercase', () => {
      expect(safeLowerCase('HELLO')).toBe('hello');
      expect(safeLowerCase('Hello World')).toBe('hello world');
    });

    it('should return empty string for null', () => {
      expect(safeLowerCase(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(safeLowerCase(undefined)).toBe('');
    });

    it('should handle empty string', () => {
      expect(safeLowerCase('')).toBe('');
    });

    it('should convert number to lowercase string', () => {
      expect(safeLowerCase(123)).toBe('123');
    });

    it('should handle Turkish characters', () => {
      expect(safeLowerCase('TÜRKÇE')).toBe('türkçe');
    });

    it('should handle mixed case', () => {
      expect(safeLowerCase('HeLLo WoRLd')).toBe('hello world');
    });

    it('should handle special characters', () => {
      expect(safeLowerCase('TEST@123')).toBe('test@123');
    });
  });

  describe('safeIncludes', () => {
    it('should find substring (case-insensitive)', () => {
      expect(safeIncludes('Hello World', 'world')).toBe(true);
      expect(safeIncludes('Hello World', 'WORLD')).toBe(true);
    });

    it('should return false when substring not found', () => {
      expect(safeIncludes('Hello World', 'xyz')).toBe(false);
    });

    it('should handle null text', () => {
      expect(safeIncludes(null, 'test')).toBe(false);
    });

    it('should handle undefined text', () => {
      expect(safeIncludes(undefined, 'test')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(safeIncludes('', '')).toBe(true);
      expect(safeIncludes('Hello', '')).toBe(true);
      expect(safeIncludes('', 'test')).toBe(false);
    });

    it('should handle Turkish characters (case-insensitive)', () => {
      // Note: Turkish İ → i conversion is locale-dependent
      // Test verifies case-insensitive comparison works
      expect(safeIncludes('istanbul Türkiye', 'istanbul')).toBe(true);
      expect(safeIncludes('ANKARA', 'ankara')).toBe(true);
    });

    it('should find exact match', () => {
      expect(safeIncludes('test', 'test')).toBe(true);
    });
  });
});
