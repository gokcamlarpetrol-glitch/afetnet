/**
 * @deprecated
 * Legacy compatibility adapter for global error handling.
 *
 * The canonical implementation lives in:
 *   src/core/services/GlobalErrorHandler.ts
 *
 * This adapter prevents duplicate global hook installations by delegating
 * all calls to `globalErrorHandlerService`.
 */

import { globalErrorHandlerService } from '../services/GlobalErrorHandler';

type ErrorContext = Record<string, unknown>;

const normalizeError = (error: Error | string): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
};

const normalizeContext = (context: ErrorContext = {}): Record<string, string> => {
  const normalized: Record<string, string> = {};
  Object.entries(context).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    normalized[key] = String(value);
  });
  return normalized;
};

class GlobalErrorHandlerAdapter {
  initialize(): void {
    // Fire-and-forget to preserve legacy sync signature
    void globalErrorHandlerService.initialize();
  }

  reportError(error: Error | string, context: ErrorContext = {}): void {
    const err = normalizeError(error);
    globalErrorHandlerService.handleManualError(err, {
      source: typeof context.source === 'string' ? context.source : 'legacy_global_error_handler',
      ...normalizeContext(context),
    });
  }

  wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    context?: ErrorContext,
  ): T {
    return globalErrorHandlerService.wrapAsyncFunction(fn, {
      source: 'legacy_async_wrapper',
      ...normalizeContext(context),
    });
  }

  getStats(): { errorCount: number; errorsLastMinute: number; isInitialized: boolean } {
    const stats = globalErrorHandlerService.getErrorStats();
    return {
      errorCount: stats.errorCount,
      errorsLastMinute: stats.errorCount,
      isInitialized: true,
    };
  }
}

export const globalErrorHandler = new GlobalErrorHandlerAdapter();
