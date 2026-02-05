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
import { useEarthquakeStore } from '../../stores/earthquakeStore';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { useSOSStore, SOSSignal } from '../../services/sos';
import { createLogger } from '../../utils/logger';
import { EarthquakeMarker } from '../../components/map/EarthquakeMarker';
import { ClusterMarker } from '../../components/map/ClusterMarker';
import { MapClusterEngine, MapPoint } from '../../utils/MapClusterEngine';
import { MapLegend, getMagnitudeColor } from '../../components/map/MapLegend';
import { firebaseAnalyticsService } from '../../services/FirebaseAnalyticsService';
// NOTE: Premium overlays removed for stability (AssemblyPointMarkers, WavePropagationOverlay, RiskOverlay)
// Will be re-added with lazy loading in future update.
import * as haptics from '../../utils/haptics';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';
import type { Region } from 'react-native-maps';

const logger = createLogger('DisasterMapScreen');

// SOS Signal marker type for map display
interface ActiveSOSSignal {
  id: string;
  userId: string;
  userName?: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  message: string;
  trapped: boolean;
  distance?: number; // Will be calculated from user location
}

import MapView, { Marker, Circle } from 'react-native-maps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type DisasterMapNavigationProp = StackNavigationProp<ParamListBase>;

interface DisasterMapScreenProps {
  navigation: DisasterMapNavigationProp;
}

// ELITE: Premium color palette (Modern Calm Trust)
const PREMIUM_COLORS = {
  trustBlue: '#1F4E79',
  trustBlueDark: '#163B5B',
  trustBlueLight: '#4A769E',
  cream: '#F4EFE7',
  ivory: '#FFFCF7',
  textPrimary: '#121416',
  textSecondary: '#5B5F66',
  safe: '#2E7D32',
  warning: '#D9A441',
  critical: '#B53A3A',
  criticalDark: '#962A2A',
  glass: 'rgba(255, 252, 247, 0.92)',
  glassBorder: 'rgba(31, 78, 121, 0.12)',
};

