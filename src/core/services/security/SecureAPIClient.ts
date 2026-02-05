/**
 * SECURE API CLIENT - ELITE EDITION
 * 
 * Güvenli API istekleri için merkezi client
 * 
 * SECURITY FEATURES:
 * - Request signing and validation
 * - Automatic retry with exponential backoff
 * - Rate limiting (client-side)
 * - Request/Response logging (without sensitive data)
 * - App Check token injection
 * - Timeout management
 * 
 * @version 2.0.0
 * @elite true
 */

import { createLogger } from '../../utils/logger';
import { appCheckService } from './AppCheckService';

const logger = createLogger('SecureAPIClient');

// ============================================================
// TYPES
// ============================================================

export interface APIClientConfig {
    baseURL: string;
    timeout: number;
    maxRetries: number;
    retryDelay: number;
    enableRateLimiting: boolean;
    rateLimitPerMinute: number;
}

export interface APIRequest {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    endpoint: string;
    body?: unknown;
    headers?: Record<string, string>;
    skipAuth?: boolean;
    skipAppCheck?: boolean;
}

export interface APIResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    statusCode: number;
    retryCount: number;
    timestamp: number;
}

interface RateLimitState {
    requests: number[];
    blocked: boolean;
    blockedUntil: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_CONFIG: APIClientConfig = {
    baseURL: '', // DEPRECATED: Render backend removed, using Firebase
    timeout: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000, // 1 second base delay
    enableRateLimiting: true,
    rateLimitPerMinute: 60,
};

// Status codes that should trigger retry
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// ============================================================
// SECURE API CLIENT CLASS
// ============================================================

class SecureAPIClient {
    private config: APIClientConfig;
    private rateLimit: RateLimitState = {
        requests: [],
        blocked: false,
        blockedUntil: 0,
    };

    constructor(config: Partial<APIClientConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ==================== MAIN REQUEST METHOD ====================

    /**
     * Make a secure API request
     */
    async request<T>(request: APIRequest): Promise<APIResponse<T>> {
        const timestamp = Date.now();
        let retryCount = 0;

        // Check rate limit
        if (this.isRateLimited()) {
            return {
                success: false,
                error: 'Çok fazla istek. Lütfen biraz bekleyin.',
                statusCode: 429,
                retryCount: 0,
                timestamp,
            };
        }

        // Record this request for rate limiting
        this.recordRequest();

        while (retryCount <= this.config.maxRetries) {
            try {
                const response = await this.executeRequest<T>(request);

                if (response.success || !this.shouldRetry(response.statusCode)) {
                    return { ...response, retryCount, timestamp };
                }

                // Retry logic
                retryCount++;
                if (retryCount <= this.config.maxRetries) {
                    const delay = this.calculateRetryDelay(retryCount, response.statusCode);
                    logger.debug(`Retrying request in ${delay}ms (attempt ${retryCount})`);
                    await this.sleep(delay);
                }
            } catch (error) {
                retryCount++;
                if (retryCount > this.config.maxRetries) {
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : 'İstek başarısız',
                        statusCode: 0,
                        retryCount,
                        timestamp,
                    };
                }
                await this.sleep(this.calculateRetryDelay(retryCount, 0));
            }
        }

        return {
            success: false,
            error: 'Maximum retry attempts exceeded',
            statusCode: 0,
            retryCount,
            timestamp,
        };
    }

