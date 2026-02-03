/**
 * NETWORK STATUS BANNER - ELITE EDITION
 * Dynamic banner showing connection state
 * 
 * States:
 * - Online (green) - Cloud connected
 * - Mesh Only (orange) - BLE mesh active, no cloud
 * - Offline (red) - No connection
 * 
 * Features:
 * - Animated state transitions
 * - Pending message count
 * - Tap to expand details
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Pressable,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { connectionManager } from '../../services/ConnectionManager';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type ConnectionState = 'online' | 'mesh' | 'offline';

interface NetworkStatusBannerProps {
    pendingCount?: number;
    failedCount?: number;
    onRetryPressed?: () => void;
    style?: object;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
    pendingCount = 0,
    failedCount = 0,
    onRetryPressed,
    style,
}) => {
    const [expanded, setExpanded] = useState(false);
    const meshConnected = useMeshStore(state => state.isConnected);
    const connectionQuality = useMeshStore(state => state.connectionQuality);
    const peerCount = useMeshStore(state => state.peers.length);

    // Animation values
    const slideAnim = useRef(new Animated.Value(-50)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    // Determine connection state
    const [connectionState, setConnectionState] = useState<ConnectionState>('offline');

    useEffect(() => {
        const checkConnection = () => {
            if (connectionManager.isOnline) {
                setConnectionState('online');
            } else if (meshConnected) {
                setConnectionState('mesh');
            } else {
                setConnectionState('offline');
            }
        };

        checkConnection();
        const interval = setInterval(checkConnection, 3000);
        return () => clearInterval(interval);
    }, [meshConnected]);

    // Slide in animation
    useEffect(() => {
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, [slideAnim, scaleAnim]);

    const handlePress = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    const getStateConfig = () => {
        switch (connectionState) {
            case 'online':
                return {
                    icon: 'cloud-done' as const,
                    label: 'Çevrimiçi',
                    sublabel: 'Bulut bağlantısı aktif',
                    color: '#34C759',
                    bgColor: 'rgba(52, 199, 89, 0.15)',
                };
            case 'mesh':
                return {
                    icon: 'git-network' as const,
                    label: 'Mesh Ağı',
                    sublabel: `${peerCount} cihaz bağlı`,
                    color: '#FF9500',
                    bgColor: 'rgba(255, 149, 0, 0.15)',
                };
            case 'offline':
                return {
                    icon: 'cloud-offline' as const,
                    label: 'Çevrimdışı',
                    sublabel: 'Bağlantı yok',
                    color: '#FF3B30',
                    bgColor: 'rgba(255, 59, 48, 0.15)',
                };
        }
    };

    const config = getStateConfig();

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateY: slideAnim },
                        { scale: scaleAnim },
                    ],
                },
                style,
            ]}
        >
            <Pressable onPress={handlePress}>
                <BlurView intensity={80} tint="light" style={styles.blurContainer}>
                    <View style={[styles.banner, { backgroundColor: config.bgColor }]}>
                        {/* Main Status Row */}
                        <View style={styles.mainRow}>
                            <View style={styles.statusIndicator}>
                                <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                                <Ionicons name={config.icon} size={20} color={config.color} />
                            </View>

                            <View style={styles.textContainer}>
                                <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
                                <Text style={styles.sublabel}>{config.sublabel}</Text>
                            </View>

                            {/* Pending/Failed badges */}
                            <View style={styles.badges}>
                                {pendingCount > 0 && (
                                    <View style={[styles.badge, styles.pendingBadge]}>
                                        <Ionicons name="time" size={12} color="#FF9500" />
                                        <Text style={styles.badgeText}>{pendingCount}</Text>
                                    </View>
                                )}
                                {failedCount > 0 && (
                                    <View style={[styles.badge, styles.failedBadge]}>
                                        <Ionicons name="alert-circle" size={12} color="#FF3B30" />
                                        <Text style={[styles.badgeText, { color: '#FF3B30' }]}>{failedCount}</Text>
                                    </View>
                                )}
                            </View>

                            <Ionicons
                                name={expanded ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color="#999"
                            />
                        </View>

                        {/* Expanded Details */}
                        {expanded && (
                            <View style={styles.expandedContent}>
                                <View style={styles.divider} />

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Bağlantı Kalitesi</Text>
                                    <View style={styles.qualityBar}>
                                        {['poor', 'fair', 'good', 'excellent'].map((level, index) => (
                                            <View
                                                key={level}
                                                style={[
                                                    styles.qualitySegment,
                                                    index <= ['poor', 'fair', 'good', 'excellent'].indexOf(connectionQuality) &&
                                                    { backgroundColor: config.color },
                                                ]}
                                            />
                                        ))}
                                    </View>
                                </View>

                                {connectionState === 'mesh' && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Mesh Cihazları</Text>
                                        <Text style={styles.detailValue}>{peerCount} bağlı</Text>
                                    </View>
                                )}

                                {(pendingCount > 0 || failedCount > 0) && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Bekleyen Mesajlar</Text>
                                        <Text style={styles.detailValue}>{pendingCount + failedCount}</Text>
                                    </View>
                                )}

                                {failedCount > 0 && onRetryPressed && (
                                    <Pressable
                                        style={styles.retryButton}
                                        onPress={onRetryPressed}
                                    >
                                        <Ionicons name="refresh" size={16} color="#FFF" />
                                        <Text style={styles.retryText}>Tekrar Dene</Text>
                                    </Pressable>
                                )}
                            </View>
                        )}
                    </View>
                </BlurView>
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    blurContainer: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    banner: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    textContainer: {
        flex: 1,
        marginLeft: 12,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
    },
    sublabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    badges: {
        flexDirection: 'row',
        gap: 8,
        marginRight: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    pendingBadge: {
        backgroundColor: 'rgba(255, 149, 0, 0.2)',
    },
    failedBadge: {
        backgroundColor: 'rgba(255, 59, 48, 0.2)',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FF9500',
    },
    expandedContent: {
        marginTop: 12,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 13,
        color: '#666',
    },
    detailValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
    },
    qualityBar: {
        flexDirection: 'row',
        gap: 2,
    },
    qualitySegment: {
        width: 20,
        height: 6,
        backgroundColor: '#E5E5E5',
        borderRadius: 2,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginTop: 8,
    },
    retryText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default NetworkStatusBanner;
