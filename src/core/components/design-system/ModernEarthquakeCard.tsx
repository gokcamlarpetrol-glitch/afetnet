/**
 * PREMIUM EARTHQUAKE CARD - WORLD-CLASS DESIGN
 * Ultra-premium earthquake display with all details
 * Inspired by Apple Weather and premium news apps
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, {
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { colors, shadow } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 200;

interface PremiumEarthquakeCardProps {
    magnitude: number;
    location: string;
    depth: number;
    time: string;
    latitude: number;
    longitude: number;
    onPress?: () => void;
    onMapPress?: () => void;
}

export const PremiumEarthquakeCardComponent = ({
    magnitude,
    location,
    depth,
    time,
    latitude,
    longitude,
    onPress,
    onMapPress,
}: PremiumEarthquakeCardProps) => {
    const mapRef = useRef<MapView>(null);

    // Severity classification
    const isCritical = magnitude >= 6.0;
    const isStrong = magnitude >= 5.0 && magnitude < 6.0;
    const isModerate = magnitude >= 4.0 && magnitude < 5.0;
    const isLight = magnitude >= 3.0 && magnitude < 4.0;

    const getSeverityLabel = () => {
        if (isCritical) return 'Şiddetli';
        if (isStrong) return 'Güçlü';
        if (isModerate) return 'Orta';
        if (isLight) return 'Hafif';
        return 'Düşük';
    };

    const getSeverityColor = (): string => {
        if (isCritical) return '#EF4444';
        if (isStrong) return '#F97316';
        if (isModerate) return '#FBBF24';
        if (isLight) return '#3B82F6';
        return '#10B981';
    };

    const getSeverityGradient = (): [string, string] => {
        if (isCritical) return ['#EF4444', '#DC2626'];
        if (isStrong) return ['#F97316', '#EA580C'];
        if (isModerate) return ['#FBBF24', '#F59E0B'];
        if (isLight) return ['#3B82F6', '#2563EB'];
        return ['#10B981', '#059669'];
    };

    // Pulse animation for epicenter
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.8);

    useEffect(() => {
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.8, { duration: 1200 }),
                withTiming(1, { duration: 1200 })
            ),
            -1,
            true
        );
        pulseOpacity.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 1200 }),
                withTiming(0.8, { duration: 1200 })
            ),
            -1,
            true
        );
    }, []);

    const pulseRingStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    // Time calculation
    const getTimeAgo = (timeStr: string) => {
        const now = new Date();
        const parts = timeStr.split(':');
        if (parts.length >= 2) {
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            const earthquakeTime = new Date();
            earthquakeTime.setHours(hours, minutes, 0, 0);

            const diffMs = now.getTime() - earthquakeTime.getTime();
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 0) return 'az önce';
            if (diffMins < 1) return 'az önce';
            if (diffMins < 60) return `${diffMins} dk önce`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours} saat önce`;
            return timeStr;
        }
        return timeStr;
    };

    // Intensity based on magnitude (Mercalli scale approximation)
    const getIntensity = () => {
        if (magnitude >= 7.0) return 'X';
        if (magnitude >= 6.5) return 'IX';
        if (magnitude >= 6.0) return 'VIII';
        if (magnitude >= 5.5) return 'VII';
        if (magnitude >= 5.0) return 'VI';
        if (magnitude >= 4.5) return 'V';
        if (magnitude >= 4.0) return 'IV';
        if (magnitude >= 3.0) return 'III';
        if (magnitude >= 2.0) return 'II';
        return 'I';
    };

    // Get formatted date
    const getFormattedDate = () => {
        const now = new Date();
        return now.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const severityColor = getSeverityColor();
    const severityGradient = getSeverityGradient();

    return (
        <Pressable onPress={onPress}>
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>Son Deprem</Text>
                        <View style={styles.liveBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>Canlı</Text>
                        </View>
                    </View>
                    <Pressable onPress={onPress} hitSlop={8}>
                        <Text style={styles.headerLink}>Tümünü Gör</Text>
                    </Pressable>
                </View>

                {/* Main Card */}
                <View style={styles.card}>
                    {/* Map Section */}
                    <Pressable onPress={onMapPress} style={styles.mapContainer}>
                        <MapView
                            ref={mapRef}
                            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                            style={styles.map}
                            mapType="standard"
                            initialRegion={{
                                latitude,
                                longitude,
                                latitudeDelta: 0.4,
                                longitudeDelta: 0.4,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                            pointerEvents="none"
                            showsCompass={false}
                            showsScale={false}
                            showsBuildings={false}
                            showsTraffic={false}
                            showsIndoors={false}
                        >
                            {/* Single clear epicenter marker */}
                            <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }}>
                                <View style={styles.epicenterContainer}>
                                    <Animated.View style={[styles.pulseRing, { borderColor: severityColor }, pulseRingStyle]} />
                                    <View style={[styles.epicenterDot, { backgroundColor: severityColor }]} />
                                </View>
                            </Marker>
                        </MapView>

                        {/* Gradient Overlay */}
                        <LinearGradient
                            colors={['transparent', 'rgba(15, 23, 42, 0.9)']}
                            style={styles.mapGradient}
                            pointerEvents="none"
                        />

                        {/* Epicenter Label */}
                        <View style={styles.epicenterLabel}>
                            <Ionicons name="locate" size={10} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.epicenterLabelText}>Merkez Üssü</Text>
                        </View>

                        {/* Location Name */}
                        <Text style={styles.locationText}>{location}</Text>

                        {/* Severity Badge */}
                        <LinearGradient
                            colors={severityGradient}
                            style={styles.severityBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name="warning" size={10} color="#fff" />
                            <Text style={styles.severityText}>{getSeverityLabel()}</Text>
                        </LinearGradient>

                        {/* Map Button */}
                        <Pressable style={styles.mapButton} onPress={onMapPress}>
                            <Ionicons name="expand" size={16} color="#fff" />
                        </Pressable>
                    </Pressable>

                    {/* Info Section */}
                    <View style={styles.infoSection}>
                        {/* Magnitude & Time Row */}
                        <View style={styles.magnitudeRow}>
                            <View style={styles.magnitudeContainer}>
                                <Text style={[styles.magnitudeValue, { color: severityColor }]}>
                                    {magnitude.toFixed(1)}
                                </Text>
                                <View style={styles.magnitudeLabels}>
                                    <Text style={styles.magnitudeLabel}>Büyüklük</Text>
                                    <Text style={styles.magnitudeUnit}>ML</Text>
                                </View>
                            </View>

                            <View style={styles.timeSection}>
                                <View style={styles.timeRow}>
                                    <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.4)" />
                                    <Text style={styles.timeText}>{getTimeAgo(time)}</Text>
                                </View>
                                <Text style={styles.dateText}>{getFormattedDate()}</Text>
                            </View>
                        </View>

                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Ionicons name="layers-outline" size={16} color="rgba(255,255,255,0.5)" />
                                <View style={styles.statContent}>
                                    <Text style={styles.statLabel}>DERİNLİK</Text>
                                    <Text style={styles.statValue}>{depth.toFixed(2)} km</Text>
                                </View>
                            </View>

                            <View style={styles.statDivider} />

                            <View style={styles.statItem}>
                                <Ionicons name="speedometer-outline" size={16} color="rgba(255,255,255,0.5)" />
                                <View style={styles.statContent}>
                                    <Text style={styles.statLabel}>ŞİDDET</Text>
                                    <Text style={styles.statValue}>{getIntensity()}</Text>
                                </View>
                            </View>

                            <View style={styles.statDivider} />

                            <View style={styles.statItem}>
                                <Ionicons name="people-outline" size={16} color="rgba(255,255,255,0.5)" />
                                <View style={styles.statContent}>
                                    <Text style={styles.statLabel}>RAPORLAR</Text>
                                    <Text style={styles.statValue}>—</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    );
};

