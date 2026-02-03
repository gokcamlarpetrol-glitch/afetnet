/**
 * ERROR UTILITIES - ELITE TYPE-SAFE ERROR HANDLING
 * Helper functions for type-safe error handling with unknown type
 */

/**
 * Extract error message from unknown error type
 * Use this in catch blocks with error: unknown
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Extract error name from unknown error type
 */
export function getErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  return 'UnknownError';
}

/**
 * Extract error stack from unknown error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Check if error has specific code (Firebase/custom errors)
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code;
  }
  return undefined;
}

/**
 * Type guard to check if value is Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
