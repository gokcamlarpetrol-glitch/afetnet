/**
 * Earthquake Event Watcher Client
 * Connects to the Earthquake Event Watcher microservice
 * Receives real-time earthquake events via WebSocket or HTTP polling
 */

import { createLogger } from '../utils/logger';
import { useEarthquakeStore, Earthquake } from '../stores/earthquakeStore';
import { notificationService } from './NotificationService';
import { locationService } from './LocationService';

const logger = createLogger('EarthquakeEventWatcherClient');

interface WatcherEvent {
  id: string;
  timestamp: number;
  magnitude: number;
  latitude: number;
  longitude: number;
  depthKm: number | null;
  source: 'USGS' | 'Ambee' | 'Xweather' | 'Zyla';
  location?: string;
  detectedAt: number;
  latencyMs?: number;
  priorityScore: number;
  duplicateSources: string[];
}

export class EarthquakeEventWatcherClient {
  private ws: WebSocket | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private lastEventId: string | null = null;
  // CRITICAL: Don't use localhost in production - use actual microservice URL
  // For now, disable WebSocket and use direct AFAD polling (faster and more reliable)
  private readonly WATCHER_URL = process.env.EXPO_PUBLIC_WATCHER_URL || ''; // Empty = disabled
  private readonly POLL_INTERVAL_MS = 3000; // Fallback polling - same as EarthquakeService

  async start(): Promise<void> {
    logger.info('Starting Earthquake Event Watcher Client');

    // CRITICAL: Skip WebSocket if URL not configured (microservice not deployed)
    // Use direct AFAD polling instead (faster and more reliable)
    if (!this.WATCHER_URL || this.WATCHER_URL.includes('localhost')) {
      if (__DEV__) {
        logger.info('⚠️ WebSocket URL not configured - using direct AFAD polling (EarthquakeService handles this)');
      }
      // Don't start polling - EarthquakeService already handles AFAD polling
      return;
    }

    // Try WebSocket first (lowest latency) - only if URL is configured
    try {
      await this.connectWebSocket();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn('WebSocket connection failed, falling back to HTTP polling', {
        error: errMsg,
      });
      this.startPolling();
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping Earthquake Event Watcher Client');

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isConnected = false;
  }

  /**
   * Connect via WebSocket for real-time events
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // WebSocket endpoint from microservice
        const wsUrl = this.WATCHER_URL.replace('http', 'ws') + '/events';
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          logger.info('WebSocket connected to Earthquake Event Watcher');
          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            const watcherEvent: WatcherEvent = JSON.parse(event.data);
            await this.handleEvent(watcherEvent);
          } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.error('Failed to parse WebSocket message', { error: errMsg });
          }
        };

        this.ws.onerror = (error) => {
          logger.error('WebSocket error', { error });
          reject(error);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          logger.warn('WebSocket closed, attempting reconnect...');
          // Attempt reconnect after delay
          setTimeout(() => {
            this.connectWebSocket().catch(() => {
              this.startPolling();
            });
          }, 5000);
        };
      } catch (error: unknown) {
        reject(error);
      }
    });
  }

  /**
   * Fallback: Poll HTTP endpoint
   */
  private startPolling(): void {
    logger.info('Starting HTTP polling fallback');

    this.pollInterval = setInterval(async () => {
      try {
        await this.pollEvents();
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('Polling error', { error: errMsg });
      }
    }, this.POLL_INTERVAL_MS);

    // Initial poll
    this.pollEvents();
  }

  /**
   * Poll for new events via HTTP
   */
  private async pollEvents(): Promise<void> {
    try {
      const url = `${this.WATCHER_URL}/api/events/latest`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const events: WatcherEvent[] = await response.json();

      for (const event of events) {
        // Skip if already processed
        if (event.id === this.lastEventId) {
          continue;
        }

        await this.handleEvent(event);
        this.lastEventId = event.id;
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.debug('Poll failed', { error: errMsg });
    }
  }

  /**
   * Handle incoming earthquake event
   */
  private async handleEvent(event: WatcherEvent): Promise<void> {
    try {
      logger.info('Received earthquake event', {
        id: event.id,
        source: event.source,
        magnitude: event.magnitude,
        location: event.location,
        latencyMs: event.latencyMs,
      });

      // Convert to app's Earthquake format
      const earthquake: Earthquake = {
        id: event.id,
        magnitude: event.magnitude,
        location: event.location || 'Bilinmeyen Konum',
        depth: event.depthKm || 10,
        time: event.timestamp,
        latitude: event.latitude,
        longitude: event.longitude,
        source: event.source === 'USGS' ? 'USGS' : 'KANDILLI', // Map to app sources
      };

      // Add to store
      const store = useEarthquakeStore.getState();
      const existing = store.items.find((eq) => eq.id === earthquake.id);
      if (!existing) {
        // Add earthquake to store by updating items array
        const updatedItems = [...store.items, earthquake];
        store.setItems(updatedItems);
      }

      // Check if user is within radius
      const userLocation = locationService.getCurrentLocation();
      if (userLocation) {
        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          earthquake.latitude,
          earthquake.longitude,
        );

        const radiusKm = 50; // Default radius
        if (distance <= radiusKm) {
          // Show notification using existing NotificationService API
          await notificationService.showEarthquakeNotification(
            earthquake.magnitude,
            earthquake.location,
          );

          logger.info('Earthquake notification sent', {
            distanceKm: distance.toFixed(1),
            magnitude: earthquake.magnitude,
            source: event.source,
            latencyMs: event.latencyMs,
          });
        }
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to handle event', { error: errMsg });
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  isActive(): boolean {
    return this.isConnected || this.pollInterval !== null;
  }
}

export const earthquakeEventWatcherClient = new EarthquakeEventWatcherClient();

