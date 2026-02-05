/**
 * WAVE PROPAGATION OVERLAY - ELITE EDITION
 * 
 * Harita üzerinde gerçek zamanlı P ve S dalga yayılım animasyonu
 * 
 * Features:
 * - Epicenter'dan yayılan P ve S dalgaları
 * - Gerçek zamanlı dalga hızı hesaplaması
 * - Kullanıcı konumuna varış zamanı
 * - Interaktif countdown overlay
 * - Multi-source desteği
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import { Circle, Marker } from 'react-native-maps';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

// ========================
// TYPES
// ========================

export interface WaveSource {
    id: string;
    latitude: number;
    longitude: number;
    depth: number;
    magnitude: number;
    originTime: number;
    pWaveVelocity?: number; // km/s, default 6.0
    sWaveVelocity?: number; // km/s, default 3.5
}

export interface UserLocation {
    latitude: number;
    longitude: number;
}

interface WavePropagationOverlayProps {
    sources: WaveSource[];
    userLocation?: UserLocation;
    onPWaveArrival?: (sourceId: string) => void;
    onSWaveArrival?: (sourceId: string) => void;
    showPWave?: boolean;
    showSWave?: boolean;
    maxRadius?: number; // km
}

// ========================
// CONSTANTS
// ========================

const COLORS = {
    pWave: 'rgba(255, 59, 48, 0.4)',      // Red
    pWaveStroke: 'rgba(255, 59, 48, 0.8)',
    sWave: 'rgba(255, 149, 0, 0.4)',      // Orange
    sWaveStroke: 'rgba(255, 149, 0, 0.8)',
    epicenter: '#FF3B30',
    userSafe: '#34C759',
    userDanger: '#FF3B30',
};

const DEFAULT_P_VELOCITY = 6.0; // km/s
const DEFAULT_S_VELOCITY = 3.5; // km/s

// ========================
// UTILITY FUNCTIONS
// ========================

/**
 * Convert km to degrees (approximate)
 */
const kmToDegrees = (km: number): number => {
    return km / 111.32; // 1 degree ≈ 111.32 km
};

/**
 * Calculate distance between two coordinates (Haversine)
 */
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

// ========================
// WAVE CIRCLE COMPONENT
// ========================

interface WaveCircleProps {
    source: WaveSource;
    type: 'p' | 's';
    elapsedSeconds: number;
}

const WaveCircle: React.FC<WaveCircleProps> = ({ source, type, elapsedSeconds }) => {
    const velocity = type === 'p'
        ? (source.pWaveVelocity || DEFAULT_P_VELOCITY)
        : (source.sWaveVelocity || DEFAULT_S_VELOCITY);

    const radiusKm = elapsedSeconds * velocity;
    const radiusDegrees = kmToDegrees(radiusKm);

    if (radiusKm <= 0 || radiusKm > 1000) return null;

    return (
        <Circle
            center={{
                latitude: source.latitude,
                longitude: source.longitude,
            }}
            radius={radiusKm * 1000} // meters
            fillColor={type === 'p' ? COLORS.pWave : COLORS.sWave}
            strokeColor={type === 'p' ? COLORS.pWaveStroke : COLORS.sWaveStroke}
            strokeWidth={2}
        />
    );
};

// ========================
// EPICENTER MARKER
// ========================

interface EpicenterMarkerProps {
    source: WaveSource;
}

