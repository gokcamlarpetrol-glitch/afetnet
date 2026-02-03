/**
 * ERROR UTILITIES TESTS - ELITE TEST SUITE
 * Comprehensive tests for type-safe error handling utilities
 */

import {
  getErrorMessage,
  getErrorName,
  getErrorStack,
  getErrorCode,
  isError,
} from '../errorUtils';

describe('errorUtils', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should return string directly if error is string', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should convert number to string', () => {
      expect(getErrorMessage(404)).toBe('404');
    });

    it('should convert null to string', () => {
      expect(getErrorMessage(null)).toBe('null');
    });

    it('should convert undefined to string', () => {
      expect(getErrorMessage(undefined)).toBe('undefined');
    });

    it('should convert object to string', () => {
      expect(getErrorMessage({ code: 'ERR' })).toBe('[object Object]');
    });
  });

  describe('getErrorName', () => {
    it('should extract name from Error instance', () => {
      const error = new Error('Test');
      expect(getErrorName(error)).toBe('Error');
    });

    it('should extract name from TypeError', () => {
      const error = new TypeError('Type error');
      expect(getErrorName(error)).toBe('TypeError');
    });

    it('should return UnknownError for non-Error values', () => {
      expect(getErrorName('string')).toBe('UnknownError');
      expect(getErrorName(null)).toBe('UnknownError');
      expect(getErrorName(undefined)).toBe('UnknownError');
      expect(getErrorName(42)).toBe('UnknownError');
    });
  });

  describe('getErrorStack', () => {
    it('should extract stack from Error instance', () => {
      const error = new Error('Test');
      const stack = getErrorStack(error);
      expect(stack).toBeDefined();
      expect(stack).toContain('Error: Test');
    });

    it('should return undefined for non-Error values', () => {
      expect(getErrorStack('string')).toBeUndefined();
      expect(getErrorStack(null)).toBeUndefined();
      expect(getErrorStack(undefined)).toBeUndefined();
    });
  });

  describe('getErrorCode', () => {
    it('should extract code from object with code property', () => {
      const error = { code: 'AUTH_ERROR', message: 'Auth failed' };
      expect(getErrorCode(error)).toBe('AUTH_ERROR');
    });

    it('should extract code from Firebase-like error', () => {
      const error = { code: 'auth/invalid-email', message: 'Invalid email' };
      expect(getErrorCode(error)).toBe('auth/invalid-email');
    });

    it('should return undefined for Error without code', () => {
      const error = new Error('Test');
      expect(getErrorCode(error)).toBeUndefined();
    });

    it('should return undefined for non-object values', () => {
      expect(getErrorCode('string')).toBeUndefined();
      expect(getErrorCode(null)).toBeUndefined();
      expect(getErrorCode(undefined)).toBeUndefined();
    });
  });

  describe('isError', () => {
    it('should return true for Error instance', () => {
      expect(isError(new Error('Test'))).toBe(true);
    });

    it('should return true for TypeError', () => {
      expect(isError(new TypeError('Type error'))).toBe(true);
    });

    it('should return true for RangeError', () => {
      expect(isError(new RangeError('Range error'))).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isError('string')).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError({ message: 'fake error' })).toBe(false);
    });
  });
});
