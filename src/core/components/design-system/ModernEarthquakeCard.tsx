/**
 * PREMIUM EARTHQUAKE CARD - WORLD-CLASS DESIGN
 * Ultra-premium earthquake display with all details
 * Inspired by Apple Weather and premium news apps
 * 
 * Real MapView preview (non-interactive) showing epicenter
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
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

/**
 * Real MapView preview — non-interactive to work safely inside ScrollView
 */
const EpicenterMapPreview = ({ latitude, longitude, severityColor, magnitude }: {
    latitude: number;
    longitude: number;
    severityColor: string;
    magnitude: number;
}) => {
    const [mapReady, setMapReady] = useState(false);

    return (
        <View style={[styles.map, { height: MAP_HEIGHT }]}>
            {/* Loading fallback shown until map renders */}
            {!mapReady && (
                <LinearGradient
                    colors={['#1a2332', '#0d1b2a', '#1b2838']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.mapLoadingContainer}>
                        <Ionicons name="map-outline" size={28} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.mapLoadingText}>Harita yükleniyor...</Text>
                    </View>
                </LinearGradient>
            )}

            {/* Real non-interactive MapView — zoomed out for geographic context */}
            <MapView
                provider={PROVIDER_DEFAULT}
                style={StyleSheet.absoluteFill}
                initialRegion={{
                    latitude,
                    longitude,
                    latitudeDelta: 2.5,
                    longitudeDelta: 2.5,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                showsTraffic={false}
                showsBuildings={false}
                showsIndoors={false}
                showsPointsOfInterest={true}
                toolbarEnabled={false}
                moveOnMarkerPress={false}
                pointerEvents="none"
                onMapReady={() => setMapReady(true)}
                mapType="standard"
                liteMode={Platform.OS === 'android'}
            >
                {/* Seismic impact — 3 concentric circles */}
                <Circle
                    center={{ latitude, longitude }}
                    radius={60000}
                    strokeColor={`${severityColor}30`}
                    fillColor={`${severityColor}08`}
                    strokeWidth={1}
                />
                <Circle
                    center={{ latitude, longitude }}
                    radius={35000}
                    strokeColor={`${severityColor}55`}
                    fillColor={`${severityColor}12`}
                    strokeWidth={1.5}
                />
                <Circle
                    center={{ latitude, longitude }}
                    radius={12000}
                    strokeColor={`${severityColor}AA`}
                    fillColor={`${severityColor}25`}
                    strokeWidth={2}
                />

                {/* Epicenter — native red pin (always large & visible on iOS/Android) */}
                <Marker
                    coordinate={{ latitude, longitude }}
                    pinColor={severityColor}
                    title={`M${magnitude.toFixed(1)} Deprem`}
                />
            </MapView>
        </View>
    );
};

/** Dark map style for premium look */
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
    { featureType: 'land', elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

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
        try {
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
        } catch {
            return timeStr || '—';
        }
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
        try {
            const now = new Date();
            return now.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return '';
        }
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
                    {/* Real MapView Preview */}
                    <Pressable onPress={onMapPress} style={styles.mapContainer}>
                        <EpicenterMapPreview
                            latitude={latitude}
                            longitude={longitude}
                            severityColor={severityColor}
                            magnitude={magnitude}
                        />

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
                        <Text style={styles.locationText}>{location || 'Bilinmiyor'}</Text>

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
                                    {(magnitude ?? 0).toFixed(1)}
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
                                    <Text style={styles.statValue}>{(depth ?? 0).toFixed(2)} km</Text>
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
        overflow: 'hidden',
    },
    mapLoadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    mapLoadingText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500',
    },

    mapGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 80,
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
