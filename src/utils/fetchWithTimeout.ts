/**
 * Fetch with Timeout - Elite Network Error Handling
 * 
 * CRITICAL: Prevents user from waiting indefinitely
 * 
 * Features:
 * - Automatic timeout
 * - AbortController integration
 * - Retry logic
 * - Error handling
 */

/**
 * Fetch with automatic timeout
 * 
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * 
 * @returns {Promise<Response>} Fetch response
 * 
 * @throws {Error} If timeout is reached
 * @throws {Error} If network error occurs
 * 
 * @example
 * ```typescript
 * const response = await fetchWithTimeout(
 *   'https://api.example.com/data',
 *   { method: 'POST', body: JSON.stringify(data) },
 *   5000 // 5 second timeout
 * );
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000,
): Promise<Response> {
  const controller = new (globalThis as any).AbortController();
  const timeoutId = (globalThis as any).setTimeout(() => controller.abort(), timeout);

  try {
    const response = await (globalThis as any).fetch(url, {
      ...options,
      signal: controller.signal,
    });

    (globalThis as any).clearTimeout(timeoutId);
    return response;
  } catch (error) {
    (globalThis as any).clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Fetch with automatic retry
 * 
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} timeout - Timeout per request (default: 10000)
 * 
 * @returns {Promise<Response>} Fetch response
 * 
 * @example
 * ```typescript
 * const response = await fetchWithRetry(
 *   'https://api.example.com/critical',
 *   { method: 'POST' },
 *   3, // 3 retries
 *   5000 // 5 second timeout
 * );
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  timeout: number = 10000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);
      
      // If successful, return immediately
      if (response.ok) {
        return response;
      }

      // If 4xx error, don't retry (client error)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // If 5xx error, retry
      lastError = new Error(`Server error: ${response.status}`);
      
    } catch (error) {
      lastError = error as Error;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => (globalThis as any).setTimeout(resolve, backoff));
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * Fetch JSON with timeout and error handling
 * 
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * 
 * @returns {Promise<T>} Parsed JSON response
 * 
 * @example
 * ```typescript
 * const data = await fetchJSON<{ earthquakes: any[] }>(
 *   'https://api.example.com/earthquakes'
 * );
 * ```
 */
export async function fetchJSON<T = any>(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000,
): Promise<T> {
  const response = await fetchWithTimeout(url, options, timeout);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * POST JSON with timeout
 * 
 * @param {string} url - URL to post to
 * @param {any} data - Data to send
 * @param {number} timeout - Timeout in milliseconds
 * 
 * @returns {Promise<T>} Response data
 * 
 * @example
 * ```typescript
 * const result = await postJSON('/api/sos', sosData);
 * ```
 */
export async function postJSON<T = any>(
  url: string,
  data: any,
  timeout: number = 10000,
): Promise<T> {
  return fetchJSON<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, timeout);
}

export default {
  fetchWithTimeout,
  fetchWithRetry,
  fetchJSON,
  postJSON,
};

