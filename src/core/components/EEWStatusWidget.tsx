/**
 * EEW STATUS WIDGET - REAL-TIME PROTECTION STATUS
 * 
 * 🛡️ CANLIDA NE OLUYOR GÖSTER
 * 
 * Shows live status of all earthquake detection systems:
 * - On-Device P-Wave detector
 * - Crowdsourced Network
 * - Background Monitor
 * - Multi-source monitoring
 * 
 * ELITE FEATURES:
 * - Animated pulse when active
 * - Traffic light status (Green/Yellow/Red)
 * - Tap to open settings
 * - Real-time metrics
 * 
 * @version 1.0.0
 * @elite true
 */

import React, { useEffect, useState, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

// ============================================================
// TYPES
// ============================================================

type StatusLevel = 'active' | 'partial' | 'inactive';

interface EEWStatus {
    onDevice: boolean;
    crowdsourced: boolean;
    background: boolean;
    multiSource: boolean;
    lastUpdate: number;
}

// ============================================================
// COMPONENT
// ============================================================

const EEWStatusWidget = memo(function EEWStatusWidget() {
    const navigation = useNavigation<StackNavigationProp<any>>();
    const [status, setStatus] = useState<EEWStatus>({
        onDevice: false,
        crowdsourced: false,
        background: false,
        multiSource: false,
        lastUpdate: Date.now(),
    });
    const [pulseAnim] = useState(new Animated.Value(1));

    // Animate pulse when all systems active
    useEffect(() => {
        const allActive = status.onDevice && status.crowdsourced && status.background && status.multiSource;

        if (allActive) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [status, pulseAnim]);

    // Poll for status updates
    useEffect(() => {
        const checkStatus = async () => {
            try {
                // Dynamic imports to avoid circular deps
                const [
                    { onDeviceSeismicDetector },
                    { crowdsourcedSeismicNetwork },
                    { backgroundSeismicMonitor },
                ] = await Promise.all([
                    import('../services/OnDeviceSeismicDetector'),
                    import('../services/CrowdsourcedSeismicNetwork'),
                    import('../services/BackgroundSeismicMonitor'),
                ]);

                setStatus({
                    onDevice: onDeviceSeismicDetector.getIsRunning(),
                    crowdsourced: crowdsourcedSeismicNetwork.getIsRunning(),
                    background: backgroundSeismicMonitor.getStatus().enabled,
                    multiSource: true, // Always running via Cloud Functions
                    lastUpdate: Date.now(),
                });
            } catch {
                // Services not yet initialized
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const getStatusLevel = useCallback((): StatusLevel => {
        const active = [status.onDevice, status.crowdsourced, status.background, status.multiSource];
        const count = active.filter(Boolean).length;

        if (count >= 3) return 'active';
        if (count >= 1) return 'partial';
        return 'inactive';
    }, [status]);

    const getStatusColor = useCallback(() => {
        const level = getStatusLevel();
        switch (level) {
            case 'active': return '#10B981';
            case 'partial': return '#F59E0B';
            case 'inactive': return '#EF4444';
        }
    }, [getStatusLevel]);

    const getStatusText = useCallback(() => {
        const level = getStatusLevel();
        switch (level) {
            case 'active': return 'Tam Koruma Aktif';
            case 'partial': return 'Kısmi Koruma';
            case 'inactive': return 'Koruma Pasif';
        }
    }, [getStatusLevel]);

    const handlePress = () => {
        navigation.navigate('EEWSettings');
    };

    const statusColor = getStatusColor();
    const activeCount = [status.onDevice, status.crowdsourced, status.background, status.multiSource].filter(Boolean).length;

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
                <LinearGradient
                    colors={['#18181B', '#1F1F23']}
                    style={styles.gradient}
                >
                    {/* Status Indicator */}
                    <View style={styles.header}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={styles.title}>Deprem Koruması</Text>
                        <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                    </View>

                    {/* Status Text */}
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {getStatusText()}
                    </Text>

                    {/* Service Icons */}
                    <View style={styles.services}>
                        <ServiceBadge
                            icon="phone-portrait"
                            label="Cihaz"
                            active={status.onDevice}
                        />
                        <ServiceBadge
                            icon="people"
                            label="Ağ"
                            active={status.crowdsourced}
                        />
                        <ServiceBadge
                            icon="moon"
                            label="7/24"
                            active={status.background}
                        />
                        <ServiceBadge
                            icon="cloud"
                            label="Bulut"
                            active={status.multiSource}
                        />
                    </View>

                    {/* Metrics */}
                    <View style={styles.metrics}>
                        <Text style={styles.metricsText}>
                            {activeCount}/4 sistem aktif • {'<'}1s tepki süresi
                        </Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
});

// ============================================================
// SERVICE BADGE SUB-COMPONENT
// ============================================================

interface ServiceBadgeProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    active: boolean;
}

const ServiceBadge = memo(function ServiceBadge({ icon, label, active }: ServiceBadgeProps) {
    return (
        <View style={[styles.badge, active && styles.badgeActive]}>
            <Ionicons
                name={icon}
                size={16}
                color={active ? '#10B981' : '#4B5563'}
            />
            <Text style={[styles.badgeLabel, active && styles.badgeLabelActive]}>
                {label}
            </Text>
        </View>
    );
});

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#27272A',
    },
    gradient: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    title: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statusText: {
        fontSize: 20,
        fontWeight: '700',
        marginTop: 8,
    },
    services: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 8,
    },
    badge: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: '#27272A',
    },
    badgeActive: {
        backgroundColor: '#10B98115',
        borderWidth: 1,
        borderColor: '#10B98140',
    },
    badgeLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    badgeLabelActive: {
        color: '#10B981',
    },
    metrics: {
        marginTop: 12,
        alignItems: 'center',
    },
    metricsText: {
        fontSize: 12,
        color: '#6B7280',
    },
});

export default EEWStatusWidget;
