/**
 * Earthquake Event Watcher - Main Entry Point
 * Real-time earthquake detection microservice
 */

import { logger } from './utils/logger';
import { config } from './config';
import { usgsClient, ambeeClient, xweatherClient, zylaClient } from './apiClients';
import { normalizationService } from './normalization';
import { deduplicationService } from './deduplication';
import { queuePublisher } from './queue/publisher';
import { metricsService } from './monitoring/metrics';
import { healthCheckService } from './monitoring/health';
import { earlyDetectionService } from './ai/EarlyDetectionService';
import { patternRecognitionService } from './ai/PatternRecognitionService';
import express from 'express';
import { NormalizedEarthquake, PrioritizedEvent } from './types/earthquake';
import { createEventsRouter, storeEvent } from './api/events';

class EarthquakeEventWatcher {
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private metricsServer: express.Application;
  private metricsServerInstance: any;

  constructor() {
    this.metricsServer = express();
    this.setupMetricsServer();
  }

  private setupMetricsServer(): void {
    this.metricsServer.get('/metrics', async (_req, res) => {
      try {
        const metrics = await metricsService.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error: any) {
        logger.error('Failed to get metrics', { error: error.message });
        res.status(500).send('Error generating metrics');
      }
    });
  }

  /**
   * Start the watcher service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Watcher is already running');
      return;
    }

    logger.info('Starting Earthquake Event Watcher', {
      pollIntervalMs: config.pollIntervalMs,
      magnitudeThreshold: config.magnitudeThreshold,
      sources: ['USGS', 'Ambee', 'Xweather', 'Zyla'],
    });

    try {
      // Connect to message queue
      await queuePublisher.connect();
      logger.info('Message queue connected');

      // Start health check server
      await healthCheckService.start();

      // Setup API routes
      this.metricsServer.use(express.json());
      this.metricsServer.use('/api', createEventsRouter());

      // Start metrics server
      this.metricsServerInstance = this.metricsServer.listen(config.metricsPort, () => {
        logger.info(`Metrics server started on port ${config.metricsPort}`);
      });

      // Start polling
      this.isRunning = true;
      await this.poll(); // Initial poll
      this.pollInterval = setInterval(() => {
        this.poll().catch((error) => {
          logger.error('Poll error', { error: error.message });
        });
      }, config.pollIntervalMs);

      logger.info('Earthquake Event Watcher started successfully');
    } catch (error: any) {
      logger.error('Failed to start watcher', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the watcher service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Earthquake Event Watcher');

    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    await queuePublisher.disconnect();
    await deduplicationService.cleanup();
    await healthCheckService.stop();

    if (this.metricsServerInstance) {
      this.metricsServerInstance.close();
    }

    logger.info('Earthquake Event Watcher stopped');
  }

  /**
   * Poll all APIs and process events
   */
  private async poll(): Promise<void> {
    const pollStartTime = Date.now();
    const allRawEvents: any[] = [];

    // Fetch from all sources in parallel
    const fetchPromises = [
      this.fetchFromSource('USGS', () => usgsClient.fetchRecent()),
      this.fetchFromSource('Ambee', () => ambeeClient.fetchRecent()),
      this.fetchFromSource('Xweather', () => xweatherClient.fetchRecent()),
      this.fetchFromSource('Zyla', () => zylaClient.fetchRecent()),
    ];

    const results = await Promise.allSettled(fetchPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allRawEvents.push(...result.value);
      }
    }

    // CRITICAL: AI-Powered Early Detection - Analyze BEFORE normalization
    // This provides earliest possible detection by analyzing raw signals
    const earlyWarnings = await earlyDetectionService.analyzeForEarlyDetection(allRawEvents);
    
