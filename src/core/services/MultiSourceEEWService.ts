/**
 * MULTI-SOURCE EEW DATA SERVICE - ELITE EDITION
 * 
 * Birden fazla kaynaktan deprem verisi toplayan ve birleştiren servis
 * 
 * SOURCES:
 * - AFAD (Türkiye - Primary)
 * - Kandilli Observatory (Türkiye - Secondary)
 * - USGS (Global)
 * - EMSC (Europe)
 * 
 * FEATURES:
 * - Multi-source data fusion
 * - Source prioritization
 * - Duplicate detection
 * - Cross-validation
 * - Real-time streaming
 * 
 * @version 1.0.0
 * @elite true
 */

import { createLogger } from '../utils/logger';
import { useEEWHistoryStore, EEWHistoryEvent } from '../stores/eewHistoryStore';

const logger = createLogger('MultiSourceEEWService');

// ============================================================
// TYPES
// ============================================================

export interface EarthquakeEvent {
    id: string;
    source: 'AFAD' | 'KANDILLI' | 'USGS' | 'EMSC';

    // Location
    latitude: number;
    longitude: number;
    depth: number;

    // Magnitude
    magnitude: number;
    magnitudeType: 'ML' | 'Mw' | 'Mb' | 'Ms' | 'unknown';

    // Time
    originTime: number; // Unix timestamp (ms)

    // Location description
    location: string;
    region?: string;
    country?: string;

    // Quality
    quality?: 'reviewed' | 'automatic' | 'preliminary';
    rms?: number; // Root mean square residual
    gap?: number; // Azimuthal gap

    // Raw data
    rawData?: any;
}

export interface DataSourceConfig {
    name: string;
    enabled: boolean;
    priority: number; // 1 = highest
    apiUrl: string;
    pollInterval: number; // ms
    minMagnitude: number;
    region?: 'turkey' | 'global' | 'europe';
}

// ============================================================
// DATA SOURCE CONFIGURATIONS
// ============================================================

const DATA_SOURCES: Record<string, DataSourceConfig> = {
    AFAD: {
        name: 'AFAD',
        enabled: true,
        priority: 1,
        apiUrl: 'https://deprem.afad.gov.tr/apiv2/event/filter',
        // CRITICAL FIX: 5s polling was too aggressive — risks IP-blocking by AFAD
        // and doubles requests since EEWService also polls AFAD independently.
        // 30s is sufficient for earthquake detection (events persist for hours).
        pollInterval: 30000,
        minMagnitude: 1.0,
        region: 'turkey',
    },
    KANDILLI: {
        name: 'Kandilli Observatory',
        enabled: true,
        priority: 2,
        apiUrl: 'https://www.koeri.boun.edu.tr/scripts/lst0.asp', // HTML scraping needed
        pollInterval: 30000, // 30 seconds — balanced polling for secondary Turkish source
        minMagnitude: 1.0,
        region: 'turkey',
    },
    USGS: {
        name: 'USGS',
        enabled: true,
        priority: 3,
        apiUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
        pollInterval: 30000, // 30 seconds for global coverage
        minMagnitude: 4.0, // Only significant earthquakes globally
        region: 'global',
    },
    EMSC: {
        name: 'EMSC',
        enabled: true, // Activated for European coverage
        priority: 4,
        apiUrl: 'https://www.seismicportal.eu/fdsnws/event/1/query',
        pollInterval: 120000, // 120s — EMSC primary via WebSocket (RealtimeEarthquakeMonitor), this is fallback only
        minMagnitude: 4.0,
        region: 'europe',
    },
};

// ============================================================
// MULTI-SOURCE EEW SERVICE
// ============================================================

class MultiSourceEEWService {
    private sourceConfigs = DATA_SOURCES;
    private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
    private seenEventIds = new Set<string>();
    private onEventCallbacks: ((event: EarthquakeEvent) => void)[] = [];
    private isRunning = false;
    // CRITICAL: Track first poll per source to avoid notification flood on startup
    private isFirstPollCompleted: Map<string, boolean> = new Map();

    // ==================== LIFECYCLE ====================

    /**
     * Start polling all enabled sources
     */
    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info('🌐 Starting Multi-Source EEW Service');

