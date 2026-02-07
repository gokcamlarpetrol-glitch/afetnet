/**
 * useLiveLocation — Shared hook for real-time GPS tracking
 * 
 * Uses expo-location watchPositionAsync for continuous updates.
 * Auto-cleans up on unmount. Shared between MapScreen & DisasterMapScreen.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';

const logger = createLogger('useLiveLocation');

export interface LiveLocationData {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
}

interface UseLiveLocationOptions {
    /** Minimum distance (meters) to trigger update. Default: 10 */
    distanceInterval?: number;
    /** Minimum time (ms) between updates. Default: 5000 */
    timeInterval?: number;
    /** GPS accuracy level. Default: High */
    accuracy?: Location.Accuracy;
    /** Whether to actively track. Default: true */
    enabled?: boolean;
}

interface UseLiveLocationResult {
    /** Current user location (null until first fix) */
    location: { latitude: number; longitude: number } | null;
    /** Full location data with accuracy, heading, speed */
    locationData: LiveLocationData | null;
    /** Whether location permission was granted */
    permissionGranted: boolean;
    /** Whether the hook is actively tracking */
    isTracking: boolean;
    /** Request a single immediate location update */
    refreshLocation: () => Promise<void>;
}

export function useLiveLocation(options: UseLiveLocationOptions = {}): UseLiveLocationResult {
    const {
        distanceInterval = 10,
        timeInterval = 5000,
        accuracy = Location.Accuracy.High,
        enabled = true,
    } = options;

    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationData, setLocationData] = useState<LiveLocationData | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

    const updateLocation = useCallback((loc: Location.LocationObject) => {
        const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
        };
        setLocation(coords);
        setLocationData({
            ...coords,
            accuracy: loc.coords.accuracy,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
            timestamp: loc.timestamp,
        });
    }, []);

    useEffect(() => {
        if (!enabled) {
            // Stop tracking if disabled
            if (subscriptionRef.current) {
                subscriptionRef.current.remove();
                subscriptionRef.current = null;
                setIsTracking(false);
            }
            return;
        }

        let isMounted = true;

        const startWatching = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (!isMounted) return;

                if (status !== 'granted') {
                    setPermissionGranted(false);
                    logger.warn('Location permission not granted');
                    return;
                }
                setPermissionGranted(true);

                // Get initial position immediately (fast feedback)
                try {
                    const initial = await Location.getCurrentPositionAsync({ accuracy });
                    if (isMounted) {
                        updateLocation(initial);
                    }
                } catch (e) {
                    logger.warn('Initial location fetch failed:', e);
                }

                // Start continuous watching
                const subscription = await Location.watchPositionAsync(
                    {
                        accuracy,
                        distanceInterval,
                        timeInterval,
                    },
                    (loc) => {
                        if (isMounted) {
                            updateLocation(loc);
                        }
                    },
                );

                if (isMounted) {
                    subscriptionRef.current = subscription;
                    setIsTracking(true);
                } else {
                    subscription.remove();
                }
            } catch (error) {
                logger.error('Live location setup failed:', error);
            }
        };

        startWatching();

        return () => {
            isMounted = false;
            if (subscriptionRef.current) {
                subscriptionRef.current.remove();
                subscriptionRef.current = null;
                setIsTracking(false);
            }
        };
    }, [enabled, distanceInterval, timeInterval, accuracy, updateLocation]);

    const refreshLocation = useCallback(async () => {
        try {
            const loc = await Location.getCurrentPositionAsync({ accuracy });
            updateLocation(loc);
        } catch (error) {
            logger.warn('Manual location refresh failed:', error);
        }
    }, [accuracy, updateLocation]);

    return {
        location,
        locationData,
        permissionGranted,
        isTracking,
        refreshLocation,
    };
}