const EpicenterMarker: React.FC<EpicenterMarkerProps> = ({ source }) => {
    return (
        <Marker
            coordinate={{
                latitude: source.latitude,
                longitude: source.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
        >
            <View style={styles.epicenterContainer}>
                <View style={styles.epicenterOuter}>
                    <View style={styles.epicenterInner}>
                        <Text style={styles.epicenterMagnitude}>
                            {source.magnitude.toFixed(1)}
                        </Text>
                    </View>
                </View>
                <View style={styles.epicenterPulse} />
            </View>
        </Marker>
    );
};

// ========================
// COUNTDOWN OVERLAY
// ========================

interface CountdownOverlayProps {
    sources: WaveSource[];
    userLocation: UserLocation;
    elapsedTimes: Map<string, number>;
}

const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
    sources,
    userLocation,
    elapsedTimes,
}) => {
    // Type for nearest wave data
    type NearestWaveData = { sourceId: string; timeToP: number; timeToS: number; distance: number };

    // Find nearest incoming wave
    const nearestWave = useMemo((): NearestWaveData | null => {
        let nearest: NearestWaveData | null = null;

        sources.forEach((source) => {
            const distance = calculateDistance(
                source.latitude,
                source.longitude,
                userLocation.latitude,
                userLocation.longitude
            );

            const pVelocity = source.pWaveVelocity || DEFAULT_P_VELOCITY;
            const sVelocity = source.sWaveVelocity || DEFAULT_S_VELOCITY;

            const elapsed = elapsedTimes.get(source.id) || 0;
            const pTravelTime = distance / pVelocity;
            const sTravelTime = distance / sVelocity;

            const timeToP = Math.max(0, pTravelTime - elapsed);
            const timeToS = Math.max(0, sTravelTime - elapsed);

            if (!nearest || timeToS < nearest.timeToS) {
                nearest = { sourceId: source.id, timeToP, timeToS, distance };
            }
        });

        return nearest;
    }, [sources, userLocation, elapsedTimes]);

    if (!nearestWave || (nearestWave.timeToP <= 0 && nearestWave.timeToS <= 0)) {
        return null;
    }

    const isUrgent = nearestWave.timeToS <= 10;

    return (
        <View style={[styles.countdownContainer, isUrgent && styles.countdownUrgent]}>
            <BlurView intensity={80} tint="dark" style={styles.countdownBlur}>
                <View style={styles.countdownContent}>
                    <View style={styles.countdownRow}>
                        <View style={styles.waveCountdown}>
                            <View style={[styles.waveIndicator, { backgroundColor: COLORS.pWaveStroke }]} />
                            <Text style={styles.waveLabel}>P-Wave</Text>
                            <Text style={[styles.waveTime, nearestWave.timeToP <= 0 && styles.waveArrived]}>
                                {nearestWave.timeToP <= 0 ? 'ARRIVED' : `${nearestWave.timeToP.toFixed(1)}s`}
                            </Text>
                        </View>

                        <View style={styles.waveCountdown}>
                            <View style={[styles.waveIndicator, { backgroundColor: COLORS.sWaveStroke }]} />
                            <Text style={styles.waveLabel}>S-Wave</Text>
                            <Text style={[
                                styles.waveTime,
                                styles.sWaveTime,
                                nearestWave.timeToS <= 0 && styles.waveArrived
                            ]}>
                                {nearestWave.timeToS <= 0 ? 'ARRIVED' : `${nearestWave.timeToS.toFixed(1)}s`}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.distanceText}>
                        📐 {nearestWave.distance.toFixed(1)} km uzaklıkta
                    </Text>

                    {isUrgent && (
                        <View style={styles.urgentAlert}>
                            <Ionicons name="warning" size={20} color="white" />
                            <Text style={styles.urgentText}>ÇÖK, KAPAN, TUTUN!</Text>
                        </View>
                    )}
                </View>
            </BlurView>
        </View>
    );
};

// ========================
// MAIN COMPONENT
// ========================

