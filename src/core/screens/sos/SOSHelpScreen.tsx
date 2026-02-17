/**
 * SOS HELP SCREEN
 * Opens when a user taps an incoming SOS notification.
 * Shows the SOS sender's live location, status, and provides rescue actions.
 *
 * FEATURES:
 * - Live location tracking of SOS sender on map
 * - Sender info (name, battery, trapped status, health)
 * - Send rescue ACK (acknowledge help is on the way)
 * - Open directions in Maps app
 * - Call emergency services (112)
 * - Start conversation with SOS sender
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Linking,
    Platform,
    Alert,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Location from 'expo-location';
import * as haptics from '../../utils/haptics';
import { sosChannelRouter } from '../../services/sos/SOSChannelRouter';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';

const logger = createLogger('SOSHelpScreen');

type SOSHelpNavigationProp = StackNavigationProp<MainStackParamList, 'SOSHelp'>;
type SOSHelpRouteProp = RouteProp<MainStackParamList, 'SOSHelp'>;

interface SOSHelpScreenProps {
    navigation: SOSHelpNavigationProp;
    route: SOSHelpRouteProp;
}

interface LocationState {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
}

export default function SOSHelpScreen({ navigation, route }: SOSHelpScreenProps) {
    const insets = useSafeAreaInsets();
    const params = route?.params ?? {};
    const {
        signalId,
        senderUid,
        senderDeviceId,
        senderName = 'Bilinmeyen',
        latitude,
        longitude,
        message,
        trapped,
        battery,
        healthInfo,
    } = params;

    const [senderLocation, setSenderLocation] = useState<LocationState | null>(
        latitude != null && longitude != null
            ? { latitude, longitude, timestamp: Date.now() }
            : null,
    );
    const [myLocation, setMyLocation] = useState<LocationState | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [ackSent, setAckSent] = useState(false);
    const [ackSending, setAckSending] = useState(false);
    const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
    const firestoreUnsubRef = useRef<(() => void) | null>(null);

    // Start watching my own location
    useEffect(() => {
        let cancelled = false;

        const startLocationWatch = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted' || cancelled) return;

                const sub = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 5000,
                        distanceInterval: 5,
                    },
                    (loc) => {
                        if (cancelled) return;
                        setMyLocation({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            accuracy: loc.coords.accuracy ?? undefined,
                            timestamp: Date.now(),
                        });
                    },
                );
                locationWatchRef.current = sub;
            } catch (err) {
                logger.warn('Location watch failed:', err);
            }
        };

        startLocationWatch();

        return () => {
            cancelled = true;
            locationWatchRef.current?.remove();
        };
    }, []);

    // Listen for real-time location updates of the SOS sender from Firestore
    useEffect(() => {
        if (!senderUid && !senderDeviceId) return;

        let cancelled = false;

        const startListening = async () => {
            try {
                const { getFirestoreInstanceAsync } = await import(
                    '../../services/firebase/FirebaseInstanceManager'
                );
                const db = await getFirestoreInstanceAsync();
                if (!db || cancelled) return;

                const { doc, onSnapshot } = await import('firebase/firestore');

                // Listen to the sender's current location document
                const targetId = senderUid || senderDeviceId || '';
                const locationRef = doc(db, 'locations_current', targetId);

                const unsub = onSnapshot(
                    locationRef,
                    (snapshot) => {
                        if (cancelled || !snapshot.exists()) return;
                        const data = snapshot.data();
                        const lat = data?.latitude ?? data?.lat;
                        const lng = data?.longitude ?? data?.lng;
                        if (typeof lat === 'number' && typeof lng === 'number') {
                            setSenderLocation({
                                latitude: lat,
                                longitude: lng,
                                accuracy: data?.accuracy,
                                timestamp: data?.timestamp ?? Date.now(),
                            });
                        }
                    },
                    () => { /* permission errors are non-critical */ },
                );

                firestoreUnsubRef.current = unsub;
            } catch (err) {
                logger.warn('Firestore location listener failed:', err);
            }
        };

        startListening();

        return () => {
            cancelled = true;
            firestoreUnsubRef.current?.();
        };
    }, [senderUid, senderDeviceId]);

    // Calculate distance between my location and sender
    useEffect(() => {
        if (!myLocation || !senderLocation) return;

        const R = 6371000; // Earth radius in meters
        const dLat = ((senderLocation.latitude - myLocation.latitude) * Math.PI) / 180;
        const dLng = ((senderLocation.longitude - myLocation.longitude) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((myLocation.latitude * Math.PI) / 180) *
                Math.cos((senderLocation.latitude * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        setDistance(R * c);
    }, [myLocation, senderLocation]);

    // Send rescue ACK
    const handleSendACK = useCallback(async () => {
        if (ackSent || ackSending) return;
        setAckSending(true);

        try {
            haptics.impactMedium();
            const deviceId = senderDeviceId || senderUid || '';
            await sosChannelRouter.sendRescueACK(signalId || '', deviceId, {
                sosSenderUid: senderUid,
            });
            setAckSent(true);
            haptics.notificationSuccess();
            Alert.alert('Bildirildi', `${senderName} kişisine yardıma geldiğiniz bildirildi.`);
        } catch (err) {
            logger.error('ACK failed:', err);
            Alert.alert('Hata', 'Bildirim gönderilemedi. Tekrar deneyin.');
        } finally {
            setAckSending(false);
        }
    }, [ackSent, ackSending, signalId, senderDeviceId, senderUid, senderName]);

    // Open directions in Maps
    const handleOpenDirections = useCallback(() => {
        if (!senderLocation) return;
        haptics.impactLight();

        const { latitude: lat, longitude: lng } = senderLocation;
        const url = Platform.select({
            ios: `maps:0,0?daddr=${lat},${lng}`,
            android: `google.navigation:q=${lat},${lng}`,
        });
        if (url) {
            Linking.openURL(url).catch(() => {
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
            });
        }
    }, [senderLocation]);

    // Call 112
    const handleCallEmergency = useCallback(() => {
        haptics.impactHeavy();
        Linking.openURL('tel:112');
    }, []);

    // Navigate to SOS conversation
    const handleOpenChat = useCallback(() => {
        haptics.impactLight();
        const userId = senderUid || senderDeviceId || '';
        if (!userId) return;
        navigation.navigate('SOSConversation', {
            sosUserId: userId,
            sosSenderUid: senderUid,
            sosUserName: senderName,
            sosLocation: senderLocation
                ? { latitude: senderLocation.latitude, longitude: senderLocation.longitude }
                : null,
            sosTrapped: trapped,
            sosBatteryLevel: battery,
        });
    }, [navigation, senderUid, senderDeviceId, senderName, senderLocation, trapped, battery]);

    // Format distance
    const distanceText = distance != null
        ? distance < 1000
            ? `${Math.round(distance)} m`
            : `${(distance / 1000).toFixed(1)} km`
        : null;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <LinearGradient
                colors={['#7f1d1d', '#991b1b', '#1e293b']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.headerTitle}>Yardım Sayfası</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* SOS Alert Banner */}
                <Animated.View entering={FadeInUp.delay(200)} style={styles.alertBanner}>
                    <Ionicons name="alert-circle" size={28} color="#fbbf24" />
                    <View style={styles.alertTextContainer}>
                        <Text style={styles.alertTitle}>
                            {trapped ? 'Enkaz Altında!' : 'Acil Yardım Çağrısı'}
                        </Text>
                        <Text style={styles.alertSubtitle}>
                            {senderName} yardım bekliyor
                        </Text>
                    </View>
                </Animated.View>

                {/* Sender Info Card */}
                <Animated.View entering={FadeInUp.delay(300)} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.avatarCircle}>
                            <Ionicons name="person" size={28} color="#ef4444" />
                        </View>
                        <View style={styles.senderInfo}>
                            <Text style={styles.senderName}>{senderName}</Text>
                            {distanceText && (
                                <Text style={styles.distanceText}>
                                    {distanceText} uzaklıkta
                                </Text>
                            )}
                        </View>
                        {trapped && (
                            <View style={styles.trappedBadge}>
                                <Ionicons name="warning" size={14} color="#fff" />
                                <Text style={styles.trappedText}>Enkaz</Text>
                            </View>
                        )}
                    </View>

                    {/* Status Row */}
                    <View style={styles.statusRow}>
                        {battery != null && (
                            <View style={styles.statusItem}>
                                <Ionicons
                                    name={battery < 20 ? 'battery-dead' : battery < 50 ? 'battery-half' : 'battery-full'}
                                    size={16}
                                    color={battery < 20 ? '#ef4444' : '#22c55e'}
                                />
                                <Text style={styles.statusText}>%{battery}</Text>
                            </View>
                        )}
                        {senderLocation && (
                            <View style={styles.statusItem}>
                                <Ionicons name="location" size={16} color="#3b82f6" />
                                <Text style={styles.statusText}>
                                    {senderLocation.latitude.toFixed(4)}, {senderLocation.longitude.toFixed(4)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Message */}
                    {message ? (
                        <View style={styles.messageBox}>
                            <Ionicons name="chatbubble-ellipses" size={16} color="#94a3b8" />
                            <Text style={styles.messageText}>{message}</Text>
                        </View>
                    ) : null}

                    {/* Health Info */}
                    {healthInfo && Object.keys(healthInfo).length > 0 && (
                        <View style={styles.healthBox}>
                            <Text style={styles.healthTitle}>Sağlık Bilgisi</Text>
                            {healthInfo.bloodType && (
                                <Text style={styles.healthItem}>Kan Grubu: {healthInfo.bloodType}</Text>
                            )}
                            {healthInfo.allergies && (
                                <Text style={styles.healthItem}>Alerji: {healthInfo.allergies}</Text>
                            )}
                            {healthInfo.chronicConditions && (
                                <Text style={styles.healthItem}>Kronik: {healthInfo.chronicConditions}</Text>
                            )}
                            {healthInfo.emergencyNotes && (
                                <Text style={styles.healthItem}>Not: {healthInfo.emergencyNotes}</Text>
                            )}
                        </View>
                    )}
                </Animated.View>

                {/* Location Card */}
                <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
                    <Text style={styles.cardTitle}>Konum Takibi</Text>
                    {senderLocation ? (
                        <View>
                            <View style={styles.locationRow}>
                                <Ionicons name="navigate" size={20} color="#3b82f6" />
                                <View style={styles.locationInfo}>
                                    <Text style={styles.locationCoord}>
                                        {senderLocation.latitude.toFixed(6)}, {senderLocation.longitude.toFixed(6)}
                                    </Text>
                                    {senderLocation.accuracy != null && (
                                        <Text style={styles.locationAccuracy}>
                                            Doğruluk: ~{Math.round(senderLocation.accuracy)}m
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <Pressable
                                style={({ pressed }) => [styles.directionsButton, pressed && { opacity: 0.7 }]}
                                onPress={handleOpenDirections}
                            >
                                <Ionicons name="navigate-circle" size={22} color="#fff" />
                                <Text style={styles.directionsText}>Yol Tarifi Al</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.noLocationBox}>
                            <ActivityIndicator size="small" color="#94a3b8" />
                            <Text style={styles.noLocationText}>Konum bekleniyor...</Text>
                        </View>
                    )}
                </Animated.View>

                {/* Action Buttons */}
                <Animated.View entering={FadeInUp.delay(500)} style={styles.actionsCard}>
                    {/* Send ACK */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionButton,
                            ackSent ? styles.actionButtonDisabled : styles.actionButtonPrimary,
                            pressed && !ackSent && { opacity: 0.8 },
                        ]}
                        onPress={handleSendACK}
                        disabled={ackSent || ackSending}
                    >
                        {ackSending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons
                                name={ackSent ? 'checkmark-circle' : 'hand-left'}
                                size={24}
                                color="#fff"
                            />
                        )}
                        <Text style={styles.actionButtonText}>
                            {ackSent ? 'Yardım Bildirimi Gönderildi' : 'Yardıma Geliyorum'}
                        </Text>
                    </Pressable>

                    {/* Open Chat */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionButton,
                            styles.actionButtonChat,
                            pressed && { opacity: 0.8 },
                        ]}
                        onPress={handleOpenChat}
                    >
                        <Ionicons name="chatbubbles" size={24} color="#fff" />
                        <Text style={styles.actionButtonText}>Mesaj Gönder</Text>
                    </Pressable>

                    {/* Call 112 */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionButton,
                            styles.actionButtonEmergency,
                            pressed && { opacity: 0.8 },
                        ]}
                        onPress={handleCallEmergency}
                    >
                        <Ionicons name="call" size={24} color="#fff" />
                        <Text style={styles.actionButtonText}>112 Acil Ara</Text>
                    </Pressable>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.h2.fontSize,
        fontWeight: '700',
        color: '#fff',
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 40,
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.4)',
        gap: spacing.sm,
    },
    alertTextContainer: {
        flex: 1,
    },
    alertTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '700',
        color: '#fbbf24',
    },
    alertSubtitle: {
        fontSize: typography.bodySmall.fontSize,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 2,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    avatarCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    senderInfo: {
        flex: 1,
    },
    senderName: {
        fontSize: typography.h3.fontSize,
        fontWeight: '700',
        color: '#fff',
    },
    distanceText: {
        fontSize: typography.bodySmall.fontSize,
        color: '#93c5fd',
        marginTop: 2,
    },
    trappedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ef4444',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        gap: 4,
    },
    trappedText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    statusRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statusText: {
        fontSize: typography.caption.fontSize,
        color: '#94a3b8',
    },
    messageBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.xs,
        marginTop: spacing.sm,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
    },
    messageText: {
        flex: 1,
        fontSize: typography.bodySmall.fontSize,
        color: '#cbd5e1',
    },
    healthBox: {
        marginTop: spacing.sm,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    healthTitle: {
        fontSize: typography.bodySmall.fontSize,
        fontWeight: '700',
        color: '#22c55e',
        marginBottom: 4,
    },
    healthItem: {
        fontSize: typography.caption.fontSize,
        color: '#94a3b8',
        marginTop: 2,
    },
    cardTitle: {
        fontSize: typography.body.fontSize,
        fontWeight: '700',
        color: '#fff',
        marginBottom: spacing.sm,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    locationInfo: {
        flex: 1,
    },
    locationCoord: {
        fontSize: typography.bodySmall.fontSize,
        color: '#93c5fd',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    locationAccuracy: {
        fontSize: typography.caption.fontSize,
        color: '#64748b',
        marginTop: 2,
    },
    directionsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3b82f6',
        borderRadius: borderRadius.md,
        paddingVertical: 12,
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    directionsText: {
        fontSize: typography.body.fontSize,
        fontWeight: '600',
        color: '#fff',
    },
    noLocationBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
    },
    noLocationText: {
        fontSize: typography.bodySmall.fontSize,
        color: '#64748b',
    },
    actionsCard: {
        gap: spacing.sm,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.lg,
        paddingVertical: 16,
        gap: spacing.sm,
    },
    actionButtonPrimary: {
        backgroundColor: '#22c55e',
    },
    actionButtonDisabled: {
        backgroundColor: '#374151',
    },
    actionButtonChat: {
        backgroundColor: '#0ea5e9',
    },
    actionButtonEmergency: {
        backgroundColor: '#ef4444',
    },
    actionButtonText: {
        fontSize: typography.body.fontSize,
        fontWeight: '700',
        color: '#fff',
    },
});