// PREMIUM: Status colors with Modern Calm Trust palette
const STATUS_COLORS = {
  safe: PREMIUM_COLORS.safe,
  'need-help': PREMIUM_COLORS.warning,
  unknown: PREMIUM_COLORS.textSecondary,
  critical: PREMIUM_COLORS.critical,
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

export default function DisasterMapScreen({ navigation }: DisasterMapScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  // State
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [zoom, setZoom] = useState(15);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [selectedQuake, setSelectedQuake] = useState<MapPoint | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [viewMode, setViewMode] = useState<'family' | 'earthquake'>('family');

  // Stores
  const familyMembers = useFamilyStore((state) => state.members);
  const earthquakes = useEarthquakeStore((state) => state.items);

  // SOS Signals state
  const [activeSOSSignals, setActiveSOSSignals] = useState<ActiveSOSSignal[]>([]);
  const [selectedSOS, setSelectedSOS] = useState<ActiveSOSSignal | null>(null);

  // Cluster Engine
  const clusterEngine = useMemo(() => new MapClusterEngine({
    radius: 40,
    maxZoom: 14,
  }), []);

  const [clusters, setClusters] = useState<ReturnType<MapClusterEngine["getClusters"]>>([]);

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['15%', '45%', '90%'], []);

  // Initialize location
  useEffect(() => {
    initializeLocation();
    useFamilyStore.getState().initialize();
  }, []);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setRegion({
          latitude: 39.0,
          longitude: 35.0,
          latitudeDelta: 5,
          longitudeDelta: 5,
        });
        setIsInitialized(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(userCoords);

      const initialRegion = {
        ...userCoords,
        ...DEFAULT_DELTA,
      };

      setRegion(initialRegion);
      setIsInitialized(true);

      if (mapRef.current) {
        mapRef.current.animateToRegion(initialRegion, 500);
      }
    } catch (error) {
      logger.error('Location initialization failed:', error);
      setIsInitialized(true);
    }
  };

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

    if (lat && lng && mapRef.current) {
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
      if (lat && lng) {
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
  const getRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes}dk önce`;
    if (hours < 24) return `${hours}sa önce`;
    return `${days}g önce`;
  };

  const getStatusText = (status: FamilyMember['status']): string => {
    switch (status) {
      case 'safe': return 'Güvende';
      case 'need-help': return 'Yardım Gerekiyor';
      case 'critical': return 'Kritik Durum';
      default: return 'Bilinmiyor';
    }
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
              key={member.id}
              coordinate={{ latitude: lat, longitude: lng }}
              anchor={{ x: 0.5, y: 0.9 }}
              zIndex={selectedMember?.id === member.id ? 100 : 10}
              tracksViewChanges={false}
            >
              <FamilyMemberMarker
                member={member}
                isSelected={selectedMember?.id === member.id}
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
        {activeSOSSignals.map((signal) => (
          <Marker
            key={`sos-${signal.id}`}
            coordinate={{ latitude: signal.latitude, longitude: signal.longitude }}
            onPress={() => {
              haptics.impactMedium();
              setSelectedSOS(signal);
              bottomSheetRef.current?.snapToIndex(1);
            }}
            tracksViewChanges={true}
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
                      key={member.id}
                      style={styles.memberCard}
                      onPress={() => focusOnMember(member)}
                    >
                      {/* Premium Avatar with gradient */}
                      <LinearGradient
                        colors={[STATUS_COLORS[member.status], `${STATUS_COLORS[member.status]}CC`]}
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
                              { backgroundColor: STATUS_COLORS[member.status] + '15' },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDotSmall,
                                { backgroundColor: STATUS_COLORS[member.status] },
                              ]}
                            />
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: STATUS_COLORS[member.status] },
                              ]}
                            >
                              {getStatusText(member.status)}
                            </Text>
                          </View>
                          <Text style={styles.lastSeenText}>
                            {getRelativeTime(member.lastSeen)}
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

          {/* Selected Member Detail */}
          {selectedMember && (
            <View style={styles.detailView}>
              <Pressable
                style={styles.backBtn}
                onPress={() => setSelectedMember(null)}
              >
                <Ionicons name="chevron-back" size={20} color={PREMIUM_COLORS.trustBlue} />
                <Text style={styles.backBtnText}>Geri</Text>
              </Pressable>

              {/* Member Header */}
              <View style={styles.memberDetail}>
                <LinearGradient
                  colors={[STATUS_COLORS[selectedMember.status], `${STATUS_COLORS[selectedMember.status]}CC`]}
                  style={styles.memberDetailAvatar}
                >
                  <Text style={styles.memberDetailAvatarText}>
                    {selectedMember.name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </LinearGradient>

                <Text style={styles.memberDetailName}>{selectedMember.name}</Text>

                <View
                  style={[
                    styles.statusBadgeLarge,
                    { backgroundColor: STATUS_COLORS[selectedMember.status] + '15' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDotLarge,
                      { backgroundColor: STATUS_COLORS[selectedMember.status] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusBadgeLargeText,
                      { color: STATUS_COLORS[selectedMember.status] },
                    ]}
                  >
                    {getStatusText(selectedMember.status)}
                  </Text>
                </View>
              </View>

              {/* Info Cards */}
              <View style={styles.infoCards}>
                {/* Last seen */}
                <View style={styles.infoCard}>
                  <View style={styles.infoCardIcon}>
                    <Ionicons name="time-outline" size={20} color={PREMIUM_COLORS.trustBlue} />
                  </View>
                  <View>
                    <Text style={styles.infoCardLabel}>Son Görülme</Text>
                    <Text style={styles.infoCardValue}>
                      {getRelativeTime(selectedMember.lastSeen)}
                    </Text>
                  </View>
                </View>

                {/* Battery */}
                {selectedMember.batteryLevel !== undefined && (
                  <View style={styles.infoCard}>
                    <View style={[
                      styles.infoCardIcon,
                      selectedMember.batteryLevel <= 20 && { backgroundColor: PREMIUM_COLORS.critical + '15' }
                    ]}>
                      <Ionicons
                        name={selectedMember.batteryLevel <= 20 ? 'battery-dead' : 'battery-half'}
                        size={20}
                        color={selectedMember.batteryLevel <= 20 ? PREMIUM_COLORS.critical : PREMIUM_COLORS.trustBlue}
                      />
                    </View>
                    <View>
                      <Text style={styles.infoCardLabel}>Pil</Text>
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
                  <View style={styles.infoCard}>
                    <View style={styles.infoCardIcon}>
                      <Ionicons name="call-outline" size={20} color={PREMIUM_COLORS.trustBlue} />
                    </View>
                    <View>
                      <Text style={styles.infoCardLabel}>Telefon</Text>
                      <Text style={styles.infoCardValue}>
                        {selectedMember.phoneNumber}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <LinearGradient
                  colors={[PREMIUM_COLORS.trustBlue, PREMIUM_COLORS.trustBlueDark]}
                  style={styles.actionBtnPrimary}
                >
                  <Pressable
                    style={styles.actionBtnInner}
                    onPress={() => {
                      haptics.impactMedium();
                      if (selectedMember?.location) {
                        const { latitude, longitude } = selectedMember.location;
                        const url = Platform.OS === 'ios'
                          ? `http://maps.apple.com/?daddr=${latitude},${longitude}`
                          : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
                        Linking.openURL(url).catch(err => logger.error('Failed to open maps:', err));
                      }
                    }}
                  >
                    <Ionicons name="navigate" size={20} color="#fff" />
                    <Text style={styles.actionBtnPrimaryText}>Yol Tarifi</Text>
                  </Pressable>
                </LinearGradient>

                {selectedMember.phoneNumber && (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      haptics.impactLight();
                      if (selectedMember?.phoneNumber) {
                        Linking.openURL(`tel:${selectedMember.phoneNumber}`).catch(err =>
                          logger.error('Failed to open phone:', err)
                        );
                      }
                    }}
                  >
                    <Ionicons name="call" size={20} color={PREMIUM_COLORS.trustBlue} />
                    <Text style={styles.actionBtnText}>Ara</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

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
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.cream,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PREMIUM_COLORS.cream,
  },
  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: PREMIUM_COLORS.textSecondary,
    textAlign: 'center',
  },

  // PREMIUM: Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
  },
  headerBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glassBorder,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(31,78,121,0.08)',
    borderRadius: 12,
    padding: 3,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  viewModeBtnActive: {
    backgroundColor: PREMIUM_COLORS.trustBlue,
  },
  viewModeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_COLORS.textSecondary,
  },
  viewModeBtnTextActive: {
    color: '#fff',
  },

  // EEW Badge
  eewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PREMIUM_COLORS.safe + '15',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.safe + '30',
  },
  eewPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PREMIUM_COLORS.safe + '10',
    borderRadius: 12,
  },
  eewBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_COLORS.safe,
  },

  // PREMIUM: Floating Controls
  floatingControls: {
    position: 'absolute',
    right: 16,
    gap: 12,
    alignItems: 'center',
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: PREMIUM_COLORS.glass,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PREMIUM_COLORS.trustBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glassBorder,
  },
  controlBtnPrimary: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PREMIUM_COLORS.trustBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  controlBtnInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomControls: {
    backgroundColor: PREMIUM_COLORS.glass,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: PREMIUM_COLORS.trustBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glassBorder,
  },
  zoomBtn: {
    width: 50,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: PREMIUM_COLORS.glassBorder,
  },

  // Pulse Marker
  pulseContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  pulseCenter: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: PREMIUM_COLORS.trustBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },

  // PREMIUM: Family Marker
  familyMarkerContainer: {
    alignItems: 'center',
  },
  familyMarkerOuter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  familyMarkerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PREMIUM_COLORS.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  familyMarkerInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PREMIUM_COLORS.textPrimary,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  batteryBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  nameLabel: {
    marginTop: 6,
    backgroundColor: PREMIUM_COLORS.glass,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 90,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glassBorder,
  },
  nameLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
    textAlign: 'center',
  },

  // PREMIUM: Bottom Sheet
  bottomSheetBg: {
    backgroundColor: PREMIUM_COLORS.ivory,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: PREMIUM_COLORS.trustBlue,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  bottomSheetHandle: {
    backgroundColor: PREMIUM_COLORS.trustBlue + '40',
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PREMIUM_COLORS.textPrimary,
    marginBottom: 20,
    marginTop: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PREMIUM_COLORS.trustBlue + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: PREMIUM_COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  // PREMIUM: Member Card
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: PREMIUM_COLORS.glassBorder,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  statusDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lastSeenText: {
    fontSize: 12,
    color: PREMIUM_COLORS.textSecondary,
  },

  // Detail View
  detailView: {
    paddingTop: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtnText: {
    fontSize: 17,
    color: PREMIUM_COLORS.trustBlue,
    fontWeight: '500',
  },
  memberDetail: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  memberDetailAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  memberDetailAvatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberDetailName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: PREMIUM_COLORS.textPrimary,
    marginBottom: 12,
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 8,
  },
  statusDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusBadgeLargeText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // PREMIUM: Info Cards
  infoCards: {
    marginTop: 24,
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PREMIUM_COLORS.cream,
    padding: 16,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glassBorder,
  },
  infoCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PREMIUM_COLORS.trustBlue + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardLabel: {
    fontSize: 13,
    color: PREMIUM_COLORS.textSecondary,
    marginBottom: 2,
  },
  infoCardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
  },

  // PREMIUM: Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: PREMIUM_COLORS.cream,
    gap: 8,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glassBorder,
  },
  actionBtnPrimary: {
    flex: 2,
    borderRadius: 16,
    shadowColor: PREMIUM_COLORS.trustBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: PREMIUM_COLORS.trustBlue,
  },
  actionBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Earthquake
  quakeInfo: {
    marginTop: 8,
  },
  quakeInfoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 14,
  },
  quakeInfoText: {
    fontSize: 16,
    color: PREMIUM_COLORS.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  quakeDetail: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  magnitudeCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  magnitudeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  quakeLocation: {
    fontSize: 20,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  quakeTime: {
    fontSize: 15,
    color: PREMIUM_COLORS.textSecondary,
  },

  // PREMIUM: SOS Signal Markers
  sosMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosMarkerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dc2626',
  },
  sosMarkerMain: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  sosMarkerLabel: {
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  sosMarkerName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  sosMarkerInfo: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});
