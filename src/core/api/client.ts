/**
 * API CLIENT
 * Backend communication with HMAC authentication
 * ELITE: Production-ready error handling and validation
 */

import { ENV } from '../config/env';
import { sanitizeString } from '../utils/validation';

const API_BASE_URL = ENV.API_BASE_URL;
// ELITE: Use empty string if no API secret (backend may not require auth)
const API_SECRET = ENV.FIREBASE_API_KEY || ''; // Using Firebase key as API secret for now

// ELITE: Custom API Error class for better error handling
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    // ELITE: Validate baseURL
    if (!baseURL || typeof baseURL !== 'string' || !baseURL.startsWith('http')) {
      throw new Error('Invalid API base URL');
    }
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = 10000,
    } = options;

    // Sanitize endpoint
    const sanitizedEndpoint = sanitizeString(endpoint, 200).replace(/[^a-zA-Z0-9/\-_]/g, '');
    if (!sanitizedEndpoint || !sanitizedEndpoint.startsWith('/')) {
      throw new Error('Invalid endpoint');
    }

    const url = `${this.baseURL}${sanitizedEndpoint}`;
    const timestamp = Date.now().toString();

    // Prepare request
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Timestamp': timestamp,
      'X-App-Version': ENV.APP_VERSION,
      ...headers,
    };

    // HMAC signature (simplified - in production use proper crypto)
    if (API_SECRET) {
      const payload = JSON.stringify(body || {});
      const signature = await this.generateSignature(timestamp, payload);
      requestHeaders['X-Signature'] = signature;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // ELITE: Try to parse error response for better error messages
        const errorBody = await response.text(); // Get raw error body
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const jsonError = JSON.parse(errorBody);
          errorMessage = jsonError.message || jsonError.error || errorMessage;
        } catch {
          // If not JSON, use raw text
          errorMessage = errorBody || errorMessage;
        }
        throw new APIError(errorMessage, response.status);
      }

      // ELITE: Handle empty responses gracefully
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return data as T;
      } else {
        // Non-JSON response (e.g., 204 No Content)
        return {} as T;
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof APIError) {
        throw error; // Re-throw custom API errors
      } else if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new APIError('Request timeout', 408); // Use 408 for timeout
        }
        throw new APIError(error.message, 0, error); // Wrap generic errors
      }

      throw new APIError('Unknown error', 0, error); // Catch all other errors
    }
  }

  private async generateSignature(timestamp: string, payload: string): Promise<string> {
    // ELITE: Use Web Crypto API for proper HMAC-SHA256
    const message = `${timestamp}:${payload}`;

    try {
      // Check if SubtleCrypto is available (modern browsers and React Native with hermes)
      if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(API_SECRET || 'default-key');
        const messageData = encoder.encode(message);

        // Import the secret key
        const key = await globalThis.crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );

        // Sign the message
        const signature = await globalThis.crypto.subtle.sign(
          'HMAC',
          key,
          messageData,
        );

        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(signature));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
      } else {
        // Fallback: Simple hash for environments without SubtleCrypto
        // This is less secure but ensures the app doesn't crash
        return this.fallbackHash(message + (API_SECRET || ''));
      }
    } catch (error) {
      // If crypto fails, use fallback hash
      console.warn('Crypto API failed, using fallback hash:', error);
      return this.fallbackHash(message + (API_SECRET || ''));
    }
  }

  private fallbackHash(str: string): string {
    // ELITE: DJB2 hash - simple but deterministic fallback
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // Convenience methods
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async post<T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async put<T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new APIClient();

// ELITE: Type-safe message interface
interface SyncMessage {
  id: string;
  content: string;
  timestamp: number;
  [key: string]: unknown;
}

// ELITE: Type-safe SOS data interface
interface SOSData {
  latitude: number;
  longitude: number;
  message?: string;
  type?: string;
  [key: string]: unknown;
}

// API endpoints
export const API = {
  // User
  registerDevice: (deviceId: string, pushToken?: string) =>
    apiClient.post('/device/register', { deviceId, pushToken }),

  // Messages
  syncMessages: (messages: SyncMessage[]) =>
    apiClient.post('/messages/sync', { messages }),

  // Location
  updateLocation: (latitude: number, longitude: number) =>
    apiClient.post('/location/update', { latitude, longitude }),

  // SOS
  sendSOS: (data: SOSData) =>
    apiClient.post('/sos/send', data as Record<string, unknown>),
};

