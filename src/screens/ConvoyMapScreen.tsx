import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import * as Beacon from '../ble/bridge';

// Import expo-maps with fallback
let ExpoMap: any = null;
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

try {
  const maps = require('expo-maps');
  ExpoMap = maps.default;
  MapView = maps.MapView;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
} catch (e) {
  console.warn('expo-maps not available:', e);
}

interface ConvoyVehicle {
  id: string;
  name: string;
  lat: number;
  lon: number;
  speed?: number;
  bearing?: number;
  status: 'active' | 'stopped' | 'warning';
  lastUpdate: number;
}

export default function ConvoyMapScreen() {
  const [vehicles, setVehicles] = useState<ConvoyVehicle[]>([]);
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<ConvoyVehicle | null>(null);
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
    startBeaconMonitoring();
    return () => {
      Beacon.stop();
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
        setMyLocation(pos);
        
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
      console.error('Failed to load current location:', error);
    }
  };

  const startBeaconMonitoring = () => {
    Beacon.start({
      onNearby: (list: any[]) => {
        const convoyVehicles = list
          .filter(x => x.convoy && x.lat != null && x.lon != null)
          .map(x => ({
            id: x.id,
            name: x.name || x.id.slice(0, 6),
            lat: x.lat,
            lon: x.lon,
            speed: x.speed,
            bearing: x.bearing,
            status: x.status || 'active',
            lastUpdate: x.ts || Date.now(),
          }));
        
        setVehicles(convoyVehicles);
      },
    });
  };

  const handleBroadcastLocation = async () => {
    if (!myLocation) {
      Alert.alert('Uyarı', 'Konum bilgisi alınamadı');
      return;
    }

    setIsBroadcasting(true);
    try {
      await Beacon.broadcastTeamLocation();
      Alert.alert('Başarılı', 'Konum yayınlandı');
    } catch (error) {
      Alert.alert('Hata', 'Konum yayınlanamadı');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleVehiclePress = (vehicle: ConvoyVehicle) => {
    setSelectedVehicle(vehicle);
    Alert.alert(
      vehicle.name,
      `Durum: ${vehicle.status === 'active' ? 'Aktif' : vehicle.status === 'stopped' ? 'Durduruldu' : 'Uyarı'}\n${vehicle.speed ? `Hız: ${vehicle.speed.toFixed(1)} km/h` : ''}\nSon güncelleme: ${new Date(vehicle.lastUpdate).toLocaleTimeString()}`,
      [
        { text: 'Tamam' },
        {
          text: 'Odağı Aç',
          onPress: () => {
            if (mapRef.current) {
              mapRef.current.animateToRegion({
                latitude: vehicle.lat,
                longitude: vehicle.lon,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }, 1000);
            }
          },
        },
      ]
    );
  };

  const handleShowAllVehicles = () => {
    if (vehicles.length === 0) {
      Alert.alert('Bilgi', 'Henüz araç bulunamadı');
      return;
    }

    if (mapRef.current) {
      const lats = vehicles.map(v => v.lat);
      const lons = vehicles.map(v => v.lon);
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      const latDelta = (maxLat - minLat) * 1.5;
      const lonDelta = (maxLon - minLon) * 1.5;
      
      mapRef.current.animateToRegion({
        latitude: centerLat,
        longitude: centerLon,
        latitudeDelta: Math.max(latDelta, 0.01),
        longitudeDelta: Math.max(lonDelta, 0.01),
      }, 1000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'stopped': return 'red';
      case 'warning': return 'orange';
      default: return 'blue';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'active': return '🟢';
      case 'stopped': return '🔴';
      case 'warning': return '🟠';
      default: return '🔵';
    }
  };

  // Fallback UI when expo-maps is not available
  if (!ExpoMap || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🚛 Konvoy Haritası</Text>
          <Text style={styles.subtitle}>Araç takip sistemi</Text>
        </View>

        <View style={styles.map}>
          <Text style={styles.mapPlaceholder}>🚛 Konvoy Haritası</Text>
          <Text style={styles.mapSubtext}>expo-maps modülü yüklenmemiş</Text>
          <Text style={styles.mapSubtext}>Haritayı kullanmak için expo-maps gerekli</Text>
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.broadcastButton} onPress={handleBroadcastLocation} disabled={isBroadcasting}>
            {isBroadcasting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>📡 Konum Yayınla</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚛 Konvoy Haritası</Text>
        <Text style={styles.subtitle}>Araç takip sistemi ({vehicles.length} araç)</Text>
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📴 Çevrimdışı Mod</Text>
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
        {vehicles.map((vehicle) => (
          <Marker
            key={vehicle.id}
            coordinate={{ latitude: vehicle.lat, longitude: vehicle.lon }}
            title={vehicle.name}
            description={`${getStatusEmoji(vehicle.status)} ${vehicle.status === 'active' ? 'Aktif' : vehicle.status === 'stopped' ? 'Durduruldu' : 'Uyarı'}`}
            pinColor={getStatusColor(vehicle.status)}
            onPress={() => handleVehiclePress(vehicle)}
          />
        ))}
        
        {vehicles.length > 1 && (
          <Polyline
            coordinates={vehicles.map(v => ({ latitude: v.lat, longitude: v.lon }))}
            strokeColor="#3b82f6"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          🚛 Araç Sayısı: {vehicles.length}
        </Text>
        {myLocation && (
          <Text style={styles.infoText}>
            📍 Konumunuz: {myLocation.latitude.toFixed(6)}, {myLocation.longitude.toFixed(6)}
          </Text>
        )}
      </View>

      <ScrollView style={styles.vehicleList} horizontal showsHorizontalScrollIndicator={false}>
        {vehicles.map((vehicle) => (
          <Pressable
            key={vehicle.id}
            style={styles.vehicleCard}
            onPress={() => handleVehiclePress(vehicle)}
          >
            <Text style={styles.vehicleName}>{vehicle.name}</Text>
            <Text style={styles.vehicleStatus}>
              {getStatusEmoji(vehicle.status)} {vehicle.status === 'active' ? 'Aktif' : vehicle.status === 'stopped' ? 'Durduruldu' : 'Uyarı'}
            </Text>
            {vehicle.speed && (
              <Text style={styles.vehicleSpeed}>{vehicle.speed.toFixed(1)} km/h</Text>
            )}
            <Text style={styles.vehicleTime}>
              {new Date(vehicle.lastUpdate).toLocaleTimeString()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <Pressable
          style={[styles.broadcastButton, isBroadcasting && styles.disabledButton]}
          onPress={handleBroadcastLocation}
          disabled={isBroadcasting}
        >
          {isBroadcasting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>📡 Konum Yayınla</Text>
          )}
        </Pressable>
        
        <Pressable
          style={[styles.showAllButton, vehicles.length === 0 && styles.disabledButton]}
          onPress={handleShowAllVehicles}
          disabled={vehicles.length === 0}
        >
          <Text style={styles.buttonText}>👁️ Tümünü Göster</Text>
        </Pressable>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 Talimatlar:{'\n'}
          • "Konum Yayınla" ile konumunuzu paylaşın{'\n'}
          • Araçlara dokunarak detayları görüntüleyin{'\n'}
          • Mavi çizgi konvoy hattını gösterir{'\n'}
          • Renkler: 🟢 Aktif, 🔴 Durduruldu, 🟠 Uyarı
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
  vehicleList: {
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingVertical: 12,
  },
  vehicleCard: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#374151',
  },
  vehicleName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  vehicleStatus: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  vehicleSpeed: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  vehicleTime: {
    color: '#64748b',
    fontSize: 10,
  },
  controls: {
    padding: 16,
    backgroundColor: '#111827',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  broadcastButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  showAllButton: {
    backgroundColor: '#3b82f6',
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
