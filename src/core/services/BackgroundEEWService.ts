/**
 * BACKGROUND EEW SERVICE - ELITE EDITION
 * 
 * Arka planda çalışan deprem erken uyarı sistemi
 * 
 * FEATURES:
 * - expo-background-fetch integration
 * - expo-task-manager persistent tasks
 * - Headless EEW polling
 * - Background P-wave detection
 * - Aggressive keep-alive strategies
 * 
 * CRITICAL: This service keeps EEW monitoring active
 * even when app is in background or killed!
 * 
 * @version 1.0.0
 * @elite true
 * @lifesaving true
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('BackgroundEEWService');

// Task names
const TASK_EEW_FETCH = 'AFETNET_EEW_BACKGROUND_FETCH';
const TASK_EEW_LOCATION = 'AFETNET_EEW_LOCATION_TASK';

// Lazy load modules
let TaskManager: typeof import('expo-task-manager') | null = null;
let BackgroundFetch: typeof import('expo-background-fetch') | null = null;
let Location: typeof import('expo-location') | null = null;

// ============================================================
// BACKGROUND EEW SERVICE
// ============================================================

class BackgroundEEWService {
    private isInitialized = false;
    private isBackgroundFetchRegistered = false;
    private appState: AppStateStatus = 'active';
    private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize background EEW service
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        logger.info('🔄 Initializing Background EEW Service...');

        try {
            // CRITICAL: Background fetch is NOT available in Expo Go
            const Constants = require('expo-constants').default;
            if (Constants.appOwnership === 'expo') {
                logger.info('⏭️ Background EEW tasks skipped (Expo Go)');
                this.isInitialized = true;
                return;
            }

            // Load modules
            TaskManager = await import('expo-task-manager');
            BackgroundFetch = await import('expo-background-fetch');
            Location = await import('expo-location');

            // Define background tasks
            await this.defineBackgroundTasks();

            // Register background fetch
            await this.registerBackgroundFetch();

            // Register location task for aggressive keep-alive
            await this.registerLocationTask();

            // Listen to app state
            this.setupAppStateListener();

            this.isInitialized = true;
            logger.info('✅ Background EEW Service initialized');
        } catch (error) {
            logger.error('Background EEW initialization failed:', error);
        }
    }

    // ==================== TASK DEFINITIONS ====================

    /**
     * Define background tasks
     */
    private async defineBackgroundTasks(): Promise<void> {
        if (!TaskManager) return;

        // CRITICAL FIX: Tasks may already be defined in index.ts (entry point).
        // Calling defineTask twice for the same name crashes iOS production builds.
        const isEEWFetchDefined = TaskManager.isTaskDefined(TASK_EEW_FETCH);
        const isEEWLocationDefined = TaskManager.isTaskDefined(TASK_EEW_LOCATION);

        // Define EEW fetch task (only if not already defined)
        if (!isEEWFetchDefined) {
            TaskManager.defineTask(TASK_EEW_FETCH, async () => {
                try {
                    logger.info('⏰ Background EEW fetch triggered');
                    await this.performBackgroundEEWCheck();
                    return BackgroundFetch?.BackgroundFetchResult.NewData;
                } catch (error) {
                    logger.error('Background fetch error:', error);
                    return BackgroundFetch?.BackgroundFetchResult.Failed;
                }
            });
        } else {
            logger.debug('EEW fetch task already defined (from index.ts)');
        }

        // Define location task (only if not already defined)
        if (!isEEWLocationDefined) {
            TaskManager.defineTask(TASK_EEW_LOCATION, async ({ data, error }) => {
                if (error) {
                    logger.error('Location task error:', error);
                    return;
                }
                if (!data || !Array.isArray((data as any).locations) || !(data as any).locations[0]?.coords) {
                    return; // Invalid data, skip
                }
                const { locations } = data as { locations: { coords: { latitude: number; longitude: number } }[] };
                if (locations.length > 0) {
                    const location = locations[0];
                    logger.debug(`📍 Background location: ${location.coords.latitude}, ${location.coords.longitude}`);
                    await this.performBackgroundEEWCheck(location.coords);
                }
            });
        } else {
            logger.debug('EEW location task already defined (from index.ts)');
        }

        logger.info('✅ Background tasks defined');
    }

    // ==================== BACKGROUND FETCH ====================

    /**
     * Register background fetch
     */
    private async registerBackgroundFetch(): Promise<void> {
        if (!BackgroundFetch || this.isBackgroundFetchRegistered) return;

        try {
            // Check status
            const status = await BackgroundFetch.getStatusAsync();

            if (status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
                status === BackgroundFetch.BackgroundFetchStatus.Denied) {
                logger.warn('Background fetch not available');
                return;
            }

            // Register task
            await BackgroundFetch.registerTaskAsync(TASK_EEW_FETCH, {
                minimumInterval: 60, // 1 minute minimum (iOS limits this)
                stopOnTerminate: false,
                startOnBoot: true,
            });

            this.isBackgroundFetchRegistered = true;
            logger.info('✅ Background fetch registered');
        } catch (error) {
            logger.error('Failed to register background fetch:', error);
        }
    }

    /**
     * Register location task for aggressive keep-alive
     */
    private async registerLocationTask(): Promise<void> {
        if (!Location || !TaskManager) return;

        try {
            // Do not trigger permission prompt during startup.
            // Background permission should be granted from feature flow first.
            const { status } = await Location.getBackgroundPermissionsAsync();
            if (status !== 'granted') {
                logger.warn('Background location permission not granted');
                return;
            }

            // Check if already registered
            const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_EEW_LOCATION);
            if (isRegistered) {
                logger.debug('Location task already registered');
                return;
            }

            // Start location updates
            await Location.startLocationUpdatesAsync(TASK_EEW_LOCATION, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 60000, // 1 minute
                distanceInterval: 1000, // 1km
                deferredUpdatesInterval: 60000,
                deferredUpdatesDistance: 1000,
                showsBackgroundLocationIndicator: false,
                foregroundService: Platform.OS === 'android' ? {
                    notificationTitle: 'AfetNet EEW Aktif',
                    notificationBody: 'Deprem erken uyarı sistemi çalışıyor',
                    notificationColor: '#4A90D9',
                } : undefined,
                pausesUpdatesAutomatically: false,
                activityType: Location.ActivityType.Other,
            });

            logger.info('✅ Background location task registered');
        } catch (error) {
            logger.error('Failed to register location task:', error);
        }
    }

    // ==================== EEW CHECK ====================

    /**
     * Perform background EEW check
     */
    private async performBackgroundEEWCheck(
        location?: { latitude: number; longitude: number }
    ): Promise<void> {
        try {
            // Fetch latest earthquakes
            const events = await this.fetchLatestEarthquakes();

            for (const event of events) {
                // Check if significant and not already notified
                if (event.magnitude >= 4.0) {
                    // Check distance if location available
                    if (location) {
                        const distance = this.calculateDistance(
                            location.latitude,
                            location.longitude,
                            event.latitude,
                            event.longitude
                        );

                        // Only alert if within 500km
                        if (distance > 500) continue;
                    }

                    // Check if already notified
                    const notified = await this.checkIfNotified(event.id);
                    if (notified) continue;

                    // Send notification
                    await this.sendBackgroundEEWNotification(event);

                    // Mark as notified
                    await this.markAsNotified(event.id);
                }
            }
        } catch (error) {
            logger.error('Background EEW check failed:', error);
        }
    }

    /**
     * Fetch latest earthquakes
     */
    private async fetchLatestEarthquakes(): Promise<Array<{
        id: string;
        magnitude: number;
        latitude: number;
        longitude: number;
        location: string;
    }>> {
        try {
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

            const formatDate = (d: Date) => d.toISOString().split('T')[0];

            const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${formatDate(fiveMinutesAgo)}%2000:00:00&end=${formatDate(now)}%2023:59:59&minmag=3&limit=10`;

            const response = await fetch(url, {
                headers: { 'User-Agent': 'AfetNet/1.0' },
            });

            const data = await response.json();

            if (!Array.isArray(data)) return [];

            return data.map((item: Record<string, unknown>) => ({
                id: String(item.eventID || item.id || `afad-${Date.now()}`),
                magnitude: Number(item.magnitude || item.mag || 0),
                latitude: Number(item.latitude || item.lat || 0),
                longitude: Number(item.longitude || item.lng || 0),
                location: String(item.location || item.region || 'Unknown'),
            }));
        } catch (error) {
            logger.error('Failed to fetch earthquakes:', error);
            return [];
        }
    }

    /**
   * Send background EEW notification
   * 
   * CRITICAL FIX: Routes through MagnitudeBasedNotificationService instead of
   * calling scheduleNotificationAsync directly. This ensures background
   * notifications pass through the centralized rate limiter and dedup system,
   * preventing spam when background fetch fires frequently.
   */
    private async sendBackgroundEEWNotification(event: {
        id: string;
        magnitude: number;
        latitude: number;
        longitude: number;
        location: string;
    }): Promise<void> {
        try {
            const { notificationCenter } = await import('./notifications/NotificationCenter');
            await notificationCenter.notify('earthquake', {
                magnitude: event.magnitude,
                location: event.location,
                timestamp: Date.now(),
                source: 'AFAD',
                latitude: event.latitude,
                longitude: event.longitude,
            }, 'BackgroundEEWService');

            logger.info(`🚨 Background EEW notification sent: M${event.magnitude}`);
        } catch (error) {
            logger.error('Failed to send background notification:', error);
        }
    }

    // ==================== HELPERS ====================

    /**
     * Calculate distance between two points (Haversine)
     */
    private calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371; // Earth radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * Mark event as notified
     * Stores timestamp so we can clean up stale entries on next check.
     */
    private async markAsNotified(eventId: string): Promise<void> {
        try {
            const { DirectStorage } = await import('../utils/storage');
            // Store with timestamp for age-based cleanup (setTimeout doesn't survive background kills)
            DirectStorage.setString(`eew_notified_${eventId}`, String(Date.now()));

            // Cleanup stale entries (older than 24h) on every mark to prevent unbounded growth
            await this.cleanupStaleNotifications();
        } catch {
            // Ignore
        }
    }

    /**
     * Check if event already notified
     * Returns true if event was notified within the last 24 hours.
     */
    private async checkIfNotified(eventId: string): Promise<boolean> {
        try {
            const { DirectStorage } = await import('../utils/storage');
            const value = DirectStorage.getString(`eew_notified_${eventId}`);
            if (!value) return false;

            // Check age — if stored as timestamp, verify it's within 24h
            const storedTime = Number(value);
            if (Number.isFinite(storedTime)) {
                const ageMs = Date.now() - storedTime;
                if (ageMs > 24 * 60 * 60 * 1000) {
                    // Stale entry — remove and return false
                    DirectStorage.delete(`eew_notified_${eventId}`);
                    return false;
                }
            }
            // Legacy 'true' values or recent timestamps both mean "notified"
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Remove notified event keys older than 24 hours.
     * Runs opportunistically on each new notification to prevent unbounded growth.
     */
    private async cleanupStaleNotifications(): Promise<void> {
        try {
            const { DirectStorage } = await import('../utils/storage');
            const allKeys = DirectStorage.getAllKeys();
            const eewKeys = allKeys.filter(k => k.startsWith('eew_notified_'));

            // Only cleanup if there are many entries (avoid unnecessary work)
            if (eewKeys.length < 20) return;

            const now = Date.now();
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
            const keysToRemove: string[] = [];

            // Check each key's age
            for (const key of eewKeys) {
                const value = DirectStorage.getString(key);
                if (!value) continue;
                const storedTime = Number(value);
                if (Number.isFinite(storedTime) && now - storedTime > TWENTY_FOUR_HOURS) {
                    keysToRemove.push(key);
                } else if (value === 'true') {
                    // Legacy format without timestamp — remove (can't determine age)
                    keysToRemove.push(key);
                }
            }

            if (keysToRemove.length > 0) {
                keysToRemove.forEach(k => DirectStorage.delete(k));
                logger.debug(`Cleaned up ${keysToRemove.length} stale notification entries`);
            }
        } catch {
            // Non-critical
        }
    }

    /**
     * Setup app state listener
     */
    private setupAppStateListener(): void {
        this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
            if (this.appState.match(/inactive|background/) && nextState === 'active') {
                // App came to foreground - perform immediate check
                this.performBackgroundEEWCheck();
            }
            this.appState = nextState;
        });
    }

    // ==================== STATUS ====================

    /**
     * Get background fetch status
     */
    async getStatus(): Promise<{
        isInitialized: boolean;
        isBackgroundFetchRegistered: boolean;
        backgroundFetchStatus: string;
        isLocationTaskRegistered: boolean;
    }> {
        let bgStatus = 'unknown';
        let locationTaskRegistered = false;

        try {
            if (BackgroundFetch) {
                const status = await BackgroundFetch.getStatusAsync();
                if (status !== null && status !== undefined) {
                    bgStatus = BackgroundFetch.BackgroundFetchStatus[status] || 'unknown';
                }
            }
        } catch {
            bgStatus = 'error';
        }

        try {
            if (TaskManager) {
                locationTaskRegistered = await TaskManager.isTaskRegisteredAsync(TASK_EEW_LOCATION);
            }
        } catch {
            // Ignore
        }

        return {
            isInitialized: this.isInitialized,
            isBackgroundFetchRegistered: this.isBackgroundFetchRegistered,
            backgroundFetchStatus: bgStatus,
            isLocationTaskRegistered: locationTaskRegistered,
        };
    }

    /**
     * Unregister all tasks
     */
    async cleanup(): Promise<void> {
        try {
            if (this.appStateSubscription) {
                this.appStateSubscription.remove();
                this.appStateSubscription = null;
            }

            if (BackgroundFetch) {
                await BackgroundFetch.unregisterTaskAsync(TASK_EEW_FETCH);
            }
            if (Location) {
                await Location.stopLocationUpdatesAsync(TASK_EEW_LOCATION);
            }

            this.isInitialized = false;
            this.isBackgroundFetchRegistered = false;
            logger.info('Background tasks unregistered');
        } catch (error) {
            logger.error('Cleanup error:', error);
        }
    }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const backgroundEEWService = new BackgroundEEWService();
