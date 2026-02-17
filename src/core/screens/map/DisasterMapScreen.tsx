/**
 * DISASTER MAP SCREEN - ELITE PREMIUM V3
 * "Modern Calm Trust" Design System Integration
 * 
 * Premium Features:
 * - Glassmorphism header with cream/ivory tones
 * - Trust Blue (#1F4E79) color palette
 * - Enhanced family tracking with premium markers
 * - Real-time earthquake visualization
 * - EEW status integration
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Dimensions,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { colors } from '../../theme';
import { styles, PREMIUM_COLORS } from './DisasterMapScreen.styles';
import { useEarthquakeStore } from '../../stores/earthquakeStore';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { useSOSStore, SOSSignal, IncomingSOSAlert } from '../../services/sos';
import { createLogger } from '../../utils/logger';
import { formatLastSeen } from '../../utils/dateUtils';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { EarthquakeMarker } from '../../components/map/EarthquakeMarker';
import { ClusterMarker } from '../../components/map/ClusterMarker';
import { MapClusterEngine, MapPoint } from '../../utils/MapClusterEngine';
import { MapLegend, getMagnitudeColor } from '../../components/map/MapLegend';
import { firebaseAnalyticsService } from '../../services/FirebaseAnalyticsService';
// NOTE: Premium overlays removed for stability (AssemblyPointMarkers, WavePropagationOverlay, RiskOverlay)
// Will be re-added with lazy loading in future update.
import * as haptics from '../../utils/haptics';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import type { Region } from 'react-native-maps';

const logger = createLogger('DisasterMapScreen');

// SOS Signal marker type for map display
interface ActiveSOSSignal {
  id: string;
  userId: string;
  userName?: string;
  name?: string;           // Display name for rescue panel
  latitude: number;
  longitude: number;
  timestamp: number;
  message: string;
  trapped: boolean;
  distance?: number;
  battery?: number;         // Battery percentage
  senderDeviceId?: string;  // For ACK and messaging
  senderUid?: string;       // Canonical UID for V3 messaging paths
  signalId?: string;        // Original signal ID
  healthInfo?: {
    bloodType?: string;
    allergies?: string;
    chronicConditions?: string;
    emergencyNotes?: string;
  };
}

// Haversine formula for distance calculation (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

import MapView, { Marker, Circle } from 'react-native-maps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type DisasterMapNavigationProp = StackNavigationProp<MainStackParamList, 'DisasterMap'>;
type DisasterMapRouteProp = RouteProp<MainStackParamList, 'DisasterMap'>;

interface DisasterMapScreenProps {
  navigation: DisasterMapNavigationProp;
  route?: DisasterMapRouteProp;
}

// ELITE: Premium color palette (Modern Calm Trust)
// PREMIUM_COLORS imported from DisasterMapScreen.styles.ts

// PREMIUM: Status colors with Modern Calm Trust palette
const STATUS_COLORS: Record<string, string> = {
  safe: PREMIUM_COLORS.safe,
  'need-help': PREMIUM_COLORS.warning,
  unknown: PREMIUM_COLORS.textSecondary,
  critical: PREMIUM_COLORS.critical,
  danger: PREMIUM_COLORS.critical,
  offline: '#94a3b8',
};

// Default region settings
const DEFAULT_DELTA = {
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// PREMIUM: Animated Pulse Component with Trust Blue glow
const PulseMarker = ({ color = PREMIUM_COLORS.trustBlue, size = 80 }: { color?: string; size?: number }) => {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.pulseContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
          },
          pulseStyle,
        ]}
      />
      <LinearGradient
        colors={[color, PREMIUM_COLORS.trustBlueDark]}
        style={[
          styles.pulseCenter,
          {
            width: size * 0.25,
            height: size * 0.25,
            borderRadius: (size * 0.25) / 2,
          },
        ]}
      />
    </View>
  );
};

// PREMIUM: Family Member Avatar Marker with glassmorphism
const FamilyMemberMarker = ({
  member,
  isSelected,
  onPress,
}: {
  member: FamilyMember;
  isSelected: boolean;
  onPress: () => void;
}) => {
  const statusColor = STATUS_COLORS[member.status] || STATUS_COLORS.unknown;
  const initial = member.name?.charAt(0)?.toUpperCase() || '?';

  const batteryLevel = member.batteryLevel ?? 100;
  const isBatteryLow = batteryLevel <= 20;

  const animatedScale = useSharedValue(1);

  useEffect(() => {
    if (isSelected) {
      animatedScale.value = withSpring(1.15, { damping: 10 });
    } else {
      animatedScale.value = withSpring(1, { damping: 10 });
    }
  }, [isSelected]);

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatedScale.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.familyMarkerContainer}>
      <Animated.View style={markerStyle}>
        {/* Premium outer ring with gradient */}
        <LinearGradient
          colors={[statusColor, `${statusColor}CC`]}
          style={[styles.familyMarkerOuter]}
        >
          {/* Inner avatar with glassmorphism */}
          <View style={styles.familyMarkerInner}>
            <Text style={styles.familyMarkerInitial}>{initial}</Text>
          </View>

          {/* Online status indicator */}
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: member.isOnline ? PREMIUM_COLORS.safe : PREMIUM_COLORS.textSecondary,
                borderColor: PREMIUM_COLORS.ivory,
              },
            ]}
          />

          {/* Battery warning badge */}
          {isBatteryLow && (
            <View style={styles.batteryBadge}>
              <Ionicons name="battery-dead" size={10} color={PREMIUM_COLORS.critical} />
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Premium name label with glass effect */}
      <View style={styles.nameLabel}>
        <Text style={styles.nameLabelText} numberOfLines={1}>
          {member.name}
        </Text>
      </View>
    </Pressable>
  );
};

// PREMIUM: EEW Status Badge Component
const EEWStatusBadge = () => {
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={styles.eewBadge}>
      <Animated.View style={[styles.eewPulse, pulseStyle]} />
      <Ionicons name="shield-checkmark" size={14} color={PREMIUM_COLORS.safe} />
      <Text style={styles.eewBadgeText}>EEW Aktif</Text>
    </View>
  );
};

