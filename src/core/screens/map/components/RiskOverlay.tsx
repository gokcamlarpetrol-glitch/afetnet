/**
 * RISK OVERLAY - ELITE EDITION
 * Displays regional risk zones on the map
 * 
 * Uses RegionalRiskService data to show:
 * - Earthquake risk zones
 * - Tsunami risk areas
 * - Flood zones
 * - Landslide prone areas
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Circle, Polygon } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { regionalRiskService, RegionalRisk } from '../../../services/RegionalRiskService';
import { colors } from '../../../theme';
import * as haptics from '../../../utils/haptics';

interface RiskOverlayProps {
    visible: boolean;
    userLocation: { latitude: number; longitude: number } | null;
    onRiskCalculated?: (risk: RegionalRisk) => void;
}

// ELITE: Risk zone definitions for major cities
const RISK_ZONES = [
    // Istanbul - High Risk Areas
    {
        id: 'istanbul_avcilar',
        name: 'Avcılar',
        center: { latitude: 40.9792, longitude: 28.7214 },
        radius: 8000,
        riskLevel: 'critical' as const,
        riskScore: 95,
        riskType: 'earthquake',
    },
    {
        id: 'istanbul_zeytinburnu',
        name: 'Zeytinburnu',
        center: { latitude: 40.9945, longitude: 28.9050 },
        radius: 5000,
        riskLevel: 'high' as const,
        riskScore: 85,
        riskType: 'earthquake',
    },
    {
        id: 'istanbul_bagcilar',
        name: 'Bağcılar',
        center: { latitude: 41.0392, longitude: 28.8567 },
        radius: 6000,
        riskLevel: 'high' as const,
        riskScore: 88,
        riskType: 'earthquake',
    },
    {
        id: 'istanbul_kucukcekmece',
        name: 'Küçükçekmece',
        center: { latitude: 41.0007, longitude: 28.7672 },
        radius: 7000,
        riskLevel: 'critical' as const,
        riskScore: 92,
        riskType: 'tsunami',
    },
    // Izmir - Moderate-High Risk
    {
        id: 'izmir_konak',
        name: 'Konak',
        center: { latitude: 38.4192, longitude: 27.1287 },
        radius: 5000,
        riskLevel: 'high' as const,
        riskScore: 75,
        riskType: 'earthquake',
    },
    {
        id: 'izmir_bayrakli',
        name: 'Bayraklı',
        center: { latitude: 38.4621, longitude: 27.1650 },
        radius: 4000,
        riskLevel: 'critical' as const,
        riskScore: 90,
        riskType: 'earthquake',
    },
    // Ankara - Low-Moderate Risk
    {
        id: 'ankara_kecioren',
        name: 'Keçiören',
        center: { latitude: 39.9889, longitude: 32.8597 },
        radius: 8000,
        riskLevel: 'moderate' as const,
        riskScore: 45,
        riskType: 'earthquake',
    },
];

/**
 * Get fill color based on risk level
 */
const getRiskFillColor = (level: 'low' | 'moderate' | 'high' | 'critical'): string => {
    switch (level) {
        case 'critical': return 'rgba(127, 29, 29, 0.35)';    // Dark red
        case 'high': return 'rgba(239, 68, 68, 0.30)';        // Red
        case 'moderate': return 'rgba(249, 115, 22, 0.25)';   // Orange
        case 'low': return 'rgba(34, 197, 94, 0.20)';         // Green
        default: return 'rgba(107, 114, 128, 0.15)';
    }
};

/**
 * Get stroke color based on risk level
 */
const getRiskStrokeColor = (level: 'low' | 'moderate' | 'high' | 'critical'): string => {
    switch (level) {
        case 'critical': return 'rgba(127, 29, 29, 0.8)';
        case 'high': return 'rgba(239, 68, 68, 0.7)';
        case 'moderate': return 'rgba(249, 115, 22, 0.6)';
        case 'low': return 'rgba(34, 197, 94, 0.5)';
        default: return 'rgba(107, 114, 128, 0.4)';
    }
};

/**
 * Get icon based on risk type
 */
const getRiskIcon = (type: string): string => {
    switch (type) {
        case 'earthquake': return 'pulse';
        case 'tsunami': return 'water';
        case 'flood': return 'rainy';
        case 'landslide': return 'trending-down';
        case 'fire': return 'flame';
        default: return 'warning';
    }
};

/**
 * Risk Zone Circle Component
 */
