import React, { useState, useRef, useEffect } from 'react';
import { logger } from "../utils/productionLogger";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import * as MB from '../offline/mbtiles';
import { openDbFromUri, startMbtilesServer, stopMbtilesServer, localTileUrlTemplate } from '../offline/mbtiles-server';
import { SafeMBTiles } from '../offline/SafeMBTiles';

// Import expo-maps with fallback
let ExpoMap: any = null;

try {
  const maps = (globalThis as any).require('expo-maps');
  ExpoMap = maps.default;
} catch {
  // expo-maps not available - fallback to alternative map solution
}

export default function MapOffline() {
  const [tileServerActive, setTileServerActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Network status monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadCurrentLocation();
    return () => {
      stopMbtilesServer();
    };
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

  const handleImportMbtiles = async () => {
    if (!SafeMBTiles.isAvailable()) {
      Alert.alert('Hata', 'MBTiles desteği mevcut değil. react-native-sqlite-storage ve react-native-tcp-socket gerekli.');
      return;
    }

    setIsLoading(true);
    try {
      const uri = await MB.pickMbtiles();
      await openDbFromUri(uri);
      await startMbtilesServer();
      setTileServerActive(true);
      Alert.alert('Başarılı', 'Offline harita paketi yüklendi ve aktif edildi!');
    } catch (e: any) {
      if (String(e?.message) !== 'cancelled') {
        Alert.alert('Hata', 'Offline harita paketi yüklenemedi: ' + String(e?.message || 'Bilinmiyor'));
      }
    } finally {
      setIsLoading(false);
    }
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

  // Fallback UI when expo-maps is not available
  if (!ExpoMap || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🗺️ Offline Harita</Text>
          <Text style={styles.subtitle}>Çevrimdışı harita görüntüleme</Text>
        </View>

        <View style={styles.map}>
          <Text style={styles.mapPlaceholder}>🗺️ Offline Harita</Text>
          <Text style={styles.mapSubtext}>expo-maps modülü yüklenmemiş</Text>
          <Text style={styles.mapSubtext}>Haritayı kullanmak için expo-maps gerekli</Text>
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.importButton} onPress={handleImportMbtiles} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>📦 MBTiles İçe Aktar</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Offline Harita</Text>
        <Text style={styles.subtitle}>Çevrimdışı harita görüntüleme</Text>
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📴 Çevrimdışı Mod</Text>
          </View>
        )}
        {tileServerActive && (
          <View style={styles.onlineBanner}>
            <Text style={styles.onlineText}>✅ Offline Tiles Aktif</Text>
          </View>
        )}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        mapType="standard"
      >
        {tileServerActive && (
          <MapView.TileOverlay
            urlTemplate={localTileUrlTemplate()}
            zIndex={-1}
            maximumZ={18}
            flipY={false}
          />
        )}
      </MapView>

      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          {tileServerActive ? '✅ Offline Tiles: Aktif' : '⚠️ Offline Tiles: Pasif'}
        </Text>
        <Text style={styles.infoText}>
          {isOnline ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}
        </Text>
        {currentLocation && (
          <Text style={styles.infoText}>
            📍 Konum: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.importButton, isLoading && styles.disabledButton]}
          onPress={handleImportMbtiles}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>📦 MBTiles İçe Aktar</Text>
          )}
        </Pressable>
        
        <Pressable style={styles.locationButton} onPress={handleShowMyLocation}>
          <Text style={styles.buttonText}>📍 Konumuma Git</Text>
        </Pressable>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 Talimatlar:{'\n'}
          • "MBTiles İçe Aktar" ile offline harita paketi yükleyin{'\n'}
          • MBTiles formatında harita dosyası gerekli{'\n'}
          • Yüklendikten sonra çevrimdışı harita görüntülenir{'\n'}
          • Tile sunucusu yerel ağ üzerinden çalışır
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
  onlineBanner: {
    backgroundColor: '#10b981',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  onlineText: {
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
    padding: 16,
    backgroundColor: '#111827',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  importButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  locationButton: {
    backgroundColor: '#10b981',
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
