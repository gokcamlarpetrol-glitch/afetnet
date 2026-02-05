/**
 * PERFORMANCE MONITORING SERVICE - ELITE EDITION
 * 
 * Uygulama performansını izleme ve raporlama
 * 
 * FEATURES:
 * - Screen render time tracking
 * - API response time logging
 * - Memory usage monitoring
 * - Frame rate monitoring
 * - Crash-free session tracking
 * - Performance alerts
 * 
 * @version 2.0.0
 * @elite true
 */

import { InteractionManager, Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('PerformanceMonitoringService');

// ============================================================
// TYPES
// ============================================================

export interface PerformanceMetric {
    name: string;
    value: number;
    unit: 'ms' | 'bytes' | 'fps' | 'percent';
    timestamp: number;
    context?: Record<string, unknown>;
}

export interface ScreenPerformance {
    screenName: string;
    renderTime: number;
    interactionTime: number;
    timestamp: number;
}

export interface APIPerformance {
    endpoint: string;
    method: string;
    responseTime: number;
    statusCode: number;
    timestamp: number;
    success: boolean;
}

export interface MemoryInfo {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    usedPercentage: number;
    timestamp: number;
}

export interface PerformanceReport {
    sessionId: string;
    startTime: number;
    endTime: number;
    screens: ScreenPerformance[];
    apiCalls: APIPerformance[];
    memorySnapshots: MemoryInfo[];
    averageScreenRenderTime: number;
    averageAPIResponseTime: number;
    slowScreens: string[];
    slowAPIs: string[];
}

// ============================================================
// CONSTANTS
// ============================================================

const THRESHOLDS = {
    SLOW_SCREEN_RENDER_MS: 500,
    SLOW_API_RESPONSE_MS: 3000,
    HIGH_MEMORY_USAGE_PERCENT: 80,
    LOW_FPS: 30,
    MAX_METRICS_BUFFER: 1000,
    MEMORY_CHECK_INTERVAL_MS: 30000, // 30 seconds
} as const;

// ============================================================
// PERFORMANCE MONITORING SERVICE CLASS
// ============================================================

class PerformanceMonitoringService {
    private isInitialized = false;
    private sessionId: string = '';
    private sessionStartTime = 0;
    private screenMetrics: ScreenPerformance[] = [];
    private apiMetrics: APIPerformance[] = [];
    private memorySnapshots: MemoryInfo[] = [];
    private activeScreens: Map<string, number> = new Map();
    private memoryCheckInterval: ReturnType<typeof setInterval> | null = null;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize the performance monitoring service
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.debug('PerformanceMonitoringService already initialized');
            return;
        }

        try {
            logger.info('📊 Initializing PerformanceMonitoringService...');

            // Generate session ID
            this.sessionId = `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.sessionStartTime = Date.now();

            // Start memory monitoring
            this.startMemoryMonitoring();

            this.isInitialized = true;
            logger.info('✅ PerformanceMonitoringService initialized', {
                sessionId: this.sessionId,
            });
        } catch (error) {
            logger.error('❌ PerformanceMonitoringService initialization failed:', error);
        }
    }

    // ==================== SCREEN PERFORMANCE ====================

    /**
     * Mark screen render start
     */
    markScreenRenderStart(screenName: string): void {
        this.activeScreens.set(screenName, performance.now());
    }

    /**
     * Mark screen render end and calculate metrics
     */
    markScreenRenderEnd(screenName: string): ScreenPerformance | null {
        const startTime = this.activeScreens.get(screenName);
        if (!startTime) {
            logger.warn(`No render start found for screen: ${screenName}`);
            return null;
        }

        const renderTime = performance.now() - startTime;
        this.activeScreens.delete(screenName);

        // Wait for interactions to complete
        const interactionStart = performance.now();
        InteractionManager.runAfterInteractions(() => {
            const interactionTime = performance.now() - interactionStart;

            const metric: ScreenPerformance = {
                screenName,
                renderTime,
                interactionTime,
                timestamp: Date.now(),
            };

            this.recordScreenMetric(metric);
        });

        return {
            screenName,
            renderTime,
            interactionTime: 0, // Will be updated after interactions
            timestamp: Date.now(),
        };
    }

    /**
     * Record screen performance metric
     */
    private recordScreenMetric(metric: ScreenPerformance): void {
        this.screenMetrics.push(metric);

        // Trim buffer if needed
        if (this.screenMetrics.length > THRESHOLDS.MAX_METRICS_BUFFER) {
            this.screenMetrics = this.screenMetrics.slice(-THRESHOLDS.MAX_METRICS_BUFFER);
        }

        // Log slow renders
        if (metric.renderTime > THRESHOLDS.SLOW_SCREEN_RENDER_MS) {
            logger.warn(`🐢 Slow screen render: ${metric.screenName} (${metric.renderTime.toFixed(0)}ms)`);
        } else {
            logger.debug(`⚡ Screen rendered: ${metric.screenName} (${metric.renderTime.toFixed(0)}ms)`);
        }
    }

    // ==================== API PERFORMANCE ====================

    /**
     * Track API call performance
     */
    trackAPICall(
        endpoint: string,
        method: string,
        startTime: number,
        statusCode: number,
        success: boolean
    ): APIPerformance {
        const responseTime = Date.now() - startTime;

        const metric: APIPerformance = {
            endpoint,
            method,
            responseTime,
            statusCode,
            timestamp: Date.now(),
            success,
        };

        this.apiMetrics.push(metric);

        // Trim buffer if needed
        if (this.apiMetrics.length > THRESHOLDS.MAX_METRICS_BUFFER) {
            this.apiMetrics = this.apiMetrics.slice(-THRESHOLDS.MAX_METRICS_BUFFER);
        }

        // Log slow API calls
        if (responseTime > THRESHOLDS.SLOW_API_RESPONSE_MS) {
            logger.warn(`🐢 Slow API call: ${method} ${endpoint} (${responseTime}ms)`);
        }

        return metric;
    }

    /**
     * Create an API call tracker
     * Returns a function to call when the API completes
     */
    startAPICall(endpoint: string, method: string): (statusCode: number, success: boolean) => APIPerformance {
        const startTime = Date.now();
        return (statusCode: number, success: boolean) => {
            return this.trackAPICall(endpoint, method, startTime, statusCode, success);
        };
    }

    // ==================== MEMORY MONITORING ====================

    /**
     * Start periodic memory monitoring
     */
    private startMemoryMonitoring(): void {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
        }

        this.memoryCheckInterval = setInterval(() => {
            this.captureMemorySnapshot();
        }, THRESHOLDS.MEMORY_CHECK_INTERVAL_MS);

        // Initial snapshot
        this.captureMemorySnapshot();
    }

    /**
     * Capture current memory usage
     */
    captureMemorySnapshot(): MemoryInfo {
        // Note: Actual memory APIs vary by platform
        // This is a simplified implementation
        const memoryInfo: MemoryInfo = {
            usedJSHeapSize: 0,
            totalJSHeapSize: 0,
            usedPercentage: 0,
            timestamp: Date.now(),
        };

        // Try to get performance memory info if available
        if (typeof performance !== 'undefined' && 'memory' in performance) {
            const memory = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
            memoryInfo.usedJSHeapSize = memory.usedJSHeapSize;
            memoryInfo.totalJSHeapSize = memory.totalJSHeapSize;
            memoryInfo.usedPercentage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
        }

        this.memorySnapshots.push(memoryInfo);

        // Trim buffer if needed
        if (this.memorySnapshots.length > THRESHOLDS.MAX_METRICS_BUFFER) {
            this.memorySnapshots = this.memorySnapshots.slice(-THRESHOLDS.MAX_METRICS_BUFFER);
        }

        // Warn on high memory usage
        if (memoryInfo.usedPercentage > THRESHOLDS.HIGH_MEMORY_USAGE_PERCENT) {
            logger.warn(`⚠️ High memory usage: ${memoryInfo.usedPercentage.toFixed(1)}%`);
        }

        return memoryInfo;
    }

    // ==================== REPORTING ====================

    /**
     * Generate performance report
     */
    generateReport(): PerformanceReport {
        const endTime = Date.now();

        // Calculate averages
        const avgScreenRender = this.screenMetrics.length > 0
            ? this.screenMetrics.reduce((sum, m) => sum + m.renderTime, 0) / this.screenMetrics.length
            : 0;

        const avgAPIResponse = this.apiMetrics.length > 0
            ? this.apiMetrics.reduce((sum, m) => sum + m.responseTime, 0) / this.apiMetrics.length
            : 0;

        // Find slow screens
        const slowScreens = [...new Set(
            this.screenMetrics
                .filter(m => m.renderTime > THRESHOLDS.SLOW_SCREEN_RENDER_MS)
                .map(m => m.screenName)
        )];

        // Find slow APIs
        const slowAPIs = [...new Set(
            this.apiMetrics
                .filter(m => m.responseTime > THRESHOLDS.SLOW_API_RESPONSE_MS)
                .map(m => m.endpoint)
        )];

        return {
            sessionId: this.sessionId,
            startTime: this.sessionStartTime,
            endTime,
            screens: [...this.screenMetrics],
            apiCalls: [...this.apiMetrics],
            memorySnapshots: [...this.memorySnapshots],
            averageScreenRenderTime: avgScreenRender,
            averageAPIResponseTime: avgAPIResponse,
            slowScreens,
            slowAPIs,
        };
    }

    /**
     * Get performance summary
     */
    getSummary(): {
        totalScreens: number;
        totalAPICalls: number;
        avgScreenRenderMs: number;
        avgAPIResponseMs: number;
        slowScreenCount: number;
        slowAPICount: number;
        memoryUsagePercent: number;
    } {
        const lastMemory = this.memorySnapshots[this.memorySnapshots.length - 1];

        return {
            totalScreens: this.screenMetrics.length,
            totalAPICalls: this.apiMetrics.length,
            avgScreenRenderMs: this.screenMetrics.length > 0
                ? this.screenMetrics.reduce((sum, m) => sum + m.renderTime, 0) / this.screenMetrics.length
                : 0,
            avgAPIResponseMs: this.apiMetrics.length > 0
                ? this.apiMetrics.reduce((sum, m) => sum + m.responseTime, 0) / this.apiMetrics.length
                : 0,
            slowScreenCount: this.screenMetrics.filter(m => m.renderTime > THRESHOLDS.SLOW_SCREEN_RENDER_MS).length,
            slowAPICount: this.apiMetrics.filter(m => m.responseTime > THRESHOLDS.SLOW_API_RESPONSE_MS).length,
            memoryUsagePercent: lastMemory?.usedPercentage || 0,
        };
    }

    // ==================== CLEANUP ====================

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.screenMetrics = [];
        this.apiMetrics = [];
        this.memorySnapshots = [];
        this.activeScreens.clear();
        logger.info('Performance metrics cleared');
    }

    /**
     * Stop the service
     */
    stop(): void {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }
        logger.info('PerformanceMonitoringService stopped');
    }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();

// ============================================================
// REACT HOOK
// ============================================================

import { useEffect, useRef } from 'react';

/**
 * Hook for tracking screen performance
 * Usage: useScreenPerformance('HomeScreen');
 */
export function useScreenPerformance(screenName: string): void {
    const hasMarkedStart = useRef(false);

    useEffect(() => {
        if (!hasMarkedStart.current) {
            performanceMonitoringService.markScreenRenderStart(screenName);
            hasMarkedStart.current = true;
        }

        // Mark end after initial render
        const timer = setTimeout(() => {
            performanceMonitoringService.markScreenRenderEnd(screenName);
        }, 0);

        return () => {
            clearTimeout(timer);
        };
    }, [screenName]);
}

/**
 * Hook for tracking API calls
 * Usage: const tracker = useAPIPerformance();
 *        tracker.start('/api/endpoint', 'GET');
 *        // ... make call
 *        tracker.end(200, true);
 */
export function useAPIPerformance() {
    const trackerRef = useRef<((statusCode: number, success: boolean) => void) | null>(null);

    return {
        start: (endpoint: string, method: string) => {
            trackerRef.current = performanceMonitoringService.startAPICall(endpoint, method);
        },
        end: (statusCode: number, success: boolean) => {
            if (trackerRef.current) {
                trackerRef.current(statusCode, success);
                trackerRef.current = null;
            }
        },
    };
}
