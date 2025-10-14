import * as Location from 'expo-location';
import { logger } from '../utils/productionLogger';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePDRFuse } from '../hooks/usePDRFuse';
// Theme imports - using inline styles for compatibility

export default function MapOffline() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const { currentPos } = usePDRFuse();

  useEffect(() => {
    // Get current location
    const getCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Konum erişimi için izin verilmelidir.');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setLocation(currentLocation);
        logger.debug('Location acquired', {
          lat: currentLocation.coords.latitude,
          lon: currentLocation.coords.longitude
        });
      } catch (error) {
        logger.error('Location error:', error);
      }
    };

    getCurrentLocation();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Offline Harita</Text>
        <Text style={styles.subtitle}>İnternet bağlantısı olmadan çalışır</Text>
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapTitle}>Offline Harita</Text>
          <Text style={styles.mapDescription}>
            Production build'de tam harita özelliği aktif olacak
          </Text>
          
          {/* Location Info */}
          {location && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>📍 Mevcut Konum</Text>
              <Text style={styles.locationText}>
                Enlem: {location.coords.latitude.toFixed(6)}
              </Text>
              <Text style={styles.locationText}>
                Boylam: {location.coords.longitude.toFixed(6)}
              </Text>
              <Text style={styles.locationText}>
                Doğruluk: {Math.round(location.coords.accuracy || 0)}m
              </Text>
            </View>
          )}

          {/* PDR Info */}
          {currentPos && (
            <View style={styles.pdrInfo}>
              <Text style={styles.pdrTitle}>🚶 Pedestrian Dead Reckoning</Text>
              <Text style={styles.pdrText}>
                Enlem: {(currentPos as any).latitude?.toFixed(6) || 'N/A'}
              </Text>
              <Text style={styles.pdrText}>
                Boylam: {(currentPos as any).longitude?.toFixed(6) || 'N/A'}
              </Text>
            </View>
          )}

          {/* Features List */}
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>✨ Özellikler</Text>
            <Text style={styles.featureItem}>• Offline harita tiles</Text>
            <Text style={styles.featureItem}>• GPS + PDR fusion</Text>
            <Text style={styles.featureItem}>• Konum paylaşımı</Text>
            <Text style={styles.featureItem}>• Güvenli bölgeler</Text>
            <Text style={styles.featureItem}>• Acil durum işaretleri</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Pressable 
          style={styles.actionButton}
          onPress={() => {
            Alert.alert('Bilgi', 'Harita özelliği production build\'de aktif olacak');
          }}
        >
          <Text style={styles.actionButtonText}>📍 Konumu Paylaş</Text>
        </Pressable>
        
        <Pressable 
          style={styles.actionButton}
          onPress={() => {
            Alert.alert('Bilgi', 'Güvenli bölgeler production build\'de aktif olacak');
          }}
        >
          <Text style={styles.actionButtonText}>🏠 Güvenli Bölgeler</Text>
        </Pressable>
      </View>
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
  mapContainer: {
    flex: 1,
    margin: 20,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#2c2c2c',
    borderRadius: 12,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  mapDescription: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 20,
  },
  locationInfo: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  pdrInfo: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  pdrTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  pdrText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  featuresContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#C62828',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});