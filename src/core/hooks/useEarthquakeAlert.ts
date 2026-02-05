/**
 * EARTHQUAKE ALERT HOOK - ELITE EDITION
 * Premium, life-saving earthquake notification system
 * 
 * ELITE FEATURES:
 * - Real-time earthquake monitoring
 * - Location-based alert filtering
 * - Magnitude threshold settings
 * - Proximity-based priority alerts
 * - Silent hours bypass for critical alerts
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Vibration, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEarthquakeStore } from '../stores/earthquakeStore';
import { ultraFastEEWNotification } from '../services/UltraFastEEWNotification';
import { firebaseAnalyticsService } from '../services/FirebaseAnalyticsService';
import { createLogger } from '../utils/logger';

const logger = createLogger('EarthquakeAlertHook');

// ELITE: Alert settings storage key
const ALERT_SETTINGS_KEY = '@afetnet_earthquake_alert_settings';

// ELITE: Alert settings interface
export interface EarthquakeAlertSettings {
    enabled: boolean;
    minMagnitude: number;          // Minimum magnitude to alert (default: 4.0)
    maxDistanceKm: number;         // Maximum distance for alerts (default: 500km)
    criticalMagnitude: number;     // Magnitude that bypasses DND (default: 5.5)
    silentHoursEnabled: boolean;   // Enable quiet hours
    silentHoursStart: number;      // Start hour (0-23)
    silentHoursEnd: number;        // End hour (0-23)
    vibrationEnabled: boolean;
    soundEnabled: boolean;
    ttsEnabled: boolean;           // Text-to-speech for critical alerts
}

// ELITE: Default settings (conservative but life-saving)
const DEFAULT_SETTINGS: EarthquakeAlertSettings = {
    enabled: true,
    minMagnitude: 4.0,
    maxDistanceKm: 500,
    criticalMagnitude: 5.5,
    silentHoursEnabled: false,
    silentHoursStart: 23,
    silentHoursEnd: 7,
    vibrationEnabled: true,
    soundEnabled: true,
    ttsEnabled: true,
};

// ELITE: Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// ELITE: Check if current time is within silent hours
const isWithinSilentHours = (settings: EarthquakeAlertSettings): boolean => {
    if (!settings.silentHoursEnabled) return false;

    const now = new Date();
    const currentHour = now.getHours();

    if (settings.silentHoursStart < settings.silentHoursEnd) {
        return currentHour >= settings.silentHoursStart && currentHour < settings.silentHoursEnd;
    } else {
        // Handles overnight silent hours (e.g., 23:00 - 07:00)
        return currentHour >= settings.silentHoursStart || currentHour < settings.silentHoursEnd;
    }
};

// ELITE: Earthquake alert result
export interface EarthquakeAlertResult {
    triggered: boolean;
    earthquakeId?: string;
    magnitude?: number;
    location?: string;
    distance?: number;
    alertType?: 'critical' | 'high' | 'medium' | 'low';
}

// ELITE: Hook return interface
export interface UseEarthquakeAlertReturn {
    settings: EarthquakeAlertSettings;
    updateSettings: (newSettings: Partial<EarthquakeAlertSettings>) => Promise<void>;
    lastAlert: EarthquakeAlertResult | null;
    testAlert: () => Promise<void>;
    isMonitoring: boolean;
    alertCount: number;
}

// ============================================================
// MAIN HOOK
// ============================================================

export function useEarthquakeAlert(): UseEarthquakeAlertReturn {
    const [settings, setSettings] = useState<EarthquakeAlertSettings>(DEFAULT_SETTINGS);
    const [lastAlert, setLastAlert] = useState<EarthquakeAlertResult | null>(null);
    const [isMonitoring, setIsMonitoring] = useState(true);
    const [alertCount, setAlertCount] = useState(0);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    const processedEarthquakes = useRef<Set<string>>(new Set());
    const earthquakes = useEarthquakeStore((state) => state.items);

    // ELITE: Load settings on mount
    useEffect(() => {
        loadSettings();
        requestLocationPermission();
    }, []);

    // ELITE: Monitor earthquakes and trigger alerts
    useEffect(() => {
        if (!settings.enabled || !userLocation) return;

        const newEarthquakes = earthquakes.filter((eq) => {
            // Skip already processed
            if (processedEarthquakes.current.has(eq.id)) return false;

            // Only process recent earthquakes (last 10 minutes)
            const age = Date.now() - new Date(eq.time).getTime();
            if (age > 10 * 60 * 1000) return false;

            return true;
        });

        newEarthquakes.forEach((eq) => {
            processedEarthquakes.current.add(eq.id);
            checkAndTriggerAlert(eq);
        });
    }, [earthquakes, settings, userLocation]);

    // ELITE: Load saved settings
    const loadSettings = async () => {
        try {
            const saved = await AsyncStorage.getItem(ALERT_SETTINGS_KEY);
            if (saved) {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            }
        } catch (e) {
            logger.error('Failed to load alert settings:', e);
        }
    };

    // ELITE: Request location permission
    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setUserLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            }
        } catch (e) {
            logger.error('Failed to get location:', e);
        }
    };

    // ELITE: Update settings
    const updateSettings = useCallback(async (newSettings: Partial<EarthquakeAlertSettings>) => {
        try {
            const updated = { ...settings, ...newSettings };
            setSettings(updated);
            await AsyncStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(updated));

            // Track settings change
            firebaseAnalyticsService.logEvent('earthquake_alert_settings_changed', {
                min_magnitude: updated.minMagnitude,
                max_distance_km: updated.maxDistanceKm,
                enabled: updated.enabled,
            });
        } catch (e) {
            logger.error('Failed to save alert settings:', e);
        }
    }, [settings]);

    // ELITE: Check earthquake and trigger alert if needed
    const checkAndTriggerAlert = async (earthquake: { id: string; magnitude: number; latitude: number; longitude: number; location: string; time: string | number }) => {
        if (!userLocation) return;

        // Calculate distance
        const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            earthquake.latitude,
            earthquake.longitude
        );

        // Check if meets alert criteria
        if (earthquake.magnitude < settings.minMagnitude) return;
        if (distance > settings.maxDistanceKm) return;

        // Determine alert type based on magnitude and distance
        let alertType: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (earthquake.magnitude >= settings.criticalMagnitude || distance < 50) {
            alertType = 'critical';
        } else if (earthquake.magnitude >= 5.0 || distance < 100) {
            alertType = 'high';
        } else if (earthquake.magnitude >= 4.5 || distance < 200) {
            alertType = 'medium';
        }

        // Check silent hours (but ALWAYS alert for critical)
        const inSilentHours = isWithinSilentHours(settings);
        if (inSilentHours && alertType !== 'critical') {
            logger.info('Alert suppressed during silent hours:', earthquake.id);
            return;
        }

        // ELITE: Trigger the alert
        const result: EarthquakeAlertResult = {
            triggered: true,
            earthquakeId: earthquake.id,
            magnitude: earthquake.magnitude,
            location: earthquake.location,
            distance: Math.round(distance),
            alertType,
        };

        setLastAlert(result);
        setAlertCount((prev) => prev + 1);

        // Use UltraFast EEW for life-critical alerts
        await ultraFastEEWNotification.sendEEWNotification({
            magnitude: earthquake.magnitude,
            location: earthquake.location,
            warningSeconds: Math.max(0, Math.floor(distance / 5)), // Rough S-wave estimate
            estimatedIntensity: Math.round(earthquake.magnitude * 1.5),
            epicentralDistance: distance,
            source: 'AFAD',
            epicenter: { latitude: earthquake.latitude, longitude: earthquake.longitude },
        });

        // Track alert
        firebaseAnalyticsService.logEvent('earthquake_alert_triggered', {
            magnitude: earthquake.magnitude,
            distance_km: distance,
            alert_type: alertType,
            location: earthquake.location,
        });

        logger.info(`🚨 EARTHQUAKE ALERT: M${earthquake.magnitude} at ${earthquake.location}, ${Math.round(distance)}km away`);
    };

    // ELITE: Test alert function
    const testAlert = useCallback(async () => {
        await ultraFastEEWNotification.sendEEWNotification({
            magnitude: 5.5,
            location: 'Test Bölgesi',
            warningSeconds: 10,
            estimatedIntensity: 6,
            epicentralDistance: 50,
            source: 'AFAD',
            epicenter: { latitude: 41.0, longitude: 29.0 },
        });

        setLastAlert({
            triggered: true,
            magnitude: 5.5,
            location: 'Test Bölgesi',
            distance: 50,
            alertType: 'high',
        });

        firebaseAnalyticsService.logEvent('earthquake_alert_test');
    }, []);

    return {
        settings,
        updateSettings,
        lastAlert,
        testAlert,
        isMonitoring,
        alertCount,
    };
}

export default useEarthquakeAlert;
