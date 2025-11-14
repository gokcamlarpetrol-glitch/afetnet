/**
 * MAP SCREEN - Premium Design
 * Modern, functional map with earthquake markers and controls
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Dimensions, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import BottomSheet from '@gorhom/bottom-sheet';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useEarthquakeStore, Earthquake } from '../../stores/earthquakeStore';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { calculateDistance, formatDistance, getMagnitudeColor } from '../../utils/mapUtils';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MapScreen');

// Use react-native-maps with error handling
// NOTE: Requires development build (not Expo Go)
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let Polygon: any = null;

try {
  const rnMaps = require('react-native-maps');
  MapView = rnMaps.default || rnMaps;
  Marker = rnMaps.Marker;
  Circle = rnMaps.Circle;
  Polygon = rnMaps.Polygon;
} catch (e) {
  logger.warn('react-native-maps not available:', e);
  // Will show fallback UI
}
import { EarthquakeMarker } from '../../components/map/EarthquakeMarker';
import { FamilyMarker } from '../../components/map/FamilyMarker';
import TrappedUserMarker from '../../components/rescue/TrappedUserMarker';
import ClusterMarker from '../../components/map/ClusterMarker';
import MapLayerControl, { MapLayers } from '../../components/map/MapLayerControl';
import { offlineMapService, MapLocation } from '../../services/OfflineMapService';
import { useCompass } from '../../../hooks/useCompass';
import { useUserStatusStore } from '../../stores/userStatusStore';
import { useRescueStore, TrappedUser } from '../../stores/rescueStore';
import { clusterMarkers, isCluster, getZoomLevel, ClusterableMarker, Cluster } from '../../utils/markerClustering';
import { useViewportData } from '../../hooks/useViewportData';

const { width, height } = Dimensions.get('window');

const mapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#1d2c4d" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#8ec3b9" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a3646" }] },
    { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
    { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#64779e" }] },
    { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#334e87" }] },
    { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#023e58" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#283d6a" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#6f9ba5" }] },
    { "featureType": "poi", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
    { "featureType": "poi.park", "elementType": "geometry.fill", "stylers": [{ "color": "#023e58" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#3C7680" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#304a7d" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#98a5be" }] },
    { "featureType": "road", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#2c6675" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#255763" }] },
    { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#b0d5ce" }] },
    { "featureType": "road.highway", "elementType": "labels.text.stroke", "stylers": [{ "color": "#023e58" }] },
    { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#98a5be" }] },
    { "featureType": "transit", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
    { "featureType": "transit.line", "elementType": "geometry.fill", "stylers": [{ "color": "#283d6a" }] },
    { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#3a4762" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0e1626" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#4e6d70" }] }
  ];


export default function MapScreen({ navigation, route }: any) {
  const mapRef = useRef<any>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [offlineLocations, setOfflineLocations] = useState<MapLocation[]>([]);
  const [trappedUsers, setTrappedUsers] = useState<TrappedUser[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<Earthquake | FamilyMember | MapLocation | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [showCompass, setShowCompass] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(10);
  const [currentRegion, setCurrentRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [hazardZones, setHazardZones] = useState<any[]>([]);
  const [isSampleMapData, setIsSampleMapData] = useState(false);
  
  // ELITE: Ref-based region tracking to prevent infinite loops
  const currentRegionRef = useRef<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const isAnimatingRef = useRef(false); // CRITICAL: Prevent infinite loops during animations
  const regionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // CRITICAL: Debounce region updates
  const lastRegionUpdateTimeRef = useRef<number>(0); // ELITE: Track last update time to prevent rapid updates
  const isInitialMountRef = useRef(true); // ELITE: Track initial mount to prevent unnecessary updates
  
  // Elite: Layer control state
  const [layers, setLayers] = useState<MapLayers>({
    earthquakes: true,
    family: true,
    pois: true,
    trappedUsers: true,
    hazardZones: false,
  });

  // Compass hook
  const { heading, isAvailable: compassAvailable } = useCompass();
  
  // User status (for debris tracking)
  const userStatus = useUserStatusStore((state) => state.status);
  const userStatusLocation = useUserStatusStore((state) => state.location);

  const snapPoints = useMemo(() => ['25%', '50%', '85%'], []);

  useEffect(() => {
    // Subscribe to store updates
    const unsubscribe = useEarthquakeStore.subscribe((state) => {
      setEarthquakes(state.items);
    });

    const unsubscribeFamily = useFamilyStore.subscribe((state) => {
      setFamilyMembers(state.members);
    });

    const unsubscribeRescue = useRescueStore.subscribe((state) => {
      setTrappedUsers(state.trappedUsers);
    });

    // Initial load
    setEarthquakes(useEarthquakeStore.getState().items);
    setFamilyMembers(useFamilyStore.getState().members);
    setTrappedUsers(useRescueStore.getState().trappedUsers);

    return () => {
      unsubscribe();
      unsubscribeFamily();
      unsubscribeRescue();
    };
  }, []);

  useEffect(() => {
    // Load offline locations (with retry in case service not initialized yet)
    const loadOfflineLocations = async () => {
      let locations = offlineMapService.getAllLocations();
      
      // If no locations, wait a bit and try again (service might still be initializing)
      if (locations.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        locations = offlineMapService.getAllLocations();
      }
      
      setOfflineLocations(locations);
      setIsSampleMapData(offlineMapService.isUsingSampleData());
      
      if (__DEV__ && locations.length > 0) {
        logger.info(`MapScreen: Loaded ${locations.length} offline locations`);
      }
    };
    
    loadOfflineLocations();
    
    // Refresh locations periodically (every 30 seconds)
    const interval = setInterval(() => {
      const freshLocations = offlineMapService.getAllLocations();
      setOfflineLocations(freshLocations);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Harita için konum izni gereklidir');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      logger.error('Location error:', error);
    }
  }, []);

  // CRITICAL: Extract route params to stable values using useMemo to prevent infinite loops
  const focusOnMember = useMemo(() => route?.params?.focusOnMember, [route?.params?.focusOnMember]);
  const focusOnEarthquake = useMemo(() => route?.params?.focusOnEarthquake, [route?.params?.focusOnEarthquake]);

  useEffect(() => {
    let isMounted = true;
    let hazardInterval: NodeJS.Timeout | null = null;
    let focusTimeout1: NodeJS.Timeout | null = null;
    let focusTimeout2: NodeJS.Timeout | null = null;
    
    // CRITICAL: Get user location with mounted check
    getUserLocation().catch((error) => {
      if (isMounted) {
        logger.error('Failed to get user location:', error);
      }
    });
    
    // Load hazard zones
    const loadHazardZones = async () => {
      if (!isMounted) return;
      try {
        const { listHazards } = await import('../../../../src/hazard/store');
        const zones = await listHazards();
        if (isMounted) {
          setHazardZones(zones);
        }
      } catch (error) {
        if (isMounted) {
          logger.warn('Failed to load hazard zones:', error);
        }
      }
    };
    loadHazardZones();
    
    // Refresh hazard zones periodically (every 30 seconds)
    hazardInterval = setInterval(() => {
      if (isMounted) {
        loadHazardZones();
      }
    }, 30000);
    
    // Handle navigation params (focusOnMember, focusOnEarthquake)
    if (focusOnMember) {
      const member = useFamilyStore.getState().members.find(m => m.id === focusOnMember);
      if (member && mapRef.current && isMounted) {
        // ELITE: Support both latitude/longitude properties and location object
        const lat = member.location?.latitude ?? member.latitude;
        const lng = member.location?.longitude ?? member.longitude;
        
        // Validate coordinates before focusing
        if (typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90 &&
            typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180) {
          focusTimeout1 = setTimeout(() => {
            if (isMounted && mapRef.current) {
              // ELITE: Set animating flag to prevent region change updates during animation
              isAnimatingRef.current = true;
              mapRef.current.animateToRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 1000);
              setSelectedItem(member);
              bottomSheetRef.current?.expand();
              setTimeout(() => {
                isAnimatingRef.current = false;
                lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
              }, 1500); // Increased buffer
            }
          }, 500);
        } else {
          logger.warn('Invalid coordinates for member focus:', { member, lat, lng });
        }
      }
    }
    
    if (focusOnEarthquake) {
      const eq = useEarthquakeStore.getState().items.find(e => e.id === focusOnEarthquake);
      if (eq && mapRef.current && isMounted) {
        focusTimeout2 = setTimeout(() => {
          if (isMounted && mapRef.current) {
            // ELITE: Set animating flag to prevent region change updates during animation
            isAnimatingRef.current = true;
            mapRef.current.animateToRegion({
              latitude: eq.latitude,
              longitude: eq.longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            }, 1000);
            setSelectedItem(eq);
            bottomSheetRef.current?.expand();
            setTimeout(() => {
              isAnimatingRef.current = false;
              lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
            }, 1500); // Increased buffer
          }
        }, 500);
      }
    }
    
    // CRITICAL: Cleanup function
    return () => {
      isMounted = false;
      // Clear hazard zones refresh interval
      if (hazardInterval) {
        clearInterval(hazardInterval);
      }
      // Clear focus timeouts
      if (focusTimeout1) {
        clearTimeout(focusTimeout1);
      }
      if (focusTimeout2) {
        clearTimeout(focusTimeout2);
      }
      // CRITICAL: Clear region update timeout
      if (regionUpdateTimeoutRef.current) {
        clearTimeout(regionUpdateTimeoutRef.current);
        regionUpdateTimeoutRef.current = null;
      }
    };
    // CRITICAL: Use stable dependencies to prevent infinite loops
  }, [focusOnMember, focusOnEarthquake, getUserLocation]);

  const getLocationIcon = (type: MapLocation['type']): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'assembly': return 'people';
      case 'hospital': return 'medical';
      case 'water': return 'water';
      case 'shelter': return 'home';
      case 'police': return 'shield';
      case 'fire': return 'flame';
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
    }
  };

  const handleMarkerPress = useCallback((item: Earthquake | FamilyMember | MapLocation) => {
    haptics.impactLight();
    setSelectedItem(item);
    bottomSheetRef.current?.expand();
    
    // Check if the item has latitude and longitude before animating
    if ('latitude' in item && 'longitude' in item) {
      // ELITE: Set animating flag to prevent region change updates during animation
      isAnimatingRef.current = true;
      mapRef.current?.animateToRegion({
        latitude: item.latitude,
        longitude: item.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      }, 500);
      // ELITE: Reset animating flag after animation completes (with extra buffer)
      setTimeout(() => {
        isAnimatingRef.current = false;
        lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
      }, 1000); // Increased buffer to ensure animation completes
    }
  }, []);

  const handleMapControlPress = useCallback(async (action: 'zoomIn' | 'zoomOut' | 'locate' | 'cycleMapType') => {
    haptics.impactLight();
    const camera = await mapRef.current?.getCamera();
    switch (action) {
      case 'zoomIn':
        if (camera) {
          // ELITE: Set animating flag to prevent region change updates during animation
          isAnimatingRef.current = true;
          camera.zoom += 1;
          mapRef.current?.animateCamera(camera, { duration: 250 });
          setCurrentZoom(camera.zoom + 1);
          setTimeout(() => {
            isAnimatingRef.current = false;
            lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
          }, 500); // Increased buffer
        }
        break;
      case 'zoomOut':
        if (camera) {
          // ELITE: Set animating flag to prevent region change updates during animation
          isAnimatingRef.current = true;
          camera.zoom -= 1;
          mapRef.current?.animateCamera(camera, { duration: 250 });
          setCurrentZoom(camera.zoom - 1);
          setTimeout(() => {
            isAnimatingRef.current = false;
            lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
          }, 500); // Increased buffer
        }
        break;
      case 'locate':
        if (userLocation) {
          // ELITE: Set animating flag to prevent region change updates during animation
          isAnimatingRef.current = true;
          mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.5, longitudeDelta: 0.5 }, 500);
          setTimeout(() => {
            isAnimatingRef.current = false;
            lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
          }, 1000); // Increased buffer
        } else {
          getUserLocation();
        }
        break;
      case 'cycleMapType':
        setMapType(prev => prev === 'standard' ? 'satellite' : prev === 'satellite' ? 'hybrid' : 'standard');
        break;
    }
  }, [userLocation, getUserLocation]);

  // Elite: Handle layer toggle
  const handleLayerToggle = useCallback((layer: keyof MapLayers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // ELITE: Viewport-based data filtering for performance
  // CRITICAL: Use ref-based region to prevent unnecessary re-renders
  const viewportRegion = currentRegionRef.current || currentRegion;
  const viewportEarthquakes = useViewportData({
    data: earthquakes,
    region: viewportRegion,
    enabled: layers.earthquakes && !!viewportRegion,
    buffer: 0.2, // 20% buffer
  });

  // ELITE: Memoize filtered family members to prevent unnecessary recalculations
  const validFamilyMembers = useMemo(() => {
    return familyMembers.filter(member => {
      const lat = member.location?.latitude ?? member.latitude;
      const lng = member.location?.longitude ?? member.longitude;
      return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90 &&
             typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
    });
  }, [familyMembers]);

  const viewportFamilyMembers = useViewportData({
    data: validFamilyMembers,
    region: viewportRegion,
    enabled: layers.family && !!viewportRegion,
    buffer: 0.2,
  });

  // Elite: Marker clustering for performance
  // ELITE: Use ref-based region to prevent unnecessary recalculations
  const clusteredMarkers = useMemo(() => {
    const region = currentRegionRef.current || currentRegion;
    if (!region) return { earthquakes: [], family: [] };
    
    const zoomLevel = getZoomLevel(region.latitudeDelta);
    
    const eqMarkers: ClusterableMarker[] = viewportEarthquakes.map(eq => ({
      id: `eq-${eq.id}`,
      latitude: eq.latitude,
      longitude: eq.longitude,
      ...eq,
    }));
    
    const familyMarkers: ClusterableMarker[] = viewportFamilyMembers.map(member => ({
      id: `fm-${member.id}`,
      latitude: member.location?.latitude ?? member.latitude,
      longitude: member.location?.longitude ?? member.longitude,
      ...member,
    }));
    
    return {
      earthquakes: clusterMarkers(eqMarkers, zoomLevel),
      family: clusterMarkers(familyMarkers, zoomLevel),
    };
    // ELITE: Only recalculate when viewport data or currentRegion state changes (not ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportEarthquakes, viewportFamilyMembers, currentRegion]);
  
  // Elite: Empty state check
  const hasAnyMarkers = useMemo(() => {
    return (
      (layers.earthquakes && earthquakes.length > 0) ||
      (layers.family && familyMembers.length > 0) ||
      (layers.pois && offlineLocations.length > 0) ||
      (layers.trappedUsers && trappedUsers.length > 0)
    );
  }, [layers, earthquakes.length, familyMembers.length, offlineLocations.length, trappedUsers.length]);
  
  const renderBottomSheetContent = useCallback(() => {
    if (!selectedItem) {
      return (
        <View style={styles.bottomSheetEmpty}>
          <Ionicons name="location-outline" size={48} color={colors.text.tertiary} />
          <Text style={styles.bottomSheetEmptyText}>Detayları görmek için bir nokta seçin</Text>
          {!hasAnyMarkers && (
            <Text style={styles.bottomSheetEmptySubtext}>
              Haritada görüntülenecek veri bulunmuyor
            </Text>
          )}
        </View>
      );
    }

    const isEarthquake = 'magnitude' in selectedItem;
    const isMapLocation = 'type' in selectedItem && !isEarthquake && !('status' in selectedItem);

    return (
      <View style={styles.bottomSheetContent}>
        <View style={styles.bottomSheetHeader}>
          <Ionicons 
            name={
              isEarthquake ? 'pulse' : 
              isMapLocation ? getLocationIcon((selectedItem as MapLocation).type) :
              'person'
            } 
            size={24} 
            color={
              isEarthquake ? getMagnitudeColor((selectedItem as Earthquake).magnitude) : 
              isMapLocation ? getLocationColor((selectedItem as MapLocation).type) :
              colors.brand.primary
            } 
            style={styles.bottomSheetIcon}
          />
          <Text style={styles.bottomSheetTitle}>
            {isEarthquake ? (selectedItem as Earthquake).location : 
             isMapLocation ? (selectedItem as MapLocation).name :
             (selectedItem as FamilyMember).name}
          </Text>
        </View>
        
        {isEarthquake ? (
          <View style={styles.detailContainer}>
            <DetailRow icon="speedometer" label="Büyüklük" value={`${(selectedItem as Earthquake).magnitude.toFixed(1)} ML`} />
            <DetailRow icon="arrow-down" label="Derinlik" value={`${(selectedItem as Earthquake).depth.toFixed(1)} km`} />
            <DetailRow icon="time" label="Zaman" value={new Date((selectedItem as Earthquake).time).toLocaleString('tr-TR')} />
          </View>
        ) : isMapLocation ? (
          <View style={styles.detailContainer}>
            <DetailRow icon="location" label="Adres" value={(selectedItem as MapLocation).address || 'Adres bilgisi yok'} />
            <DetailRow icon="navigate" label="Uzaklık" value={userLocation ? formatDistance(calculateDistance(userLocation.latitude, userLocation.longitude, (selectedItem as MapLocation).latitude, (selectedItem as MapLocation).longitude)) : 'Hesaplanıyor...'} />
            {(selectedItem as MapLocation).capacity && (
              <DetailRow icon="people" label="Kapasite" value={`${(selectedItem as MapLocation).capacity} kişi`} />
            )}
            {(selectedItem as MapLocation).phone && (
              <DetailRow icon="call" label="Telefon" value={(selectedItem as MapLocation).phone || ''} />
            )}
            <DetailRow icon="information-circle" label="Tip" value={
              (selectedItem as MapLocation).type === 'assembly' ? 'Toplanma Alanı' :
              (selectedItem as MapLocation).type === 'hospital' ? 'Hastane' :
              (selectedItem as MapLocation).type === 'water' ? 'Su Dağıtım Noktası' :
              (selectedItem as MapLocation).type === 'shelter' ? 'Barınma Merkezi' :
              (selectedItem as MapLocation).type === 'police' ? 'Polis Merkezi' :
              (selectedItem as MapLocation).type === 'fire' ? 'İtfaiye' : 'Diğer'
            } />
          </View>
        ) : (
          <View style={styles.detailContainer}>
            <DetailRow icon="checkmark-circle" label="Durum" value={(selectedItem as FamilyMember).status} />
            <DetailRow icon="time-outline" label="Son Görülme" value={new Date((selectedItem as FamilyMember).lastSeen).toLocaleString('tr-TR')} />
            <DetailRow icon="navigate" label="Uzaklık" value={userLocation ? formatDistance(calculateDistance(userLocation.latitude, userLocation.longitude, (selectedItem as FamilyMember).latitude, (selectedItem as FamilyMember).longitude)) : 'Hesaplanıyor...'} />
          </View>
        )}
      </View>
    );
  }, [selectedItem, userLocation]);

const DetailRow = ({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap, label: string, value: string }) => (
  <View style={styles.detailRow}>
    <Ionicons name={icon} size={20} color={colors.text.tertiary} />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

  // If MapView is not available, show informative fallback
  if (!MapView || !Marker) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 24 }]}>
          <Ionicons name="map-outline" size={64} color={colors.text.secondary} />
          <Text style={[styles.headerSubtitle, { marginTop: 16, textAlign: 'center' }]}>Harita Modülü Yüklenemedi</Text>
          <Text style={[styles.headerSubtitle, { textAlign: 'center', marginTop: 8 }]}>
            Development build gereklidir{'\n'}
            Expo Go'da harita çalışmaz{'\n'}
            {'\n'}
            Çalıştır: npx expo run:ios
          </Text>
          <Pressable 
            style={{ marginTop: 24, padding: 12, backgroundColor: colors.accent.primary, borderRadius: 12 }}
            onPress={() => {
              Alert.alert(
                'Harita Modülü',
                'Development build oluşturmak için:\n\n1. npx expo run:ios\n2. Veya EAS Build kullanın\n\nExpo Go harita modüllerini desteklemez.',
                [{ text: 'Tamam' }]
              );
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Nasıl Çalıştırılır?</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {isSampleMapData && (
        <View style={styles.sampleDataBanner}>
          <Ionicons name="information-circle" size={16} color="#fbbf24" style={{ marginRight: 8 }} />
          <Text style={styles.sampleDataText}>
            Bu harita örnek veriler içeriyor. Bölgenize özel noktalar yakında eklenecek.
          </Text>
        </View>
      )}
      
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType={mapType}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsScale
        initialRegion={{
          latitude: 41.0082, // Istanbul center
          longitude: 28.9784,
          latitudeDelta: 8,
          longitudeDelta: 8,
        }}
        onMapReady={() => {
          logger.info('MapView ready');
          // ELITE: Set animating flag to prevent region change updates during initial setup
          isAnimatingRef.current = true;
          isInitialMountRef.current = true;
          
          // ELITE: Set initial region using ref first (no state update = no re-render)
          const initialRegion = {
            latitude: 41.0082,
            longitude: 28.9784,
            latitudeDelta: 8,
            longitudeDelta: 8,
          };
          currentRegionRef.current = initialRegion;
          
          // ELITE: Update state only once after initial mount
          setCurrentRegion(initialRegion);
          setCurrentZoom(getZoomLevel(initialRegion.latitudeDelta));
          
          // ELITE: Reset flags after MapView is fully ready
          setTimeout(() => {
            isAnimatingRef.current = false;
            isInitialMountRef.current = false;
            lastRegionUpdateTimeRef.current = Date.now();
          }, 1000); // Increased delay to ensure MapView is fully ready
        }}
        onRegionChangeComplete={useCallback((region: {
          latitude: number;
          longitude: number;
          latitudeDelta: number;
          longitudeDelta: number;
        }) => {
          // ELITE: Aggressive infinite loop prevention
          const now = Date.now();
          
          // CRITICAL: Ignore if animating or initial mount
          if (isAnimatingRef.current || isInitialMountRef.current) {
            return;
          }
          
          // ELITE: Rate limiting - prevent updates more frequent than 500ms
          const timeSinceLastUpdate = now - lastRegionUpdateTimeRef.current;
          if (timeSinceLastUpdate < 500) {
            return;
          }
          
          // ELITE: Check if region actually changed significantly using ref
          const prevRegion = currentRegionRef.current;
          if (prevRegion) {
            const latDiff = Math.abs(prevRegion.latitude - region.latitude);
            const lngDiff = Math.abs(prevRegion.longitude - region.longitude);
            const latDeltaDiff = Math.abs(prevRegion.latitudeDelta - region.latitudeDelta);
            const lngDeltaDiff = Math.abs(prevRegion.longitudeDelta - region.longitudeDelta);
            
            // ELITE: Very strict thresholds to prevent unnecessary updates
            const latLngThreshold = 0.01; // 1% threshold for lat/lng (more lenient for user interaction)
            const deltaThreshold = 0.05; // 5% threshold for delta (more lenient for zoom)
            const hasSignificantChange = 
              latDiff > latLngThreshold ||
              lngDiff > latLngThreshold ||
              latDeltaDiff > deltaThreshold ||
              lngDeltaDiff > deltaThreshold;
            
            if (!hasSignificantChange) {
              // No significant change, update ref only (no state update)
              currentRegionRef.current = region;
              return;
            }
          }
          
          // ELITE: Clear existing timeout
          if (regionUpdateTimeoutRef.current) {
            clearTimeout(regionUpdateTimeoutRef.current);
            regionUpdateTimeoutRef.current = null;
          }
          
          // ELITE: Debounced state update with ref sync
          regionUpdateTimeoutRef.current = setTimeout(() => {
            // Update ref immediately
            currentRegionRef.current = region;
            
            // Update state only if significant change
            setCurrentRegion(region);
            
            // Update zoom only if changed significantly
            const newZoom = getZoomLevel(region.latitudeDelta);
            setCurrentZoom((prevZoom) => {
              if (Math.abs(prevZoom - newZoom) > 0.5) {
                return newZoom;
              }
              return prevZoom;
            });
            
            // Update last update time
            lastRegionUpdateTimeRef.current = Date.now();
          }, 500); // Increased debounce to 500ms for stability
        }, [])}
        customMapStyle={mapStyle}
        loadingEnabled
        loadingIndicatorColor={colors.accent.primary}
      >
        {/* User Location Marker */}
        {userLocation && (
          <Marker coordinate={userLocation} title="Konumun">
            <View style={styles.userLocationMarker} />
          </Marker>
        )}
        
        {/* Elite: Clustered Earthquake Markers */}
        {layers.earthquakes && clusteredMarkers.earthquakes.map((item) => {
          if (isCluster(item)) {
            return (
              <ClusterMarker
                key={item.id}
                cluster={item}
                onPress={(cluster) => {
                  // Zoom in on cluster
                  if (mapRef.current) {
                    // ELITE: Set animating flag to prevent region change updates during animation
                    isAnimatingRef.current = true;
                    const region = currentRegionRef.current || currentRegion;
                    mapRef.current.animateToRegion({
                      latitude: cluster.latitude,
                      longitude: cluster.longitude,
                      latitudeDelta: region?.latitudeDelta ? region.latitudeDelta * 0.5 : 2,
                      longitudeDelta: region?.longitudeDelta ? region.longitudeDelta * 0.5 : 2,
                    }, 500);
                    setTimeout(() => {
                      isAnimatingRef.current = false;
                      lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
                    }, 1000); // Increased buffer
                  }
                }}
              />
            );
          }
          const eq = item as Earthquake;
          return (
            <Marker 
              key={`eq-${eq.id}`} 
              coordinate={{ latitude: eq.latitude, longitude: eq.longitude }}
              onPress={() => handleMarkerPress(eq)}
              tracksViewChanges={false}
            >
              <EarthquakeMarker magnitude={eq.magnitude} selected={selectedItem?.id === eq.id} />
            </Marker>
          );
        })}
        
        {/* Elite: Clustered Family Member Markers */}
        {layers.family && clusteredMarkers.family.map((item) => {
          if (isCluster(item)) {
            return (
              <ClusterMarker
                key={item.id}
                cluster={item}
                onPress={(cluster) => {
                  if (mapRef.current) {
                    // ELITE: Set animating flag to prevent region change updates during animation
                    isAnimatingRef.current = true;
                    const region = currentRegionRef.current || currentRegion;
                    mapRef.current.animateToRegion({
                      latitude: cluster.latitude,
                      longitude: cluster.longitude,
                      latitudeDelta: region?.latitudeDelta ? region.latitudeDelta * 0.5 : 2,
                      longitudeDelta: region?.longitudeDelta ? region.longitudeDelta * 0.5 : 2,
                    }, 500);
                    setTimeout(() => {
                      isAnimatingRef.current = false;
                      lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
                    }, 1000); // Increased buffer
                  }
                }}
              />
            );
          }
          const member = item as FamilyMember;
          // ELITE: Support both latitude/longitude properties and location object
          const lat = member.location?.latitude ?? member.latitude;
          const lng = member.location?.longitude ?? member.longitude;
          
          // Validate coordinates before rendering marker
          if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90 ||
              typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
            return null;
          }
          
          return (
            <Marker
              key={`fm-${member.id}`}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => handleMarkerPress(member)}
              tracksViewChanges={false}
            >
              <FamilyMarker name={member.name} status={member.status} />
            </Marker>
          );
        })}
        
        {/* Offline Location Markers (Assembly Points, Hospitals, etc.) */}
        {layers.pois && offlineLocations.map((location) => (
          <Marker
            key={location.id}
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title={location.name}
            description={location.address || location.type}
            onPress={() => handleMarkerPress(location)}
            tracksViewChanges={false}
          >
            <View style={[styles.offlineMarker, { borderColor: getLocationColor(location.type) }]}>
              <Ionicons 
                name={getLocationIcon(location.type)} 
                size={24} 
                color={getLocationColor(location.type)} 
              />
            </View>
          </Marker>
        ))}

        {/* Debris/Trapped Status Marker */}
        {userStatusLocation && (userStatus === 'trapped' || userStatus === 'needs_help') && (
          <Marker
            coordinate={userStatusLocation}
            title={userStatus === 'trapped' ? 'Enkaz Altında' : 'Yardım Gerekiyor'}
            description="Cihaz algılama durumu"
          >
            <View style={[styles.debrisMarker, { backgroundColor: userStatus === 'trapped' ? '#DC2626' : '#F59E0B' }]}>
              <Ionicons 
                name={userStatus === 'trapped' ? 'alert-circle' : 'warning'} 
                size={28} 
                color="#fff" 
              />
            </View>
          </Marker>
        )}

        {/* Trapped Users (Rescue Team Mode) */}
        {layers.trappedUsers && trappedUsers.map((user) => (
          <TrappedUserMarker
            key={`tu-${user.id}`}
            user={user}
            onPress={(user) => {
              // Zoom to user location
              if (user.location && mapRef.current) {
                // ELITE: Set animating flag to prevent region change updates during animation
                isAnimatingRef.current = true;
                mapRef.current.animateToRegion({
                  latitude: user.location.latitude,
                  longitude: user.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }, 1000);
                setSelectedItem(user as any);
                bottomSheetRef.current?.expand();
                setTimeout(() => {
                  isAnimatingRef.current = false;
                  lastRegionUpdateTimeRef.current = Date.now(); // Reset rate limit timer
                }, 1500); // Increased buffer to ensure animation completes
              }
            }}
          />
        ))}

        {/* ELITE: Hazard Zones (Circle Overlays) */}
        {layers.hazardZones && Circle && hazardZones.map((zone) => {
          const getZoneColor = () => {
            switch (zone.severity) {
              case 3: return 'rgba(220, 38, 38, 0.3)'; // Critical - Red
              case 2: return 'rgba(245, 158, 11, 0.3)'; // High - Orange
              case 1: return 'rgba(251, 191, 36, 0.3)'; // Medium - Yellow
              default: return 'rgba(107, 114, 128, 0.3)'; // Low - Gray
            }
          };
          
          const getZoneStrokeColor = () => {
            switch (zone.severity) {
              case 3: return '#DC2626'; // Critical - Red
              case 2: return '#F59E0B'; // High - Orange
              case 1: return '#FBBF24'; // Medium - Yellow
              default: return '#6B7280'; // Low - Gray
            }
          };

          return (
            <Circle
              key={`hazard-${zone.id}`}
              center={{
                latitude: zone.center.lat,
                longitude: zone.center.lng,
              }}
              radius={zone.radius} // meters
              fillColor={getZoneColor()}
              strokeColor={getZoneStrokeColor()}
              strokeWidth={2}
            />
          );
        })}
      </MapView>

      {/* Floating UI Elements */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 16 }]}>
        <BlurView intensity={50} tint="dark" style={styles.floatingHeaderBlur}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerSubtitle}>
                {layers.earthquakes ? earthquakes.length : 0} deprem • {layers.family ? familyMembers.length : 0} aile • {layers.pois ? offlineLocations.length : 0} nokta
                {layers.trappedUsers && trappedUsers.length > 0 && ` • ${trappedUsers.length} enkaz`}
              </Text>
            </View>
            {/* Elite: Mesh Network Indicator */}
            <View style={styles.offlineBadge}>
              <Ionicons name="bluetooth" size={16} color={colors.status.online} />
              <Text style={styles.offlineBadgeText}>Mesh</Text>
            </View>
          </View>
        </BlurView>
      </View>
      
      {/* Elite: Map Layer Control */}
      <MapLayerControl
        layers={layers}
        onLayerToggle={handleLayerToggle}
        earthquakeCount={earthquakes.length}
        familyCount={familyMembers.length}
        poisCount={offlineLocations.length}
        trappedUsersCount={trappedUsers.length}
      />
      <View style={[styles.floatingControls, { top: insets.top + 100 }]}>
        <Pressable style={styles.controlButton} onPress={() => handleMapControlPress('zoomIn')}>
          <Ionicons name="add" size={24} color={colors.text.primary} />
        </Pressable>
        <Pressable style={styles.controlButton} onPress={() => handleMapControlPress('zoomOut')}>
          <Ionicons name="remove" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.controlSeparator} />
        <Pressable style={styles.controlButton} onPress={() => handleMapControlPress('locate')}>
          <Ionicons name="locate" size={24} color={colors.text.primary} />
        </Pressable>
        <Pressable style={styles.controlButton} onPress={() => handleMapControlPress('cycleMapType')}>
          <Ionicons name="layers" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundComponent={({ style }) => (
          <BlurView intensity={50} tint="dark" style={[style, styles.bottomSheetBackground]} />
        )}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        {renderBottomSheetContent()}
      </BottomSheet>

      {/* Compass Widget */}
      {showCompass && compassAvailable && (
        <View style={[styles.compassWidget, { bottom: insets.bottom + 100, left: 16 }]}>
          <BlurView intensity={50} tint="dark" style={styles.compassWidgetBlur}>
            <View style={[styles.compassCircle, { transform: [{ rotate: `${-heading}deg` }] }]}>
              <View style={styles.compassNeedle}>
                <View style={styles.compassNeedleNorth} />
                <View style={styles.compassNeedleSouth} />
              </View>
              <View style={styles.compassLabels}>
                <Text style={styles.compassLabelN}>N</Text>
                <Text style={styles.compassLabelS}>S</Text>
                <Text style={styles.compassLabelE}>E</Text>
                <Text style={styles.compassLabelW}>W</Text>
              </View>
            </View>
            <Text style={styles.compassHeading}>{Math.round(heading)}°</Text>
          </BlurView>
        </View>
      )}

      {/* Debris Status Indicator */}
      {(userStatus === 'trapped' || userStatus === 'needs_help') && (
        <View style={[styles.debrisStatusIndicator, { top: insets.top + 70, left: 16 }]}>
          <BlurView intensity={50} tint="dark" style={styles.debrisStatusBlur}>
            <Ionicons 
              name={userStatus === 'trapped' ? 'alert-circle' : 'warning'} 
              size={20} 
              color={userStatus === 'trapped' ? '#DC2626' : '#F59E0B'} 
            />
            <Text style={styles.debrisStatusText}>
              {userStatus === 'trapped' ? 'Enkaz Algılandı' : 'Yardım Gerekli'}
            </Text>
          </BlurView>
        </View>
      )}
      
      {/* Premium Gate KALDIRILDI - Tüm kullanıcılar erişebilir */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  sampleDataBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 2,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sampleDataText: {
    color: colors.text.primary,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  userLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand.primary,
    borderWidth: 3,
    borderColor: '#fff',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  floatingHeaderBlur: {
    padding: 12,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.status.online,
  },
  offlineBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.status.online,
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  controlButton: {
    padding: 12,
  },
  controlSeparator: {
    height: 1,
    backgroundColor: colors.border.primary,
  },
  bottomSheetBackground: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetHandle: {
    backgroundColor: colors.text.tertiary,
  },
  bottomSheetContent: {
    padding: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bottomSheetIcon: {
    marginRight: 12,
  },
  bottomSheetTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  detailContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  detailValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  bottomSheetEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  bottomSheetEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  bottomSheetEmptySubtext: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 8,
    textAlign: 'center',
  },
  offlineMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  compassWidget: {
    position: 'absolute',
    width: 80,
    height: 80,
  },
  compassWidgetBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  compassCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  compassNeedle: {
    width: 2,
    height: 24,
    position: 'absolute',
  },
  compassNeedleNorth: {
    position: 'absolute',
    top: 2,
    left: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#DC2626',
  },
  compassNeedleSouth: {
    position: 'absolute',
    bottom: 2,
    left: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#6B7280',
  },
  compassLabels: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  compassLabelN: {
    position: 'absolute',
    top: 4,
    left: '50%',
    marginLeft: -6,
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  compassLabelS: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -6,
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  compassLabelE: {
    position: 'absolute',
    right: 4,
    top: '50%',
    marginTop: -7,
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  compassLabelW: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -7,
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  compassHeading: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  debrisMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  debrisStatusIndicator: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  debrisStatusBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  debrisStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
