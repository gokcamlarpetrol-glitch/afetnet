import * as Location from 'expo-location';
import { logger } from '../utils/productionLogger';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePDRFuse } from '../hooks/usePDRFuse';
import { palette } from '../theme/colors';
import { spacing } from '../theme/spacing';

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
                Enlem: {currentPos.latitude.toFixed(6)}
              </Text>
              <Text style={styles.pdrText}>
                Boylam: {currentPos.longitude.toFixed(6)}
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
    backgroundColor: palette.background.light,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: palette.background.dark,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: palette.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  mapContainer: {
    flex: 1,
    margin: spacing.lg,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: palette.background.dark,
    borderRadius: 12,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.border,
    borderStyle: 'dashed',
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.sm,
  },
  mapDescription: {
    fontSize: 14,
    color: palette.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  locationInfo: {
    backgroundColor: palette.background.light,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    width: '100%',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.xs,
  },
  locationText: {
    fontSize: 14,
    color: palette.text.secondary,
    marginBottom: 2,
  },
  pdrInfo: {
    backgroundColor: palette.background.light,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    width: '100%',
  },
  pdrTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.xs,
  },
  pdrText: {
    fontSize: 14,
    color: palette.text.secondary,
    marginBottom: 2,
  },
  featuresContainer: {
    backgroundColor: palette.background.light,
    padding: spacing.md,
    borderRadius: 8,
    width: '100%',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.xs,
  },
  featureItem: {
    fontSize: 14,
    color: palette.text.secondary,
    marginBottom: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: palette.primary.main,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: palette.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});