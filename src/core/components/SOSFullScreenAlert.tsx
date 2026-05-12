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
 * - Manual dismiss with confirmation (life-safety: no auto-dismiss)
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
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    cancelAnimation,
    Easing,
} from 'react-native-reanimated';
import * as haptics from '../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// EVENT NAME — used by NotificationCenter to trigger this alert
// ============================================================================

export const SOS_FULLSCREEN_ALERT_EVENT = 'SOS_FULLSCREEN_ALERT';
export const SOS_FULLSCREEN_CANCEL_EVENT = 'SOS_FULLSCREEN_CANCEL';

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
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [alertData, setAlertData] = useState<SOSFullScreenAlertData | null>(null);
    const hapticTimers = useRef<NodeJS.Timeout[]>([]);
    const whistleStopTimer = useRef<NodeJS.Timeout | null>(null);
    const lastAlertIdRef = useRef<string | null>(null);
    const lastAlertTimeRef = useRef<number>(0);

    // CRITICAL FIX: Use a ref to track current alertData for the cancel listener.
    // The cancel listener's useEffect has [] dependency (registered once on mount)
    // so it cannot read the latest alertData from the closure. Without this ref,
    // the cancel handler always reads alertData=null (initial value) and exits
    // early at `if (!alertDataRef.current) return`, meaning SOS cancellation
    // NEVER dismisses the full-screen alert on the receiver's device.
    const alertDataRef = useRef<SOSFullScreenAlertData | null>(null);

    // BUG10 FIX: Prevent orphaned Alert.alert callbacks + state updates after unmount
    const isMountedRef = useRef(true);
    useEffect(() => {
        return () => { isMountedRef.current = false; };
    }, []);

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
        return () => { cancelAnimation(pulseScale); };
    }, [pulseScale]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    // CRITICAL FIX: Register event listeners ONCE on mount with stable [] dependency.
    // Previously, this effect had [alertData] as dependency, which caused:
    // 1. Listener tear-down and re-registration on every alertData change
    // 2. Brief gap where no listener is active (cancel events lost)
    // 3. Race condition: cancel event during React batch update hits old listener
    //    with stale alertData=null, causing `if (!alertData) return` to always exit
    // Now uses alertDataRef (updated synchronously) for cancel matching.
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

                // Update ref SYNCHRONOUSLY before setState (for cancel listener)
                alertDataRef.current = data;
                setAlertData(data);
                setVisible(true);

                // Haptic burst — track timers for cleanup
                haptics.impactHeavy();
                hapticTimers.current.forEach(t => clearTimeout(t));
                hapticTimers.current = [
                    setTimeout(() => haptics.impactHeavy(), 200),
                    setTimeout(() => haptics.impactHeavy(), 400),
                ];

                // Play short alarm tone via WhistleService (non-blocking, works offline)
                import('../services/WhistleService').then(({ whistleService }) => {
                    whistleService.initialize().then(() => {
                        whistleService.playSOSWhistle('morse');
                        // Stop after 5 seconds (short alert tone) — track timer for cleanup
                        if (whistleStopTimer.current) clearTimeout(whistleStopTimer.current);
                        whistleStopTimer.current = setTimeout(() => whistleService.stop(), 5000);
                    });
                }).catch(e => { if (__DEV__) console.debug('SOS whistle init failed:', e); });

                // LIFE-SAFETY: No auto-dismiss — SOS alerts must remain visible until
                // the user manually dismisses (with confirmation) or sender cancels.
            },
        );

        // Listen for SOS cancellation events to auto-dismiss the full-screen alert.
        // When Device A cancels SOS, Device B must dismiss this alert immediately.
        const cancelSubscription = DeviceEventEmitter.addListener(
            SOS_FULLSCREEN_CANCEL_EVENT,
            (cancelData: { signalId?: string }) => {
                // BUG10 FIX: Guard against state updates after unmount
                if (!isMountedRef.current) return;
                // CRITICAL FIX: Read from ref (always current) instead of closure (stale).
                const currentAlertData = alertDataRef.current;
                if (!currentAlertData) return;
                const currentKey = currentAlertData.signalId || `${currentAlertData.senderName}_${currentAlertData.message}`;
                const cancelKey = cancelData?.signalId;
                // Dismiss if signalId matches OR if no signalId provided (dismiss any active alert)
                if (!cancelKey || cancelKey === currentKey) {
                    // Stop whistle + clear all timers
                    if (whistleStopTimer.current) {
                        clearTimeout(whistleStopTimer.current);
                        whistleStopTimer.current = null;
                    }
                    import('../services/WhistleService').then(({ whistleService: ws }) => {
                        ws.stop();
                    }).catch(e => { if (__DEV__) console.debug('SOS whistle stop on cancel failed:', e); });
                    alertDataRef.current = null;
                    setVisible(false);
                }
            },
        );

        return () => {
            subscription.remove();
            cancelSubscription.remove();
            hapticTimers.current.forEach(t => clearTimeout(t));
            hapticTimers.current = [];
            if (whistleStopTimer.current) clearTimeout(whistleStopTimer.current);
            // CRITICAL FIX: Stop whistle on unmount to prevent infinite alarm
            import('../services/WhistleService').then(({ whistleService: ws }) => {
                ws.stop();
            }).catch(e => { if (__DEV__) console.debug('SOS whistle stop on unmount failed:', e); });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const performDismiss = useCallback(() => {
        // BUG10 FIX: Guard against state updates after unmount
        if (!isMountedRef.current) return;
        alertDataRef.current = null; // Clear ref so cancel listener won't match stale data
        setVisible(false);
        // CRITICAL FIX: Stop whistle + clear its timer on dismiss
        if (whistleStopTimer.current) {
            clearTimeout(whistleStopTimer.current);
            whistleStopTimer.current = null;
        }
        import('../services/WhistleService').then(({ whistleService: ws }) => {
            ws.stop();
        }).catch(e => { if (__DEV__) console.debug('SOS whistle stop on dismiss failed:', e); });
    }, []);

    const handleDismiss = useCallback(() => {
        // LIFE-SAFETY: Require confirmation before dismissing SOS alert
        Alert.alert(
            'SOS Bildirimi',
            'Bu kişi yardım bekliyor. Bildirimi kapatmak istediğinize emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                // BUG10 FIX: Guard Alert.alert onPress — callback fires after unmount if user
                // taps "Kapat" while component is being torn down
                { text: 'Kapat', style: 'destructive', onPress: () => {
                    if (isMountedRef.current) performDismiss();
                } },
            ],
        );
    }, [performDismiss]);

    const handleGoToHelp = useCallback(() => {
        // CRITICAL FIX: Capture alertData BEFORE calling performDismiss().
        // performDismiss() sets alertDataRef.current = null and setVisible(false),
        // which can cause alertData to become null in the next render cycle.
        // We need the data for navigation params.
        const capturedData = alertData;
        performDismiss();
        if (!capturedData) return;

        import('../navigation/navigationRef').then(({ navigateTo }) => {
            navigateTo('SOSHelp', {
                signalId: capturedData.signalId,
                senderUid: capturedData.senderUid,
                senderDeviceId: capturedData.senderDeviceId,
                senderName: capturedData.senderName,
                latitude: capturedData.latitude,
                longitude: capturedData.longitude,
                message: capturedData.message,
                trapped: capturedData.trapped,
                battery: capturedData.battery,
                healthInfo: capturedData.healthInfo,
            });
        }).catch(e => { if (__DEV__) console.debug('SOS navigate to help failed:', e); });
    }, [alertData, performDismiss]);

    const handleOpenMaps = useCallback(() => {
        if (!alertData?.latitude || !alertData?.longitude) return;
        // CRITICAL FIX: Capture alertData BEFORE performDismiss clears it
        const capturedData = alertData;
        performDismiss();

        // Navigate to in-app DisasterMap with SOS focus instead of external maps
        import('../navigation/navigationRef').then(({ navigateTo }) => {
            navigateTo('DisasterMap', {
                focusOnSOS: true,
                sosLatitude: capturedData.latitude,
                sosLongitude: capturedData.longitude,
                sosSenderName: capturedData.senderName || 'SOS',
            });
        }).catch(e => { if (__DEV__) console.debug('SOS navigate to map failed:', e); });
    }, [alertData, performDismiss]);

    const handleCall112 = useCallback(() => {
        haptics.impactHeavy();
        Linking.openURL('tel:112');
    }, []);

    // FIX 17: Elapsed time display — updates every 30s
    const [elapsedText, setElapsedText] = useState<string | null>(null);

    useEffect(() => {
        if (!visible || !alertData) return;
        const alertTime = lastAlertTimeRef.current;
        if (!alertTime) return;

        const updateElapsed = () => {
            const diffMs = Date.now() - alertTime;
            const diffMin = Math.floor(diffMs / 60_000);
            // CRITICAL FIX: Guard against negative elapsed time (clock skew or stale alertTime)
            const safeDiffMin = Math.max(0, diffMin);
            if (safeDiffMin < 1) {
                setElapsedText('Az önce gönderildi');
            } else {
                setElapsedText(`${safeDiffMin} dakika önce gönderildi`);
            }
        };
        updateElapsed();
        const interval = setInterval(updateElapsed, 30_000);
        return () => clearInterval(interval);
    }, [visible, alertData]);

    if (!visible || !alertData) return null;

    // FIX 17: 6 decimal places for precise rescue coordination
    const locationText = alertData.latitude && alertData.longitude
        ? `${alertData.latitude.toFixed(6)}, ${alertData.longitude.toFixed(6)}`
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
                <Pressable
                    style={[styles.closeButton, { top: Math.max(insets.top + 8, 50) }]}
                    onPress={handleDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="SOS uyarısını kapat"
                    accessibilityHint="Bildirim ekranını kapatır, SOS sinyali iptal edilmez"
                    hitSlop={10}
                >
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

                    {/* FIX 17: Elapsed time */}
                    {elapsedText && (
                        <Text style={styles.elapsedText}>{elapsedText}</Text>
                    )}

                    {/* FIX 17: Context info row — battery + trapped indicator */}
                    <View style={styles.contextRow}>
                        {alertData.battery != null && alertData.battery > 0 && (
                            <View style={styles.contextBadge}>
                                <Ionicons
                                    name={alertData.battery <= 20 ? 'battery-dead' : 'battery-half'}
                                    size={14}
                                    color={alertData.battery <= 20 ? '#ef4444' : '#fbbf24'}
                                />
                                <Text style={styles.contextBadgeText}>%{alertData.battery}</Text>
                            </View>
                        )}
                        {alertData.trapped && (
                            <View style={[styles.contextBadge, styles.trappedContextBadge]}>
                                <Ionicons name="warning" size={14} color="#fff" />
                                <Text style={[styles.contextBadgeText, { color: '#fff', fontWeight: '800' }]}>
                                    ENKAZ ALTINDA
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Location */}
                    {locationText && (
                        <View style={styles.locationRow}>
                            <Ionicons name="location" size={16} color="#fbbf24" />
                            <Text style={styles.locationText}>{locationText}</Text>
                        </View>
                    )}

                    {/* Trapped badge (legacy — kept for backward compat, hidden when context row shows it) */}
                    {alertData.trapped && !alertData.battery && (
                        <View style={styles.trappedBadge}>
                            <Ionicons name="warning" size={16} color="#fff" />
                            <Text style={styles.trappedText}>Enkaz Altında!</Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.actions} accessibilityRole="menu">
                        <Pressable
                            style={({ pressed }) => [styles.actionButton, styles.actionPrimary, pressed && { opacity: 0.8 }]}
                            onPress={handleGoToHelp}
                            accessibilityRole="button"
                            accessibilityLabel={`${alertData.senderName} adlı kullanıcıya yardıma git`}
                        >
                            <Ionicons name="hand-left" size={24} color="#fff" />
                            <Text style={styles.actionText}>Yardıma Git</Text>
                        </Pressable>

                        {/* HATA 8 FIX: Mesh-only SOS'larda lat/lng (0,0) "null-island" geliyor.
                           Bu durumda 'Konuma Git' button anlamsız (Atlantik ortası). Sadece geçerli koordinat varsa göster. */}
                        {alertData.latitude !== undefined && alertData.longitude !== undefined &&
                         alertData.latitude !== 0 && alertData.longitude !== 0 &&
                         Math.abs(alertData.latitude) > 0.01 && Math.abs(alertData.longitude) > 0.01 && (
                            <Pressable
                                style={({ pressed }) => [styles.actionButton, styles.actionMaps, pressed && { opacity: 0.8 }]}
                                onPress={handleOpenMaps}
                                accessibilityRole="button"
                                accessibilityLabel="Konumu haritada aç"
                                accessibilityHint="Sistem haritası uygulamasında SOS konumunu açar"
                            >
                                <Ionicons name="map" size={24} color="#fff" />
                                <Text style={styles.actionText}>Konuma Git</Text>
                            </Pressable>
                        )}

                        <Pressable
                            style={({ pressed }) => [styles.actionButton, styles.action112, pressed && { opacity: 0.8 }]}
                            onPress={handleCall112}
                            accessibilityRole="button"
                            accessibilityLabel="112 acil yardım hattını ara"
                            accessibilityHint="Telefon uygulamasında 112 numarasını çevirir"
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
        // top is set dynamically via useSafeAreaInsets
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
    // FIX 17: Elapsed time
    elapsedText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
        marginTop: 6,
        fontStyle: 'italic',
    },
    // FIX 17: Context row for battery + trapped
    contextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
        flexWrap: 'wrap',
    },
    contextBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    contextBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fbbf24',
    },
    trappedContextBadge: {
        backgroundColor: '#b91c1c',
        borderWidth: 1,
        borderColor: '#fbbf24',
    },
});