// PREMIUM: SOS Signal Marker Component with pulsing red animation
const SOSSignalMarker = ({
  signal,
  onPress,
  userLocation,
}: {
  signal: ActiveSOSSignal;
  onPress: () => void;
  userLocation: { latitude: number; longitude: number } | null;
}) => {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Calculate distance if user location available
  const distance = useMemo(() => {
    if (!userLocation) return null;
    const R = 6371; // Earth radius in km
    const dLat = (signal.latitude - userLocation.latitude) * Math.PI / 180;
    const dLon = (signal.longitude - userLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(userLocation.latitude * Math.PI / 180) *
      Math.cos(signal.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, [signal, userLocation]);

  const timeSince = useMemo(() => {
    const mins = Math.floor((Date.now() - signal.timestamp) / 60000);
    if (mins < 1) return 'şimdi';
    if (mins < 60) return `${mins}dk`;
    return `${Math.floor(mins / 60)}sa`;
  }, [signal.timestamp]);

  return (
    <Pressable onPress={onPress} style={styles.sosMarkerContainer}>
      {/* Pulsing ring */}
      <Animated.View
        style={[
          styles.sosMarkerPulse,
          pulseStyle,
        ]}
      />

      {/* Main marker */}
      <LinearGradient
        colors={signal.trapped ? ['#dc2626', '#991b1b'] : ['#f59e0b', '#d97706']}
        style={styles.sosMarkerMain}
      >
        <Ionicons
          name={signal.trapped ? 'alert' : 'hand-left'}
          size={20}
          color="#fff"
        />
      </LinearGradient>

      {/* Info label */}
      <View style={styles.sosMarkerLabel}>
        <Text style={styles.sosMarkerName} numberOfLines={1}>
          {signal.trapped ? '🆘 ENKAZ' : '⚠️ YARDIM'}
        </Text>
        <Text style={styles.sosMarkerInfo}>
          {distance ? `${distance.toFixed(1)}km • ` : ''}{timeSince}
        </Text>
      </View>
    </Pressable>
  );
};

export default function DisasterMapScreen({ navigation, route }: DisasterMapScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  const toFiniteNumber = useCallback((value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }, []);

  // Route params from notification tap (SOS + family location focus)
  const focusOnSOS = route?.params?.focusOnSOS;
  const focusOnFamily = route?.params?.focusOnFamily;
  const sosLatitude = toFiniteNumber(route?.params?.sosLatitude);
  const sosLongitude = toFiniteNumber(route?.params?.sosLongitude);
  const familyLatitude = toFiniteNumber(route?.params?.familyLatitude);
  const familyLongitude = toFiniteNumber(route?.params?.familyLongitude);
  const targetLatitude = sosLatitude ?? familyLatitude;
  const targetLongitude = sosLongitude ?? familyLongitude;
  const shouldFocusRouteLocation = Boolean((focusOnSOS || focusOnFamily) && targetLatitude !== null && targetLongitude !== null);

  // FIX #2: Live location tracking (replaces one-shot getCurrentPositionAsync)
  const { location: userLocation, locationData } = useLiveLocation({
    distanceInterval: 10,
    timeInterval: 5000,
  });

  // State
  const [region, setRegion] = useState<Region | null>(null);
  const [zoom, setZoom] = useState(15);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedQuake, setSelectedQuake] = useState<MapPoint | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [viewMode, setViewMode] = useState<'family' | 'earthquake'>('family');

  // Auto-focus on location when navigated from notification
  useEffect(() => {
    if (shouldFocusRouteLocation && targetLatitude !== null && targetLongitude !== null && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: targetLatitude,
        longitude: targetLongitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [shouldFocusRouteLocation, targetLatitude, targetLongitude]);

  // Stores
  const familyMembers = useFamilyStore((state) => state.members);
  const earthquakes = useEarthquakeStore((state) => state.items);
  const currentSOSSignal = useSOSStore((state) => state.currentSignal);
  const incomingSOSAlerts = useSOSStore((state) => state.incomingSOSAlerts);

  // SOS Signals state
  const [selectedSOS, setSelectedSOS] = useState<ActiveSOSSignal | null>(null);

  const activeSOSSignals = useMemo<ActiveSOSSignal[]>(() => {
    if (
      !currentSOSSignal ||
      !currentSOSSignal.location ||
      (currentSOSSignal.status !== 'broadcasting' && currentSOSSignal.status !== 'acknowledged')
    ) {
      return [];
    }

    return [{
      id: currentSOSSignal.id,
      userId: currentSOSSignal.userId,
      userName: currentSOSSignal.userId,
      latitude: currentSOSSignal.location.latitude,
      longitude: currentSOSSignal.location.longitude,
      timestamp: currentSOSSignal.timestamp,
      message: currentSOSSignal.message,
      trapped: currentSOSSignal.trapped,
      senderUid: currentSOSSignal.userId,
    }];
  }, [currentSOSSignal]);

  // Incoming SOS from other users (via SOSAlertListener → sosStore)
  const incomingSOSMarkers = useMemo<ActiveSOSSignal[]>(() => {
    return incomingSOSAlerts
      .filter(alert => {
        // Only show alerts from the last 30 minutes
        const age = Date.now() - alert.timestamp;
        return age < 30 * 60 * 1000;
      })
      .map(alert => ({
        id: alert.id,
        userId: alert.senderUid || alert.senderDeviceId,
        userName: alert.senderName,
        name: alert.senderName,
        latitude: alert.latitude,
        longitude: alert.longitude,
        timestamp: alert.timestamp,
        message: alert.message,
        trapped: alert.trapped,
        battery: alert.battery,
        senderDeviceId: alert.senderDeviceId,
        senderUid: alert.senderUid,
        signalId: alert.signalId,
        healthInfo: alert.healthInfo,
      }));
  }, [incomingSOSAlerts]);

  // Combined: own SOS + incoming SOS from others
  const allSOSSignals = useMemo(() => {
    return [...activeSOSSignals, ...incomingSOSMarkers];
  }, [activeSOSSignals, incomingSOSMarkers]);

  useEffect(() => {
    if (selectedSOS && !allSOSSignals.some((signal) => signal.id === selectedSOS.id)) {
      setSelectedSOS(null);
    }
  }, [allSOSSignals, selectedSOS]);

  // Cluster Engine
  const clusterEngine = useMemo(() => new MapClusterEngine({
    radius: 40,
    maxZoom: 14,
  }), []);

  const [clusters, setClusters] = useState<ReturnType<MapClusterEngine["getClusters"]>>([]);

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['15%', '45%', '90%'], []);

  // CRITICAL FIX: Ensure familyStore is initialized when DisasterMapScreen mounts.
  // Previously removed (FIX #5) assuming init.ts would handle it, but init.ts gates
  // behind isAuthed — causing empty members if auth race condition occurs.
  // initialize() is idempotent and safe to call multiple times.
  useEffect(() => {
    useFamilyStore.getState().initialize().catch((error) => {
      logger.warn('FamilyStore init from DisasterMapScreen:', error);
    });
  }, []);

  // FIX #2: Location initialization is now handled by useLiveLocation hook
  useEffect(() => {
    if (userLocation) {
      const initialRegion = {
        ...userLocation,
        ...DEFAULT_DELTA,
      };
      setRegion(initialRegion);
      setIsInitialized(true);

      if (mapRef.current && !isInitialized) {
        mapRef.current.animateToRegion(initialRegion, 500);
      }
    } else {
      // Fallback: if no location after 3 seconds, show Turkey overview
      const timer = setTimeout(() => {
        if (!userLocation) {
          setRegion({
            latitude: 39.0,
            longitude: 35.0,
            latitudeDelta: 5,
            longitudeDelta: 5,
          });
          setIsInitialized(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [userLocation]);

  // Update earthquake clusters
  useEffect(() => {
    if (earthquakes.length > 0 && region) {
      const points: MapPoint[] = earthquakes.map(eq => ({
        id: eq.id,
        latitude: eq.latitude,
        longitude: eq.longitude,
        magnitude: eq.magnitude,
        location: eq.location,
        source: eq.source,
        time: eq.time,
        type: 'earthquake',
      }));

      clusterEngine.load(points);
      updateClusters(region, zoom);
    }
  }, [earthquakes, region, zoom]);

  const updateClusters = useCallback((currentRegion: Region, currentZoom: number) => {
    if (!clusterEngine) return;

    const bbox: [number, number, number, number] = [
      currentRegion.longitude - currentRegion.longitudeDelta / 2,
      currentRegion.latitude - currentRegion.latitudeDelta / 2,
      currentRegion.longitude + currentRegion.longitudeDelta / 2,
      currentRegion.latitude + currentRegion.latitudeDelta / 2,
    ];

    try {
      const newClusters = clusterEngine.getClusters(bbox, Math.round(currentZoom));
      setClusters(newClusters);
    } catch (e) {
      logger.error('Cluster calculation failed', e);
    }
  }, [clusterEngine]);

  const onRegionChangeComplete = useCallback((newRegion: Region) => {
    setRegion(newRegion);
    const newZoom = Math.log2(360 / newRegion.longitudeDelta);
    setZoom(newZoom);
    updateClusters(newRegion, newZoom);
  }, [updateClusters]);

  // Focus functions
  const focusOnUser = useCallback(() => {
    haptics.impactLight();
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        ...DEFAULT_DELTA,
      }, 500);
    }
  }, [userLocation]);

  const focusOnMember = useCallback((member: FamilyMember) => {
    haptics.impactMedium();
    setSelectedMember(member);
    setSelectedQuake(null);

    const lat = member.location?.latitude ?? member.latitude;
    const lng = member.location?.longitude ?? member.longitude;

    // FIX #1: Proper coordinate validation (lat=0 is valid, e.g. equator)
    if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng) && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }

    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  const showAllMembers = useCallback(() => {
    haptics.impactLight();

    const allCoords: { latitude: number; longitude: number }[] = [];

    if (userLocation) {
      allCoords.push(userLocation);
    }

    familyMembers.forEach(member => {
      const lat = member.location?.latitude ?? member.latitude;
      const lng = member.location?.longitude ?? member.longitude;
      // FIX #1: Proper coordinate validation
      if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) {
        allCoords.push({ latitude: lat, longitude: lng });
      }
    });

    if (allCoords.length === 0) return;

    const minLat = Math.min(...allCoords.map(c => c.latitude));
    const maxLat = Math.max(...allCoords.map(c => c.latitude));
    const minLng = Math.min(...allCoords.map(c => c.longitude));
    const maxLng = Math.max(...allCoords.map(c => c.longitude));

    const padding = 0.02;

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(maxLat - minLat + padding, 0.01),
        longitudeDelta: Math.max(maxLng - minLng + padding, 0.01),
      }, 500);
    }
  }, [userLocation, familyMembers]);

  const handleClusterPress = useCallback((clusterId: number, coordinate: { latitude: number; longitude: number }) => {
    haptics.impactLight();
    const nextZoom = clusterEngine.getExpansionZoom(clusterId);

    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: coordinate,
        zoom: nextZoom,
      }, { duration: 500 });
    }
  }, [clusterEngine]);

  const handleQuakePress = useCallback((point: MapPoint) => {
    haptics.impactMedium();
    setSelectedQuake(point);
    setSelectedMember(null);
    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  // Helper functions
  const getRelativeTime = (timestamp: number | string | Date | null | undefined): string =>
    formatLastSeen(timestamp);

  const getStatusText = (status: FamilyMember['status']): string => {
    switch (status) {
      case 'safe': return 'Güvende';
      case 'need-help': return 'Yardım Gerekiyor';
      case 'critical': return 'Kritik Durum';
      case 'danger': return 'Tehlikede';
      case 'offline': return 'Çevrimdışı';
      case 'unknown': return 'Bilinmiyor';
      default: return 'Bilinmiyor';
    }
  };

  const getStatusIcon = (status: FamilyMember['status']): string => {
    switch (status) {
      case 'safe': return 'shield-checkmark';
      case 'need-help': return 'alert-circle';
      case 'critical': return 'warning';
      case 'danger': return 'flame';
      case 'offline': return 'cloud-offline';
      default: return 'help-circle';
    }
  };

  const getRelationshipEmoji = (relationship?: string): string => {
    if (!relationship) return '👤';
    const emojis: Record<string, string> = {
      anne: '👩', baba: '👨', es: '💕', kardes: '👫',
      cocuk: '👶', akraba: '👥', arkadas: '🤝', diger: '👤',
    };
    return emojis[relationship] || '👤';
  };

  const getRelationshipLabel = (relationship?: string): string => {
    if (!relationship) return '';
    const labels: Record<string, string> = {
      anne: 'Anne', baba: 'Baba', es: 'Eş', kardes: 'Kardeş',
      cocuk: 'Çocuk', akraba: 'Akraba', arkadas: 'Arkadaş', diger: 'Diğer',
    };
    return labels[relationship] || relationship;
  };

  // Loading state
  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View entering={FadeIn}>
          <LinearGradient
            colors={[PREMIUM_COLORS.trustBlue, PREMIUM_COLORS.trustBlueDark]}
            style={styles.loadingIcon}
          >
            <Ionicons name="map" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.loadingText}>Konum alınıyor...</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region || undefined}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        loadingEnabled
        loadingIndicatorColor={PREMIUM_COLORS.trustBlue}
        mapPadding={{
          top: insets.top + 80,
          right: 0,
          bottom: 200,
          left: 0,
        }}
      >
        {/* User Location with premium pulse */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}
          >
            <PulseMarker color={PREMIUM_COLORS.trustBlue} size={60} />
          </Marker>
        )}

        {/* Family Members */}
        {familyMembers.map((member) => {
          const lat = member.location?.latitude ?? member.latitude;
          const lng = member.location?.longitude ?? member.longitude;

          if (!lat || !lng || !isFinite(lat) || !isFinite(lng)) return null;

          return (
            <Marker
              key={member.uid}
              coordinate={{ latitude: lat, longitude: lng }}
              anchor={{ x: 0.5, y: 0.9 }}
              zIndex={selectedMember?.uid === member.uid ? 100 : 10}
              tracksViewChanges={false}
            >
              <FamilyMemberMarker
                member={member}
                isSelected={selectedMember?.uid === member.uid}
                onPress={() => focusOnMember(member)}
              />
            </Marker>
          );
        })}

        {/* Earthquake Heatmap Circles */}
        {viewMode === 'earthquake' && earthquakes.slice(0, 20).map((eq) => (
          <Circle
            key={`heatmap-${eq.id}`}
            center={{ latitude: eq.latitude, longitude: eq.longitude }}
            radius={eq.magnitude * 8000}
            fillColor={getMagnitudeColor(eq.magnitude) + '25'}
            strokeColor={getMagnitudeColor(eq.magnitude)}
            strokeWidth={2}
          />
        ))}

        {/* Earthquake Markers */}
        {viewMode === 'earthquake' && clusters.map((item) => {
          const { geometry, properties } = item;
          const coordinate = {
            latitude: geometry.coordinates[1],
            longitude: geometry.coordinates[0],
          };

          if (properties.cluster) {
            return (
              <ClusterMarker
                key={`cluster-${properties.cluster_id}`}
                cluster={{
                  ...properties,
                  latitude: coordinate.latitude,
                  longitude: coordinate.longitude,
                  point_count: properties.point_count,
                }}
                onPress={() => handleClusterPress(properties.cluster_id, coordinate)}
              />
            );
          }

          return (
            <Marker
              key={`quake-${properties.pointId}`}
              coordinate={coordinate}
              onPress={() => handleQuakePress(properties as unknown as MapPoint)}
              tracksViewChanges={false}
            >
              <EarthquakeMarker
                magnitude={properties.magnitude || 3.0}
                selected={selectedQuake?.id === properties.pointId}
              />
            </Marker>
          );
        })}

        {/* PREMIUM: SOS Signal Markers - Always visible in both modes */}
        {allSOSSignals.map((signal) => (
          <Marker
            key={`sos-${signal.id}`}
            coordinate={{ latitude: signal.latitude, longitude: signal.longitude }}
            onPress={() => {
              haptics.impactMedium();
              setSelectedSOS(signal);
              bottomSheetRef.current?.snapToIndex(1);
            }}
            tracksViewChanges={false}  // FIX #4: Performance — SOS markers don't need per-frame re-render
          >
            <SOSSignalMarker
              signal={signal}
              onPress={() => {
                haptics.impactMedium();
                setSelectedSOS(signal);
                bottomSheetRef.current?.snapToIndex(1);
              }}
              userLocation={userLocation}
            />
          </Marker>
        ))}

        {/* NOTE: Premium overlays removed for stability. 
            Will be re-added with lazy loading in future update. */}
      </MapView>

      {/* PREMIUM: Header with glassmorphism */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BlurView intensity={40} tint="light" style={styles.headerBlur}>
          <LinearGradient
            colors={['rgba(255,252,247,0.95)', 'rgba(244,239,231,0.9)']}
            style={styles.headerGradient}
          >
            {/* Back Button - only when navigated from Stack */}
            {navigation.canGoBack() && (
              <Pressable
                style={styles.headerBackBtn}
                onPress={() => {
                  haptics.impactLight();
                  navigation.goBack();
                }}
                hitSlop={12}
              >
                <Ionicons name="chevron-back" size={24} color={PREMIUM_COLORS.textPrimary} />
              </Pressable>
            )}

            {/* View Mode Toggle */}
            <View style={styles.viewModeToggle}>
              <Pressable
                style={[
                  styles.viewModeBtn,
                  viewMode === 'family' && styles.viewModeBtnActive,
                ]}
                onPress={() => {
                  haptics.impactLight();
                  setViewMode('family');
                  firebaseAnalyticsService.logEvent('map_view_mode_change', { mode: 'family', family_count: familyMembers.length });
                }}
              >
                <Ionicons
                  name="people"
                  size={18}
                  color={viewMode === 'family' ? '#fff' : PREMIUM_COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.viewModeBtnText,
                    viewMode === 'family' && styles.viewModeBtnTextActive,
                  ]}
                >
                  Aile
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.viewModeBtn,
                  viewMode === 'earthquake' && styles.viewModeBtnActive,
                ]}
                onPress={() => {
                  haptics.impactLight();
                  setViewMode('earthquake');
                  firebaseAnalyticsService.logEvent('map_view_mode_change', { mode: 'earthquake', earthquake_count: earthquakes.length });
                }}
              >
                <Ionicons
                  name="pulse"
                  size={18}
                  color={viewMode === 'earthquake' ? '#fff' : PREMIUM_COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.viewModeBtnText,
                    viewMode === 'earthquake' && styles.viewModeBtnTextActive,
                  ]}
                >
                  Deprem
                </Text>
              </Pressable>
            </View>

            {/* EEW Status Badge */}
            <EEWStatusBadge />
          </LinearGradient>
        </BlurView>
      </View>

      {/* Map Legend */}
      <MapLegend
        mode={viewMode}
        earthquakeCount={earthquakes.length}
        style={{ bottom: insets.bottom + 380 }}
      />

      {/* PREMIUM: Floating Controls */}
      <View style={[styles.floatingControls, { bottom: insets.bottom + 220 }]}>
        {/* Show all family */}
        <Pressable style={styles.controlBtn} onPress={showAllMembers}>
          <Ionicons name="people" size={22} color={PREMIUM_COLORS.trustBlue} />
        </Pressable>

        {/* Focus on user - Primary action */}
        <LinearGradient
          colors={[PREMIUM_COLORS.trustBlue, PREMIUM_COLORS.trustBlueDark]}
          style={styles.controlBtnPrimary}
        >
          <Pressable style={styles.controlBtnInner} onPress={focusOnUser}>
            <Ionicons name="locate" size={22} color="#fff" />
          </Pressable>
        </LinearGradient>

        {/* Zoom controls */}
        <View style={styles.zoomControls}>
          <Pressable
            style={styles.zoomBtn}
            onPress={() => {
              haptics.impactLight();
              if (mapRef.current) {
                mapRef.current.animateCamera({ zoom: zoom + 1 }, { duration: 300 });
              }
            }}
          >
            <Ionicons name="add" size={22} color={PREMIUM_COLORS.trustBlue} />
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable
            style={styles.zoomBtn}
            onPress={() => {
              haptics.impactLight();
              if (mapRef.current) {
                mapRef.current.animateCamera({ zoom: Math.max(zoom - 1, 3) }, { duration: 300 });
              }
            }}
          >
            <Ionicons name="remove" size={22} color={PREMIUM_COLORS.trustBlue} />
          </Pressable>
        </View>
      </View>

      {/* PREMIUM: Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={styles.bottomSheetBg}
        handleIndicatorStyle={styles.bottomSheetHandle}
        enablePanDownToClose={false}
      >
        <BottomSheetScrollView style={styles.sheetContent}>
          {/* Family Members List (default view) */}
          {!selectedMember && !selectedQuake && (
            <>
              <Text style={styles.sheetTitle}>
                {viewMode === 'family' ? 'Aile Üyeleri' : 'Deprem Aktivitesi'}
              </Text>

              {viewMode === 'family' ? (
                familyMembers.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyStateIcon}>
                      <Ionicons name="people-outline" size={32} color={PREMIUM_COLORS.trustBlue} />
                    </View>
                    <Text style={styles.emptyStateText}>Aile üyesi bulunamadı</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Aile üyelerini eklemek için Aile sekmesine gidin
                    </Text>
                  </View>
                ) : (
                  familyMembers.map((member) => (
                    <Pressable
                      key={member.uid}
                      style={styles.memberCard}
                      onPress={() => focusOnMember(member)}
                    >
                      {/* Premium Avatar with gradient */}
                      <LinearGradient
                        colors={[STATUS_COLORS[member.status] || STATUS_COLORS.unknown, `${STATUS_COLORS[member.status] || STATUS_COLORS.unknown}CC`]}
                        style={styles.memberAvatar}
                      >
                        <Text style={styles.memberAvatarText}>
                          {member.name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                      </LinearGradient>

                      {/* Info */}
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <View style={styles.memberMeta}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: (STATUS_COLORS[member.status] || STATUS_COLORS.unknown) + '15' },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDotSmall,
                                { backgroundColor: STATUS_COLORS[member.status] || STATUS_COLORS.unknown },
                              ]}
                            />
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: STATUS_COLORS[member.status] || STATUS_COLORS.unknown },
                              ]}
                            >
                              {getStatusText(member.status)}
                            </Text>
                          </View>
                          <Text style={styles.lastSeenText}>
                            {member.lastSeen ? getRelativeTime(member.lastSeen) : 'Bilinmiyor'}
                          </Text>
                        </View>
                      </View>

                      {/* Arrow */}
                      <Ionicons name="chevron-forward" size={20} color={PREMIUM_COLORS.textSecondary} />
                    </Pressable>
                  ))
                )
              ) : (
                // Earthquake info
                <View style={styles.quakeInfo}>
                  <LinearGradient
                    colors={[PREMIUM_COLORS.trustBlue + '10', PREMIUM_COLORS.trustBlue + '05']}
                    style={styles.quakeInfoGradient}
                  >
                    <Ionicons name="pulse" size={24} color={PREMIUM_COLORS.trustBlue} />
                    <Text style={styles.quakeInfoText}>
                      Son 24 saatte {earthquakes.length} deprem kaydedildi
                    </Text>
                  </LinearGradient>
                </View>
              )}
            </>
          )}

          {/* Selected Member Detail — PREMIUM REDESIGN */}
          {selectedMember && (() => {
            const statusColor = STATUS_COLORS[selectedMember.status] || STATUS_COLORS.unknown;
            const memberLat = selectedMember.location?.latitude ?? selectedMember.latitude;
            const memberLng = selectedMember.location?.longitude ?? selectedMember.longitude;
            const hasLocation = typeof memberLat === 'number' && typeof memberLng === 'number' && isFinite(memberLat) && isFinite(memberLng) && (memberLat !== 0 || memberLng !== 0);
            const distanceKm = hasLocation && userLocation
              ? calculateDistance(userLocation.latitude, userLocation.longitude, memberLat, memberLng)
              : null;
            const relationEmoji = getRelationshipEmoji(selectedMember.relationship);
            const relationLabel = getRelationshipLabel(selectedMember.relationship);

            return (
              <View style={styles.detailView}>
                {/* Back button */}
                <Pressable
                  style={styles.backBtn}
                  onPress={() => setSelectedMember(null)}
                >
                  <Ionicons name="chevron-back" size={20} color={PREMIUM_COLORS.trustBlue} />
                  <Text style={styles.backBtnText}>Geri</Text>
                </Pressable>

                {/* PREMIUM: Avatar with animated status ring */}
                <View style={styles.memberDetail}>
                  <View style={{ position: 'relative', marginBottom: 16 }}>
                    {/* Status ring */}
                    <View style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      borderWidth: 3.5,
                      borderColor: statusColor,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: statusColor,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                    }}>
                      <LinearGradient
                        colors={[statusColor, `${statusColor}BB`]}
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: 42,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff' }}>
                          {selectedMember.name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                      </LinearGradient>
                    </View>

                    {/* Relationship emoji badge */}
                    {relationLabel ? (
                      <View style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -4,
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#fff',
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.12,
                        shadowRadius: 4,
                        elevation: 3,
                      }}>
                        <Text style={{ fontSize: 18 }}>{relationEmoji}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Name + relationship */}
                  <Text style={styles.memberDetailName}>{selectedMember.name}</Text>
                  {relationLabel ? (
                    <Text style={{
                      fontSize: 14,
                      color: PREMIUM_COLORS.textSecondary,
                      fontWeight: '500',
                      marginBottom: 12,
                      marginTop: -8,
                    }}>{relationLabel}</Text>
                  ) : null}

                  {/* PREMIUM: Status banner — large, prominent */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: statusColor + '12',
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 16,
                    gap: 10,
                    borderWidth: 1.5,
                    borderColor: statusColor + '25',
                  }}>
                    <Ionicons name={getStatusIcon(selectedMember.status) as any} size={22} color={statusColor} />
                    <Text style={{
                      fontSize: 17,
                      fontWeight: '700',
                      color: statusColor,
                      letterSpacing: 0.3,
                    }}>
                      {getStatusText(selectedMember.status)}
                    </Text>
                  </View>
                </View>

                {/* PREMIUM: Info cards grid */}
                <View style={styles.infoCards}>
                  {/* Last seen */}
                  <View style={styles.infoCard}>
                    <View style={styles.infoCardIcon}>
                      <Ionicons name="time-outline" size={20} color={PREMIUM_COLORS.trustBlue} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoCardLabel}>Son Görülme</Text>
                      <Text style={styles.infoCardValue}>
                        {selectedMember.lastSeen ? getRelativeTime(selectedMember.lastSeen) : 'Bilinmiyor'}
                      </Text>
                    </View>
                    {/* Online indicator */}
                    <View style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: selectedMember.isOnline ? PREMIUM_COLORS.safe : '#94a3b8',
                    }} />
                  </View>

                  {/* Distance */}
                  {distanceKm !== null && (
                    <View style={styles.infoCard}>
                      <View style={styles.infoCardIcon}>
                        <Ionicons name="location-outline" size={20} color={PREMIUM_COLORS.trustBlue} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoCardLabel}>Uzaklık</Text>
                        <Text style={styles.infoCardValue}>
                          {distanceKm < 1
                            ? `${Math.round(distanceKm * 1000)} m`
                            : `${distanceKm.toFixed(1)} km`}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Battery */}
                  {selectedMember.batteryLevel !== undefined && (
                    <View style={styles.infoCard}>
                      <View style={[
                        styles.infoCardIcon,
                        selectedMember.batteryLevel <= 20 && { backgroundColor: PREMIUM_COLORS.critical + '15' }
                      ]}>
                        <Ionicons
                          name={selectedMember.batteryLevel <= 20 ? 'battery-dead' : selectedMember.batteryLevel <= 50 ? 'battery-half' : 'battery-full'}
                          size={20}
                          color={selectedMember.batteryLevel <= 20 ? PREMIUM_COLORS.critical : PREMIUM_COLORS.safe}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoCardLabel}>Pil Seviyesi</Text>
                        <Text
                          style={[
                            styles.infoCardValue,
                            selectedMember.batteryLevel <= 20 && { color: PREMIUM_COLORS.critical },
                          ]}
                        >
                          %{selectedMember.batteryLevel}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Phone */}
                  {selectedMember.phoneNumber && (
                    <Pressable
                      style={styles.infoCard}
                      onPress={() => {
                        haptics.impactLight();
                        Linking.openURL(`tel:${selectedMember.phoneNumber}`).catch(err =>
                          logger.error('Phone:', err)
                        );
                      }}
                    >
                      <View style={styles.infoCardIcon}>
                        <Ionicons name="call-outline" size={20} color={PREMIUM_COLORS.trustBlue} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoCardLabel}>Telefon</Text>
                        <Text style={styles.infoCardValue}>
                          {selectedMember.phoneNumber}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={PREMIUM_COLORS.textSecondary} />
                    </Pressable>
                  )}

                  {/* Last Known Location (when phone was off) */}
                  {!hasLocation && selectedMember.lastKnownLocation && (
                    <View style={[styles.infoCard, { borderColor: PREMIUM_COLORS.warning + '40' }]}>
                      <View style={[styles.infoCardIcon, { backgroundColor: PREMIUM_COLORS.warning + '15' }]}>
                        <Ionicons name="location-outline" size={20} color={PREMIUM_COLORS.warning} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoCardLabel}>Son Bilinen Konum</Text>
                        <Text style={[styles.infoCardValue, { color: PREMIUM_COLORS.warning }]}>
                          {selectedMember.lastKnownLocation?.timestamp ? getRelativeTime(selectedMember.lastKnownLocation.timestamp) : 'Bilinmiyor'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* PREMIUM: Action buttons — 3 buttons */}
                <View style={styles.actionButtons}>
                  {/* Yol Tarifi */}
                  <LinearGradient
                    colors={hasLocation
                      ? [PREMIUM_COLORS.trustBlue, PREMIUM_COLORS.trustBlueDark]
                      : ['#94a3b8', '#64748b']
                    }
                    style={[styles.actionBtnPrimary, { flex: 1 }]}
                  >
                    <Pressable
                      style={styles.actionBtnInner}
                      onPress={() => {
                        haptics.impactMedium();
                        const lat = hasLocation ? memberLat : selectedMember.lastKnownLocation?.latitude;
                        const lng = hasLocation ? memberLng : selectedMember.lastKnownLocation?.longitude;
                        if (lat && lng) {
                          const url = Platform.OS === 'ios'
                            ? `http://maps.apple.com/?daddr=${lat},${lng}`
                            : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                          Linking.openURL(url).catch(err => logger.error('Maps:', err));
                        } else {
                          Alert.alert('Konum Yok', 'Bu üyenin konumu henüz paylaşılmamış.');
                        }
                      }}
                    >
                      <Ionicons name="navigate" size={18} color="#fff" />
                      <Text style={styles.actionBtnPrimaryText}>Yol Tarifi</Text>
                    </Pressable>
                  </LinearGradient>

                  {/* Mesaj */}
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      haptics.impactLight();
                      navigation.navigate('Conversation', {
                        userId: selectedMember.uid || selectedMember.deviceId,
                      });
                    }}
                  >
                    <Ionicons name="chatbubble" size={18} color={PREMIUM_COLORS.trustBlue} />
                    <Text style={styles.actionBtnText}>Mesaj</Text>
                  </Pressable>

                  {/* Ara */}
                  {selectedMember.phoneNumber && (
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        haptics.impactLight();
                        Linking.openURL(`tel:${selectedMember.phoneNumber}`).catch(err =>
                          logger.error('Phone:', err)
                        );
                      }}
                    >
                      <Ionicons name="call" size={18} color={PREMIUM_COLORS.safe} />
                      <Text style={[styles.actionBtnText, { color: PREMIUM_COLORS.safe }]}>Ara</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Selected Earthquake Detail */}
          {selectedQuake && (
            <View style={styles.detailView}>
              <Pressable
                style={styles.backBtn}
                onPress={() => setSelectedQuake(null)}
              >
                <Ionicons name="chevron-back" size={20} color={PREMIUM_COLORS.trustBlue} />
                <Text style={styles.backBtnText}>Geri</Text>
              </Pressable>

              <View style={styles.quakeDetail}>
                <LinearGradient
                  colors={[getMagnitudeColor(selectedQuake.magnitude || 3), getMagnitudeColor(selectedQuake.magnitude || 3) + 'CC']}
                  style={styles.magnitudeCircle}
                >
                  <Text style={styles.magnitudeText}>
                    {selectedQuake.magnitude?.toFixed(1)}
                  </Text>
                </LinearGradient>
                <Text style={styles.quakeLocation}>{selectedQuake.location}</Text>
                <Text style={styles.quakeTime}>
                  {selectedQuake.time
                    ? new Date(selectedQuake.time).toLocaleString('tr-TR')
                    : 'Zaman bilinmiyor'}
                </Text>
              </View>
            </View>
          )}

          {/* ========== CRITICAL: SOS KURTARMA PANELİ ========== */}
          {selectedSOS && (
            <View style={styles.detailView}>
              <Pressable
                style={styles.backBtn}
                onPress={() => setSelectedSOS(null)}
              >
                <Ionicons name="chevron-back" size={20} color={PREMIUM_COLORS.trustBlue} />
                <Text style={styles.backBtnText}>Geri</Text>
              </Pressable>

              {/* SOS Header — Red emergency gradient */}
              <LinearGradient
                colors={['#DC2626', '#B91C1C']}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 40, marginBottom: 4 }}>
                  {selectedSOS.trapped ? '🆘' : '⚠️'}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center' }}>
                  {selectedSOS.name || 'Bilinmeyen'}
                </Text>
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 20,
                  marginTop: 6,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>
                    {selectedSOS.trapped ? 'ENKAZ ALTINDA' : 'YARDIM İSTİYOR'}
                  </Text>
                </View>
                {selectedSOS.message && (
                  <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
                    "{selectedSOS.message}"
                  </Text>
                )}
              </LinearGradient>

              {/* Info Cards */}
              <View style={styles.infoCards}>
                {/* Distance + Time */}
                <View style={styles.infoCard}>
                  <View style={[styles.infoCardIcon, { backgroundColor: '#DC262615' }]}>
                    <Ionicons name="location" size={20} color="#DC2626" />
                  </View>
                  <View>
                    <Text style={styles.infoCardLabel}>Mesafe</Text>
                    <Text style={styles.infoCardValue}>
                      {userLocation
                        ? `${calculateDistance(
                          userLocation.latitude,
                          userLocation.longitude,
                          selectedSOS.latitude,
                          selectedSOS.longitude
                        ).toFixed(1)} km`
                        : 'Hesaplanıyor...'}
                    </Text>
                  </View>
                </View>

                {/* Time since SOS */}
                <View style={styles.infoCard}>
                  <View style={styles.infoCardIcon}>
                    <Ionicons name="time" size={20} color={PREMIUM_COLORS.trustBlue} />
                  </View>
                  <View>
                    <Text style={styles.infoCardLabel}>SOS Zamanı</Text>
                    <Text style={styles.infoCardValue}>
                      {selectedSOS?.timestamp ? getRelativeTime(selectedSOS.timestamp) : 'Bilinmiyor'}
                    </Text>
                  </View>
                </View>

                {/* Battery */}
                {selectedSOS.battery !== undefined && (
                  <View style={styles.infoCard}>
                    <View style={[styles.infoCardIcon, selectedSOS.battery <= 20 && { backgroundColor: '#DC262615' }]}>
                      <Ionicons
                        name={selectedSOS.battery <= 20 ? 'battery-dead' : selectedSOS.battery <= 50 ? 'battery-half' : 'battery-full'}
                        size={20}
                        color={selectedSOS.battery <= 20 ? '#DC2626' : PREMIUM_COLORS.trustBlue}
                      />
                    </View>
                    <View>
                      <Text style={styles.infoCardLabel}>Pil</Text>
                      <Text style={[
                        styles.infoCardValue,
                        selectedSOS.battery <= 20 && { color: '#DC2626', fontWeight: '900' },
                      ]}>
                        %{selectedSOS.battery}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Health Info — Life-saving medical data */}
              {selectedSOS.healthInfo && (
                <View style={{
                  backgroundColor: '#EFF6FF',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="medical" size={18} color="#1D4ED8" />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#1D4ED8', marginLeft: 6 }}>
                      Sağlık Bilgisi
                    </Text>
                  </View>
                  {selectedSOS.healthInfo.bloodType && (
                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF', width: 100 }}>Kan Grubu:</Text>
                      <Text style={{ fontSize: 13, color: '#1E3A5F', fontWeight: '800' }}>{selectedSOS.healthInfo.bloodType}</Text>
                    </View>
                  )}
                  {selectedSOS.healthInfo.allergies && (
                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626', width: 100 }}>Alerji:</Text>
                      <Text style={{ fontSize: 13, color: '#1E3A5F', flex: 1 }}>{selectedSOS.healthInfo.allergies}</Text>
                    </View>
                  )}
                  {selectedSOS.healthInfo.chronicConditions && (
                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309', width: 100 }}>Kronik:</Text>
                      <Text style={{ fontSize: 13, color: '#1E3A5F', flex: 1 }}>{selectedSOS.healthInfo.chronicConditions}</Text>
                    </View>
                  )}
                  {selectedSOS.healthInfo.emergencyNotes && (
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#4338CA', width: 100 }}>Not:</Text>
                      <Text style={{ fontSize: 13, color: '#1E3A5F', flex: 1 }}>{selectedSOS.healthInfo.emergencyNotes}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* ACTION BUTTONS — Life-saving actions */}
              <View style={styles.actionButtons}>

                {/* 🧭 KONUMA GİT — Turn-by-turn navigation */}
                <LinearGradient
                  colors={['#DC2626', '#B91C1C']}
                  style={styles.actionBtnPrimary}
                >
                  <Pressable
                    style={styles.actionBtnInner}
                    onPress={() => {
                      haptics.impactHeavy();
                      const url = Platform.OS === 'ios'
                        ? `http://maps.apple.com/?daddr=${selectedSOS.latitude},${selectedSOS.longitude}&dirflg=d`
                        : `https://www.google.com/maps/dir/?api=1&destination=${selectedSOS.latitude},${selectedSOS.longitude}&travelmode=driving`;
                      Linking.openURL(url).catch(err => logger.error('Failed to open maps:', err));
                    }}
                  >
                    <Ionicons name="navigate" size={20} color="#fff" />
                    <Text style={styles.actionBtnPrimaryText}>Konuma Git</Text>
                  </Pressable>
                </LinearGradient>

                {/* 💬 MESAJ GÖNDER — SOS Conversation */}
                <Pressable
                  style={[styles.actionBtn, { flex: 1 }]}
                  onPress={() => {
                    haptics.impactMedium();
                    navigation.navigate('SOSConversation', {
                      sosUserId: selectedSOS.senderUid || selectedSOS.senderDeviceId || selectedSOS.userId,
                      sosUserAliases: [
                        selectedSOS.senderUid,
                        selectedSOS.senderDeviceId,
                        selectedSOS.userId,
                      ].filter((value): value is string => typeof value === 'string' && value.length > 0),
                      sosLocation: {
                        latitude: selectedSOS.latitude,
                        longitude: selectedSOS.longitude,
                      },
                      sosMessage: selectedSOS.message,
                      sosBatteryLevel: selectedSOS.battery,
                      sosTrapped: selectedSOS.trapped,
                    });
                  }}
                >
                  <Ionicons name="chatbubble-ellipses" size={20} color={PREMIUM_COLORS.trustBlue} />
                  <Text style={styles.actionBtnText}>Mesaj</Text>
                </Pressable>

                {/* ✅ YARDIMA GELİYORUM — Send rescue ACK */}
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: '#DCFCE7', borderColor: '#16A34A' }]}
                  onPress={async () => {
                    haptics.notificationSuccess();
                    try {
                      const { sosChannelRouter } = await import('../../services/sos/SOSChannelRouter');
                      await sosChannelRouter.sendRescueACK(
                        selectedSOS.signalId || selectedSOS.id,
                        selectedSOS.senderDeviceId || selectedSOS.id,
                        { sosSenderUid: selectedSOS.senderUid }
                      );
                      // Show confirmation
                      const { Alert } = await import('react-native');
                      Alert.alert(
                        '✅ Bildirim Gönderildi',
                        'Enkaz altındaki kişi yardıma geldiğinizi görecek.',
                        [{ text: 'Tamam' }]
                      );
                    } catch (err) {
                      logger.error('ACK failed:', err);
                    }
                  }}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                  <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>Geliyorum</Text>
                </Pressable>
              </View>

              {/* Coordinates for emergency services */}
              <View style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
              }}>
                <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                  📍 {selectedSOS.latitude.toFixed(6)}, {selectedSOS.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
