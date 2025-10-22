import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
// MapView temporarily disabled for Expo Go compatibility
// import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function TrackScreen() {
  const [trackingCoordinates, setTrackingCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    let locationSubscription;
    
    if (isTracking) {
      locationSubscription = Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          setCurrentLocation(location);
          setTrackingCoordinates(prev => [...prev, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }]);
        },
      );
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [isTracking]);

  const toggleTracking = async () => {
    if (!isTracking) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum takibi için izin verilmelidir.');
        return;
      }
    }
    
    setIsTracking(!isTracking);
    if (isTracking) {
      Alert.alert('Takip Durduruldu', 'Konum takibi durduruldu');
    } else {
      Alert.alert('Takip Başlatıldı', 'Konum takibi başlatıldı');
    }
  };

  const clearTrack = () => {
    setTrackingCoordinates([]);
    Alert.alert('Temizlendi', 'Takip verisi temizlendi');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📍 Konum Takibi</Text>
        <Text style={styles.subtitle}>
          {isTracking ? 'Takip aktif' : 'Takip durduruldu'}
        </Text>
      </View>

      <View style={styles.map}>
        <Text style={styles.mapPlaceholder}>📍 Konum Takip Haritası</Text>
        <Text style={styles.mapSubtext}>Takip edilen noktalar: {trackingCoordinates.length}</Text>
        {currentLocation && (
          <>
            <Text style={styles.mapSubtext}>Mevcut konum:</Text>
            <Text style={styles.mapSubtext}>Lat: {currentLocation.coords.latitude.toFixed(6)}</Text>
            <Text style={styles.mapSubtext}>Lng: {currentLocation.coords.longitude.toFixed(6)}</Text>
          </>
        )}
        {trackingCoordinates.length > 0 && (
          <>
            <Text style={styles.mapSubtext}>Başlangıç: {trackingCoordinates[0].latitude.toFixed(6)}, {trackingCoordinates[0].longitude.toFixed(6)}</Text>
            <Text style={styles.mapSubtext}>Son konum: {trackingCoordinates[trackingCoordinates.length - 1].latitude.toFixed(6)}, {trackingCoordinates[trackingCoordinates.length - 1].longitude.toFixed(6)}</Text>
          </>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable 
          style={[styles.button, isTracking ? styles.stopButton : styles.startButton]} 
          onPress={toggleTracking}
        >
          <Text style={styles.buttonText}>
            {isTracking ? '⏹️ Takibi Durdur' : '▶️ Takibi Başlat'}
          </Text>
        </Pressable>
        
        <Pressable style={styles.clearButton} onPress={clearTrack}>
          <Text style={styles.buttonText}>🗑️ Temizle</Text>
        </Pressable>
      </View>

      {currentLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.infoText}>
            Enlem: {currentLocation.coords.latitude.toFixed(6)}
          </Text>
          <Text style={styles.infoText}>
            Boylam: {currentLocation.coords.longitude.toFixed(6)}
          </Text>
          <Text style={styles.infoText}>
            Doğruluk: {currentLocation.coords.accuracy?.toFixed(0)}m
          </Text>
          <Text style={styles.infoText}>
            Nokta Sayısı: {trackingCoordinates.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#2c2c2c',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginTop: 8,
  },
  map: {
    flex: 1,
    margin: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholder: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#757575',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationInfo: {
    backgroundColor: '#ffffff',
    padding: 16,
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
});