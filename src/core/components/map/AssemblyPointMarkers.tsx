/**
 * ASSEMBLY POINT MARKERS COMPONENT - ELITE EDITION
 * 
 * Haritada toplanma alanlarını gösterir
 * 
 * Features:
 * - Custom marker ikonları
 * - Kapasite ve hizmet bilgisi
 * - Navigasyon entegrasyonu
 * - Clustering desteği
 * - Erişilebilirlik göstergesi
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Linking, Platform } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { turkeyAssemblyPointsService, AssemblyPoint } from '../../services/TurkeyAssemblyPointsService';
import * as haptics from '../../utils/haptics';

interface AssemblyPointMarkersProps {
    visible: boolean;
    userLocation?: { latitude: number; longitude: number } | null;
    maxPoints?: number;
    onPointPress?: (point: AssemblyPoint) => void;
}

// Type colors and icons
const TYPE_CONFIG = {
    park: { color: '#4CAF50', icon: 'leaf' as const, label: 'Park' },
    stadium: { color: '#2196F3', icon: 'football' as const, label: 'Stadyum' },
    square: { color: '#9C27B0', icon: 'grid' as const, label: 'Meydan' },
    school: { color: '#FF9800', icon: 'school' as const, label: 'Okul' },
    field: { color: '#795548', icon: 'expand' as const, label: 'Açık Alan' },
    other: { color: '#607D8B', icon: 'location' as const, label: 'Diğer' },
};

export const AssemblyPointMarkers = memo(({
    visible,
    userLocation,
    maxPoints = 50,
    onPointPress
}: AssemblyPointMarkersProps) => {
    const [selectedPoint, setSelectedPoint] = useState<AssemblyPoint | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Get points - if user location available, get nearest ones
    const points = userLocation
        ? turkeyAssemblyPointsService.findNearest(userLocation.latitude, userLocation.longitude, maxPoints)
        : turkeyAssemblyPointsService.getAllPoints().slice(0, maxPoints);

    const handleMarkerPress = useCallback((point: AssemblyPoint) => {
        haptics.impactLight();
        setSelectedPoint(point);
        setModalVisible(true);
        onPointPress?.(point);
    }, [onPointPress]);

    const closeModal = useCallback(() => {
        setModalVisible(false);
        setSelectedPoint(null);
    }, []);

    const openNavigation = useCallback((point: AssemblyPoint) => {
        const url = Platform.select({
            ios: `maps://app?daddr=${point.latitude},${point.longitude}&dirflg=w`,
            android: `google.navigation:q=${point.latitude},${point.longitude}&mode=w`,
        });
        if (url) {
            Linking.openURL(url).catch(() => {
                // Fallback to web Google Maps
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}&travelmode=walking`);
            });
        }
        closeModal();
    }, [closeModal]);

    const formatCapacity = (capacity: number): string => {
        if (capacity >= 1000000) return `${(capacity / 1000000).toFixed(1)}M`;
        if (capacity >= 1000) return `${(capacity / 1000).toFixed(0)}K`;
        return String(capacity);
    };

    if (!visible) return null;

    return (
        <>
            {points.map((point) => {
                const config = TYPE_CONFIG[point.type] || TYPE_CONFIG.other;

                return (
                    <Marker
                        key={point.id}
                        coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                        onPress={() => handleMarkerPress(point)}
                        tracksViewChanges={false}
                    >
                        {/* Custom Marker */}
                        <View style={[styles.markerContainer, { backgroundColor: config.color }]}>
                            <Ionicons name={config.icon} size={16} color="white" />
                        </View>
                        <View style={[styles.markerArrow, { borderTopColor: config.color }]} />

                        {/* Callout */}
                        <Callout tooltip>
                            <View style={styles.calloutContainer}>
                                <Text style={styles.calloutTitle}>{point.name}</Text>
                                <Text style={styles.calloutSubtitle}>{point.district}</Text>
                            </View>
                        </Callout>
                    </Marker>
                );
            })}

            {/* Detail Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={closeModal}
            >
                <Pressable style={styles.modalOverlay} onPress={closeModal}>
                    <View style={styles.modalContent}>
                        <BlurView intensity={80} style={styles.modalBlur}>
                            {selectedPoint && (
                                <View style={styles.modalInner}>
                                    {/* Header */}
                                    <View style={styles.modalHeader}>
                                        <View style={[
                                            styles.typeIcon,
                                            { backgroundColor: TYPE_CONFIG[selectedPoint.type]?.color || '#607D8B' }
                                        ]}>
                                            <Ionicons
                                                name={TYPE_CONFIG[selectedPoint.type]?.icon || 'location'}
                                                size={24}
                                                color="white"
                                            />
                                        </View>
                                        <View style={styles.headerInfo}>
                                            <Text style={styles.modalTitle}>{selectedPoint.name}</Text>
                                            <Text style={styles.modalSubtitle}>
                                                {selectedPoint.district}, {selectedPoint.province.charAt(0).toUpperCase() + selectedPoint.province.slice(1)}
                                            </Text>
                                        </View>
                                        <Pressable onPress={closeModal} hitSlop={10}>
                                            <Ionicons name="close-circle" size={28} color="#8E8E93" />
                                        </Pressable>
                                    </View>

                                    {/* Badges */}
                                    <View style={styles.badgeRow}>
                                        {selectedPoint.isAfadApproved && (
                                            <View style={styles.afadBadge}>
                                                <Ionicons name="shield-checkmark" size={14} color="#34C759" />
                                                <Text style={styles.afadText}>AFAD Onaylı</Text>
                                            </View>
                                        )}
                                        <View style={styles.capacityBadge}>
                                            <Ionicons name="people" size={14} color="#007AFF" />
                                            <Text style={styles.capacityText}>{formatCapacity(selectedPoint.capacity)} kişi</Text>
                                        </View>
                                    </View>

                                    {/* Accessibility */}
                                    <View style={styles.accessibilityRow}>
                                        {selectedPoint.accessibility.wheelchair && (
                                            <View style={styles.accessIcon}>
                                                <Text style={styles.accessEmoji}>♿</Text>
                                                <Text style={styles.accessLabel}>Tekerlekli</Text>
                                            </View>
                                        )}
                                        {selectedPoint.accessibility.elderly && (
                                            <View style={styles.accessIcon}>
                                                <Text style={styles.accessEmoji}>👴</Text>
                                                <Text style={styles.accessLabel}>Yaşlı</Text>
                                            </View>
                                        )}
                                        {selectedPoint.accessibility.children && (
                                            <View style={styles.accessIcon}>
                                                <Text style={styles.accessEmoji}>👶</Text>
                                                <Text style={styles.accessLabel}>Çocuk</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Services */}
                                    <View style={styles.servicesContainer}>
                                        <Text style={styles.servicesTitle}>Hizmetler</Text>
                                        <View style={styles.servicesRow}>
                                            {selectedPoint.services.map((service, index) => (
                                                <View key={index} style={styles.serviceChip}>
                                                    <Text style={styles.serviceText}>{service}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Navigate Button */}
                                    <Pressable
                                        style={styles.navigateButton}
                                        onPress={() => openNavigation(selectedPoint)}
                                    >
                                        <Ionicons name="navigate" size={20} color="white" />
                                        <Text style={styles.navigateText}>Yol Tarifi Al</Text>
                                    </Pressable>
                                </View>
                            )}
                        </BlurView>
                    </View>
                </Pressable>
            </Modal>
        </>
    );
});

AssemblyPointMarkers.displayName = 'AssemblyPointMarkers';

const styles = StyleSheet.create({
    markerContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    markerArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        alignSelf: 'center',
        marginTop: -2,
    },
    calloutContainer: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 8,
        minWidth: 120,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a2e',
    },
    calloutSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    modalBlur: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
    },
    modalInner: {
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    typeIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a2e',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 2,
    },
    badgeRow: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 10,
    },
    afadBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    afadText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#34C759',
    },
    capacityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    capacityText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#007AFF',
    },
    accessibilityRow: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 16,
    },
    accessIcon: {
        alignItems: 'center',
    },
    accessEmoji: {
        fontSize: 24,
    },
    accessLabel: {
        fontSize: 10,
        color: '#8E8E93',
        marginTop: 4,
    },
    servicesContainer: {
        marginBottom: 20,
    },
    servicesTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    serviceChip: {
        backgroundColor: '#F2F2F7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    serviceText: {
        fontSize: 13,
        color: '#3a3a5c',
    },
    navigateButton: {
        flexDirection: 'row',
        backgroundColor: '#1F4E79',
        paddingVertical: 16,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    navigateText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
