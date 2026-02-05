/**
 * MAP LEGEND COMPONENT - ELITE EDITION
 * Premium collapsible legend for earthquake and family status visualization
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Magnitude color scale (USGS standard)
export const MAGNITUDE_COLORS = {
    minor: { min: 0, max: 3, color: '#22c55e', label: '< 3.0 Hafif' },
    light: { min: 3, max: 4.5, color: '#eab308', label: '3.0 - 4.5 Orta' },
    moderate: { min: 4.5, max: 5.5, color: '#f97316', label: '4.5 - 5.5 Kuvvetli' },
    strong: { min: 5.5, max: 6.5, color: '#ef4444', label: '5.5 - 6.5 Şiddetli' },
    major: { min: 6.5, max: 10, color: '#dc2626', label: '> 6.5 Yıkıcı' },
};

export const getMagnitudeColor = (magnitude: number): string => {
    if (magnitude < 3) return MAGNITUDE_COLORS.minor.color;
    if (magnitude < 4.5) return MAGNITUDE_COLORS.light.color;
    if (magnitude < 5.5) return MAGNITUDE_COLORS.moderate.color;
    if (magnitude < 6.5) return MAGNITUDE_COLORS.strong.color;
    return MAGNITUDE_COLORS.major.color;
};

// Family status colors
const FAMILY_STATUS_COLORS = [
    { status: 'safe', color: '#34C759', label: 'Güvende' },
    { status: 'need-help', color: '#FF9500', label: 'Yardım Gerekiyor' },
    { status: 'critical', color: '#FF3B30', label: 'Kritik' },
    { status: 'unknown', color: '#8E8E93', label: 'Bilinmiyor' },
];

interface MapLegendProps {
    mode: 'family' | 'earthquake';
    earthquakeCount?: number;
    style?: any;
}

export const MapLegend: React.FC<MapLegendProps> = ({ mode, earthquakeCount = 0, style }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpanded = () => {
        haptics.impactLight();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    return (
        <View style={[styles.container, style]}>
            <BlurView intensity={80} tint="light" style={styles.blurContainer}>
                {/* Header - Always visible */}
                <Pressable style={styles.header} onPress={toggleExpanded}>
                    <View style={styles.headerLeft}>
                        <Ionicons
                            name={mode === 'earthquake' ? 'pulse' : 'people'}
                            size={16}
                            color={mode === 'earthquake' ? '#ef4444' : '#007AFF'}
                        />
                        <Text style={styles.headerTitle}>
                            {mode === 'earthquake' ? 'Deprem Lejandı' : 'Aile Durumu'}
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        {mode === 'earthquake' && earthquakeCount > 0 && (
                            <View style={styles.countBadge}>
                                <Text style={styles.countText}>{earthquakeCount}</Text>
                            </View>
                        )}
                        <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color="#8E8E93"
                        />
                    </View>
                </Pressable>

                {/* Expanded content */}
                {isExpanded && (
                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(100)} style={styles.content}>
                        {mode === 'earthquake' ? (
                            // Earthquake magnitude legend
                            <View style={styles.legendItems}>
                                {Object.values(MAGNITUDE_COLORS).map((item) => (
                                    <View key={item.label} style={styles.legendItem}>
                                        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                                        <Text style={styles.legendLabel}>{item.label}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            // Family status legend
                            <View style={styles.legendItems}>
                                {FAMILY_STATUS_COLORS.map((item) => (
                                    <View key={item.status} style={styles.legendItem}>
                                        <View style={[styles.statusCircle, { backgroundColor: item.color }]}>
                                            <Text style={styles.statusInitial}>A</Text>
                                        </View>
                                        <Text style={styles.legendLabel}>{item.label}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </Animated.View>
                )}
            </BlurView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        minWidth: 160,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    blurContainer: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    countBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    countText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    content: {
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    legendItems: {
        gap: 8,
        marginTop: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    statusCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    statusInitial: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    legendLabel: {
        fontSize: 12,
        color: '#525252',
    },
});

export default MapLegend;
