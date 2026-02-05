/**
 * FAULT LINE OVERLAY COMPONENT - ELITE EDITION
 * 
 * Haritada fay hatlarını gösterir
 * 
 * Features:
 * - Kritik fay hatları kırmızı çizgi
 * - Risk seviyesine göre renklendirme
 * - İnteraktif dokunma ile bilgi
 * - Animasyonlu çizim
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Polyline } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { turkeyOfflineDataService, FaultLine } from '../../services/TurkeyOfflineDataService';
import * as haptics from '../../utils/haptics';

interface FaultLineOverlayProps {
    visible: boolean;
    onFaultLinePress?: (faultLine: FaultLine) => void;
}

// Risk level colors
const RISK_COLORS = {
    critical: '#FF0000',  // Red
    high: '#FF6B00',      // Orange
    moderate: '#FFD700',  // Yellow
};

const RISK_STROKE_WIDTH = {
    critical: 4,
    high: 3,
    moderate: 2,
};

export const FaultLineOverlay = memo(({ visible, onFaultLinePress }: FaultLineOverlayProps) => {
    const [selectedFault, setSelectedFault] = useState<FaultLine | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const faultLines = turkeyOfflineDataService.getAllFaultLines();

    const handleFaultPress = useCallback((fault: FaultLine) => {
        haptics.impactLight();
        setSelectedFault(fault);
        setModalVisible(true);
        onFaultLinePress?.(fault);
    }, [onFaultLinePress]);

    const closeModal = useCallback(() => {
        setModalVisible(false);
        setSelectedFault(null);
    }, []);

    if (!visible) return null;

    return (
        <>
            {faultLines.map((fault) => (
                <Polyline
                    key={fault.id}
                    coordinates={fault.segments}
                    strokeColor={RISK_COLORS[fault.riskLevel]}
                    strokeWidth={RISK_STROKE_WIDTH[fault.riskLevel]}
                    lineDashPattern={fault.riskLevel === 'critical' ? undefined : [10, 5]}
                    tappable
                    onPress={() => handleFaultPress(fault)}
                />
            ))}

            {/* Fault Line Info Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeModal}
            >
                <Pressable style={styles.modalOverlay} onPress={closeModal}>
                    <BlurView intensity={20} style={styles.modalContent}>
                        <Pressable onPress={() => { }} style={styles.modalInner}>
                            {selectedFault && (
                                <>
                                    <View style={styles.modalHeader}>
                                        <Ionicons
                                            name="warning"
                                            size={24}
                                            color={RISK_COLORS[selectedFault.riskLevel]}
                                        />
                                        <Text style={styles.modalTitle}>{selectedFault.name}</Text>
                                    </View>

                                    <View style={[
                                        styles.riskBadge,
                                        { backgroundColor: RISK_COLORS[selectedFault.riskLevel] + '20' }
                                    ]}>
                                        <Text style={[
                                            styles.riskText,
                                            { color: RISK_COLORS[selectedFault.riskLevel] }
                                        ]}>
                                            {selectedFault.riskLevel === 'critical' ? 'KRİTİK RİSK' :
                                                selectedFault.riskLevel === 'high' ? 'YÜKSEK RİSK' : 'ORTA RİSK'}
                                        </Text>
                                    </View>

                                    <Text style={styles.description}>{selectedFault.description}</Text>

                                    {selectedFault.lastMajorEarthquake && (
                                        <View style={styles.earthquakeInfo}>
                                            <Ionicons name="pulse" size={18} color="#FF6B6B" />
                                            <Text style={styles.earthquakeText}>
                                                Son büyük deprem: {selectedFault.lastMajorEarthquake.year}
                                                ({selectedFault.lastMajorEarthquake.magnitude} büyüklüğünde)
                                            </Text>
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

FaultLineOverlay.displayName = 'FaultLineOverlay';

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: '85%',
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
        gap: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a2e',
        flex: 1,
    },
    riskBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 16,
    },
    riskText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 14,
        color: '#4a4a6a',
        lineHeight: 22,
        marginBottom: 16,
    },
    earthquakeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
        gap: 8,
    },
    earthquakeText: {
        fontSize: 13,
        color: '#FF6B6B',
        flex: 1,
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
