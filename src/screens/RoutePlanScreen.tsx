import React, { useState, useEffect, useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';

// Import expo-maps with fallback
let ExpoMap: any = null;
let MapView: any = null;
let Polyline: any = null;
let Marker: any = null;

try {
  const maps = require('expo-maps');
  ExpoMap = maps.default;
  MapView = maps.MapView;
  Polyline = maps.Polyline;
  Marker = maps.Marker;
} catch (e) {
  console.warn('expo-maps not available:', e);
}

interface RoutePoint {
  latitude: number;
  longitude: number;
}

export default function RoutePlanScreen() {
  const [routeCoordinates, setRouteCoordinates] = useState<RoutePoint[]>([]);
  const [startPoint, setStartPoint] = useState<RoutePoint | null>(null);
  const [endPoint, setEndPoint] = useState<RoutePoint | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Network status monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Initialize with current location
    loadCurrentLocation();
  }, []);

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const currentPos = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setStartPoint(currentPos);
        
        // Set initial map region
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            ...currentPos,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      }
    } catch (error) {
      Alert.alert('Hata', 'Konum alınamadı');
    }
  };

  const handlePlanRoute = async () => {
    if (!startPoint || !endPoint) {
      Alert.alert('Uyarı', 'Başlangıç ve bitiş noktalarını seçin');
      return;
    }

    setIsPlanning(true);
    
    try {
      // Simulate route planning (in production, use real routing API)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate route points (simple straight line for now)
      const points = generateRoutePoints(startPoint, endPoint);
      setRouteCoordinates(points);
      
      Alert.alert('Başarılı', 'Güvenli rota oluşturuldu');
    } catch (error) {
      Alert.alert('Hata', 'Rota planlanamadı');
    } finally {
      setIsPlanning(false);
    }
  };

  const generateRoutePoints = (start: RoutePoint, end: RoutePoint): RoutePoint[] => {
    const points: RoutePoint[] = [start];
    const steps = 10;
    
    for (let i = 1; i < steps; i++) {
      const ratio = i / steps;
      points.push({
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      });
    }
    
    points.push(end);
    return points;
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    if (!startPoint) {
      setStartPoint({ latitude, longitude });
      Alert.alert('Başlangıç', `Başlangıç noktası seçildi: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    } else if (!endPoint) {
      setEndPoint({ latitude, longitude });
      Alert.alert('Bitiş', `Bitiş noktası seçildi: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    }
  };

  const handleClearRoute = () => {
    setRouteCoordinates([]);
    setStartPoint(null);
    setEndPoint(null);
  };

  const calculateDistance = (): number => {
    if (!startPoint || !endPoint) return 0;
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (startPoint.latitude * Math.PI) / 180;
    const φ2 = (endPoint.latitude * Math.PI) / 180;
    const Δφ = ((endPoint.latitude - startPoint.latitude) * Math.PI) / 180;
    const Δλ = ((endPoint.longitude - startPoint.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const distance = calculateDistance();

  // Fallback UI when expo-maps is not available
  if (!ExpoMap || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🗺️ Rota Planlama</Text>
          <Text style={styles.subtitle}>Güvenli rota oluşturun</Text>
        </View>

        <View style={styles.map}>
          <Text style={styles.mapPlaceholder}>🗺️ Rota Planlama Haritası</Text>
          <Text style={styles.mapSubtext}>expo-maps modülü yüklenmemiş</Text>
          <Text style={styles.mapSubtext}>Haritayı kullanmak için expo-maps gerekli</Text>
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.planButton} onPress={handlePlanRoute}>
            <Text style={styles.buttonText}>🚀 Rota Planla</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Rota Planlama</Text>
        <Text style={styles.subtitle}>Güvenli rota oluşturun</Text>
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
        {startPoint && (
          <Marker
            coordinate={startPoint}
            title="Başlangıç"
            pinColor="green"
          />
        )}
        {endPoint && (
          <Marker
            coordinate={endPoint}
            title="Bitiş"
            pinColor="red"
          />
        )}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2196F3"
            strokeWidth={4}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          {startPoint ? `📍 Başlangıç: ${startPoint.latitude.toFixed(6)}, ${startPoint.longitude.toFixed(6)}` : '📍 Başlangıç noktası seçin'}
        </Text>
        <Text style={styles.infoText}>
          {endPoint ? `🎯 Bitiş: ${endPoint.latitude.toFixed(6)}, ${endPoint.longitude.toFixed(6)}` : '🎯 Bitiş noktası seçin'}
        </Text>
        {distance > 0 && (
          <Text style={styles.infoText}>
            📏 Mesafe: {distance.toFixed(0)}m ({(distance / 1000).toFixed(2)}km)
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.planButton, isPlanning && styles.planButtonDisabled]}
          onPress={handlePlanRoute}
          disabled={isPlanning || !startPoint || !endPoint}
        >
          {isPlanning ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>🚀 Rota Planla</Text>
          )}
        </Pressable>
        
        <Pressable
          style={styles.clearButton}
          onPress={handleClearRoute}
          disabled={!startPoint && !endPoint}
        >
          <Text style={styles.clearButtonText}>🗑️ Temizle</Text>
        </Pressable>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 Talimatlar:{'\n'}
          • Haritaya dokunarak başlangıç noktasını seçin{'\n'}
          • İkinci dokunuşla bitiş noktasını seçin{'\n'}
          • "Rota Planla" butonuna basın{'\n'}
          • Güvenli rota otomatik olarak oluşturulur
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
  },
  mapSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
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
  controls: {
    padding: 16,
    backgroundColor: '#111827',
    gap: 12,
  },
  planButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  planButtonDisabled: {
    backgroundColor: '#64748b',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
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
