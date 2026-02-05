/**
 * WIDGET DATA BRIDGE SERVICE - ELITE EDITION
 * 
 * React Native ↔ iOS Widget veri köprüsü
 * UserDefaults (App Groups) üzerinden veri paylaşımı
 * 
 * FEATURES:
 * - Son deprem verisi widget'a aktarma
 * - Aile durumu senkronizasyonu
 * - Offline cache desteği
 * - Widget yenileme tetikleme
 * 
 * @version 1.0.0
 * @elite true
 */

import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('WidgetDataBridgeService');

// ============================================================
// TYPES
// ============================================================

export interface WidgetEarthquakeData {
    magnitude: number;
    location: string;
    depth: number;
    time: string; // ISO string
    distance?: number;
    isOffline: boolean;
}

export interface WidgetData {
    latestEarthquake: WidgetEarthquakeData | null;
    familySafeCount: number;
    lastUpdate: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEYS = {
    WIDGET_DATA: '@widget_data',
    LAST_EARTHQUAKE: '@last_earthquake_for_widget',
    FAMILY_SAFE_COUNT: '@family_safe_count_for_widget',
} as const;

// App Group identifier (must match iOS configuration)
const APP_GROUP_ID = 'group.com.afetnet.widget';

// ============================================================
// WIDGET DATA BRIDGE SERVICE CLASS
// ============================================================

class WidgetDataBridgeService {
    private isInitialized = false;
    private cachedData: WidgetData | null = null;

    // ==================== INITIALIZATION ====================

    /**
     * Initialize widget data bridge
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            logger.info('📱 Initializing WidgetDataBridgeService...');

            // Load cached data
            await this.loadCachedData();

            this.isInitialized = true;
            logger.info('✅ WidgetDataBridgeService initialized');
        } catch (error) {
            logger.error('❌ WidgetDataBridgeService initialization failed:', error);
        }
    }

    // ==================== EARTHQUAKE DATA ====================

    /**
     * Update widget with latest earthquake data
     * Call this whenever new earthquake data is received
     */
    async updateLatestEarthquake(earthquake: {
        magnitude: number;
        location: string;
        depth: number;
        time: Date;
        distance?: number;
    }): Promise<void> {
        try {
            const widgetData: WidgetEarthquakeData = {
                magnitude: earthquake.magnitude,
                location: earthquake.location,
                depth: earthquake.depth,
                time: earthquake.time.toISOString(),
                distance: earthquake.distance,
                isOffline: false,
            };

            // Save to AsyncStorage (fallback)
            await AsyncStorage.setItem(
                STORAGE_KEYS.LAST_EARTHQUAKE,
                JSON.stringify(widgetData)
            );

            // Save to shared UserDefaults (iOS Widget)
            if (Platform.OS === 'ios') {
                await this.saveToSharedDefaults('latestEarthquake', widgetData);
                await this.refreshWidget();
            }

            // Update cached data
            if (this.cachedData) {
                this.cachedData.latestEarthquake = widgetData;
                this.cachedData.lastUpdate = new Date().toISOString();
            }

            logger.debug('Widget earthquake data updated', { magnitude: earthquake.magnitude });
        } catch (error) {
            logger.error('Failed to update widget earthquake:', error);
        }
    }

    // ==================== FAMILY STATUS ====================

    /**
     * Update widget with family safe count
     */
    async updateFamilySafeCount(count: number): Promise<void> {
        try {
            // Save to AsyncStorage (fallback)
            await AsyncStorage.setItem(
                STORAGE_KEYS.FAMILY_SAFE_COUNT,
                count.toString()
            );

            // Save to shared UserDefaults (iOS Widget)
            if (Platform.OS === 'ios') {
                await this.saveToSharedDefaults('familySafeCount', count);
                await this.refreshWidget();
            }

            // Update cached data
            if (this.cachedData) {
                this.cachedData.familySafeCount = count;
            }

            logger.debug('Widget family safe count updated', { count });
        } catch (error) {
            logger.error('Failed to update widget family count:', error);
        }
    }

    // ==================== SHARED DEFAULTS (iOS) ====================

    /**
     * Save data to shared UserDefaults for iOS Widget
     */
    private async saveToSharedDefaults(key: string, value: unknown): Promise<void> {
        if (Platform.OS !== 'ios') return;

        try {
            // Use native module if available
            const SharedGroupPreferences = NativeModules.SharedGroupPreferences;

            if (SharedGroupPreferences) {
                const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
                await SharedGroupPreferences.setItem(key, jsonValue, APP_GROUP_ID);
            } else {
                // Fallback: Save to AsyncStorage with special prefix
                await AsyncStorage.setItem(
                    `${APP_GROUP_ID}:${key}`,
                    typeof value === 'string' ? value : JSON.stringify(value)
                );
            }
        } catch (error) {
            logger.error('Failed to save to shared defaults:', error);
        }
    }

    /**
     * Refresh widget timeline (iOS)
     */
    private async refreshWidget(): Promise<void> {
        if (Platform.OS !== 'ios') return;

        try {
            const WidgetKit = NativeModules.WidgetKit;

            if (WidgetKit?.reloadAllTimelines) {
                await WidgetKit.reloadAllTimelines();
                logger.debug('Widget timeline refreshed');
            }
        } catch (error) {
            logger.error('Failed to refresh widget:', error);
        }
    }

    // ==================== CACHE MANAGEMENT ====================

    /**
     * Load cached data from storage
     */
    private async loadCachedData(): Promise<void> {
        try {
            const earthquakeData = await AsyncStorage.getItem(STORAGE_KEYS.LAST_EARTHQUAKE);
            const familyCount = await AsyncStorage.getItem(STORAGE_KEYS.FAMILY_SAFE_COUNT);

            this.cachedData = {
                latestEarthquake: earthquakeData ? JSON.parse(earthquakeData) : null,
                familySafeCount: familyCount ? parseInt(familyCount, 10) : 0,
                lastUpdate: new Date().toISOString(),
            };
        } catch (error) {
            logger.error('Failed to load cached data:', error);
            this.cachedData = {
                latestEarthquake: null,
                familySafeCount: 0,
                lastUpdate: new Date().toISOString(),
            };
        }
    }

    /**
     * Get current widget data
     */
    getWidgetData(): WidgetData | null {
        return this.cachedData;
    }

    /**
     * Clear all widget data
     */
    async clearWidgetData(): Promise<void> {
        try {
            await AsyncStorage.multiRemove([
                STORAGE_KEYS.LAST_EARTHQUAKE,
                STORAGE_KEYS.FAMILY_SAFE_COUNT,
                STORAGE_KEYS.WIDGET_DATA,
            ]);

            if (Platform.OS === 'ios') {
                await this.refreshWidget();
            }

            this.cachedData = null;
            logger.info('Widget data cleared');
        } catch (error) {
            logger.error('Failed to clear widget data:', error);
        }
    }
}

// Export singleton instance
export const widgetDataBridgeService = new WidgetDataBridgeService();
