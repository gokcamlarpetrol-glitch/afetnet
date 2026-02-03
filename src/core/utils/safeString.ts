/**
 * SAFE STRING UTILITIES
 * Prevents runtime crashes caused by string manipulation on undefined/null values
 */

/**
 * Safely converts a value to lowercase string
 * Handles null, undefined, numbers, and objects gracefully
 * @param value - The value to convert
 * @returns Lowercase string or empty string if invalid
 */
export function safeLowerCase(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.toLowerCase();
  }

  try {
    return String(value).toLowerCase();
  } catch (error) {
    return '';
  }
}

/**
 * Safely checks if a string includes a substring (case-insensitive)
 * @param text - The text to search in
 * @param query - The query to search for
 * @returns boolean
 */
export function safeIncludes(text: unknown, query: string): boolean {
  const safeText = safeLowerCase(text);
  const safeQuery = safeLowerCase(query);
  return safeText.includes(safeQuery);
}
