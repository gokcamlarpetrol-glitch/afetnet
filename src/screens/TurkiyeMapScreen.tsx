import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { listAssembly } from '../assembly/loader';
import type { AssemblyPoint } from '../assembly/types';

// Import expo-maps with fallback
let ExpoMap: any = null;
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;

try {
  const maps = require('expo-maps');
  ExpoMap = maps.default;
  MapView = maps.MapView;
  Marker = maps.Marker;
  Circle = maps.Circle;
} catch (e) {
  // expo-maps not available - fallback to alternative map solution
}

export default function TurkiyeMapScreen() {
  const [assemblyPoints, setAssemblyPoints] = useState<AssemblyPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<AssemblyPoint | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showAllPoints, setShowAllPoints] = useState(true);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Network status monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadAssemblyPoints();
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
        setCurrentLocation(pos);
        
        // Set initial map region to Turkey center
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: 39.0,
            longitude: 35.0,
            latitudeDelta: 8,
            longitudeDelta: 8,
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Failed to load current location:', error);
    }
  };

  const loadAssemblyPoints = async () => {
    setIsLoading(true);
    try {
      const points = await listAssembly();
      setAssemblyPoints(points);
    } catch (error) {
      console.error('Failed to load assembly points:', error);
      Alert.alert('Hata', 'Toplanma noktaları yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkerPress = (point: AssemblyPoint) => {
    setSelectedPoint(point);
    Alert.alert(
      point.name || 'Toplanma Noktası',
      `${point.addr || 'Adres bilgisi yok'}\n${point.capacity ? `Kapasite: ${point.capacity} kişi` : ''}`,
      [
        { text: 'Tamam' },
        {
          text: 'Yön Tarifi',
          onPress: () => {
            // Navigate to this point
            if (mapRef.current) {
              mapRef.current.animateToRegion({
                latitude: point.lat,
                longitude: point.lon,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 1000);
            }
          },
        },
      ]
    );
  };

  const handleShowMyLocation = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    } else {
      Alert.alert('Uyarı', 'Konum bilgisi alınamadı');
    }
  };

  const handleShowTurkey = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: 39.0,
        longitude: 35.0,
        latitudeDelta: 8,
        longitudeDelta: 8,
      }, 1000);
    }
  };

  const handleRefresh = () => {
    loadAssemblyPoints();
  };

  // Fallback UI when expo-maps is not available
  if (!ExpoMap || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🇹🇷 Türkiye Haritası</Text>
          <Text style={styles.subtitle}>Tüm toplanma noktaları</Text>
        </View>

        <View style={styles.map}>
          <Text style={styles.mapPlaceholder}>🇹🇷 Türkiye Haritası</Text>
          <Text style={styles.mapSubtext}>expo-maps modülü yüklenmemiş</Text>
          <Text style={styles.mapSubtext}>Haritayı kullanmak için expo-maps gerekli</Text>
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.buttonText}>🔄 Yenile</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🇹🇷 Türkiye Haritası</Text>
        <Text style={styles.subtitle}>Tüm toplanma noktaları ({assemblyPoints.length})</Text>
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📴 Çevrimdışı Mod</Text>
          </View>
        )}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: 39.0,
          longitude: 35.0,
          latitudeDelta: 8,
          longitudeDelta: 8,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        mapType="standard"
      >
        {currentLocation && (
          <Circle
            center={currentLocation}
            radius={5000}
            strokeColor="#3b82f6"
            fillColor="rgba(59, 130, 246, 0.1)"
            strokeWidth={2}
          />
        )}
        
        {showAllPoints && assemblyPoints.map((point) => (
          <Marker
            key={point.id}
            coordinate={{ latitude: point.lat, longitude: point.lon }}
            title={point.name}
            description={point.addr}
            pinColor="red"
            onPress={() => handleMarkerPress(point)}
          />
        ))}
      </MapView>

      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          📍 Toplanma Noktaları: {assemblyPoints.length}
        </Text>
        {currentLocation && (
          <Text style={styles.infoText}>
            📍 Konumunuz: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.controlButton, showAllPoints && styles.activeButton]}
          onPress={() => setShowAllPoints(!showAllPoints)}
        >
          <Text style={[styles.controlButtonText, showAllPoints && styles.activeButtonText]}>
            {showAllPoints ? '📍 Noktaları Gizle' : '📍 Noktaları Göster'}
          </Text>
        </Pressable>
        
        <Pressable style={styles.controlButton} onPress={handleShowMyLocation}>
          <Text style={styles.controlButtonText}>🎯 Konumuma Git</Text>
        </Pressable>
        
        <Pressable style={styles.controlButton} onPress={handleShowTurkey}>
          <Text style={styles.controlButtonText}>🇹🇷 Türkiye Geneli</Text>
        </Pressable>
        
        <Pressable style={styles.controlButton} onPress={handleRefresh} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.controlButtonText}>🔄 Yenile</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 Talimatlar:{'\n'}
          • Kırmızı pinler toplanma noktalarını gösterir{'\n'}
          • Pinlere dokunarak detayları görüntüleyin{'\n'}
          • "Yön Tarifi" ile o noktaya zoom yapın{'\n'}
          • Mavi daire 5km çevrenizi gösterir
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
    padding: 12,
    backgroundColor: '#111827',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  controlButton: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  activeButton: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  controlButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeButtonText: {
    color: '#ffffff',
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
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
