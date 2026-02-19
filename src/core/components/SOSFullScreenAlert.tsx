/**
 * SOS FULL-SCREEN ALERT - ELITE V4
 * Shown when an SOS notification arrives while app is in foreground.
 * Replaces the basic Alert.alert with a prominent, full-screen modal.
 *
 * FEATURES:
 * - Red gradient background with pulse animation
 * - Large SOS icon + "ACİL DURUM" title
 * - Sender name, message, location
 * - 3 action buttons: "Yardıma Git", "Konuma Git", "112 Ara"
 * - Short alarm tone + haptic
 * - Auto-dismiss after 60 seconds
 * - DeviceEventEmitter-driven (works fully offline)
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    DeviceEventEmitter,
    Linking,
    Platform,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
} from 'react-native-reanimated';
import * as haptics from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// EVENT NAME — used by NotificationCenter to trigger this alert
// ============================================================================

export const SOS_FULLSCREEN_ALERT_EVENT = 'SOS_FULLSCREEN_ALERT';

export interface SOSFullScreenAlertData {
    signalId?: string;
    senderUid?: string;
    senderDeviceId?: string;
    senderName: string;
    message: string;
    latitude?: number;
    longitude?: number;
    trapped?: boolean;
    battery?: number;
    healthInfo?: Record<string, string>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SOSFullScreenAlert() {
    const [visible, setVisible] = useState(false);
    const [alertData, setAlertData] = useState<SOSFullScreenAlertData | null>(null);
    const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);
    const lastAlertIdRef = useRef<string | null>(null);
    const lastAlertTimeRef = useRef<number>(0);

    // Pulse animation
    const pulseScale = useSharedValue(1);

    useEffect(() => {
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.9, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
        );
    }, [pulseScale]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    // Listen for SOS alert events
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            SOS_FULLSCREEN_ALERT_EVENT,
            (data: SOSFullScreenAlertData) => {
                // Dedup: Ignore duplicate alerts for the same signal within 30 seconds
                // This prevents double-trigger from both mesh direct emit + notification chain
                const alertKey = data.signalId || `${data.senderName}_${data.message}`;
                const now = Date.now();
                if (alertKey === lastAlertIdRef.current && now - lastAlertTimeRef.current < 30_000) {
                    return; // Skip duplicate
                }
                lastAlertIdRef.current = alertKey;
                lastAlertTimeRef.current = now;

                setAlertData(data);
                setVisible(true);

                // Haptic burst
                haptics.impactHeavy();
                setTimeout(() => haptics.impactHeavy(), 200);
                setTimeout(() => haptics.impactHeavy(), 400);

                // Play short alarm tone via WhistleService (non-blocking, works offline)
                import('../services/WhistleService').then(({ whistleService }) => {
                    whistleService.initialize().then(() => {
                        whistleService.playSOSWhistle('morse');
                        // Stop after 5 seconds (short alert tone)
                        setTimeout(() => whistleService.stop(), 5000);
                    });
                }).catch(() => { /* non-critical */ });

                // Auto-dismiss after 60 seconds
                if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
                autoDismissTimer.current = setTimeout(() => {
                    setVisible(false);
                }, 60_000);
            },
        );

        return () => {
            subscription.remove();
            if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
        };
    }, []);

    const handleDismiss = useCallback(() => {
        setVisible(false);
        if (autoDismissTimer.current) {
            clearTimeout(autoDismissTimer.current);
            autoDismissTimer.current = null;
        }
    }, []);

    const handleGoToHelp = useCallback(() => {
        handleDismiss();
        if (!alertData) return;

        import('../navigation/navigationRef').then(({ navigateTo }) => {
            navigateTo('SOSHelp', {
                signalId: alertData.signalId,
                senderUid: alertData.senderUid,
                senderDeviceId: alertData.senderDeviceId,
                senderName: alertData.senderName,
                latitude: alertData.latitude,
                longitude: alertData.longitude,
                message: alertData.message,
                trapped: alertData.trapped,
                battery: alertData.battery,
                healthInfo: alertData.healthInfo,
            });
        }).catch(() => { });
    }, [alertData, handleDismiss]);

    const handleOpenMaps = useCallback(() => {
        if (!alertData?.latitude || !alertData?.longitude) return;
        handleDismiss();

        // Navigate to in-app DisasterMap with SOS focus instead of external maps
        import('../navigation/navigationRef').then(({ navigateTo }) => {
            navigateTo('DisasterMap', {
                focusOnSOS: true,
                sosLatitude: alertData.latitude,
                sosLongitude: alertData.longitude,
                sosSenderName: alertData.senderName || 'SOS',
            });
        }).catch(() => { });
    }, [alertData, handleDismiss]);

    const handleCall112 = useCallback(() => {
        haptics.impactHeavy();
        Linking.openURL('tel:112');
    }, []);

    if (!visible || !alertData) return null;

    const locationText = alertData.latitude && alertData.longitude
        ? `${alertData.latitude.toFixed(4)}, ${alertData.longitude.toFixed(4)}`
        : null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleDismiss}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <LinearGradient
                    colors={['#7f1d1d', '#dc2626', '#991b1b']}
                    style={StyleSheet.absoluteFill}
                />

                {/* Close button */}
                <Pressable style={styles.closeButton} onPress={handleDismiss}>
                    <Ionicons name="close" size={28} color="#fff" />
                </Pressable>

                <View style={styles.content}>
                    {/* Pulsating SOS Icon */}
                    <Animated.View style={[styles.iconContainer, pulseStyle]}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="alert-circle" size={64} color="#fff" />
                        </View>
                    </Animated.View>

                    {/* Title */}
                    <Text style={styles.title}>ACİL DURUM</Text>

                    {/* Sender Info */}
                    <Text style={styles.senderName}>{alertData.senderName}</Text>
                    <Text style={styles.message}>{alertData.message}</Text>

                    {/* Location */}
                    {locationText && (
                        <View style={styles.locationRow}>
                            <Ionicons name="location" size={16} color="#fbbf24" />
                            <Text style={styles.locationText}>{locationText}</Text>
                        </View>
                    )}

                    {/* Trapped badge */}
                    {alertData.trapped && (
                        <View style={styles.trappedBadge}>
                            <Ionicons name="warning" size={16} color="#fff" />
                            <Text style={styles.trappedText}>Enkaz Altında!</Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.actions}>
                        <Pressable
                            style={({ pressed }) => [styles.actionButton, styles.actionPrimary, pressed && { opacity: 0.8 }]}
                            onPress={handleGoToHelp}
                        >
                            <Ionicons name="hand-left" size={24} color="#fff" />
                            <Text style={styles.actionText}>Yardıma Git</Text>
                        </Pressable>

                        {alertData.latitude && alertData.longitude && (
                            <Pressable
                                style={({ pressed }) => [styles.actionButton, styles.actionMaps, pressed && { opacity: 0.8 }]}
                                onPress={handleOpenMaps}
                            >
                                <Ionicons name="navigate" size={24} color="#fff" />
                                <Text style={styles.actionText}>Konuma Git</Text>
                            </Pressable>
                        )}

                        <Pressable
                            style={({ pressed }) => [styles.actionButton, styles.action112, pressed && { opacity: 0.8 }]}
                            onPress={handleCall112}
                        >
                            <Ionicons name="call" size={24} color="#fff" />
                            <Text style={styles.actionText}>112 Ara</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 32,
        width: '100%',
    },
    iconContainer: {
        marginBottom: 20,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        letterSpacing: 2,
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 8,
    },
    senderName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fbbf24',
        textAlign: 'center',
        marginTop: 12,
    },
    message: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 22,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    locationText: {
        fontSize: 13,
        color: '#fbbf24',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    trappedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        backgroundColor: '#b91c1c',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 2,
        borderColor: '#fbbf24',
    },
    trappedText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#fff',
    },
    actions: {
        width: '100%',
        marginTop: 32,
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        paddingVertical: 16,
        gap: 10,
    },
    actionPrimary: {
        backgroundColor: '#22c55e',
    },
    actionMaps: {
        backgroundColor: '#1e40af',
    },
    action112: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 2,
        borderColor: '#fff',
    },
    actionText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
    },
});