export const PremiumEarthquakeCard = React.memo(PremiumEarthquakeCardComponent);

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text.primary,
        letterSpacing: -0.3,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    liveDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#EF4444',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#EF4444',
    },
    headerLink: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3B82F6',
    },
    card: {
        backgroundColor: '#0F172A',
        borderRadius: 20,
        overflow: 'hidden',
        ...(shadow as any).large,
    },
    mapContainer: {
        height: MAP_HEIGHT,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    mapGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 80,
    },
    epicenterContainer: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
    },
    epicenterDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    epicenterInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    epicenterLabel: {
        position: 'absolute',
        bottom: 30,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    epicenterLabelText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
    },
    locationText: {
        position: 'absolute',
        bottom: 12,
        left: 16,
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        maxWidth: SCREEN_WIDTH - 120,
    },
    severityBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    severityText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    mapButton: {
        position: 'absolute',
        bottom: 12,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    infoSection: {
        padding: 16,
    },
    magnitudeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    magnitudeContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    magnitudeValue: {
        fontSize: 42,
        fontWeight: '800',
        letterSpacing: -2,
    },
    magnitudeLabels: {
        gap: 0,
    },
    magnitudeLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.5)',
    },
    magnitudeUnit: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.3)',
    },
    timeSection: {
        alignItems: 'flex-end',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeText: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.6)',
    },
    dateText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
        marginTop: 2,
    },
    coordsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    coordItem: {
        flex: 1,
    },
    coordLabel: {
        fontSize: 9,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    coordValue: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    coordDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 12,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        paddingVertical: 14,
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    statContent: {
        alignItems: 'flex-start',
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    statLabel: {
        fontSize: 8,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
});