export const WavePropagationOverlay: React.FC<WavePropagationOverlayProps> = ({
    sources,
    userLocation,
    onPWaveArrival,
    onSWaveArrival,
    showPWave = true,
    showSWave = true,
    maxRadius = 500,
}) => {
    const [elapsedTimes, setElapsedTimes] = useState<Map<string, number>>(new Map());
    const [pWaveArrived, setPWaveArrived] = useState<Set<string>>(new Set());
    const [sWaveArrived, setSWaveArrived] = useState<Set<string>>(new Set());

    // Update elapsed time for each source
    useEffect(() => {
        const interval = setInterval(() => {
            const newTimes = new Map<string, number>();
            const now = Date.now();

            sources.forEach((source) => {
                const elapsed = (now - source.originTime) / 1000;
                newTimes.set(source.id, elapsed);

                // Check for wave arrivals
                if (userLocation) {
                    const distance = calculateDistance(
                        source.latitude,
                        source.longitude,
                        userLocation.latitude,
                        userLocation.longitude
                    );

                    const pVelocity = source.pWaveVelocity || DEFAULT_P_VELOCITY;
                    const sVelocity = source.sWaveVelocity || DEFAULT_S_VELOCITY;

                    const pArrivalTime = distance / pVelocity;
                    const sArrivalTime = distance / sVelocity;

                    // P-wave arrival check
                    if (elapsed >= pArrivalTime && !pWaveArrived.has(source.id)) {
                        setPWaveArrived((prev) => new Set([...prev, source.id]));
                        onPWaveArrival?.(source.id);
                    }

                    // S-wave arrival check
                    if (elapsed >= sArrivalTime && !sWaveArrived.has(source.id)) {
                        setSWaveArrived((prev) => new Set([...prev, source.id]));
                        onSWaveArrival?.(source.id);
                    }
                }
            });

            setElapsedTimes(newTimes);
        }, 100); // Update every 100ms for smooth animation

        return () => clearInterval(interval);
    }, [sources, userLocation, pWaveArrived, sWaveArrived]);

    return (
        <>
            {/* Wave circles */}
            {sources.map((source) => {
                const elapsed = elapsedTimes.get(source.id) || 0;

                return (
                    <React.Fragment key={source.id}>
                        {/* P-Wave circles (multiple rings) */}
                        {showPWave && (
                            <>
                                <WaveCircle source={source} type="p" elapsedSeconds={elapsed} />
                                <WaveCircle source={source} type="p" elapsedSeconds={elapsed - 2} />
                                <WaveCircle source={source} type="p" elapsedSeconds={elapsed - 4} />
                            </>
                        )}

                        {/* S-Wave circles (multiple rings) */}
                        {showSWave && (
                            <>
                                <WaveCircle source={source} type="s" elapsedSeconds={elapsed} />
                                <WaveCircle source={source} type="s" elapsedSeconds={elapsed - 3} />
                                <WaveCircle source={source} type="s" elapsedSeconds={elapsed - 6} />
                            </>
                        )}

                        {/* Epicenter marker */}
                        <EpicenterMarker source={source} />
                    </React.Fragment>
                );
            })}

            {/* Countdown overlay (rendered outside map) */}
            {userLocation && sources.length > 0 && (
                <CountdownOverlay
                    sources={sources}
                    userLocation={userLocation}
                    elapsedTimes={elapsedTimes}
                />
            )}
        </>
    );
};

// ========================
// STYLES
// ========================

const styles = StyleSheet.create({
    epicenterContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    epicenterOuter: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 59, 48, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.epicenter,
    },
    epicenterInner: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.epicenter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    epicenterMagnitude: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
    },
    epicenterPulse: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: COLORS.epicenter,
        opacity: 0.5,
    },
    countdownContainer: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    countdownUrgent: {
        borderWidth: 2,
        borderColor: COLORS.epicenter,
    },
    countdownBlur: {
        padding: 16,
    },
    countdownContent: {
        gap: 12,
    },
    countdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    waveCountdown: {
        alignItems: 'center',
        gap: 4,
    },
    waveIndicator: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    waveLabel: {
        color: 'white',
        fontSize: 12,
        opacity: 0.8,
    },
    waveTime: {
        color: 'white',
        fontSize: 24,
        fontWeight: '700',
    },
    sWaveTime: {
        color: COLORS.sWaveStroke,
    },
    waveArrived: {
        color: '#34C759',
        fontSize: 14,
    },
    distanceText: {
        color: 'white',
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.8,
    },
    urgentAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.epicenter,
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    urgentText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 1,
    },
});

export default WavePropagationOverlay;
