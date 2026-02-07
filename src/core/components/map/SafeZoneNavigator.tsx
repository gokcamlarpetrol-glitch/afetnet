/**
 * SAFE ZONE NAVIGATOR — FAZ 5
 * 
 * Finds nearest assembly points / safe zones and provides
 * walking time estimates + navigation launch.
 * 
 * Features:
 * - Haversine distance calculation
 * - Walking time estimate (4 km/h)
 * - Top 3 nearest zones with details
 * - One-tap navigation to Apple/Google Maps
 * - Auto-show on earthquake detection
 */

import React, { memo, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Linking,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as haptics from '../../utils/haptics';
import { turkeyAssemblyPointsService, AssemblyPoint } from '../../services/TurkeyAssemblyPointsService';

interface SafeZoneNavigatorProps {
    visible: boolean;
    userLocation: { latitude: number; longitude: number } | null;
    onClose: () => void;
    onNavigate?: (point: AssemblyPoint) => void;
}

const WALKING_SPEED_KMH = 4.0;

// Haversine formula
function calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatWalkingTime(distanceKm: number): string {
    const minutes = Math.round((distanceKm / WALKING_SPEED_KMH) * 60);
    if (minutes < 1) return '< 1 dk';
    if (minutes < 60) return `${minutes} dk`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}sa ${remainingMins}dk` : `${hours}sa`;
}

const PREMIUM_COLORS = {
    trustBlue: '#1F4E79',
    trustBlueDark: '#163B5B',
    safe: '#2E7D32',
    cream: '#F4EFE7',
    ivory: '#FFFCF7',
    textPrimary: '#121416',
    textSecondary: '#5B5F66',
};

const SafeZoneNavigator = memo(({ visible, userLocation, onClose, onNavigate }: SafeZoneNavigatorProps) => {
    const nearestZones = useMemo(() => {
        if (!userLocation) return [];

        try {
            const allPoints = turkeyAssemblyPointsService.findNearest(
                userLocation.latitude,
                userLocation.longitude,
                5,
            );

            return allPoints.map(point => {
                const distance = calculateDistance(
                    userLocation.latitude, userLocation.longitude,
                    point.latitude, point.longitude,
                );
                return {
                    ...point,
                    distance,
                    walkingTime: formatWalkingTime(distance),
                };
            }).slice(0, 3);
        } catch {
            return [];
        }
    }, [userLocation]);

    const navigateToPoint = useCallback((point: AssemblyPoint & { distance: number }) => {
        haptics.impactMedium();
        const url = Platform.OS === 'ios'
            ? `http://maps.apple.com/?daddr=${point.latitude},${point.longitude}&dirflg=w`
            : `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}&travelmode=walking`;
        Linking.openURL(url).catch(() => { });
        onNavigate?.(point);
    }, [onNavigate]);

    if (!visible) return null;

    return (
        <View style={styles.container}>
            <BlurView intensity={80} tint="light" style={styles.blur}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <LinearGradient
                                colors={[PREMIUM_COLORS.safe, '#1B5E20']}
                                style={styles.headerIcon}
                            >
                                <Ionicons name="shield-checkmark" size={20} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.headerTitle}>Güvenli Bölgeler</Text>
                                <Text style={styles.headerSubtitle}>En yakın toplanma alanları</Text>
                            </View>
                        </View>
                        <Pressable onPress={onClose} hitSlop={10}>
                            <Ionicons name="close-circle" size={26} color={PREMIUM_COLORS.textSecondary} />
                        </Pressable>
                    </View>

                    {/* Zone List */}
                    {nearestZones.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="location-outline" size={32} color={PREMIUM_COLORS.textSecondary} />
                            <Text style={styles.emptyText}>
                                {userLocation ? 'Yakında toplanma alanı bulunamadı' : 'Konum bilgisi bekleniyor...'}
                            </Text>
                        </View>
                    ) : (
                        nearestZones.map((zone, index) => (
                            <Pressable
                                key={zone.id}
                                style={styles.zoneCard}
                                onPress={() => navigateToPoint(zone)}
                            >
                                {/* Rank badge */}
                                <LinearGradient
                                    colors={index === 0 ? [PREMIUM_COLORS.safe, '#1B5E20'] : [PREMIUM_COLORS.textSecondary, '#444']}
                                    style={styles.rankBadge}
                                >
                                    <Text style={styles.rankText}>{index + 1}</Text>
                                </LinearGradient>

                                {/* Zone info */}
                                <View style={styles.zoneInfo}>
                                    <Text style={styles.zoneName} numberOfLines={1}>{zone.name}</Text>
                                    <View style={styles.zoneMetaRow}>
                                        <View style={styles.zoneMeta}>
                                            <Ionicons name="walk" size={14} color={PREMIUM_COLORS.trustBlue} />
                                            <Text style={styles.zoneMetaText}>{zone.walkingTime}</Text>
                                        </View>
                                        <View style={styles.zoneMeta}>
                                            <Ionicons name="resize" size={14} color={PREMIUM_COLORS.textSecondary} />
                                            <Text style={styles.zoneMetaText}>{zone.distance.toFixed(1)} km</Text>
                                        </View>
                                        {zone.capacity && (
                                            <View style={styles.zoneMeta}>
                                                <Ionicons name="people" size={14} color={PREMIUM_COLORS.textSecondary} />
                                                <Text style={styles.zoneMetaText}>{zone.capacity.toLocaleString()}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Navigate arrow */}
                                <Ionicons name="navigate" size={22} color={PREMIUM_COLORS.trustBlue} />
                            </Pressable>
                        ))
                    )}

                    {/* Footer tip */}
                    <View style={styles.footer}>
                        <Ionicons name="information-circle" size={14} color={PREMIUM_COLORS.textSecondary} />
                        <Text style={styles.footerText}>
                            Yürüme süresi tahmini (4 km/sa hız)
                        </Text>
                    </View>
                </View>
            </BlurView>
        </View>
    );
});

SafeZoneNavigator.displayName = 'SafeZoneNavigator';

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    blur: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    card: {
        padding: 20,
        backgroundColor: 'rgba(255,252,247,0.95)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#121416',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#5B5F66',
        marginTop: 1,
    },
    emptyState: {
        alignItems: 'center',
        padding: 24,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#5B5F66',
        textAlign: 'center',
    },
    zoneCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(31, 78, 121, 0.05)',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        gap: 12,
    },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
    zoneInfo: {
        flex: 1,
    },
    zoneName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#121416',
        marginBottom: 4,
    },
    zoneMetaRow: {
        flexDirection: 'row',
        gap: 12,
    },
    zoneMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    zoneMetaText: {
        fontSize: 12,
        color: '#5B5F66',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        justifyContent: 'center',
    },
    footerText: {
        fontSize: 11,
        color: '#5B5F66',
    },
});

export { SafeZoneNavigator };
