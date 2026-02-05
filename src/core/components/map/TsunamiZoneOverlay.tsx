/**
 * TSUNAMI ZONE OVERLAY COMPONENT - ELITE EDITION
 * 
 * Haritada tsunami risk zonlarını gösterir
 * 
 * Features:
 * - Kıyı şeritlerinde risk görselleştirmesi
 * - Gradient renklendirme
 * - Yüksek zemin noktaları
 * - Tahliye rotaları
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Polygon, Polyline, Marker, Circle } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { tsunamiRiskService, TsunamiZone } from '../../services/TsunamiRiskService';
import * as haptics from '../../utils/haptics';

interface TsunamiZoneOverlayProps {
    visible: boolean;
    userLocation?: { latitude: number; longitude: number } | null;
    onZonePress?: (zone: TsunamiZone) => void;
}

// Risk colors with opacity
const RISK_COLORS = {
    extreme: { fill: 'rgba(255, 0, 0, 0.25)', stroke: '#FF0000' },
    high: { fill: 'rgba(255, 107, 0, 0.20)', stroke: '#FF6B00' },
    moderate: { fill: 'rgba(255, 193, 7, 0.15)', stroke: '#FFC107' },
    low: { fill: 'rgba(76, 175, 80, 0.10)', stroke: '#4CAF50' },
};

export const TsunamiZoneOverlay = memo(({
    visible,
    userLocation,
    onZonePress
}: TsunamiZoneOverlayProps) => {
    const [selectedZone, setSelectedZone] = useState<TsunamiZone | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const zones = tsunamiRiskService.getTsunamiZones();
    const highGroundPoints = tsunamiRiskService.getHighGroundPoints();

    const handleZonePress = useCallback((zone: TsunamiZone) => {
        haptics.impactMedium();
        setSelectedZone(zone);
        setModalVisible(true);
        onZonePress?.(zone);
    }, [onZonePress]);

    const closeModal = useCallback(() => {
        setModalVisible(false);
        setSelectedZone(null);
    }, []);

    if (!visible) return null;

    return (
        <>
            {/* Tsunami Risk Zones - Coastal Buffer */}
            {zones.map((zone) => {
                const colors = RISK_COLORS[zone.riskLevel];

                // Create coastal buffer polygon (simplified visual)
                return (
                    <React.Fragment key={zone.id}>
                        {/* Coastal line */}
                        <Polyline
                            coordinates={zone.coastLine}
                            strokeColor={colors.stroke}
                            strokeWidth={zone.riskLevel === 'extreme' ? 5 : 3}
                            lineDashPattern={[5, 2]}
                            tappable
                            onPress={() => handleZonePress(zone)}
                        />

                        {/* Risk circles along coast */}
                        {zone.coastLine.map((point, index) => (
                            <Circle
                                key={`${zone.id}_circle_${index}`}
                                center={point}
                                radius={zone.riskLevel === 'extreme' ? 1500 : 1000}
                                fillColor={colors.fill}
                                strokeColor={colors.stroke}
                                strokeWidth={1}
                            />
                        ))}
                    </React.Fragment>
                );
            })}

            {/* High Ground Evacuation Points */}
            {highGroundPoints.map((point) => (
                <Marker
                    key={`high_${point.name}`}
                    coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                    anchor={{ x: 0.5, y: 1 }}
                >
                    <View style={styles.highGroundMarker}>
                        <Ionicons name="arrow-up-circle" size={28} color="#4CAF50" />
                    </View>
                </Marker>
            ))}

            {/* User Risk Indicator */}
            {userLocation && tsunamiRiskService.isInExtremeRiskZone(userLocation.latitude, userLocation.longitude) && (
                <Circle
                    center={userLocation}
                    radius={100}
                    fillColor="rgba(255, 0, 0, 0.3)"
                    strokeColor="#FF0000"
                    strokeWidth={2}
                />
            )}

            {/* Zone Info Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeModal}
            >
                <Pressable style={styles.modalOverlay} onPress={closeModal}>
                    <BlurView intensity={20} style={styles.modalContent}>
                        <Pressable onPress={() => { }} style={styles.modalInner}>
                            {selectedZone && (
                                <>
                                    {/* Header */}
                                    <View style={styles.modalHeader}>
                                        <View style={[
                                            styles.waveIcon,
                                            { backgroundColor: RISK_COLORS[selectedZone.riskLevel].stroke }
                                        ]}>
                                            <Ionicons name="water" size={24} color="white" />
                                        </View>
                                        <View style={styles.headerInfo}>
                                            <Text style={styles.modalTitle}>{selectedZone.name}</Text>
                                            <Text style={styles.modalSubtitle}>{selectedZone.region}</Text>
                                        </View>
                                    </View>

                                    {/* Risk Badge */}
                                    <View style={[
                                        styles.riskBadge,
                                        { backgroundColor: RISK_COLORS[selectedZone.riskLevel].fill }
                                    ]}>
                                        <Ionicons
                                            name="warning"
                                            size={16}
                                            color={RISK_COLORS[selectedZone.riskLevel].stroke}
                                        />
                                        <Text style={[
                                            styles.riskText,
                                            { color: RISK_COLORS[selectedZone.riskLevel].stroke }
                                        ]}>
                                            {selectedZone.riskLevel === 'extreme' ? 'AŞIRI RİSK' :
                                                selectedZone.riskLevel === 'high' ? 'YÜKSEK RİSK' :
                                                    selectedZone.riskLevel === 'moderate' ? 'ORTA RİSK' : 'DÜŞÜK RİSK'}
                                        </Text>
                                    </View>

                                    {/* Stats */}
                                    <View style={styles.statsRow}>
                                        <View style={styles.statItem}>
                                            <Ionicons name="resize" size={20} color="#1F4E79" />
                                            <Text style={styles.statValue}>{selectedZone.maxWaveHeight}m</Text>
                                            <Text style={styles.statLabel}>Max Dalga</Text>
                                        </View>
                                        <View style={styles.statItem}>
                                            <Ionicons name="time" size={20} color="#1F4E79" />
                                            <Text style={styles.statValue}>{selectedZone.historicalEvents}</Text>
                                            <Text style={styles.statLabel}>Tarihsel</Text>
                                        </View>
                                    </View>

                                    {/* Warnings */}
                                    <View style={styles.warningsContainer}>
                                        <Text style={styles.warningsTitle}>⚠️ Uyarılar</Text>
                                        {selectedZone.warnings.map((warning, index) => (
                                            <View key={index} style={styles.warningItem}>
                                                <Text style={styles.warningText}>• {warning}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Evacuation Routes */}
                                    {selectedZone.evacuationRoutes.length > 0 && (
                                        <View style={styles.routesContainer}>
                                            <Text style={styles.routesTitle}>🏔️ Tahliye Noktaları</Text>
                                            {selectedZone.evacuationRoutes.map((route, index) => (
                                                <View key={index} style={styles.routeItem}>
                                                    <Ionicons name="arrow-up-circle" size={18} color="#4CAF50" />
                                                    <Text style={styles.routeName}>{route.name}</Text>
                                                    <Text style={styles.routeElevation}>+{route.elevationGain}m</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    <Pressable style={styles.closeButton} onPress={closeModal}>
                                        <Text style={styles.closeButtonText}>Kapat</Text>
                                    </Pressable>
                                </>
                            )}
                        </Pressable>
                    </BlurView>
                </Pressable>
            </Modal>
        </>
    );
});

TsunamiZoneOverlay.displayName = 'TsunamiZoneOverlay';

const styles = StyleSheet.create({
    highGroundMarker: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: '90%',
        maxHeight: '80%',
        borderRadius: 20,
        overflow: 'hidden',
    },
    modalInner: {
        padding: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    waveIcon: {
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
    riskBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
    },
    riskText: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 20,
    },
    statItem: {
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a2e',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 11,
        color: '#8E8E93',
        marginTop: 2,
    },
    warningsContainer: {
        backgroundColor: '#FFF3E0',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    warningsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#E65100',
        marginBottom: 8,
    },
    warningItem: {
        marginTop: 4,
    },
    warningText: {
        fontSize: 13,
        color: '#E65100',
        lineHeight: 20,
    },
    routesContainer: {
        backgroundColor: '#E8F5E9',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    routesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2E7D32',
        marginBottom: 8,
    },
    routeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    routeName: {
        fontSize: 13,
        color: '#2E7D32',
        flex: 1,
    },
    routeElevation: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4CAF50',
    },
    closeButton: {
        backgroundColor: '#1F4E79',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
