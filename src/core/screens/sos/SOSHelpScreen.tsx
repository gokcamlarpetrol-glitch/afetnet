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
    Dimensions,
    DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown, FadeInUp,
    useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
    cancelAnimation,
} from 'react-native-reanimated';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Location from 'expo-location';
import * as haptics from '../../utils/haptics';
import { sosChannelRouter } from '../../services/sos/SOSChannelRouter';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    // G4: Multi-responder coordination — count rescuers who already pressed
    // "Yola Çıktım" so this rescuer knows whether more help is needed.
    const [respondersCount, setRespondersCount] = useState<number>(0);
    const mapRef = useRef<MapView | null>(null);
    const soundRef = useRef<AudioPlayer | null>(null);
    const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
    const firestoreUnsubRef = useRef<(() => void) | null>(null);
    const audioUnsubRef = useRef<Array<() => void>>([]);
    const audioListenerSubRef = useRef<{ remove: () => void } | null>(null);
    const respondersUnsubRef = useRef<(() => void) | null>(null);

    // Pulse animation for SOS marker
    const pulseScale = useSharedValue(1);
    useEffect(() => {
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
        );
        return () => cancelAnimation(pulseScale);
    }, [pulseScale]);

    // G4: Subscribe to sos_broadcasts/{signalId}/acks to count concurrent
    // responders. Lets this rescuer see whether more help is already on the way
    // (avoids over-mobilization for a single SOS).
    useEffect(() => {
        if (!signalId) return undefined;
        let cancelled = false;
        const start = async () => {
            try {
                const { getFirestoreInstanceAsync } = await import('../../services/firebase/FirebaseInstanceManager');
                const db = await getFirestoreInstanceAsync();
                if (!db || cancelled) return;
                const { collection, onSnapshot } = await import('firebase/firestore');
                const acksRef = collection(db, 'sos_broadcasts', signalId, 'acks');
                const unsub = onSnapshot(
                    acksRef,
                    (snap) => {
                        if (cancelled) return;
                        setRespondersCount(snap.size);
                    },
                    (err) => { logger.debug('Responders ACK listener error (non-critical):', err); },
                );
                respondersUnsubRef.current = unsub;
            } catch (err) {
                logger.debug('Responders listener init failed:', err);
            }
        };
        void start();
        return () => {
            cancelled = true;
            if (respondersUnsubRef.current) {
                try { respondersUnsubRef.current(); } catch { /* best-effort */ }
                respondersUnsubRef.current = null;
            }
        };
    }, [signalId]);

    // G1: Listen for SOS cancellation while rescuer is on this screen.
    // SOSAlertListener.handleSOSCancellation emits SOS_FULLSCREEN_CANCEL when the
    // original SOS is cancelled (sender rescued or stopped). Without this, the rescuer
    // stays stuck on the rescue screen unaware that the call is over.
    // (FAZ 1 TIER1-10: NearbySOSListener kaldırıldı, emitter SOSAlertListener'da.)
    useEffect(() => {
        if (!signalId) return undefined;
        const subscription = DeviceEventEmitter.addListener('SOS_FULLSCREEN_CANCEL', (payload: { signalId?: string }) => {
            // Only react if the cancelled signal is the one we are responding to.
            if (payload?.signalId && payload.signalId !== signalId) return;
            logger.info('SOSHelpScreen: SOS cancelled by sender — informing rescuer and closing screen');
            try {
                Alert.alert(
                    'Yardım Çağrısı İptal Edildi',
                    `${senderName} artık iyi olduğunu bildirdi veya yardım çağrısını iptal etti. Geri dönüş yapabilirsiniz.`,
                    [{
                        text: 'Tamam',
                        onPress: () => {
                            try {
                                if (navigation.canGoBack()) {
                                    navigation.goBack();
                                }
                            } catch {
                                // Best-effort — navigation may already be gone
                            }
                        },
                    }],
                    { cancelable: false },
                );
            } catch {
                // If Alert.alert fails for any reason, still try to leave the screen
                try { navigation.goBack(); } catch { /* ignore */ }
            }
        });
        return () => subscription.remove();
    }, [signalId, senderName, navigation]);
    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: 2 - pulseScale.value, // fades as it grows
    }));

    // Elapsed time counter
    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatElapsed = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Start watching my own location
    useEffect(() => {
        let cancelled = false;

        const startLocationWatch = async () => {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
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
                    (err) => { logger.debug('SOS location listener error (non-critical):', err); },
                );

                if (cancelled) {
                    unsub();
                    return;
                }
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

    // Listen for consent-gated audio_url from the recipient's SOS alert path.
    useEffect(() => {
        if (!signalId) return;

        let cancelled = false;
        const listenAudio = async () => {
            try {
                const { getFirestoreInstanceAsync } = await import(
                    '../../services/firebase/FirebaseInstanceManager'
                );
                const db = await getFirestoreInstanceAsync();
                if (!db || cancelled) return;

                const targetIds = new Set<string>();
                try {
                    const { getFirebaseAuth } = await import('../../../lib/firebase');
                    const uid = getFirebaseAuth()?.currentUser?.uid;
                    if (uid) targetIds.add(uid);
                } catch { /* best-effort */ }
                try {
                    const { getDeviceId } = await import('../../utils/device');
                    const currentDeviceId = await getDeviceId();
                    if (currentDeviceId) targetIds.add(currentDeviceId);
                } catch { /* best-effort */ }

                const { doc, onSnapshot } = await import('firebase/firestore');
                const unsubs: Array<() => void> = [];
                targetIds.forEach((targetId) => {
                    const alertRef = doc(db, 'sos_alerts', targetId, 'items', signalId);
                    const unsub = onSnapshot(
                        alertRef,
                        (snap) => {
                            if (cancelled || !snap.exists()) return;
                            const data = snap.data();
                            if (data?.audio_url && typeof data.audio_url === 'string') {
                                setAudioUrl(data.audio_url);
                            }
                        },
                        (err) => { logger.debug('SOS audio listener error (non-critical):', err); },
                    );
                    unsubs.push(unsub);
                });
                audioUnsubRef.current = unsubs;
            } catch {
                // Offline — audio feature degrades gracefully
            }
        };

        listenAudio();
        return () => {
            cancelled = true;
            audioUnsubRef.current.forEach((unsub) => {
                try { unsub(); } catch { /* no-op */ }
            });
            audioUnsubRef.current = [];
        };
    }, [signalId]);

    // Fit map to show both locations — only on initial load
    // (don't override manual pan/zoom by the rescuer)
    const hasInitialFitRef = useRef(false);
    useEffect(() => {
        if (!mapRef.current || !senderLocation || hasInitialFitRef.current) return;
        hasInitialFitRef.current = true;

        const coords = [{ latitude: senderLocation.latitude, longitude: senderLocation.longitude }];
        if (myLocation) {
            coords.push({ latitude: myLocation.latitude, longitude: myLocation.longitude });
        }

        try {
            mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true,
            });
        } catch { /* non-critical */ }
    }, [senderLocation, myLocation]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioListenerSubRef.current) {
                try { audioListenerSubRef.current.remove(); } catch { /* */ }
                audioListenerSubRef.current = null;
            }
            if (soundRef.current) {
                try { soundRef.current.remove(); } catch { /* */ }
                soundRef.current = null;
            }
        };
    }, []);

    // Play/stop ambient audio
    const handlePlayAudio = useCallback(async () => {
        if (!audioUrl) return;
        haptics.impactLight();

        if (isPlayingAudio && soundRef.current) {
            soundRef.current.pause();
            try { soundRef.current.remove(); } catch { /* */ }
            soundRef.current = null;
            setIsPlayingAudio(false);
            return;
        }

        try {
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
                shouldPlayInBackground: false,
            });

            const player = createAudioPlayer({ uri: audioUrl });
            soundRef.current = player;
            setIsPlayingAudio(true);
            player.play();

            // CRITICAL FIX: Track the listener subscription so it can be cleaned up on unmount.
            // Without this, the listener leaks and can fire after the component is unmounted.
            if (audioListenerSubRef.current) {
                try { audioListenerSubRef.current.remove(); } catch { /* */ }
            }
            audioListenerSubRef.current = player.addListener('playbackStatusUpdate', (status: any) => {
                // KRİTİK (görev #26): Yalnızca didJustFinish'e güven. Önceki
                // `isBuffering===false && positionMillis>=durationMillis` koşulu
                // durationMillis 0/undefined olduğunda (henüz yüklenmemiş ses)
                // çalmanın hemen başında "bitti" sayıp oynatmayı durduruyordu.
                if (status?.didJustFinish) {
                    setIsPlayingAudio(false);
                    if (audioListenerSubRef.current) {
                        try { audioListenerSubRef.current.remove(); } catch { /* */ }
                        audioListenerSubRef.current = null;
                    }
                    try { player.remove(); } catch { /* */ }
                    soundRef.current = null;
                }
            });
        } catch {
            Alert.alert('Hata', 'Ses dosyası oynatılamadı.', [{ text: 'Tamam' }]);
            setIsPlayingAudio(false);
        }
    }, [audioUrl, isPlayingAudio]);

    // Send rescue ACK
    const handleSendACK = useCallback(async () => {
        if (ackSent || ackSending) return;
        setAckSending(true);

        try {
            haptics.impactMedium();
            const deviceId = senderDeviceId || senderUid || '';
            // CRITICAL FIX: Validate signalId before sending ACK.
            // Empty signalId creates invalid Firestore paths (e.g., 'sos_broadcasts//acks/...')
            if (!signalId || signalId.trim().length === 0) {
                throw new Error('Sinyal kimliği bulunamadı — ACK gönderilemez.');
            }
            await sosChannelRouter.sendRescueACK(signalId, deviceId, {
                sosSenderUid: senderUid,
            });
            setAckSent(true);
            haptics.notificationSuccess();
            Alert.alert('Bildirildi', `${senderName} kişisine yardıma geldiğiniz bildirildi.`, [{ text: 'Tamam' }]);
        } catch (err) {
            logger.error('ACK failed:', err);
            Alert.alert('Hata', 'Bildirim gönderilemedi. Tekrar deneyin.', [{ text: 'Tamam' }]);
        } finally {
            setAckSending(false);
        }
    }, [ackSent, ackSending, signalId, senderDeviceId, senderUid, senderName]);

    // Open directions with walking/driving choice
    const handleOpenDirections = useCallback(() => {
        if (!senderLocation) return;
        haptics.impactLight();

        const { latitude: lat, longitude: lng } = senderLocation;

        Alert.alert(
            'Yol Tarifi',
            'Nasıl gitmek istiyorsunuz?',
            [
                {
                    text: 'Yürüyerek',
                    onPress: () => {
                        const url = Platform.select({
                            ios: `maps:0,0?daddr=${lat},${lng}&dirflg=w`,
                            android: `google.navigation:q=${lat},${lng}&mode=w`,
                        });
                        if (url) {
                            Linking.openURL(url).catch(() => {
                                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`);
                            });
                        }
                    },
                },
                {
                    text: 'Araçla',
                    onPress: () => {
                        const url = Platform.select({
                            ios: `maps:0,0?daddr=${lat},${lng}&dirflg=d`,
                            android: `google.navigation:q=${lat},${lng}&mode=d`,
                        });
                        if (url) {
                            Linking.openURL(url).catch(() => {
                                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
                            });
                        }
                    },
                },
                { text: 'İptal', style: 'cancel' },
            ],
        );
    }, [senderLocation]);

    // Open location in the app's DisasterMap screen
    const handleOpenLocationOnMap = useCallback(() => {
        if (!senderLocation) return;
        haptics.impactMedium();

        navigation.navigate('DisasterMap', {
            focusOnSOS: true,
            sosLatitude: senderLocation.latitude,
            sosLongitude: senderLocation.longitude,
            sosSenderName: senderName || 'SOS',
        });
    }, [senderLocation, navigation, senderName]);

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
                <View style={styles.headerCenter}>
                    <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>CANLI</Text>
                    </View>
                    <Text style={styles.headerTitle}>SOS Yardım</Text>
                </View>
                <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={14} color="#fbbf24" />
                    <Text style={styles.timerText}>{formatElapsed(elapsedSeconds)}</Text>
                </View>
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

                {/* In-App Map */}
                {senderLocation && (
                    <Animated.View entering={FadeInUp.delay(250)} style={styles.mapContainer}>
                        <MapView
                            ref={mapRef}
                            style={styles.mapView}
                            initialRegion={{
                                latitude: senderLocation.latitude,
                                longitude: senderLocation.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            showsUserLocation={false}
                            showsMyLocationButton={false}
                            loadingEnabled
                        >
                            {/* SOS Sender Marker - Red with pulse */}
                            <Marker
                                coordinate={{
                                    latitude: senderLocation.latitude,
                                    longitude: senderLocation.longitude,
                                }}
                                title={senderName}
                                description={trapped ? 'Enkaz Altında!' : 'Acil Yardım'}
                                anchor={{ x: 0.5, y: 0.5 }}
                            >
                                <View style={styles.senderMarker}>
                                    <Animated.View style={[styles.senderMarkerPulse, pulseStyle]} />
                                    <View style={styles.senderMarkerCore}>
                                        <Ionicons name="alert-circle" size={20} color="#fff" />
                                    </View>
                                </View>
                            </Marker>

                            {/* My Location Marker - Blue */}
                            {myLocation && (
                                <Marker
                                    coordinate={{
                                        latitude: myLocation.latitude,
                                        longitude: myLocation.longitude,
                                    }}
                                    title="Ben"
                                    anchor={{ x: 0.5, y: 0.5 }}
                                >
                                    <View style={styles.myMarker}>
                                        <Ionicons name="person" size={16} color="#fff" />
                                    </View>
                                </Marker>
                            )}

                            {/* Polyline between locations */}
                            {myLocation && (
                                <Polyline
                                    coordinates={[
                                        { latitude: myLocation.latitude, longitude: myLocation.longitude },
                                        { latitude: senderLocation.latitude, longitude: senderLocation.longitude },
                                    ]}
                                    strokeColor="#ef4444"
                                    strokeWidth={3}
                                    lineDashPattern={[10, 5]}
                                />
                            )}
                        </MapView>

                        {/* Map overlay buttons */}
                        <View style={styles.mapOverlay}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.mapOverlayButton,
                                    pressed && { opacity: 0.8 },
                                ]}
                                onPress={handleOpenLocationOnMap}
                            >
                                <Ionicons name="map" size={18} color="#fff" />
                                <Text style={styles.mapOverlayButtonText}>
                                    Konuma Git {distanceText ? `(${distanceText})` : ''}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.mapOverlayButton,
                                    styles.mapOverlayButtonSecondary,
                                    pressed && { opacity: 0.8 },
                                ]}
                                onPress={handleOpenDirections}
                            >
                                <Ionicons name="navigate" size={18} color="#fff" />
                                <Text style={styles.mapOverlayButtonText}>GPS Tarifi</Text>
                            </Pressable>
                        </View>
                    </Animated.View>
                )}

                {/* Sender Info Card */}
                <Animated.View entering={FadeInUp.delay(300)} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.avatarCircle}>
                            <Ionicons name="person" size={28} color="#ef4444" />
                        </View>
                        <View style={styles.senderInfo}>
                            <Text style={styles.senderName}>{senderName}</Text>
                            {distanceText && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                    <Ionicons
                                        name={distance !== null && distance < 100 ? "flame" : "location"}
                                        size={14}
                                        color={distance !== null && distance < 100 ? "#ef4444" : "#94a3b8"}
                                    />
                                    <Text style={[
                                        styles.distanceText,
                                        distance !== null && distance < 100 && { color: '#ef4444', fontWeight: '800' }
                                    ]}>
                                        {distance !== null && distance < 100 ? `ÇOK YAKIN: ${distanceText}` : `${distanceText} uzaklıkta`}
                                    </Text>
                                </View>
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
                                {/* KRİTİK (görev #26): SOS göndericisinin pil seviyesi
                                    "bilinmiyor" için -1 gelebilir; "%-1" göstermek
                                    yerine "Pil: Bilinmiyor" yaz ve nötr ikon kullan. */}
                                <Ionicons
                                    name={
                                        battery < 0
                                            ? 'battery-half'
                                            : battery < 20
                                                ? 'battery-dead'
                                                : battery < 50
                                                    ? 'battery-half'
                                                    : 'battery-full'
                                    }
                                    size={16}
                                    color={battery >= 0 && battery < 20 ? '#ef4444' : battery < 0 ? '#94a3b8' : '#22c55e'}
                                />
                                <Text style={styles.statusText}>
                                    {battery < 0 ? 'Pil: Bilinmiyor' : `%${battery}`}
                                </Text>
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

                {/* Ambient Audio Card */}
                {audioUrl && (
                    <Animated.View entering={FadeInUp.delay(350)} style={styles.card}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.audioButton,
                                isPlayingAudio && styles.audioButtonPlaying,
                                pressed && { opacity: 0.8 },
                            ]}
                            onPress={handlePlayAudio}
                        >
                            <Ionicons
                                name={isPlayingAudio ? 'stop-circle' : 'mic'}
                                size={22}
                                color="#fff"
                            />
                            <Text style={styles.audioButtonText}>
                                {isPlayingAudio ? 'Kaydı Durdur' : 'Ortam Sesi Dinle'}
                            </Text>
                        </Pressable>
                    </Animated.View>
                )}

                {/* Konum bekleniyor (harita yoksa) */}
                {!senderLocation && (
                    <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
                        <View style={styles.noLocationBox}>
                            <ActivityIndicator size="small" color="#94a3b8" />
                            <Text style={styles.noLocationText}>Konum bekleniyor...</Text>
                        </View>
                    </Animated.View>
                )}

                {/* Action Buttons */}
                <Animated.View entering={FadeInUp.delay(500)} style={styles.actionsCard}>
                    {/* G4: Multi-responder banner — show count of other rescuers
                        already heading to this SOS so this user can decide
                        whether more help is needed or step back. */}
                    {respondersCount > (ackSent ? 1 : 0) && (
                        <View
                            style={styles.respondersBanner}
                            accessibilityRole="text"
                            accessibilityLabel={`${respondersCount} kişi yardıma gidiyor`}
                        >
                            <Ionicons name="people" size={18} color="#7dd3fc" />
                            <Text style={styles.respondersBannerText}>
                                {ackSent
                                    ? `Siz dahil ${respondersCount} kişi yardıma gidiyor`
                                    : `Şu an ${respondersCount} kişi yardıma gidiyor`}
                            </Text>
                        </View>
                    )}

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

                    {/* In-app map navigation */}
                    {senderLocation && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.actionButton,
                                styles.actionButtonDirections,
                                pressed && { opacity: 0.8 },
                            ]}
                            onPress={handleOpenLocationOnMap}
                        >
                            <Ionicons name="map" size={24} color="#fff" />
                            <Text style={styles.actionButtonText}>
                                Konuma Git {distanceText ? `(${distanceText})` : ''}
                            </Text>
                        </Pressable>
                    )}

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
        paddingVertical: spacing.sm,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        alignItems: 'center',
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ef4444',
        letterSpacing: 1,
    },
    headerTitle: {
        fontSize: typography.h3.fontSize,
        fontWeight: '700',
        color: '#fff',
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    timerText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fbbf24',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    respondersBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        // M1: SOSHelpScreen background is the dark red-to-navy SOS gradient.
        // A translucent light-blue panel + dark navy text failed WCAG AA (<3:1
        // contrast). Switching to an opaque sky panel with white text reaches
        // ~10:1 — readable on any background variant.
        backgroundColor: '#0c4a6e',
        borderColor: '#0ea5e9',
        borderWidth: 1,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    respondersBannerText: {
        ...typography.bodySmall,
        color: '#f0f9ff', // near-white for max contrast on #0c4a6e (~12:1)
        fontWeight: '600',
        flex: 1,
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
    actionButtonDirections: {
        backgroundColor: '#1e40af',
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
    mapContainer: {
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        marginBottom: spacing.md,
        borderWidth: 2,
        borderColor: '#fbbf24',
    },
    mapView: {
        width: '100%',
        height: SCREEN_HEIGHT * 0.4,
    },
    senderMarker: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
    },
    senderMarkerPulse: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
    },
    senderMarkerCore: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    myMarker: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    mapOverlay: {
        flexDirection: 'row',
        gap: spacing.xs,
        padding: spacing.sm,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    mapOverlayButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#dc2626',
        borderRadius: borderRadius.md,
        paddingVertical: 10,
        gap: 6,
    },
    mapOverlayButtonSecondary: {
        backgroundColor: '#1e40af',
    },
    mapOverlayButtonText: {
        fontSize: typography.bodySmall.fontSize,
        fontWeight: '700',
        color: '#fff',
    },
    audioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7c3aed',
        borderRadius: borderRadius.md,
        paddingVertical: 14,
        gap: spacing.sm,
    },
    audioButtonPlaying: {
        backgroundColor: '#dc2626',
    },
    audioButtonText: {
        fontSize: typography.body.fontSize,
        fontWeight: '700',
        color: '#fff',
    },
});