        Object.entries(this.sourceConfigs).forEach(([key, config]) => {
            if (config.enabled) {
                this.startPolling(key, config);
            }
        });
    }

    /**
     * Stop all polling
     */
    stop(): void {
        if (!this.isRunning) return;
        this.isRunning = false;

        logger.info('Stopping Multi-Source EEW Service');

        this.pollingIntervals.forEach((interval, key) => {
            clearInterval(interval);
            logger.debug(`Stopped polling ${key}`);
        });
        this.pollingIntervals.clear();

        // CRITICAL FIX: Reset first-poll flag so re-start suppresses the initial data load.
        // But PRESERVE seenEventIds — clearing it causes duplicate notifications for events
        // that were already notified in the previous cycle. On restart, the first poll will
        // re-fetch the same 10-minute window; without seenEventIds, all events appear "new".
        this.isFirstPollCompleted.clear();
        // this.seenEventIds is intentionally NOT cleared — prevents duplicate notifications on restart
        // NOTE: Do NOT clear onEventCallbacks here. Subscribers (init.ts Phase B) register
        // once and expect their callback to persist across stop/start cycles. Clearing here
        // silently drops all subscriptions, so after restart no callbacks fire.
    }

    /**
     * Subscribe to events
     */
    onEvent(callback: (event: EarthquakeEvent) => void): () => void {
        this.onEventCallbacks.push(callback);
        return () => {
            const index = this.onEventCallbacks.indexOf(callback);
            if (index > -1) this.onEventCallbacks.splice(index, 1);
        };
    }

    // ==================== POLLING ====================

    private startPolling(sourceKey: string, config: DataSourceConfig): void {
        logger.info(`📡 Starting polling: ${config.name} (every ${config.pollInterval / 1000}s)`);

        // Initial fetch
        this.fetchFromSource(sourceKey, config).catch(e =>
            logger.debug(`Initial fetch failed for ${sourceKey}:`, e)
        );

        // Start interval
        const interval = setInterval(() => {
            this.fetchFromSource(sourceKey, config).catch(e =>
                logger.debug(`Polling failed for ${sourceKey}:`, e)
            );
        }, config.pollInterval);

        this.pollingIntervals.set(sourceKey, interval);
    }

    private async fetchJsonWithTimeout(
        url: string,
        timeoutMs: number,
        headers?: Record<string, string>,
    ): Promise<any | null> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    ...(headers || {}),
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                return null;
            }
            return await response.json();
        } catch (error) {
            if (__DEV__ && error instanceof Error && error.name !== 'AbortError') {
                logger.debug('Multi-source fetch failed:', error.message);
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async fetchFromSource(sourceKey: string, config: DataSourceConfig): Promise<void> {
        // Guard: don't process results if service was stopped while fetch was in-flight
        if (!this.isRunning) return;
        try {
            let events: EarthquakeEvent[] = [];

            switch (sourceKey) {
                case 'AFAD':
                    events = await this.fetchAFAD(config);
                    break;
                case 'KANDILLI':
                    events = await this.fetchKandilli(config);
                    break;
                case 'USGS':
                    events = await this.fetchUSGS(config);
                    break;
                case 'EMSC':
                    events = await this.fetchEMSC(config);
                    break;
            }

            // Guard: re-check after await — service may have been stopped during fetch
            if (!this.isRunning) return;

            // Process new events
            const ONE_HOUR = 60 * 60 * 1000;
            for (const event of events) {
                // CRITICAL: Skip earthquakes older than 1 hour to prevent old notification flood
                if (Date.now() - event.originTime > ONE_HOUR) continue;

                const eventKey = this.getEventKey(event);
                if (!this.seenEventIds.has(eventKey)) {
                    this.seenEventIds.add(eventKey);
                    // CRITICAL: Only notify after first poll completes per source
                    // First poll silently indexes existing earthquakes
                    if (this.isFirstPollCompleted.get(sourceKey)) {
                        this.processNewEvent(event);
                    }
                }
            }

            // Mark first poll as complete for this source
            if (!this.isFirstPollCompleted.get(sourceKey)) {
                this.isFirstPollCompleted.set(sourceKey, true);
                logger.info(`📡 ${sourceKey}: Initial poll complete, ${events.length} events indexed silently`);
            }

            // Cleanup old event IDs (keep last 1000)
            if (this.seenEventIds.size > 1000) {
                const toDelete = Array.from(this.seenEventIds).slice(0, 500);
                toDelete.forEach(id => this.seenEventIds.delete(id));
            }

        } catch (error) {
            // Silent fail - expected for network issues
        }
    }

    // ==================== DATA FETCHERS ====================

    /**
     * Fetch from AFAD API
     */
    private async fetchAFAD(config: DataSourceConfig): Promise<EarthquakeEvent[]> {
        // OOM prevention: Only fetch last 10 minutes, limit to 10 results
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const startDate = tenMinutesAgo.toISOString();
        const endDate = new Date().toISOString();

        const url = `${config.apiUrl}?start=${startDate}&end=${endDate}&minmag=${config.minMagnitude}&limit=10&orderby=timedesc`;
        const data = await this.fetchJsonWithTimeout(url, 10000);
        if (!data) return [];
        const events: EarthquakeEvent[] = [];

        const items = Array.isArray(data) ? data.slice(0, 10) : [];
        for (const item of items) {
            try {
                events.push({
                    id: `afad-${item.eventID || item.eventId}`,
                    source: 'AFAD',
                    latitude: parseFloat(item.geojson?.coordinates?.[1] || item.latitude || '0'),
                    longitude: parseFloat(item.geojson?.coordinates?.[0] || item.longitude || '0'),
                    depth: parseFloat(item.depth || '10'),
                    magnitude: parseFloat(item.mag || item.magnitude || '0'),
                    magnitudeType: (item.magType || 'ML') as any,
                    originTime: new Date(item.eventDate || item.date).getTime(),
                    location: [item.location, item.ilce, item.sehir].filter(Boolean).join(', ') || 'Türkiye',
                    region: 'Türkiye',
                    country: 'TR',
                    quality: 'reviewed',
                    rawData: item,
                });
            } catch (e) {
                // Skip invalid items
            }
        }

        return events;
    }

    /**
     * Fetch from Kandilli Observatory
     * Note: Kandilli uses HTML, this is a simplified JSON API fallback
     */
    private async fetchKandilli(config: DataSourceConfig): Promise<EarthquakeEvent[]> {
        // Kandilli doesn't have a public JSON API
        // We use a community-maintained proxy or fallback to AFAD
        try {
            // Try community proxy
            const data = await this.fetchJsonWithTimeout(
                'https://api.orhanaydogdu.com.tr/deprem/kandilli/live',
                10000,
            );
            if (!data) return [];
            const events: EarthquakeEvent[] = [];

            // OOM prevention: limit to 10 most recent results
            const items = (data?.result || []).slice(0, 10);
            for (const item of items) {
                try {
                    const mag = parseFloat(item.mag || item.ml || '0');
                    if (mag < config.minMagnitude) continue;

                    events.push({
                        id: `kandilli-${item.earthquake_id || `${Date.now()}-${Math.random().toString(36).substr(2, 14)}`}`,
                        source: 'KANDILLI',
                        latitude: parseFloat(item.lat || '0'),
                        longitude: parseFloat(item.lng || item.lon || '0'),
                        depth: parseFloat(item.depth || '10'),
                        magnitude: mag,
                        magnitudeType: 'ML',
                        originTime: new Date(item.date || item.date_time).getTime(),
                        location: item.title || item.lokasyon || 'Türkiye',
                        region: 'Türkiye',
                        country: 'TR',
                        quality: 'automatic',
                        rawData: item,
                    });
                } catch (e) {
                    // Skip invalid items
                }
            }

            return events;
        } catch (error) {
            // Kandilli API not available, return empty
            return [];
        }
    }

    /**
     * Fetch from USGS API
     */
    private async fetchUSGS(config: DataSourceConfig): Promise<EarthquakeEvent[]> {
        // OOM prevention: Only fetch last 10 minutes, limit to 10 results
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const url = `${config.apiUrl}?format=geojson&starttime=${tenMinutesAgo.toISOString()}&minmagnitude=${config.minMagnitude}&limit=10&orderby=time`;
        const data = await this.fetchJsonWithTimeout(url, 15000);
        if (!data) return [];
        const events: EarthquakeEvent[] = [];

        const features = (data?.features || []).slice(0, 10);
        for (const feature of features) {
            try {
                const props = feature.properties || {};
                const coords = feature.geometry?.coordinates || [];

                events.push({
                    id: `usgs-${feature.id || props.code}`,
                    source: 'USGS',
                    latitude: coords[1] || 0,
                    longitude: coords[0] || 0,
                    depth: coords[2] || 10,
                    magnitude: parseFloat(props.mag || '0'),
                    magnitudeType: (props.magType || 'unknown') as any,
                    originTime: props.time || Date.now(),
                    location: props.place || 'Unknown',
                    region: props.place?.split(', ').pop() || 'Global',
                    quality: props.status === 'reviewed' ? 'reviewed' : 'automatic',
                    rms: props.rms,
                    gap: props.gap,
                    rawData: feature,
                });
            } catch (e) {
                // Skip invalid items
            }
        }

        return events;
    }

    /**
     * Fetch from EMSC API
     */
    private async fetchEMSC(config: DataSourceConfig): Promise<EarthquakeEvent[]> {
        // OOM prevention: Only fetch last 10 minutes, limit to 10 results
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const url = `${config.apiUrl}?format=json&start=${tenMinutesAgo.toISOString()}&minmag=${config.minMagnitude}&limit=10&orderby=time`;
        const data = await this.fetchJsonWithTimeout(url, 15000);
        if (!data) return [];
        const events: EarthquakeEvent[] = [];

        const features = (data?.features || []).slice(0, 10);
        for (const feature of features) {
            try {
                const props = feature.properties || {};
                const coords = feature.geometry?.coordinates || [];

                events.push({
                    id: `emsc-${props.source_id || feature.id}`,
                    source: 'EMSC',
                    latitude: coords[1] || 0,
                    longitude: coords[0] || 0,
                    depth: coords[2] || 10,
                    magnitude: parseFloat(props.mag || '0'),
                    magnitudeType: (props.magtype || 'unknown') as any,
                    originTime: new Date(props.time).getTime(),
                    location: props.flynn_region || 'Europe',
                    region: 'Europe',
                    quality: 'automatic',
                    rawData: feature,
                });
            } catch (e) {
                // Skip invalid items
            }
        }

        return events;
    }

    // ==================== EVENT PROCESSING ====================

    private getEventKey(event: EarthquakeEvent): string {
        // Create unique key based on location + time (within 60 seconds)
        const timeWindow = Math.floor(event.originTime / 60000);
        const latRound = Math.round(event.latitude * 10) / 10;
        const lonRound = Math.round(event.longitude * 10) / 10;
        return `${latRound}-${lonRound}-${timeWindow}`;
    }

    private async processNewEvent(event: EarthquakeEvent): Promise<void> {
        // ELITE: Only log significant earthquakes at info level to prevent log spam
        if (event.magnitude >= 3.0) {
            logger.info(`📍 New earthquake from ${event.source}: M${event.magnitude.toFixed(1)} ${event.location}`);
        }

        // Notify callbacks — CRITICAL: iterate a snapshot copy to prevent skipping
        // if a callback removes itself during iteration (same pattern as EEWService)
        for (const callback of [...this.onEventCallbacks]) {
            try {
                callback(event);
            } catch (error) {
                logger.error('Event callback error:', error);
            }
        }

        // 🚨 CRITICAL: Trigger EEW notification for significant earthquakes (M4.5+)
        // ELITE: Distance-filtered with FAIL-SAFE — Türkiye bounding box fallback
        let wasNotified = false;
        if (event.magnitude >= 4.5) {
            // ELITE: Magnitude-scaled distance threshold (FAIL-SAFE: Türkiye bbox if no location)
            let shouldNotify = true;
            let distanceKm: number | null = null;
            try {
                const { locationService } = await import('./LocationService');
                const userLoc = locationService.getCurrentLocation();
                if (userLoc && userLoc.latitude !== 0 && userLoc.longitude !== 0) {
                    const { calculateDistance } = await import('../utils/locationUtils');
                    distanceKm = calculateDistance(userLoc.latitude, userLoc.longitude, event.latitude, event.longitude);
                    // ELITE: Magnitude-scaled maximum notification distance
                    // M4.5-4.9: 200km (locally felt), M5.0-5.9: 500km (regional),
                    // M6.0-6.9: 1000km (major), M7.0+: 2000km (catastrophic)
                    const maxDistKm = event.magnitude >= 7.0 ? 2000
                        : event.magnitude >= 6.0 ? 1000
                            : event.magnitude >= 5.0 ? 500
                                : 200;
                    if (distanceKm > maxDistKm) {
                        shouldNotify = false;
                        logger.info(`📍 EEW distance filter: M${event.magnitude.toFixed(1)} is ${distanceKm.toFixed(0)}km away (max: ${maxDistKm}km) — skipping notification`);
                    }
                } else {
                    // FAIL-SAFE: Konum yok — Türkiye bounding box kontrolü
                    const isInTurkey = event.latitude >= 35.8 && event.latitude <= 42.1
                        && event.longitude >= 25.6 && event.longitude <= 44.8;
                    if (!isInTurkey && event.magnitude < 6.5) {
                        shouldNotify = false;
                        logger.info(`📍 EEW fail-safe: No user location, non-Turkey M${event.magnitude.toFixed(1)} at [${event.latitude.toFixed(1)}, ${event.longitude.toFixed(1)}] — skipping`);
                    } else {
                        logger.info(`📍 EEW fail-safe: No user location, ${isInTurkey ? 'Turkey quake' : 'M6.5+ global'} — notifying for safety`);
                    }
                }
            } catch {
                // Fail-safe: hata durumunda Türkiye depremleri bildir
                const isInTurkey = event.latitude >= 35.8 && event.latitude <= 42.1
                    && event.longitude >= 25.6 && event.longitude <= 44.8;
                if (!isInTurkey && event.magnitude < 6.5) {
                    shouldNotify = false;
                }
            }

            if (shouldNotify) {
                try {
                    const { notificationCenter } = await import('./notifications/NotificationCenter');
                    await notificationCenter.notify('earthquake', {
                        magnitude: event.magnitude,
                        location: event.location,
                        isEEW: true,
                        timestamp: event.originTime,
                        depth: event.depth,
                        source: event.source,
                        latitude: event.latitude,
                        longitude: event.longitude,
                    }, 'MultiSourceEEWService');
                    wasNotified = true;
                    logger.info(`🚨 EEW NOTIFICATION TRIGGERED: M${event.magnitude.toFixed(1)} ${event.location} from ${event.source}`);

                    // CRITICAL FIX: Emergency mode is NOW handled internally by
                    // MagnitudeBasedNotificationService.triggerEmergencyMode() for M5.0+.
                    // Do NOT call activateEmergencyMode here — it was causing double-triggering:
                    //   showMagnitudeBasedNotification → triggerEmergencyMode (internal)
                    //   + activateEmergencyMode here (DUPLICATE!)
                    // Emergency mode activation for significant earthquakes is fully automatic.
                } catch (notifError) {
                    logger.error('EEW notification failed:', notifError);
                }
            }
        }

        // ELITE: Only add significant earthquakes (M3.0+) to history store
        // This prevents AsyncStorage I/O storm from 100+ micro-earthquakes per cycle → OOM fix
        if (event.magnitude >= 3.0) {
            const historyEvent: Omit<EEWHistoryEvent, 'id'> = {
                timestamp: Date.now(),
                magnitude: event.magnitude,
                location: event.location,
                depth: event.depth,
                latitude: event.latitude,
                longitude: event.longitude,
                warningTime: 0, // Will be calculated if EEW triggers
                estimatedIntensity: 0,
                epicentralDistance: 0,
                source: event.source,
                wasNotified,
                confidence: event.quality === 'reviewed' ? 95 : 80,
                certainty: event.magnitude >= 5 ? 'high' : event.magnitude >= 4 ? 'medium' : 'low',
            };

            useEEWHistoryStore.getState().addEvent(historyEvent);
        }
    }

    // ==================== UTILITIES ====================

    /**
     * Get source status
     */
    getSourceStatus(): Record<string, { enabled: boolean; polling: boolean; priority: number }> {
        const status: Record<string, { enabled: boolean; polling: boolean; priority: number }> = {};

        Object.entries(this.sourceConfigs).forEach(([key, config]) => {
            status[key] = {
                enabled: config.enabled,
                polling: this.pollingIntervals.has(key),
                priority: config.priority,
            };
        });

        return status;
    }

    /**
     * Enable/disable a source
     */
    setSourceEnabled(sourceKey: string, enabled: boolean): void {
        const config = this.sourceConfigs[sourceKey];
        if (!config) return;

        config.enabled = enabled;

        if (enabled && this.isRunning && !this.pollingIntervals.has(sourceKey)) {
            this.startPolling(sourceKey, config);
        } else if (!enabled && this.pollingIntervals.has(sourceKey)) {
            clearInterval(this.pollingIntervals.get(sourceKey)!);
            this.pollingIntervals.delete(sourceKey);
        }

        logger.info(`Source ${sourceKey} ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Export singleton
export const multiSourceEEWService = new MultiSourceEEWService();
