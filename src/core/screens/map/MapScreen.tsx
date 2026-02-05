/**
 * MAP SCREEN - Premium Design
 * Modern, functional map with earthquake markers and controls
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Dimensions, StatusBar, ImageBackground, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet from '@gorhom/bottom-sheet';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useEarthquakeStore, Earthquake } from '../../stores/earthquakeStore';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { calculateDistance, formatDistance, getMagnitudeColor } from '../../utils/mapUtils';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

// STORES & STATE
import { useMapStore, MapStyle } from '../../stores/mapStore';
import { offlineMapService, MapLocation } from '../../services/OfflineMapService';
import { useRescueStore, TrappedUser } from '../../stores/rescueStore';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { useUserStatusStore } from '../../stores/userStatusStore';

// MAP COMPONENTS
import MapView, { Marker, Circle, Polygon, UrlTile } from 'react-native-maps';
import { EarthquakeMarker } from '../../components/map/EarthquakeMarker';
import { FamilyMarker } from '../../components/map/FamilyMarker';
import TrappedUserMarker from '../../components/rescue/TrappedUserMarker';
import { ClusterMarker } from '../../components/map/ClusterMarker';
import { MeshPeerMarker } from '../../components/map/MeshPeerMarker';
import { SeismicHeatmap } from '../../components/map/SeismicHeatmap';
import MapLayerControl, { MapLayers } from '../../components/map/MapLayerControl';
import { MeshNetworkModal } from '../../components/mesh/MeshNetworkModal';
import { tileCacheService } from '../../../offline/TileCacheService';

// NEW COMPONENTS
import { MapFiltersControl } from './components/MapFiltersControl';
import { FaultLineOverlay } from './components/FaultLineOverlay';
import { EvacuationOverlay } from './components/EvacuationOverlay';
import { IncidentReportModal } from './components/IncidentReportModal';
import { RiskOverlay, RiskLegend } from './components/RiskOverlay';
import { SeismicAlertBanner } from '../../components/design-system/SeismicAlertBanner';
import { trustMapStyle, trustDarkMapStyle } from '../../theme/mapStyles'; // Updated import
// NOTE: Premium overlays (WavePropagation, AssemblyPoints, TsunamiZone) removed 
// due to react-native-maps index bounds crash. These features will be added 
// in a future update with proper lazy loading implementation.

import { clusterMarkers, isCluster, getZoomLevel, ClusterableMarker, Cluster } from '../../utils/markerClustering';
import { useViewportData } from '../../hooks/useViewportData';
import { useCompass } from '../../hooks/useCompass';
import { RescueCompass } from '../../components/map/RescueCompass';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase, RouteProp } from '@react-navigation/native';

const logger = createLogger('MapScreen');

// ELITE: Type-safe navigation and route props
type MapScreenNavigationProp = StackNavigationProp<ParamListBase>;

// ELITE: Define route params interface for type safety
interface MapScreenParams {
  focusOnMember?: string;
}

type MapScreenRouteProp = RouteProp<{ MapScreen: MapScreenParams }, 'MapScreen'>;

interface MapScreenProps {
  navigation: MapScreenNavigationProp;
  route: MapScreenRouteProp;
}

export default function MapScreen({ navigation, route }: MapScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const incidentModalRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  // GLOBAL MAP STATE
  const { filters, setFilters, mode, setMode, mapStyle: currentMapStyle, setMapStyle, is3DMode, toggle3DMode } = useMapStore();

  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [offlineLocations, setOfflineLocations] = useState<MapLocation[]>([]);
  const [trappedUsers, setTrappedUsers] = useState<TrappedUser[]>([]);
  const [meshPeers, setMeshPeers] = useState<any[]>([]);
  const [isMeshNetworkVisible, setIsMeshNetworkVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showCompass, setShowCompass] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(10);
  const [hazardZones, setHazardZones] = useState<any[]>([]);
  const [isSampleMapData, setIsSampleMapData] = useState(false);

  // Region Refs to prevent infinite loops
  const currentRegionRef = useRef<any>(null);
  const isAnimatingRef = useRef(false);
  const regionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRegionUpdateTimeRef = useRef<number>(0);
  const isInitialMountRef = useRef(true);

  // Elite: Layer control state
  // We keep this local copy for the UI control, but ideally should sync with store someday for persistence
  const [layers, setLayers] = useState<MapLayers>({
    earthquakes: true,
    family: true,
    pois: true,
    trappedUsers: true,
    hazardZones: false,
    heatmap: true,
    meshNetwork: true,
  });

  // Compass hook
  const { heading, isAvailable: compassAvailable } = useCompass();

  useEffect(() => {
    // Subscribe to stores
    const unsubscribeEq = useEarthquakeStore.subscribe((state) => setEarthquakes(state.items));
    const unsubscribeFam = useFamilyStore.subscribe((state) => setFamilyMembers(state.members));
    const unsubscribeRescue = useRescueStore.subscribe((state) => setTrappedUsers(state.trappedUsers));
    const unsubscribeMesh = useMeshStore.subscribe((state) => setMeshPeers(state.peers));

    // Initial load
    setEarthquakes(useEarthquakeStore.getState().items);
    setFamilyMembers(useFamilyStore.getState().members);
    setTrappedUsers(useRescueStore.getState().trappedUsers);
    setMeshPeers(useMeshStore.getState().peers);

    return () => {
      unsubscribeEq();
      unsubscribeFam();
      unsubscribeRescue();
      unsubscribeMesh();
    };
  }, []);

  // ELITE: Real-Time Family Location Tracking
  // Automatically refresh family member locations based on configured interval
  useEffect(() => {
    const mapState = useMapStore.getState();
    if (!mapState.realTimeTracking) return;

    const intervalMs = mapState.familyTrackingInterval * 1000;

    const refreshFamilyLocations = async () => {
      try {
        // Trigger FamilyTrackingService to share our location
        const { familyTrackingService } = await import('../../services/FamilyTrackingService');

        // CRITICAL: Start tracking first (activates background updates + Firebase subs)
        await familyTrackingService.startTracking();

        // Share our own location with family (via mesh + cloud)
        await familyTrackingService.shareMyLocation();

        // Get latest members from service (with stale check applied)
        // Note: We use store directly to avoid type mismatch between service and store types
        setFamilyMembers(useFamilyStore.getState().members);
        logger.debug('Real-time family locations refreshed');
      } catch (err) {
        logger.warn('Family location refresh error:', err);
      }
    };

    // Initial refresh
    refreshFamilyLocations();

    // Set up interval
    const intervalId = setInterval(refreshFamilyLocations, intervalMs);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const loadOffline = async () => {
      let locs = offlineMapService.getAllLocations();
      // Retry logic if empty
      if (locs.length === 0) {
        await new Promise(r => setTimeout(r, 1000));
        locs = offlineMapService.getAllLocations();
      }
      setOfflineLocations(locs);
      setIsSampleMapData(offlineMapService.isUsingSampleData());
    };
    loadOffline();
  }, []);

  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      logger.error('Location error:', error);
    }
  }, []);

  useEffect(() => {
    getUserLocation();
  }, []);

  // ELITE: Handle Focus Member Navigation
  useEffect(() => {
    if (route.params?.focusOnMember && familyMembers.length > 0) {
      const memberId = route.params.focusOnMember;
      const member = familyMembers.find(m => m.id === memberId);

      if (member && (member.location?.latitude || member.latitude) && mapRef.current) {
        const lat = member.location?.latitude ?? member.latitude;
        const lng = member.location?.longitude ?? member.longitude;

        // 1. Animate Camera
        mapRef.current.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01, // Tight zoom
          longitudeDelta: 0.01,
        }, 1000);

        // 2. Select Member (Open Modal)
        setSelectedItem(member);

        // 3. Clear param (optional, to avoid re-focus on re-render if nav stack preserved)
        navigation.setParams({ focusOnMember: undefined });
      }
    }
  }, [route.params?.focusOnMember, familyMembers]);

  // Filtering Logic
  const filteredEarthquakes = useMemo(() => {
    let filtered = earthquakes;

    // Magnitude Filter
    if (filters.minMagnitude > 0) {
      filtered = filtered.filter(eq => eq.magnitude >= filters.minMagnitude);
    }

    // Time Filter
    if (filters.timeRange !== 'all') {
      const now = Date.now();
      const thresholds = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const maxAge = thresholds[filters.timeRange as keyof typeof thresholds] || thresholds['24h'];
      filtered = filtered.filter(eq => (now - eq.time) < maxAge);
    }

    return filtered;
  }, [earthquakes, filters.minMagnitude, filters.timeRange]);


  // Cluster Logic
  const clusteredMarkers = useMemo(() => {
    if (!currentRegionRef.current) return { earthquakes: [], family: [] };
    const zoomLevel = getZoomLevel(currentRegionRef.current.latitudeDelta);

    const eqMarkers = filteredEarthquakes.map(eq => ({
      ...eq,
      id: `eq-${eq.id}`,
      latitude: eq.latitude,
      longitude: eq.longitude,
    }));

    const familyMarkers = familyMembers.filter(m => {
      const lat = m.location?.latitude ?? m.latitude;
      const lng = m.location?.longitude ?? m.longitude;
      // ELITE: Filter out invalid coordinates
      // - Must be numbers
      // - Must not be 0,0 (null island - indicates missing data)
      // - Must be within valid GPS ranges
      const isValidLat = typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
      const isValidLng = typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
      const isNotNullIsland = !(lat === 0 && lng === 0); // Exclude 0,0 which means no location
      return isValidLat && isValidLng && isNotNullIsland;
    }).map(member => ({
      ...member,
      id: `fm-${member.id}`,
      latitude: member.location?.latitude ?? member.latitude,
      longitude: member.location?.longitude ?? member.longitude,
    }));

    return {
      earthquakes: clusterMarkers(eqMarkers, zoomLevel),
      family: clusterMarkers(familyMarkers, zoomLevel),
    };
  }, [filteredEarthquakes, familyMembers, currentZoom]); // Using currentZoom as proxy for region re-calc

  // UI Handlers
  const handleMarkerPress = useCallback((item: ClusterableMarker) => {
    haptics.impactLight();
    setSelectedItem(item);
    bottomSheetRef.current?.expand();
  }, []);

  // Handle cluster press - zoom into cluster location
  const handleClusterPress = useCallback((cluster: Cluster) => {
    haptics.impactLight();
    if (mapRef.current && cluster.latitude && cluster.longitude) {
      const newRegion = {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: (currentRegionRef.current?.latitudeDelta || 0.1) / 2,
        longitudeDelta: (currentRegionRef.current?.longitudeDelta || 0.1) / 2,
      };
      mapRef.current.animateToRegion(newRegion, 300);
    }
  }, []);

  const handleIncidentReport = useCallback((typeId: string) => {
    // Create a temporary marker (simulation)
    if (userLocation) {
      Alert.alert("Rapor Alındı", `Geri bildiriminiz için teşekkürler: ${typeId.toUpperCase()}. Bilgi Mesh ağına dağıtılıyor.`);
      // In real app: save to Store
      // setTrappedUsers(prev => [...prev, ...newreport])
    }
    setMode('view');
  }, [userLocation]);

  const toggleEmergencyMode = () => {
    haptics.notificationWarning();
    setMode(mode === 'evacuation' ? 'view' : 'evacuation');
  };

  const mapStyleJSON = useMemo(() => {
    return currentMapStyle === 'dark' ? trustDarkMapStyle : trustMapStyle;
  }, [currentMapStyle]);

  const getLocationIcon = (type: MapLocation['type']): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'assembly': return 'people';
      case 'hospital': return 'medical';
      case 'water': return 'water';
      case 'shelter': return 'home';
      case 'police': return 'shield';
      case 'fire': return 'flame';
      default: return 'location'; // ELITE: Exhaustive switch with default
    }
  };

  const getLocationColor = (type: MapLocation['type']): string => {
    switch (type) {
      case 'assembly': return '#10b981';
      case 'hospital': return '#dc2626';
      case 'water': return '#3b82f6';
      case 'shelter': return '#f59e0b';
      case 'police': return '#6366f1';
      case 'fire': return '#ef4444';
      default: return '#64748b'; // ELITE: Exhaustive switch with default
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. FILTER CONTROLS (Top) */}
      <MapFiltersControl />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType={currentMapStyle === 'satellite' ? 'satellite' : currentMapStyle === 'hybrid' ? 'hybrid' : currentMapStyle === 'terrain' ? 'terrain' : 'standard'}
        customMapStyle={currentMapStyle === 'satellite' || currentMapStyle === 'hybrid' ? undefined : mapStyleJSON}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{
          latitude: 39.0, // Center of Turkey
          longitude: 35.0,
          latitudeDelta: 10,
          longitudeDelta: 10,
        }}
        onMapReady={() => {
          isInitialMountRef.current = false;
        }}
        onRegionChangeComplete={(region) => {
          currentRegionRef.current = region;
          setCurrentZoom(getZoomLevel(region.latitudeDelta));
        }}
        onLongPress={(e) => {
          if (userLocation) { // Simple check, ideally check press location
            haptics.impactHeavy();
            setMode('report');
            incidentModalRef.current?.expand();
          }
        }}
      >
        {/* ELITE: Risk Zones Overlay */}
        <RiskOverlay
          visible={layers.hazardZones}
          userLocation={userLocation}
        />

        {/* 2. FAULT LINES OVERLAY */}
        {filters.showFaultLines && <FaultLineOverlay />}

        {/* 3. EVACUATION ROUTES */}
        <EvacuationOverlay userLocation={userLocation} />

        {/* Earthquakes */}
        {layers.earthquakes && clusteredMarkers.earthquakes.map((item: ClusterableMarker | Cluster) => {
          if (isCluster(item)) {
            return <ClusterMarker key={item.id} cluster={item} onPress={handleClusterPress} />;
          }
          const eqItem = item as ClusterableMarker;
          return (
            <Marker
              key={eqItem.id}
              coordinate={{ latitude: eqItem.latitude, longitude: eqItem.longitude }}
              onPress={() => handleMarkerPress(eqItem)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <EarthquakeMarker magnitude={(eqItem as unknown as { magnitude: number }).magnitude} selected={selectedItem?.id === eqItem.id} />
            </Marker>
          );
        })}

        {/* User Location / Heatmap Fix */}
        {layers.heatmap && filteredEarthquakes.length > 0 && filters.showHeatmap && (
          <SeismicHeatmap
            enabled={layers.heatmap}
            points={filteredEarthquakes.map(eq => ({ latitude: eq.latitude, longitude: eq.longitude, weight: eq.magnitude }))}
          />
        )}

        {/* Family Members - FIND MY GRADE */}
        {layers.family && clusteredMarkers.family.map((item: ClusterableMarker | Cluster) => {
          if (isCluster(item)) return <ClusterMarker key={item.id} cluster={item} onPress={handleClusterPress} />;
          const familyItem = item as ClusterableMarker & {
            name?: string;
            status?: string;
            avatarUrl?: string;
            lastSeen?: number;
            batteryLevel?: number;
            isOnline?: boolean;
            lastKnownLocation?: { timestamp: number };
          };

          // ELITE: Determine if showing last known location
          const isLastKnownLocation = !familyItem.isOnline && !!familyItem.lastKnownLocation;

          return (
            <Marker
              key={familyItem.id}
              coordinate={{ latitude: familyItem.latitude, longitude: familyItem.longitude }}
              onPress={() => handleMarkerPress(familyItem)}
              anchor={{ x: 0.5, y: 0.7 }} // Adjusted for name label
            >
              <FamilyMarker
                name={familyItem.name || 'Bilinmiyor'}
                status={(familyItem.status || 'unknown') as 'safe' | 'need-help' | 'critical' | 'unknown'}
                avatarUrl={familyItem.avatarUrl}
                lastSeen={familyItem.lastSeen}
                batteryLevel={familyItem.batteryLevel}
                isOnline={familyItem.isOnline}
                isLastKnownLocation={isLastKnownLocation}
              />
            </Marker>
          );
        })}

        {/* POIs */}
        {layers.pois && offlineLocations.map((location) => (
          <Marker
            key={location.id}
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            onPress={() => handleMarkerPress(location)}
          >
            <View style={{
              backgroundColor: getLocationColor(location.type),
              padding: 6,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: '#fff',
            }}>
              <Ionicons name={getLocationIcon(location.type)} size={16} color="#fff" />
            </View>
          </Marker>
        ))}

        {/* 4a. TRAPPED USERS (Enkaz Altındakiler) */}
        {layers.trappedUsers && trappedUsers.map((user) => (
          <TrappedUserMarker
            key={`trapped-${user.id}`}
            user={user}
            onPress={(u) => handleMarkerPress(u as unknown as ClusterableMarker)}
          />
        ))}

        {/* 5. OFFLINE MESH PEERS (New) */}
        {layers.meshNetwork && meshPeers.map((peer) => {
          if (!peer.location) return null; // Skip peers without location
          return (
            <Marker
              key={`mesh-${peer.id}`}
              coordinate={{ latitude: peer.location.lat, longitude: peer.location.lng }}
              onPress={() => handleMarkerPress(peer)}
              anchor={{ x: 0.5, y: 0.5 }}
              opacity={peer.status === 'unknown' ? 0.7 : 1}
            >
              <MeshPeerMarker
                name={peer.name}
                rssi={peer.rssi}
                status={peer.status}
                isSelected={selectedItem?.id === peer.id}
              />
            </Marker>
          );
        })}

        {/* NOTE: Premium overlays (AssemblyPoints, TsunamiZone, WavePropagation) 
            removed for stability. Will be re-added with lazy loading in future update. */}
      </MapView>

      {/* 6. RESCUE COMPASS HUD (Elite) */}
      <RescueCompass
        visible={!!selectedItem && !!userLocation && (selectedItem && ('location' in selectedItem || 'latitude' in selectedItem || (selectedItem as any)?.location && 'lat' in (selectedItem as any).location))} // Corrected visibility check
        userLocation={userLocation}
        targetLocation={selectedItem ? {
          latitude: (selectedItem as any).location?.latitude ?? (selectedItem as any).latitude ?? (selectedItem as any).location?.lat ?? 0,
          longitude: (selectedItem as any).location?.longitude ?? (selectedItem as any).longitude ?? (selectedItem as any).location?.lng ?? 0,
        } : null}
        targetName={(selectedItem as any)?.name ?? 'Hedef'}
      />

      {/* 4. EMERGENCY MODE BUTTON */}
      <Pressable
        style={[
          styles.emergencyButton,
          { top: insets.top + (filters.showFaultLines ? 130 : 130) }, // Position below filters
          mode === 'evacuation' && styles.emergencyButtonActive,
        ]}
        onPress={toggleEmergencyMode}
      >
        <Ionicons name="exit" size={24} color="#fff" />
        <Text style={styles.emergencyButtonText}>
          {mode === 'evacuation' ? 'Tahliye Modu Aktif' : 'Tahliye'}
        </Text>
      </Pressable>

      {/* Layer Controls (Existing) */}
      <View style={[styles.layerControlPos, { top: insets.top + 180 }]}>
        <MapLayerControl layers={layers} onLayerToggle={(l) => setLayers(p => ({ ...p, [l]: !p[l] }))}
          earthquakeCount={earthquakes.length}
          familyCount={familyMembers.length}
          poisCount={offlineLocations.length}
          trappedUsersCount={trappedUsers.length}
        />
      </View>

      {/* ELITE: Evacuation Mode Active Banner */}
      {mode === 'evacuation' && userLocation && (
        <View style={[styles.evacuationBanner, { bottom: insets.bottom + 100 }]}>
          <LinearGradient
            colors={['rgba(220, 38, 38, 0.95)', 'rgba(153, 27, 27, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.evacuationBannerGradient}
          >
            <View style={styles.evacuationBannerContent}>
              <Ionicons name="warning" size={24} color="#fff" />
              <View style={styles.evacuationBannerText}>
                <Text style={styles.evacuationBannerTitle}>TAHLİYE MODU AKTİF</Text>
                <Text style={styles.evacuationBannerSubtitle}>
                  En yakın toplanma alanı: {(() => {
                    const assemblyPoints = offlineLocations.filter(l => l.type === 'assembly');
                    if (assemblyPoints.length === 0) return 'Bilinmiyor';
                    const nearest = assemblyPoints.sort((a, b) =>
                      calculateDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude) -
                      calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
                    )[0];
                    const dist = calculateDistance(userLocation.latitude, userLocation.longitude, nearest.latitude, nearest.longitude);
                    return `${nearest.name} (${formatDistance(dist)})`;
                  })()}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.evacuationCloseBtn}
              onPress={() => setMode('view')}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </LinearGradient>
        </View>
      )}

      {/* ELITE: Map Type Toggle (Satellite/Hybrid/Terrain/Standard) */}
      <View style={[styles.mapTypeToggle, { top: insets.top + 75, right: 16 }]}>
        <Pressable
          style={[
            styles.mapTypeButton,
            currentMapStyle === 'standard' && styles.mapTypeButtonActive,
          ]}
          onPress={() => { haptics.impactLight(); setMapStyle('standard'); }}
        >
          <Ionicons name="map-outline" size={18} color={currentMapStyle === 'standard' ? '#fff' : '#1F4E79'} />
        </Pressable>
        <Pressable
          style={[
            styles.mapTypeButton,
            currentMapStyle === 'satellite' && styles.mapTypeButtonActive,
          ]}
          onPress={() => { haptics.impactLight(); setMapStyle('satellite'); }}
        >
          <Ionicons name="globe-outline" size={18} color={currentMapStyle === 'satellite' ? '#fff' : '#1F4E79'} />
        </Pressable>
        <Pressable
          style={[
            styles.mapTypeButton,
            currentMapStyle === 'hybrid' && styles.mapTypeButtonActive,
          ]}
          onPress={() => { haptics.impactLight(); setMapStyle('hybrid'); }}
        >
          <Ionicons name="layers-outline" size={18} color={currentMapStyle === 'hybrid' ? '#fff' : '#1F4E79'} />
        </Pressable>
        <Pressable
          style={[
            styles.mapTypeButton,
            currentMapStyle === 'terrain' && styles.mapTypeButtonActive,
          ]}
          onPress={() => { haptics.impactLight(); setMapStyle('terrain'); }}
        >
          <Ionicons name="trail-sign-outline" size={18} color={currentMapStyle === 'terrain' ? '#fff' : '#1F4E79'} />
        </Pressable>

        {/* ELITE: Separator */}
        <View style={{ width: 1, height: 24, backgroundColor: 'rgba(31, 78, 121, 0.2)', marginHorizontal: 4 }} />

        {/* ELITE: 3D Mode Toggle */}
        <Pressable
          style={[
            styles.mapTypeButton,
            is3DMode && styles.mapTypeButtonActive,
          ]}
          onPress={() => { haptics.impactMedium(); toggle3DMode(); }}
        >
          <Ionicons name="cube-outline" size={18} color={is3DMode ? '#fff' : '#1F4E79'} />
        </Pressable>
      </View>


      {/* Modals */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['35%', '50%']} // Slightly larger for alert
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.background.card }} // Use theme color
      >
        <View style={{ padding: 16 }}>
          {selectedItem && 'magnitude' in selectedItem ? (
            // IT IS AN EARTHQUAKE
            <View>
              <SeismicAlertBanner
                magnitude={(selectedItem as Earthquake).magnitude}
                location={(selectedItem as Earthquake).location}
                time={new Date((selectedItem as Earthquake).time).toLocaleTimeString()}
                depth={(selectedItem as Earthquake).depth}
                onPress={() => {
                  bottomSheetRef.current?.close();
                  navigation.navigate('EarthquakeDetail', { earthquake: selectedItem });
                }}
              />
              <Text style={{ textAlign: 'center', marginTop: 8, color: colors.text.secondary, fontSize: 12 }}>
                Detaylar için dokunun
              </Text>
            </View>
          ) : selectedItem && 'name' in selectedItem ? (
            // IT IS A FAMILY MEMBER (OR MESH PEER)
            <View style={{ alignItems: 'center', padding: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text.primary }}>
                {(selectedItem as any).name}
              </Text>
              <Text style={{ marginTop: 4, color: colors.text.secondary }}>
                Durum: {(selectedItem as any).status || 'Bilinmiyor'}
              </Text>
            </View>
          ) : (
            // FALLBACK / MAP LOCATION
            <View style={{ alignItems: 'center', padding: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary }}>Seçili Konum</Text>
            </View>
          )}

          {/* ELITE: Compliance - Report Button (Always visible logic kept same) */}
          {(!selectedItem || !('magnitude' in selectedItem)) && (
            <Pressable
              style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', opacity: 0.8, justifyContent: 'center' }}
              onPress={() => {
                Alert.alert(
                  'İçeriği Raporla',
                  'Bu içeriğin hatalı, yanıltıcı veya uygunsuz olduğunu mu düşünüyorsunuz?',
                  [
                    { text: 'İptal', style: 'cancel' },
                    {
                      text: 'Raporla',
                      style: 'destructive',
                      onPress: () => {
                        Alert.alert('Raporlandı', 'Bildiriminiz alındı. İçerik ekibimiz tarafından incelenecektir.');
                      },
                    },
                  ],
                );
              }}
            >
              <Ionicons name="flag-outline" size={20} color={colors.emergency.critical} />
              <Text style={{ marginLeft: 8, color: colors.emergency.critical, fontWeight: '600' }}>Şikayet Et / Hata Bildir</Text>
            </Pressable>
          )}
        </View>
      </BottomSheet>

      <IncidentReportModal
        bottomSheetRef={incidentModalRef}
        onReportSubmit={handleIncidentReport}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  emergencyButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: colors.status.danger,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 30,
  },
  emergencyButtonActive: {
    backgroundColor: '#991b1b', // Darker red
    borderWidth: 2,
    borderColor: '#fff',
  },
  emergencyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  layerControlPos: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  // ELITE: Map Type Toggle Styles
  mapTypeToggle: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 20,
  },
  mapTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mapTypeButtonActive: {
    backgroundColor: '#1F4E79',
  },
  // ELITE: Evacuation Mode Banner Styles
  evacuationBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  evacuationBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  evacuationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  evacuationBannerText: {
    flex: 1,
  },
  evacuationBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  evacuationBannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  evacuationCloseBtn: {
    padding: 8,
    marginLeft: 8,
  },
});