    if (earlyWarnings.length > 0) {
      logger.info(`🚨 AI Early Detection: ${earlyWarnings.length} warning(s) detected`, {
        warnings: earlyWarnings.map(w => ({
          magnitude: w.predictedMagnitude,
          confidence: w.confidence,
          timeAdvantage: `${w.estimatedTimeToDetection}s`,
        })),
      });

      // Publish early warnings immediately (before official detection)
      for (const warning of earlyWarnings) {
        try {
          const earlyEvent: PrioritizedEvent = {
            id: warning.id,
            timestamp: warning.detectedAt,
            magnitude: warning.predictedMagnitude,
            latitude: warning.predictedLocation.lat,
            longitude: warning.predictedLocation.lon,
            depthKm: null,
            source: 'AI-EARLY' as any,
            detectedAt: warning.detectedAt,
            latencyMs: 0, // Instant detection
            priorityScore: 0, // Highest priority
            duplicateSources: [],
            location: `AI Early Warning (${warning.confidence}% confidence)`,
          };

          await queuePublisher.publish(earlyEvent);
          storeEvent(earlyEvent);
          metricsService.recordEventPublished('AI-EARLY');
          
          logger.info('🚨 Early warning published', {
            id: warning.id,
            magnitude: warning.predictedMagnitude,
            confidence: warning.confidence,
            signals: warning.signals,
          });
        } catch (error: any) {
          logger.error('Failed to publish early warning', { error: error.message });
        }
      }
    }

    if (allRawEvents.length === 0) {
      logger.debug('No events detected in this poll cycle');
      return;
    }

    // Normalize events
    const normalized = normalizationService.normalize(allRawEvents);
    logger.info(`Normalized ${normalized.length} events from ${allRawEvents.length} raw events`);

    // CRITICAL: AI Validation - Validate normalized events with AI
    const validatedEvents: NormalizedEarthquake[] = [];
    for (const event of normalized) {
      const validation = await earlyDetectionService.validateEarthquake(event);
      if (validation.valid) {
        validatedEvents.push(event);
        if (validation.confidence < 80) {
          logger.warn('Low confidence event', {
            id: event.id,
            confidence: validation.confidence,
            reasons: validation.reasons,
          });
        }
      } else {
        logger.warn('AI rejected event', {
          id: event.id,
          confidence: validation.confidence,
          reasons: validation.reasons,
        });
      }
    }

    // Use validated events (fallback to normalized if validation fails)
    const eventsToProcess = validatedEvents.length > 0 ? validatedEvents : normalized;

    // Filter by magnitude threshold
    const filtered = eventsToProcess.filter((e) => e.magnitude >= config.magnitudeThreshold);
    if (filtered.length === 0) {
      logger.debug('No events above magnitude threshold');
      return;
    }

    // Record metrics
    for (const event of filtered) {
      metricsService.recordEventDetected(event.source);
      metricsService.recordAPILatency(event.source, event.latencyMs || 0, 'success');
      metricsService.setAPIHealth(event.source, true);
    }

    // Deduplicate and prioritize
    const prioritized = await deduplicationService.deduplicateAndPrioritize(filtered);
    metricsService.recordDeduplicationRatio(filtered.length, prioritized.length);

    if (prioritized.length === 0) {
      logger.debug('No unique events after deduplication');
      return;
    }

    // Publish to queue and store for API access
    for (const event of prioritized) {
      try {
        await queuePublisher.publish(event);
        storeEvent(event); // Store for HTTP API access
        metricsService.recordEventPublished(event.source);
        logger.info('Event published', {
          id: event.id,
          source: event.source,
          magnitude: event.magnitude,
          location: event.location,
          latencyMs: event.latencyMs,
          priorityScore: event.priorityScore,
        });
      } catch (error: any) {
        logger.error('Failed to publish event', {
          error: error.message,
          eventId: event.id,
        });
        metricsService.recordAPIError('queue', 'publish_failed');
      }
    }

    const pollDuration = Date.now() - pollStartTime;
    logger.debug(`Poll cycle completed in ${pollDuration}ms`, {
      rawEvents: allRawEvents.length,
      normalized: normalized.length,
      filtered: filtered.length,
      published: prioritized.length,
    });
  }

  /**
   * Fetch from a single source with error handling
   */
  private async fetchFromSource(
    sourceName: string,
    fetchFn: () => Promise<any[]>
  ): Promise<any[]> {
    try {
      const events = await fetchFn();
      return events;
    } catch (error: any) {
      logger.error(`Failed to fetch from ${sourceName}`, { error: error.message });
      metricsService.recordAPIError(sourceName, error.name || 'unknown');
      metricsService.setAPIHealth(sourceName, false);
      return [];
    }
  }
}

// Main execution
const watcher = new EarthquakeEventWatcher();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await watcher.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await watcher.stop();
  process.exit(0);
});

// Start watcher
watcher.start().catch((error) => {
  logger.error('Failed to start watcher', { error: error.message });
  process.exit(1);
});

export default watcher;

