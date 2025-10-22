import React, { useState, useRef, useEffect } from 'react';
import { logger } from "../utils/productionLogger";
import { View, Text, Pressable, StyleSheet, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';

// Import expo-maps with fallback
let ExpoMap: any = null;
let MapView: any = null;
let Polyline: any = null;
let Marker: any = null;

try {
  const maps = (globalThis as any).require('expo-maps');
  ExpoMap = maps.default;
  MapView = maps.MapView;
  Polyline = maps.Polyline;
  Marker = maps.Marker;
} catch {
  // expo-maps not available - fallback to alternative map solution
}

interface RouteWaypoint {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  order: number;
}

interface RouteOption {
  type: 'fastest' | 'shortest' | 'safest' | 'avoid_tolls';
  label: string;
}

export default function RoutePlannerScreen() {
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [selectedRouteType, setSelectedRouteType] = useState<RouteOption['type']>('fastest');
  const [routePath, setRoutePath] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [totalDistance, setTotalDistance] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const mapRef = useRef<any>(null);

  const routeOptions: RouteOption[] = [
    { type: 'fastest', label: '⚡ En Hızlı' },
    { type: 'shortest', label: '📏 En Kısa' },
    { type: 'safest', label: '🛡️ En Güvenli' },
    { type: 'avoid_tolls', label: '🚫 Ücretsiz' },
  ];

  useEffect(() => {
    // Network status monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadCurrentLocation();
  }, []);

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const pos = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        
        // Set initial map region
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            ...pos,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      }
    } catch (error) {
      logger.error('Failed to load current location:', error);
    }
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    const newWaypoint: RouteWaypoint = {
      id: `waypoint_${Date.now()}`,
      latitude,
      longitude,
      name: `Durak ${waypoints.length + 1}`,
      order: waypoints.length + 1,
    };
    
    setWaypoints([...waypoints, newWaypoint]);
  };

  const handleCalculateRoute = async () => {
    if (waypoints.length < 2) {
      Alert.alert('Uyarı', 'En az 2 durak gerekli');
      return;
    }

    setIsCalculating(true);
    try {
      // Simulate route calculation
      await new Promise(resolve => (globalThis as any).setTimeout(resolve, 2000));
      
      // Generate route path
      const path = generateRoutePath(waypoints, selectedRouteType);
      setRoutePath(path);
      
      // Calculate distance and time
      const distance = calculateRouteDistance(path);
      const time = estimateTravelTime(distance, selectedRouteType);
      
      setTotalDistance(distance);
      setEstimatedTime(time);
      
      Alert.alert('Başarılı', 'Rota hesaplandı');
    } catch (error) {
      Alert.alert('Hata', 'Rota hesaplanamadı');
    } finally {
      setIsCalculating(false);
    }
  };

  const generateRoutePath = (points: RouteWaypoint[], type: RouteOption['type']): { latitude: number; longitude: number }[] => {
    const path: { latitude: number; longitude: number }[] = [];
    
    // Sort waypoints by order
    const sortedPoints = [...points].sort((a, b) => a.order - b.order);
    
    // Generate path between each waypoint
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i];
      const end = sortedPoints[i + 1];
      const steps = type === 'shortest' ? 5 : type === 'safest' ? 8 : 10;
      
      for (let j = 0; j <= steps; j++) {
        const ratio = j / steps;
        path.push({
          latitude: start.latitude + (end.latitude - start.latitude) * ratio,
          longitude: start.longitude + (end.longitude - start.longitude) * ratio,
        });
      }
    }
    
    return path;
  };

  const calculateRouteDistance = (path: { latitude: number; longitude: number }[]): number => {
    if (path.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (p1.latitude * Math.PI) / 180;
      const φ2 = (p2.latitude * Math.PI) / 180;
      const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
      const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      totalDistance += R * c;
    }
    
    return totalDistance;
  };

  const estimateTravelTime = (distance: number, type: RouteOption['type']): number => {
    // Average speeds in km/h
    const speeds = {
      fastest: 80,
      shortest: 50,
      safest: 60,
      avoid_tolls: 70,
    };
    
    const speed = speeds[type];
    return (distance / 1000) / speed * 60; // Time in minutes
  };

  const handleClearRoute = () => {
    setWaypoints([]);
    setRoutePath([]);
    setTotalDistance(0);
    setEstimatedTime(0);
  };

  const handleDeleteWaypoint = (id: string) => {
    const newWaypoints = waypoints.filter(w => w.id !== id);
    // Reorder waypoints
    const reordered = newWaypoints.map((w, index) => ({ ...w, order: index + 1 }));
    setWaypoints(reordered);
  };

  // Fallback UI when expo-maps is not available
  if (!ExpoMap || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🗺️ Gelişmiş Rota Planlayıcı</Text>
          <Text style={styles.subtitle}>Akıllı rota optimizasyonu</Text>
        </View>

        <View style={styles.map}>
          <Text style={styles.mapPlaceholder}>🗺️ Gelişmiş Rota Planlayıcı</Text>
          <Text style={styles.mapSubtext}>expo-maps modülü yüklenmemiş</Text>
          <Text style={styles.mapSubtext}>Haritayı kullanmak için expo-maps gerekli</Text>
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.calculateButton} onPress={handleCalculateRoute}>
            <Text style={styles.buttonText}>🚀 Rotayı Hesapla</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Gelişmiş Rota Planlayıcı</Text>
        <Text style={styles.subtitle}>Akıllı rota optimizasyonu</Text>
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📴 Çevrimdışı Mod</Text>
          </View>
        )}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        mapType="standard"
      >
        {waypoints.map((waypoint, index) => (
          <Marker
            key={waypoint.id}
            coordinate={{ latitude: waypoint.latitude, longitude: waypoint.longitude }}
            title={waypoint.name}
            description={`Durak ${waypoint.order}`}
            pinColor={index === 0 ? 'green' : index === waypoints.length - 1 ? 'red' : 'blue'}
          />
        ))}
        
        {routePath.length > 0 && (
          <Polyline
            coordinates={routePath}
            strokeColor="#2196F3"
            strokeWidth={5}
          />
        )}
      </MapView>

      <View style={styles.routeOptions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {routeOptions.map((option) => (
            <Pressable
              key={option.type}
              style={[
                styles.routeOptionButton,
                selectedRouteType === option.type && styles.routeOptionButtonActive,
              ]}
              onPress={() => setSelectedRouteType(option.type)}
            >
              <Text style={[
                styles.routeOptionText,
                selectedRouteType === option.type && styles.routeOptionTextActive,
              ]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          📍 Durak Sayısı: {waypoints.length}
        </Text>
        {totalDistance > 0 && (
          <>
            <Text style={styles.infoText}>
              📏 Toplam Mesafe: {totalDistance.toFixed(0)}m ({(totalDistance / 1000).toFixed(2)}km)
            </Text>
            <Text style={styles.infoText}>
              ⏱️ Tahmini Süre: {Math.round(estimatedTime)} dakika
            </Text>
          </>
        )}
      </View>

      <ScrollView style={styles.waypointsList} horizontal showsHorizontalScrollIndicator={false}>
        {waypoints.map((waypoint) => (
          <Pressable
            key={waypoint.id}
            style={styles.waypointCard}
            onPress={() => {
              if (mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: waypoint.latitude,
                  longitude: waypoint.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }, 1000);
              }
            }}
          >
            <Text style={styles.waypointName}>{waypoint.name}</Text>
            <Text style={styles.waypointOrder}>#{waypoint.order}</Text>
            <Pressable
              style={styles.deleteWaypointButton}
              onPress={() => handleDeleteWaypoint(waypoint.id)}
            >
              <Text style={styles.deleteWaypointText}>❌</Text>
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <Pressable
          style={[styles.calculateButton, (waypoints.length < 2 || isCalculating) && styles.disabledButton]}
          onPress={handleCalculateRoute}
          disabled={waypoints.length < 2 || isCalculating}
        >
          {isCalculating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>🚀 Rotayı Hesapla</Text>
          )}
        </Pressable>
        
        <Pressable
          style={[styles.clearButton, waypoints.length === 0 && styles.disabledButton]}
          onPress={handleClearRoute}
          disabled={waypoints.length === 0}
        >
          <Text style={styles.clearButtonText}>🗑️ Temizle</Text>
        </Pressable>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 Talimatlar:{'\n'}
          • Haritaya dokunarak duraklar ekleyin{'\n'}
          • Rota tipini seçin (En Hızlı, En Kısa, vb.){'\n'}
          • "Rotayı Hesapla" ile en iyi rotayı bulun{'\n'}
          • Durak kartlarına dokunarak odağı değiştirin
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 16,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  offlineBanner: {
    backgroundColor: '#f97316',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mapSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  routeOptions: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  routeOptionButton: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  routeOptionButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  routeOptionText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  routeOptionTextActive: {
    color: '#ffffff',
  },
  infoPanel: {
    backgroundColor: '#111827',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  infoText: {
    color: '#e5e7eb',
    fontSize: 12,
    marginVertical: 2,
  },
  waypointsList: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  waypointCard: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#374151',
    position: 'relative',
  },
  waypointName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  waypointOrder: {
    color: '#94a3b8',
    fontSize: 12,
  },
  deleteWaypointButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteWaypointText: {
    color: '#ffffff',
    fontSize: 12,
  },
  controls: {
    padding: 16,
    backgroundColor: '#111827',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  calculateButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#64748b',
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: '#111827',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  instructionText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
});
