import * as Location from 'expo-location';
import { logger } from '../utils/productionLogger';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { importAssemblyFromFile, listAssembly, loadBundledAssembly } from '../assembly/loader';
import { AssemblyPoint } from '../assembly/types';
import { usePDRFuse } from '../hooks/usePDRFuse';
import { bearingTo, haversineDistance } from '../lib/geo';

interface AssemblyWithDistance extends AssemblyPoint {
  distance: number;
  bearing: number;
}

export default function AssemblyPoints() {
  const [assemblyPoints, setAssemblyPoints] = useState<AssemblyWithDistance[]>([]);
  const [showOnMap, setShowOnMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  
  const { currentPos } = usePDRFuse();

  useEffect(() => {
    loadAssemblyPoints();
    checkLocationPermission();
  }, []);

  useEffect(() => {
    if (currentPos && assemblyPoints.length > 0) {
      updateDistances();
    }
  }, [currentPos]);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
  };

  const loadAssemblyPoints = async () => {
    try {
      setLoading(true);
      let points = await listAssembly();
      
      if (points.length === 0) {
        // Try to load bundled data
        points = await loadBundledAssembly();
      }

      setAssemblyPoints(points.map(point => ({
        ...point,
        distance: 0,
        bearing: 0
      })));
    } catch (error) {
      logger.error('Failed to load assembly points:', error);
      Alert.alert('Hata', 'Toplanma noktaları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const updateDistances = () => {
    if (!currentPos) return;

    const updatedPoints = assemblyPoints.map(point => {
      const distance = haversineDistance(
        currentPos.lat, currentPos.lon,
        point.lat, point.lon
      );
      const bearing = bearingTo(
        currentPos.lat, currentPos.lon,
        point.lat, point.lon
      );

      return {
        ...point,
        distance,
        bearing
      };
    }).sort((a, b) => a.distance - b.distance);

    setAssemblyPoints(updatedPoints);
  };

  const handleImportData = async () => {
    try {
      const result = await importAssemblyFromFile();
      if (result.type === 'cancel') return;

      const count = await importAssemblyFromFile(result.uri);
      Alert.alert(
        'İçe Aktarım Tamamlandı',
        `${count} toplanma noktası eklendi`
      );
      
      await loadAssemblyPoints();
    } catch (error) {
      logger.error('Import failed:', error);
      Alert.alert('Hata', 'Dosya içe aktarılamadı');
    }
  };

  const handleRequestLocationPermission = () => {
    Alert.alert(
      'Konum İzni Gerekli',
      'En yakın toplanma noktalarını gösterebilmek için konum izni gerekli.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ayarlar',
          onPress: () => Linking.openSettings()
        }
      ]
    );
  };

  const getBearingArrow = (bearing: number): string => {
    const directions = [
      'K', 'K-KD', 'KD', 'D-KD', 'D', 'D-GD', 'GD', 'G-GD',
      'G', 'G-GB', 'GB', 'B-GB', 'B', 'B-KB', 'KB', 'K-KB'
    ];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  };

  const renderAssemblyPoint = ({ item }: { item: AssemblyWithDistance }) => (
    <Pressable accessible={true}
          accessibilityRole="button"
      onPress={() => {
        // This would open the map centered on this point
        Alert.alert(
          item.name || 'Toplanma Noktası',
          `${item.distance > 0 ? `~${Math.round(item.distance)}m ` : ''}${getBearingArrow(item.bearing)} yönünde\n${item.addr || ''}`,
          [
            { text: 'Tamam' },
            { 
              text: 'Yön', 
              onPress: () => {
                // This would open GoToTarget screen
                logger.debug('Navigate to:', item);
              }
            }
          ]
        );
      }}
      style={styles.pointItem}
    >
      <View style={styles.pointHeader}>
        <Text style={styles.pointName}>
          {item.name || 'İsimsiz Nokta'}
        </Text>
        {item.distance > 0 && (
          <Text style={styles.pointDistance}>
            ~{Math.round(item.distance)}m
          </Text>
        )}
      </View>
      
      <View style={styles.pointDetails}>
        <Text style={styles.pointDirection}>
          {getBearingArrow(item.bearing)} yönünde
        </Text>
        {item.addr && (
          <Text style={styles.pointAddress}>
            {item.addr}
          </Text>
        )}
        {item.capacity && (
          <Text style={styles.pointCapacity}>
            Kapasite: {item.capacity} kişi
          </Text>
        )}
      </View>
    </Pressable>
  );

  const nearestPoints = assemblyPoints.slice(0, 5);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Toplanma Noktaları</Text>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Toplanma Noktaları</Text>
      
      {locationPermission === false && (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>
            Konum izni gerekli
          </Text>
          <Pressable accessible={true}
          accessibilityRole="button"
            onPress={handleRequestLocationPermission}
            style={styles.permissionButton}
          >
            <Text style={styles.permissionButtonText}>İzin Ver</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>En Yakın 5 Toplanma Noktası</Text>
        {nearestPoints.length > 0 ? (
          <FlatList
            data={nearestPoints}
            renderItem={renderAssemblyPoint}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>
            Toplanma noktası bulunamadı
          </Text>
        )}
      </View>

      <View style={styles.actionsContainer}>
        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={() => setShowOnMap(!showOnMap)}
          style={[styles.actionButton, showOnMap && styles.actionButtonActive]}
        >
          <Text style={[styles.actionButtonText, showOnMap && styles.actionButtonTextActive]}>
            {showOnMap ? 'Haritada Gizle' : 'Haritada Göster'}
          </Text>
        </Pressable>

        <Pressable accessible={true}
          accessibilityRole="button"
          onPress={handleImportData}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>
            Veri Yükle (Gelişmiş)
          </Text>
        </Pressable>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          • Haritada gösterilen noktalara dokunarak detayları görüntüleyebilirsiniz{'\n'}
          • "Yön" butonu ile pusula navigasyonu açılır{'\n'}
          • GeoJSON veya CSV formatında ek veri yükleyebilirsiniz
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  permissionBanner: {
    backgroundColor: '#f59e0b',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  permissionButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  permissionButtonText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  pointItem: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  pointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  pointDistance: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '700',
  },
  pointDetails: {
    gap: 4,
  },
  pointDirection: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  pointAddress: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  pointCapacity: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  actionButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  actionButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextActive: {
    color: '#ffffff',
  },
  infoContainer: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
});
