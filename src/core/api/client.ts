/**
 * API CLIENT
 * Backend communication with HMAC authentication
 */

import { ENV } from '../config/env';
import { sanitizeString } from '../utils/validation';

const API_BASE_URL = ENV.API_BASE_URL;
const API_SECRET = ENV.FIREBASE_API_KEY; // Using Firebase key as API secret for now

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = 10000,
    } = options;

    // Sanitize endpoint
    const sanitizedEndpoint = sanitizeString(endpoint, 200).replace(/[^a-zA-Z0-9\/\-_]/g, '');
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
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      
      throw new Error('Unknown error');
    }
  }

  private async generateSignature(timestamp: string, payload: string): Promise<string> {
    // Simplified signature - in production use proper HMAC-SHA256
    const message = `${timestamp}:${payload}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message + API_SECRET);
    
    // Simple hash (not cryptographically secure - use proper crypto in production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16);
  }

  // Convenience methods
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new APIClient();

// API endpoints
export const API = {
  // User
  registerDevice: (deviceId: string, pushToken?: string) =>
    apiClient.post('/device/register', { deviceId, pushToken }),
  
  // Messages
  syncMessages: (messages: any[]) =>
    apiClient.post('/messages/sync', { messages }),
  
  // Location
  updateLocation: (latitude: number, longitude: number) =>
    apiClient.post('/location/update', { latitude, longitude }),
  
  // SOS
  sendSOS: (data: any) =>
    apiClient.post('/sos/send', data),
};

