/**
 * Metrics & Monitoring
 * Prometheus metrics for monitoring
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../utils/logger';

export class MetricsService {
  private registry: Registry;
  private eventsDetected: Counter;
  private eventsPublished: Counter;
  private apiLatency: Histogram;
  private apiErrors: Counter;
  private apiHealth: Gauge;
  private queueSize: Gauge;
  private deduplicationRatio: Histogram;

  constructor() {
    this.registry = new Registry();

    // Event metrics
    this.eventsDetected = new Counter({
      name: 'earthquake_events_detected_total',
      help: 'Total number of earthquake events detected',
      labelNames: ['source'],
      registers: [this.registry],
    });

    this.eventsPublished = new Counter({
      name: 'earthquake_events_published_total',
      help: 'Total number of events published to queue',
      labelNames: ['source'],
      registers: [this.registry],
    });

    // API metrics
    this.apiLatency = new Histogram({
      name: 'api_request_latency_seconds',
      help: 'API request latency in seconds',
      labelNames: ['source', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.apiErrors = new Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['source', 'error_type'],
      registers: [this.registry],
    });

    this.apiHealth = new Gauge({
      name: 'api_health_status',
      help: 'API health status (1 = healthy, 0 = unhealthy)',
      labelNames: ['source'],
      registers: [this.registry],
    });

    // Queue metrics
    this.queueSize = new Gauge({
      name: 'queue_size',
      help: 'Current queue size',
      registers: [this.registry],
    });

    // Deduplication metrics
    this.deduplicationRatio = new Histogram({
      name: 'deduplication_ratio',
      help: 'Ratio of events after deduplication',
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      registers: [this.registry],
    });
  }

  recordEventDetected(source: string): void {
    this.eventsDetected.inc({ source });
  }

  recordEventPublished(source: string): void {
    this.eventsPublished.inc({ source });
  }

  recordAPILatency(source: string, latencyMs: number, status: 'success' | 'error'): void {
    this.apiLatency.observe({ source, status }, latencyMs / 1000);
  }

  recordAPIError(source: string, errorType: string): void {
    this.apiErrors.inc({ source, error_type: errorType });
  }

  setAPIHealth(source: string, healthy: boolean): void {
    this.apiHealth.set({ source }, healthy ? 1 : 0);
  }

  setQueueSize(size: number): void {
    this.queueSize.set(size);
  }

  recordDeduplicationRatio(originalCount: number, deduplicatedCount: number): void {
    if (originalCount > 0) {
      const ratio = deduplicatedCount / originalCount;
      this.deduplicationRatio.observe(ratio);
    }
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getRegistry(): Registry {
    return this.registry;
  }
}

export const metricsService = new MetricsService();









