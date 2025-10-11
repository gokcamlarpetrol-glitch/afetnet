/**
 * Unit Tests for Production Logger
 * Elite Software Engineering Standards
 */

import { ProductionLogger } from '../../src/utils/productionLogger';

describe('ProductionLogger', () => {
  let logger: ProductionLogger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new ProductionLogger();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Sensitive Data Masking', () => {
    it('should mask password fields', () => {
      const sensitiveData = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com'
      };

      logger.debug('User login', sensitiveData);

      // Password should be masked
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      expect(JSON.stringify(callArgs)).not.toContain('secret123');
      expect(JSON.stringify(callArgs)).toContain('***REDACTED***');
    });

    it('should mask API tokens', () => {
      const data = {
        apiKey: 'sk_test_1234567890abcdef',
        userId: 'user123'
      };

      logger.debug('API call', data);

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      expect(JSON.stringify(callArgs)).not.toContain('sk_test_');
      expect(JSON.stringify(callArgs)).toContain('***REDACTED***');
    });

    it('should mask long token strings', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
      
      logger.debug('Auth token', token);

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      // Should show only last 4 characters
      expect(JSON.stringify(callArgs)).toContain('***MDIyfQ');
    });
  });

  describe('Log Levels', () => {
    it('should format debug logs correctly', () => {
      logger.debug('Test message', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('[DEBUG]');
      expect(message).toContain('Test message');
    });

    it('should format info logs correctly', () => {
      logger.info('Info message', { status: 'ok' });

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('[INFO]');
      expect(message).toContain('Info message');
    });

    it('should include component context', () => {
      logger.debug('Component action', null, { component: 'SOSButton' });

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('[SOSButton]');
    });
  });

  describe('Production Safety', () => {
    it('should not log debug in production', () => {
      // Mock production environment
      const originalDEV = global.__DEV__;
      (global as any).__DEV__ = false;

      const prodLogger = new ProductionLogger();
      const prodSpy = jest.spyOn(console, 'log').mockImplementation();

      prodLogger.debug('Debug message');

      expect(prodSpy).not.toHaveBeenCalled();

      prodSpy.mockRestore();
      (global as any).__DEV__ = originalDEV;
    });

    it('should log critical errors in production', () => {
      const originalDEV = global.__DEV__;
      (global as any).__DEV__ = false;

      const prodLogger = new ProductionLogger();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      prodLogger.critical('Critical error', new Error('Test error'));

      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
      (global as any).__DEV__ = originalDEV;
    });
  });
});