const RiskZoneCircle = ({ zone }: { zone: typeof RISK_ZONES[0] }) => (
    <Circle
        key={zone.id}
        center={zone.center}
        radius={zone.radius}
        fillColor={getRiskFillColor(zone.riskLevel)}
        strokeColor={getRiskStrokeColor(zone.riskLevel)}
        strokeWidth={2}
        zIndex={zone.riskScore}
    />
);

/**
 * User Risk Indicator - Shows user's current risk level
 */
const UserRiskIndicator = ({ risk }: { risk: RegionalRisk | null }) => {
    if (!risk) return null;

    const getRiskLevelText = (score: number): string => {
        if (score >= 80) return 'Kritik';
        if (score >= 60) return 'Yüksek';
        if (score >= 40) return 'Orta';
        return 'Düşük';
    };

    const getRiskLevelColor = (score: number): string => {
        if (score >= 80) return colors.status.danger;
        if (score >= 60) return colors.status.warning;
        if (score >= 40) return '#F59E0B';
        return colors.status.success;
    };

    return (
        <View style={styles.riskIndicator}>
            <View style={[styles.riskBadge, { backgroundColor: getRiskLevelColor(risk.overallRisk) }]}>
                <Ionicons name="warning" size={14} color="#fff" />
                <Text style={styles.riskBadgeText}>
                    {getRiskLevelText(risk.overallRisk)} Risk
                </Text>
                <Text style={styles.riskScore}>{Math.round(risk.overallRisk)}%</Text>
            </View>
        </View>
    );
};

/**
 * Main Risk Overlay Component
 */
export const RiskOverlay = ({ visible, userLocation, onRiskCalculated }: RiskOverlayProps) => {
    const [userRisk, setUserRisk] = useState<RegionalRisk | null>(null);

    // Calculate user's risk when location changes
    useEffect(() => {
        if (!visible || !userLocation) return;

        const calculateRisk = async () => {
            try {
                const risk = await regionalRiskService.calculateRisk(
                    userLocation.latitude,
                    userLocation.longitude
                );
                setUserRisk(risk);
                onRiskCalculated?.(risk);
            } catch (err) {
                // Silent fail - risk calculation is optional
            }
        };

        calculateRisk();
    }, [visible, userLocation, onRiskCalculated]);

    if (!visible) return null;

    return (
        <>
            {/* Risk Zone Circles */}
            {RISK_ZONES.map((zone) => (
                <RiskZoneCircle key={zone.id} zone={zone} />
            ))}

            {/* User's Risk Circle (if location available) */}
            {userLocation && userRisk && (
                <Circle
                    center={userLocation}
                    radius={500}
                    fillColor={
                        userRisk.overallRisk >= 80 ? 'rgba(239, 68, 68, 0.4)' :
                            userRisk.overallRisk >= 60 ? 'rgba(249, 115, 22, 0.35)' :
                                'rgba(34, 197, 94, 0.3)'
                    }
                    strokeColor={
                        userRisk.overallRisk >= 80 ? '#EF4444' :
                            userRisk.overallRisk >= 60 ? '#F97316' :
                                '#22C55E'
                    }
                    strokeWidth={3}
                    zIndex={100}
                />
            )}
        </>
    );
};

/**
 * Risk Legend Component - Shows risk level legend
 */
export const RiskLegend = ({ visible }: { visible: boolean }) => {
    if (!visible) return null;

    return (
        <View style={styles.legend}>
            <Text style={styles.legendTitle}>Risk Seviyeleri</Text>
            <View style={styles.legendItems}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: 'rgba(127, 29, 29, 0.6)' }]} />
                    <Text style={styles.legendText}>Kritik (80%+)</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: 'rgba(239, 68, 68, 0.5)' }]} />
                    <Text style={styles.legendText}>Yüksek (60-80%)</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: 'rgba(249, 115, 22, 0.4)' }]} />
                    <Text style={styles.legendText}>Orta (40-60%)</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: 'rgba(34, 197, 94, 0.3)' }]} />
                    <Text style={styles.legendText}>Düşük (0-40%)</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    riskIndicator: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        zIndex: 50,
    },
    riskBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    riskBadgeText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    riskScore: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '500',
    },
    legend: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
        zIndex: 40,
    },
    legendTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1F4E79',
        marginBottom: 8,
    },
    legendItems: {
        gap: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendColor: {
        width: 16,
        height: 16,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 11,
        color: '#4B5563',
    },
});

export default RiskOverlay;
