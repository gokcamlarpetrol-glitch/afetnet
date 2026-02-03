/**
 * DISASTER MAP SCREEN - ELITE VERSION
 * Powered by Supercluster for 10k+ point rendering at 60 FPS.
 * Soft & Premium Theme Redesign
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, StatusBar, Dimensions, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet from '@gorhom/bottom-sheet';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useEarthquakeStore } from '../../stores/earthquakeStore';
import { usePremiumStore } from '../../stores/premiumStore';
import PremiumGate from '../../components/PremiumGate';
import { getMagnitudeColor, calculateDistance, formatDistance } from '../../utils/mapUtils';
import { createLogger } from '../../utils/logger';
import { EarthquakeMarker } from '../../components/map/EarthquakeMarker';
import { ClusterMarker } from '../../components/map/ClusterMarker';
import { MapClusterEngine, MapPoint } from '../../utils/MapClusterEngine';
import * as haptics from '../../utils/haptics';
import { tileCacheService } from '../../../offline/TileCacheService';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';
import type { Region } from 'react-native-maps';

const logger = createLogger('DisasterMapScreen');

import MapView, { Marker, Circle, UrlTile } from 'react-native-maps';

// ELITE: Type definitions
type DisasterMapNavigationProp = StackNavigationProp<ParamListBase>;

// Type for selected event
interface SelectedEventType {
  id?: string;
  magnitude?: number;
  location?: string;
  time?: string | number;
}

interface DisasterMapScreenProps {
  navigation: DisasterMapNavigationProp;
}

const TURKEY_CENTER = {
  latitude: 39.0,
  longitude: 35.0,
  latitudeDelta: 10,
  longitudeDelta: 10,
};

// Soft Light Map Style
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#f5f5f5" }],
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }],
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#616161" }],
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#f5f5f5" }],
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#bdbdbd" }],
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#eeeeee" }],
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }],
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#e5e5e5" }],
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9e9e9e" }],
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#ffffff" }],
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }],
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#dadada" }],
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#616161" }],
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9e9e9e" }],
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [{ "color": "#e5e5e5" }],
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [{ "color": "#eeeeee" }],
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#c9c9c9" }],
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9e9e9e" }],
  },
];

export default function DisasterMapScreen({ navigation }: DisasterMapScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const isPremium = usePremiumStore((state) => state.isPremium);

  // Data State
  const [earthquakes, setEarthquakes] = useState<MapPoint[]>([]);
  const [clusters, setClusters] = useState<ReturnType<MapClusterEngine["getClusters"]>>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventType | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Map State
  const [region, setRegion] = useState(TURKEY_CENTER);
  const [zoom, setZoom] = useState(5); // Initial zoom estimate

  // Cluster Engine (Memoized to persist)
  const clusterEngine = useMemo(() => new MapClusterEngine({
    radius: 40,
    maxZoom: 14,
  }), []);

  const snapPoints = useMemo(() => ['25%', '50%', '85%'], []);

  // Load Earthquakes & Update Clusters
  useEffect(() => {
    // Poll for new data
    const updateData = () => {
      const eqData = useEarthquakeStore.getState().items;
      setEarthquakes(eqData);

      // Convert to compatible MapPoint format
      const points: MapPoint[] = eqData.map(eq => ({
        id: eq.id,
        latitude: eq.latitude,
        longitude: eq.longitude,
        magnitude: eq.magnitude,
        location: eq.location,
        source: eq.source,
        time: eq.time,
        type: 'earthquake', // Default type
      }));

      clusterEngine.load(points);
      updateClusters(region, zoom);
    };

    updateData(); // Initial load
    const interval = setInterval(updateData, 5000); // Live tracking
    return () => clearInterval(interval);
  }, []);

  const updateClusters = (currentRegion: Region, currentZoom: number) => {
    if (!clusterEngine) return;

    const bbox: [number, number, number, number] = [
      currentRegion.longitude - currentRegion.longitudeDelta / 2, // west
      currentRegion.latitude - currentRegion.latitudeDelta / 2,   // south
      currentRegion.longitude + currentRegion.longitudeDelta / 2, // east
      currentRegion.latitude + currentRegion.latitudeDelta / 2,    // north
    ];

    try {
      const newClusters = clusterEngine.getClusters(bbox, Math.round(currentZoom));
      setClusters(newClusters);
    } catch (e) {
      logger.error('Cluster calculation failed', e);
    }
  };

  const onRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
    // Estimate Zoom Level: log2(360 / longitudeDelta)
    const newZoom = Math.log2(360 / newRegion.longitudeDelta);
    setZoom(newZoom);
    updateClusters(newRegion, newZoom);
  };

  const handleClusterPress = (clusterId: number, coordinate: { latitude: number; longitude: number }) => {
    haptics.impactLight();
    const nextZoom = clusterEngine.getExpansionZoom(clusterId);

    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: coordinate,
        zoom: nextZoom,
      }, { duration: 500 });
    }
  };

  const handleMarkerPress = (point: SelectedEventType) => {
    haptics.impactMedium();
    setSelectedEvent(point);
    bottomSheetRef.current?.expand();
  };

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        });
      }
    } catch (error) {
      logger.error('Location error', error);
    }
  };

  if (!MapView || !Marker) return (
    <View style={styles.container}>
      <Text style={{ marginTop: 100, textAlign: 'center' }}>Harita Yükleniyor...</Text>
    </View>
  );

  return (
    <ImageBackground
      source={require('../../../assets/images/premium/family_soft_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <BlurView intensity={80} tint="light" style={styles.headerBlur}>
          <View>
            <Text style={styles.headerTitle}>Afet Haritası (Elite)</Text>
            <Text style={styles.headerSubtitle}>{earthquakes.length} aktif nokta • Canlı Takip</Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable style={styles.iconBtn} onPress={getUserLocation}>
              <Ionicons name="locate" size={20} color="#0ea5e9" />
            </Pressable>
          </View>
        </BlurView>
      </View>

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={TURKEY_CENTER}
        onRegionChangeComplete={onRegionChangeComplete}
        customMapStyle={mapStyle}
        loadingEnabled
        loadingIndicatorColor={colors.brand.primary}
      >
        {/* Offline Tiles */}
        {UrlTile && (
          <UrlTile
            urlTemplate={tileCacheService.getUrlTemplate()}
            zIndex={-1}
            maximumZ={14}
          />
        )}

        {/* User Location */}
        {userLocation && (
          <Marker coordinate={userLocation} zIndex={999}>
            <View style={styles.myLocationMarker}>
              <View style={styles.myLocationDot} />
            </View>
          </Marker>
        )}

        {/* Render Clusters & Markers */}
        {clusters.map((item) => {
          const { geometry, properties } = item;
          const coordinate = {
            latitude: geometry.coordinates[1],
            longitude: geometry.coordinates[0],
          };

          // It's a Cluster
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

          // It's a Single Point
          return (
            <Marker
              key={`point-${properties.pointId}`}
              coordinate={coordinate}
              onPress={() => handleMarkerPress(properties)}
              tracksViewChanges={false} // Performance optimization
            >
              <EarthquakeMarker
                magnitude={properties.magnitude || 3.0}
                selected={selectedEvent?.id === properties.pointId}
              />
            </Marker>
          );
        })}
      </MapView>

      {/* Bottom Sheet Details */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundComponent={({ style }) => (
          <View style={[style, styles.sheetBackground]}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.95)']}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}
      >
        {selectedEvent ? (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedEvent.magnitude?.toFixed(1)} ML Deprem</Text>
              <Text style={styles.sheetSubtitle}>{selectedEvent.location}</Text>
            </View>
            {/* Details View */}
            <View style={styles.detailRow}>
              <Ionicons name="time" size={18} color="#64748b" />
              <Text style={styles.detailText}>
                {new Date(selectedEvent.time).toLocaleString('tr-TR')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable style={[styles.actionBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} onPress={() => { haptics.impactLight(); }}>
                <Text style={[styles.actionBtnText, { color: '#334155' }]}>Paylaş</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { flex: 2 }]} onPress={() => { haptics.impactMedium(); }}>
                <Text style={styles.actionBtnText}>Detaylı Rapor</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.emptySheet}>
            <Text style={styles.emptyText}>Detay görmek için bir noktaya dokunun</Text>
          </View>
        )}
      </BottomSheet>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  headerBlur: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  myLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0ea5e9',
  },
  myLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0ea5e9',
    borderWidth: 2,
    borderColor: '#fff',
  },
  sheetBackground: {
    backgroundColor: '#fff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetContent: {
    padding: 24,
  },
  sheetHeader: {
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#334155',
  },
  sheetSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
  },
  detailText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '500',
  },
  actionBtn: {
    backgroundColor: '#0ea5e9',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptySheet: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
});