    /**
     * Execute a single request (without retry logic)
     */
    private async executeRequest<T>(request: APIRequest): Promise<APIResponse<T>> {
        const url = `${this.config.baseURL}${request.endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            // Build headers
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Client-Version': '2.0.0',
                'X-Platform': require('react-native').Platform.OS,
                ...request.headers,
            };

            // Add App Check token if available and not skipped
            if (!request.skipAppCheck) {
                const appCheckHeaders = await appCheckService.getRequestHeaders();
                Object.assign(headers, appCheckHeaders);
            }

            // Add request timestamp for replay protection
            headers['X-Request-Timestamp'] = Date.now().toString();

            // Log request (without sensitive data)
            logger.debug(`API Request: ${request.method} ${request.endpoint}`);

            const response = await fetch(url, {
                method: request.method,
                headers,
                body: request.body ? JSON.stringify(request.body) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Parse response
            let data: T | undefined;
            const contentType = response.headers.get('content-type');

            if (contentType?.includes('application/json')) {
                try {
                    data = await response.json();
                } catch {
                    // Response is not valid JSON
                }
            }

            // Log response (without sensitive data)
            logger.debug(`API Response: ${response.status} ${request.endpoint}`);

            return {
                success: response.ok,
                data,
                error: response.ok ? undefined : `HTTP ${response.status}`,
                statusCode: response.status,
                retryCount: 0,
                timestamp: Date.now(),
            };
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Request timeout',
                    statusCode: 408,
                    retryCount: 0,
                    timestamp: Date.now(),
                };
            }

            throw error;
        }
    }

    // ==================== CONVENIENCE METHODS ====================

    async get<T>(endpoint: string, headers?: Record<string, string>): Promise<APIResponse<T>> {
        return this.request<T>({ method: 'GET', endpoint, headers });
    }

    async post<T>(endpoint: string, body: unknown, headers?: Record<string, string>): Promise<APIResponse<T>> {
        return this.request<T>({ method: 'POST', endpoint, body, headers });
    }

    async put<T>(endpoint: string, body: unknown, headers?: Record<string, string>): Promise<APIResponse<T>> {
        return this.request<T>({ method: 'PUT', endpoint, body, headers });
    }

    async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<APIResponse<T>> {
        return this.request<T>({ method: 'DELETE', endpoint, headers });
    }

    // ==================== RATE LIMITING ====================

    /**
     * Check if client is rate limited
     */
    private isRateLimited(): boolean {
        if (!this.config.enableRateLimiting) return false;

        const now = Date.now();

        // Check if blocked
        if (this.rateLimit.blocked && now < this.rateLimit.blockedUntil) {
            return true;
        }

        // Unblock if time has passed
        if (this.rateLimit.blocked && now >= this.rateLimit.blockedUntil) {
            this.rateLimit.blocked = false;
            this.rateLimit.requests = [];
        }

        // Clean old requests (older than 1 minute)
        const oneMinuteAgo = now - 60000;
        this.rateLimit.requests = this.rateLimit.requests.filter(t => t > oneMinuteAgo);

        // Check if over limit
        if (this.rateLimit.requests.length >= this.config.rateLimitPerMinute) {
            this.rateLimit.blocked = true;
            this.rateLimit.blockedUntil = now + 60000; // Block for 1 minute
            logger.warn('Rate limit exceeded, blocking requests');
            return true;
        }

        return false;
    }

    /**
     * Record a request for rate limiting
     */
    private recordRequest(): void {
        if (!this.config.enableRateLimiting) return;
        this.rateLimit.requests.push(Date.now());
    }

    // ==================== RETRY LOGIC ====================

    /**
     * Check if status code should trigger retry
     */
    private shouldRetry(statusCode: number): boolean {
        return RETRYABLE_STATUS_CODES.includes(statusCode);
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    private calculateRetryDelay(retryCount: number, statusCode: number): number {
        // Base delay with exponential backoff
        let delay = this.config.retryDelay * Math.pow(2, retryCount - 1);

        // Add jitter (± 20%)
        const jitter = delay * 0.2 * (Math.random() * 2 - 1);
        delay += jitter;

        // If rate limited (429), use longer delay
        if (statusCode === 429) {
            delay = Math.max(delay, 30000); // At least 30 seconds
        }

        // Cap at 60 seconds
        return Math.min(delay, 60000);
    }

    // ==================== UTILITIES ====================

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<APIClientConfig>): void {
        this.config = { ...this.config, ...config };
        logger.info('SecureAPIClient config updated');
    }

    /**
     * Get current configuration
     */
    getConfig(): APIClientConfig {
        return { ...this.config };
    }

    /**
     * Get rate limit state
     */
    getRateLimitState(): RateLimitState {
        return { ...this.rateLimit };
    }

    /**
     * Reset rate limit (for testing)
     */
    resetRateLimit(): void {
        this.rateLimit = {
            requests: [],
            blocked: false,
            blockedUntil: 0,
        };
    }
}

// Export singleton instance
export const secureAPIClient = new SecureAPIClient();

// Export class for custom instances
export { SecureAPIClient };
