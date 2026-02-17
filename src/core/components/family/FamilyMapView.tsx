/**
 * FAMILY MAP VIEW - ELITE V2
 * Life360-inspired interactive family map with animated avatars
 * 
 * FEATURES:
 * - Real-time family member locations on map
 * - Animated pulse for online members
 * - Battery level badges
 * - Status-colored markers (safe/need-help/critical)
 * - Last seen relative time
 * - Tap marker to show detail card
 */

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FamilyMember } from '../../types/family';
import { formatLastSeen, normalizeTimestampMs } from '../../utils/dateUtils';
import { resolveFamilyMemberLocation, type ResolvedFamilyLocation } from '../../utils/familyLocation';

// ELITE: Status color mapping (Life360 pattern)
const STATUS_COLORS: Record<string, string> = {
    safe: '#22c55e',
    'need-help': '#f59e0b',
    critical: '#ef4444',
    offline: '#94a3b8',
    unknown: '#64748b',
};
const isGeneratedLocalFamilyId = (value: string): boolean => value.startsWith('family-');

interface FamilyMapViewProps {
    members: FamilyMember[];
    onMemberPress?: (member: FamilyMember) => void;
    onCheckIn?: (memberId: string) => void;
}

export const FamilyMapView: React.FC<FamilyMapViewProps> = ({
    members,
    onMemberPress,
    onCheckIn,
}) => {
    const mapRef = useRef<MapView>(null);
    const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

    // Filter members with valid coordinates
    const mappableMembers = useMemo(() => {
        return members
            .map((member) => ({ member, resolvedLocation: resolveFamilyMemberLocation(member) }))
            .filter((entry): entry is { member: FamilyMember; resolvedLocation: ResolvedFamilyLocation } => !!entry.resolvedLocation);
    }, [members]);

    const selectedMemberLocation = useMemo(
        () => (selectedMember ? resolveFamilyMemberLocation(selectedMember) : null),
        [selectedMember],
    );

    // Calculate initial region to fit all members
    const initialRegion = useMemo(() => {
        if (mappableMembers.length === 0) {
            // Default to Istanbul
            return {
                latitude: 41.0082,
                longitude: 28.9784,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            };
        }

        if (mappableMembers.length === 1) {
            const m = mappableMembers[0];
            return {
                latitude: m.resolvedLocation.latitude,
                longitude: m.resolvedLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            };
        }

        // Fit all members
        const lats = mappableMembers.map((m) => m.resolvedLocation.latitude);
        const lngs = mappableMembers.map((m) => m.resolvedLocation.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const padding = 0.02;

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(maxLat - minLat + padding, 0.01),
            longitudeDelta: Math.max(maxLng - minLng + padding, 0.01),
        };
    }, [mappableMembers]);

    useEffect(() => {
        if (!mapRef.current || mappableMembers.length === 0) return;
        mapRef.current.animateToRegion(initialRegion, 350);
    }, [initialRegion, mappableMembers.length]);

    const handleMarkerPress = useCallback(
        (member: FamilyMember) => {
            setSelectedMember(member);
            onMemberPress?.(member);
        },
        [onMemberPress]
    );

    const getStatusColor = (status: FamilyMember['status']) => {
        return STATUS_COLORS[status || 'unknown'] || STATUS_COLORS.unknown;
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const resolveCheckInTargetId = (member: FamilyMember): string => {
        const uid = typeof member.uid === 'string' ? member.uid.trim() : '';
        if (uid.length > 0) return uid;

        const deviceId = typeof member.deviceId === 'string' ? member.deviceId.trim() : '';
        if (deviceId.length > 0) return deviceId;

        return member.uid;
    };

    if (mappableMembers.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="map-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyText}>Henüz konum verisi yok</Text>
                <Text style={styles.emptySubtext}>
                    Aile üyeleri konum paylaştığında burada görünür
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation
                showsMyLocationButton
                showsCompass
                mapType="standard"
            >
                {mappableMembers.map(({ member, resolvedLocation }) => {
                    const statusColor = getStatusColor(member.status);
                    const normalizedLastSeen = normalizeTimestampMs(member.lastSeen);
                    const hasRecentSignal = !!normalizedLastSeen && (Date.now() - normalizedLastSeen) < 10 * 60 * 1000;
                    const isLastKnownLocation = resolvedLocation.source === 'lastKnown';
                    const isOnline = !isLastKnownLocation && (member.isOnline === true || hasRecentSignal);

                    return (
                        <React.Fragment key={member.uid}>
                            {/* Accuracy circle */}
                            {resolvedLocation.accuracy && resolvedLocation.accuracy > 0 && (
                                <Circle
                                    center={{
                                        latitude: resolvedLocation.latitude,
                                        longitude: resolvedLocation.longitude,
                                    }}
                                    radius={resolvedLocation.accuracy}
                                    fillColor={statusColor + '15'}
                                    strokeColor={statusColor + '40'}
                                    strokeWidth={1}
                                />
                            )}

                            {/* Online pulse circle */}
                            {isOnline && (
                                <Circle
                                    center={{
                                        latitude: resolvedLocation.latitude,
                                        longitude: resolvedLocation.longitude,
                                    }}
                                    radius={80}
                                    fillColor={statusColor + '20'}
                                    strokeColor={statusColor + '50'}
                                    strokeWidth={2}
                                />
                            )}

                            {/* Member marker */}
                            <Marker
                                coordinate={{
                                    latitude: resolvedLocation.latitude,
                                    longitude: resolvedLocation.longitude,
                                }}
                                onPress={() => handleMarkerPress(member)}
                                anchor={{ x: 0.5, y: 0.5 }}
                            >
                                <View style={styles.markerContainer}>
                                    {/* Avatar circle */}
                                    <View
                                        style={[
                                            styles.markerAvatar,
                                            { borderColor: statusColor },
                                            isOnline && styles.markerAvatarOnline,
                                        ]}
                                    >
                                        <Text style={styles.markerInitials}>
                                            {getInitials(member.name)}
                                        </Text>
                                    </View>

                                    {/* Battery badge */}
                                    {member.batteryLevel !== undefined && member.batteryLevel > 0 && (
                                        <View
                                            style={[
                                                styles.batteryBadge,
                                                {
                                                    backgroundColor:
                                                        member.batteryLevel < 20
                                                            ? '#ef4444'
                                                            : member.batteryLevel < 50
                                                                ? '#f59e0b'
                                                                : '#22c55e',
                                                },
                                            ]}
                                        >
                                            <Text style={styles.batteryText}>
                                                {member.batteryLevel}%
                                            </Text>
                                        </View>
                                    )}

                                    {/* Name label */}
                                    <View style={styles.nameLabel}>
                                        <Text style={styles.nameLabelText} numberOfLines={1}>
                                            {member.name.split(' ')[0]}
                                        </Text>
                                    </View>
                                </View>
                            </Marker>
                        </React.Fragment>
                    );
                })}
            </MapView>

            {/* Selected member detail card */}
            {selectedMember && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.detailCard}
                >
                    <Pressable
                        style={styles.detailCardClose}
                        onPress={() => setSelectedMember(null)}
                    >
                        <Ionicons name="close" size={18} color="#64748b" />
                    </Pressable>

                    <View style={styles.detailHeader}>
                        <View
                            style={[
                                styles.detailAvatar,
                                { borderColor: getStatusColor(selectedMember.status) },
                            ]}
                        >
                            <Text style={styles.detailInitials}>
                                {getInitials(selectedMember.name)}
                            </Text>
                        </View>
                        <View style={styles.detailInfo}>
                            <Text style={styles.detailName}>{selectedMember.name}</Text>
                            <View style={styles.detailStatusRow}>
                                <View
                                    style={[
                                        styles.detailStatusDot,
                                        { backgroundColor: getStatusColor(selectedMember.status) },
                                    ]}
                                />
                                <Text style={styles.detailStatusText}>
                                    {selectedMember.status === 'safe'
                                        ? 'Güvende'
                                        : selectedMember.status === 'need-help'
                                            ? 'Yardım Gerekiyor'
                                            : selectedMember.status === 'critical'
                                                ? 'Kritik'
                                                : 'Bilinmiyor'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Last seen */}
                    <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={16} color="#64748b" />
                        <Text style={styles.detailRowText}>
                            {selectedMember.lastSeen
                                ? formatLastSeen(selectedMember.lastSeen)
                                : 'Bilinmiyor'}
                        </Text>
                    </View>

                    {selectedMemberLocation?.source === 'lastKnown' && (
                        <View style={styles.detailRow}>
                            <Ionicons name="locate-outline" size={16} color="#64748b" />
                            <Text style={styles.detailRowText}>Son bilinen konum gösteriliyor</Text>
                        </View>
                    )}

                    {/* Battery */}
                    {selectedMember.batteryLevel !== undefined && (
                        <View style={styles.detailRow}>
                            <Ionicons
                                name={
                                    selectedMember.batteryLevel < 20
                                        ? 'battery-dead'
                                        : selectedMember.batteryLevel < 50
                                            ? 'battery-half'
                                            : 'battery-full'
                                }
                                size={16}
                                color={
                                    selectedMember.batteryLevel < 20
                                        ? '#ef4444'
                                        : selectedMember.batteryLevel < 50
                                            ? '#f59e0b'
                                            : '#22c55e'
                                }
                            />
                            <Text style={styles.detailRowText}>
                                Pil: %{selectedMember.batteryLevel}
                            </Text>
                        </View>
                    )}

                    {/* Check-in button */}
                    <Pressable
                        style={styles.checkInButton}
                        onPress={() => {
                            onCheckIn?.(resolveCheckInTargetId(selectedMember));
                            setSelectedMember(null);
                        }}
                    >
                        <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                        <Text style={styles.checkInText}>Durum Sor</Text>
                    </Pressable>
                </Animated.View>
            )}
        </View>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    map: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 250,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
    },

    // Marker
    markerContainer: {
        alignItems: 'center',
        width: 60,
    },
    markerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2.5,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
            android: { elevation: 4 },
        }),
    },
    markerAvatarOnline: {
        backgroundColor: '#fff',
    },
    markerInitials: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    batteryBadge: {
        position: 'absolute',
        top: -4,
        right: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 6,
        minWidth: 24,
        alignItems: 'center',
    },
    batteryText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#fff',
    },
    nameLabel: {
        marginTop: 2,
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        maxWidth: 60,
    },
    nameLabelText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#1e293b',
        textAlign: 'center',
    },

    // Detail Card (bottom overlay)
    detailCard: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: { elevation: 8 },
        }),
    },
    detailCardClose: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    detailAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        marginRight: 12,
    },
    detailInitials: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    detailInfo: {
        flex: 1,
    },
    detailName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    detailStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    detailStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    detailStatusText: {
        fontSize: 13,
        color: '#64748b',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    detailRowText: {
        fontSize: 13,
        color: '#64748b',
    },
    checkInButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 8,
    },
    checkInText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});
