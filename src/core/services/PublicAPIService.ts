/**
 * PUBLIC API SERVICE
 * Public API support for data flow to other apps/institutions
 */

import { createLogger } from '../utils/logger';
import { apiClient } from '../api/client';

const logger = createLogger('PublicAPIService');

export interface PublicAPIConfig {
  enabled: boolean;
  rateLimit: number; // requests per minute
  allowedOrigins: string[];
  apiKey?: string;
}

export interface PublicAPIRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface PublicAPIResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: number;
}

class PublicAPIService {
  private config: PublicAPIConfig = {
    enabled: true,
    rateLimit: 100, // 100 requests per minute
    allowedOrigins: [],
  };

  private requestCounts: Map<string, number> = new Map();
  private requestTimestamps: Map<string, number[]> = new Map();
  private rateLimitCleanupInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Initialize public API service
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load configuration from backend
      await this.loadConfig();

      // Start rate limit cleanup
      this.startRateLimitCleanup();

      this.isInitialized = true;

      if (__DEV__) {
        logger.info('Public API service initialized');
      }
    } catch (error) {
      logger.error('Initialization error:', error);
    }
  }

  /**
   * Load configuration from backend
   */
  private async loadConfig() {
    try {
      // In production, fetch from backend
      // For now, use default config
      this.config = {
        enabled: true,
        rateLimit: 100,
        allowedOrigins: ['*'], // Allow all origins for now
      };
    } catch (error) {
      logger.error('Config load error:', error);
    }
  }

  /**
   * Handle public API request
   */
  async handleRequest(
    request: PublicAPIRequest,
    clientIP?: string,
  ): Promise<PublicAPIResponse> {
    try {
      // Check if API is enabled
      if (!this.config.enabled) {
        return {
          success: false,
          error: 'Public API is disabled',
          timestamp: Date.now(),
        };
      }

      // Rate limiting
      if (!this.checkRateLimit(clientIP || 'unknown')) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          timestamp: Date.now(),
        };
      }

      // Validate endpoint
      if (!this.validateEndpoint(request.endpoint)) {
        return {
          success: false,
          error: 'Invalid endpoint',
          timestamp: Date.now(),
        };
      }

      // Handle request based on endpoint
      const data = await this.processRequest(request);

      return {
        success: true,
        data,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Request handling error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(clientIP: string): boolean {
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(clientIP) || [];

    // Remove timestamps older than 1 minute
    const recentTimestamps = timestamps.filter(ts => now - ts < 60000);

    if (recentTimestamps.length >= this.config.rateLimit) {
      return false;
    }

    recentTimestamps.push(now);
    this.requestTimestamps.set(clientIP, recentTimestamps);
    return true;
  }

  /**
   * Validate endpoint
   */
  private validateEndpoint(endpoint: string): boolean {
    // Whitelist of allowed endpoints
    const allowedEndpoints = [
      '/api/v1/earthquakes/latest',
      '/api/v1/earthquakes/recent',
      '/api/v1/disasters/active',
      '/api/v1/eew/latest',
      '/api/v1/mesh/stats',
      '/api/v1/health',
    ];

    return allowedEndpoints.some(allowed => endpoint.startsWith(allowed));
  }

  /**
   * Process request
   */
  private async processRequest(request: PublicAPIRequest): Promise<unknown> {
    switch (request.endpoint) {
      case '/api/v1/earthquakes/latest':
        return await this.getLatestEarthquakes();

      case '/api/v1/earthquakes/recent':
        return await this.getRecentEarthquakes(request.params);

      case '/api/v1/disasters/active':
        return await this.getActiveDisasters();

      case '/api/v1/eew/latest':
        return await this.getLatestEEW();

      case '/api/v1/mesh/stats':
        return await this.getMeshStats();

      case '/api/v1/health':
        return await this.getHealthStatus();

      default:
        throw new Error('Unknown endpoint');
    }
  }

  /**
   * Get latest earthquakes
   */
  private async getLatestEarthquakes() {
    try {
      // In production, fetch from backend
      const response = await apiClient.get('/public/earthquakes/latest') as { data: unknown };
      return response.data;
    } catch (error) {
      logger.error('Get latest earthquakes error:', error);
      return [];
    }
  }

  /**
   * Get recent earthquakes
   */
  private async getRecentEarthquakes(params?: Record<string, unknown>) {
    try {
      const limit = (params?.limit as number) || 10;
      const response = await apiClient.get(`/public/earthquakes/recent?limit=${limit}`) as { data: unknown };
      return response.data;
    } catch (error) {
      logger.error('Get recent earthquakes error:', error);
      return [];
    }
  }

  /**
   * Get active disasters
   */
  private async getActiveDisasters() {
    try {
      const response = await apiClient.get('/public/disasters/active') as { data: unknown };
      return response.data;
    } catch (error) {
      logger.error('Get active disasters error:', error);
      return [];
    }
  }

  /**
   * Get latest EEW
   */
  private async getLatestEEW() {
    try {
      const response = await apiClient.get('/public/eew/latest') as { data: unknown };
      return response.data;
    } catch (error) {
      logger.error('Get latest EEW error:', error);
      return null;
    }
  }

  /**
   * Get mesh network stats
   */
  private async getMeshStats() {
    try {
      // In production, fetch from mesh service
      return {
        connectedDevices: 0,
        messagesSent: 0,
        messagesReceived: 0,
      };
    } catch (error) {
      logger.error('Get mesh stats error:', error);
      return null;
    }
  }

  /**
   * Get health status
   */
  private async getHealthStatus() {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0',
    };
  }

  /**
   * Start rate limit cleanup
   */
  private startRateLimitCleanup() {
    // Clean up old timestamps every minute - STORE INTERVAL TO PREVENT MEMORY LEAK
    this.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientIP, timestamps] of this.requestTimestamps.entries()) {
        const recentTimestamps = timestamps.filter(ts => now - ts < 60000);
        if (recentTimestamps.length === 0) {
          this.requestTimestamps.delete(clientIP);
        } else {
          this.requestTimestamps.set(clientIP, recentTimestamps);
        }
      }
    }, 60000); // 1 minute
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<PublicAPIConfig>) {
    this.config = { ...this.config, ...config };

    if (__DEV__) {
      logger.info('Public API config updated:', this.config);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PublicAPIConfig {
    return { ...this.config };
  }

  stop() {
    // Clear rate limit cleanup interval - PREVENT MEMORY LEAK
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }

    this.requestTimestamps.clear();
    this.requestCounts.clear();
    this.isInitialized = false;

    if (__DEV__) {
      logger.info('Public API service stopped');
    }
  }
}

export const publicAPIService = new PublicAPIService();


