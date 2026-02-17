jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

describe('FirebaseCrashlyticsService global hook isolation', () => {
  const originalErrorUtils = (global as any).ErrorUtils;
  const originalUnhandledRejection = (global as any).onunhandledrejection;

  beforeEach(() => {
    jest.resetModules();
    (global as any).ErrorUtils = {
      getGlobalHandler: jest.fn(() => undefined),
      setGlobalHandler: jest.fn(),
    };
    (global as any).onunhandledrejection = jest.fn();
  });

  afterAll(() => {
    (global as any).ErrorUtils = originalErrorUtils;
    (global as any).onunhandledrejection = originalUnhandledRejection;
  });

  it('does not replace ErrorUtils or onunhandledrejection handlers on initialize', async () => {
    const errorUtilsBefore = (global as any).ErrorUtils;
    const rejectionHandlerBefore = (global as any).onunhandledrejection;

    // Use require() for Jest runtime compatibility (no ESM vm-modules needed).
    const { firebaseCrashlyticsService } = require('../FirebaseCrashlyticsService');
    await firebaseCrashlyticsService.initialize();

    expect((global as any).ErrorUtils).toBe(errorUtilsBefore);
    expect((global as any).ErrorUtils.setGlobalHandler).not.toHaveBeenCalled();
    expect((global as any).onunhandledrejection).toBe(rejectionHandlerBefore);
  });
});
