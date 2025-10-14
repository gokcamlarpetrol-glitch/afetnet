import React, { useState, useEffect } from 'react';
import { logger } from '../utils/productionLogger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Pressable
} from 'react-native';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { palette, spacing } from '../ui/theme';
import { tileManager, PrefetchOptions, PrefetchProgress } from '../offline/tileManager';
import * as Location from 'expo-location';

interface TilePrefetchProps {
  visible: boolean;
  onClose: () => void;
  onComplete?: (packId: string) => void;
}

export default function TilePrefetch({ visible, onClose, onComplete }: TilePrefetchProps) {
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(2);
  const [minZoom, setMinZoom] = useState(12);
  const [maxZoom, setMaxZoom] = useState(17);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  const [availableStorage, setAvailableStorage] = useState(0);

  useEffect(() => {
    if (visible) {
      initializeLocation();
      updateEstimate();
      checkStorage();
    }
  }, [visible, radiusKm, minZoom, maxZoom]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Hata',
          'Konum izni gerekli',
          [{ text: 'Tamam' }]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCenter({
        lat: location.coords.latitude,
        lon: location.coords.longitude
      });
    } catch (error) {
      logger.error('Failed to get location:', error);
      Alert.alert(
        'Hata',
        'Konum alınamadı',
        [{ text: 'Tamam' }]
      );
    }
  };

  const updateEstimate = async () => {
    if (!center) return;

    try {
      const bbox = {
        north: center.lat + (radiusKm / 111.32),
        south: center.lat - (radiusKm / 111.32),
        east: center.lon + (radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180))),
        west: center.lon - (radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180)))
      };

      const size = await tileManager.estimatePrefetchSize(bbox, { min: minZoom, max: maxZoom });
      setEstimatedSize(size);
    } catch (error) {
      logger.error('Failed to estimate size:', error);
    }
  };

  const checkStorage = async () => {
    try {
      const storage = await tileManager.getAvailableStorage();
      setAvailableStorage(storage);
    } catch (error) {
      logger.error('Failed to check storage:', error);
    }
  };

  const handleStartDownload = async () => {
    if (!center) {
      Alert.alert(
        'Hata',
        'Konum gerekli',
        [{ text: 'Tamam' }]
      );
      return;
    }

    // Check storage
    if (estimatedSize > availableStorage * 0.8) {
      Alert.alert(
        'Depolama Uyarısı',
        'Yeterli depolama alanı yok',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Yine de İndir', onPress: () => startDownload() }
        ]
      );
      return;
    }

    startDownload();
  };

  const startDownload = async () => {
    if (!center) return;

    setIsDownloading(true);
    setProgress(null);

    try {
      const options: PrefetchOptions = {
        center,
        radiusKm,
        minZoom,
        maxZoom,
        packId: `prefetch_${Date.now()}`
      };

      const packId = await tileManager.prefetchTiles(options, (progress) => {
        setProgress(progress);
      });

      Alert.alert(
        'İndirme Tamamlandı',
        'Başarıyla indirildi',
        [
          {
            text: 'Tamam',
            onPress: () => {
              onComplete?.(options.packId || '');
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Download failed:', error);
      Alert.alert(
        'İndirme Hatası',
        error instanceof Error ? error.message : 'İndirme başarısız',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getProgressPercentage = (): number => {
    if (!progress) return 0;
    return Math.round((progress.downloaded / progress.total) * 100);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Harita Karo İndir</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content}>
          {/* Location Info */}
          <Card title="Konum">
            {center ? (
              <View>
                <Text style={styles.infoText}>
                  Mevcut Konum: {center.lat.toFixed(6)}, {center.lon.toFixed(6)}
                </Text>
                <Button
                  label="Konumu Güncelle"
                  onPress={initializeLocation}
                  variant="ghost"
                  style={styles.smallButton}
                />
              </View>
            ) : (
              <Text style={styles.infoText}>Konum mevcut değil</Text>
            )}
          </Card>

          {/* Radius Selection */}
          <Card title="Yarıçap">
            <View style={styles.rangeContainer}>
              <Text style={styles.rangeLabel}>1 km</Text>
              <Text style={styles.rangeValue}>{radiusKm} km</Text>
              <Text style={styles.rangeLabel}>10 km</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Pressable accessible={true}
                style={[styles.sliderButton, radiusKm === 1 && styles.sliderButtonActive]}
                onPress={() => setRadiusKm(1)}
              >
                <Text style={styles.sliderButtonText}>1</Text>
              </Pressable>
              <Pressable accessible={true}
                style={[styles.sliderButton, radiusKm === 2 && styles.sliderButtonActive]}
                onPress={() => setRadiusKm(2)}
              >
                <Text style={styles.sliderButtonText}>2</Text>
              </Pressable>
              <Pressable accessible={true}
                style={[styles.sliderButton, radiusKm === 5 && styles.sliderButtonActive]}
                onPress={() => setRadiusKm(5)}
              >
                <Text style={styles.sliderButtonText}>5</Text>
              </Pressable>
              <Pressable accessible={true}
                style={[styles.sliderButton, radiusKm === 10 && styles.sliderButtonActive]}
                onPress={() => setRadiusKm(10)}
              >
                <Text style={styles.sliderButtonText}>10</Text>
              </Pressable>
            </View>
          </Card>

          {/* Zoom Range */}
          <Card title="Zoom Aralığı">
            <View style={styles.zoomContainer}>
              <View style={styles.zoomRow}>
                <Text style={styles.zoomLabel}>Min Zoom:</Text>
                <View style={styles.zoomButtons}>
                  {[10, 11, 12, 13, 14, 15].map(zoom => (
                    <Pressable accessible={true}
                      key={zoom}
                      style={[styles.zoomButton, minZoom === zoom && styles.zoomButtonActive]}
                      onPress={() => setMinZoom(zoom)}
                    >
                      <Text style={styles.zoomButtonText}>{zoom}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.zoomRow}>
                <Text style={styles.zoomLabel}>Max Zoom:</Text>
                <View style={styles.zoomButtons}>
                  {[15, 16, 17, 18, 19, 20].map(zoom => (
                    <Pressable accessible={true}
                      key={zoom}
                      style={[styles.zoomButton, maxZoom === zoom && styles.zoomButtonActive]}
                      onPress={() => setMaxZoom(zoom)}
                    >
                      <Text style={styles.zoomButtonText}>{zoom}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </Card>

          {/* Storage Info */}
          <Card title="Depolama">
            <Text style={styles.infoText}>
              Tahmini Boyut: {formatBytes(estimatedSize)}
            </Text>
            <Text style={styles.infoText}>
              Mevcut Depolama: {formatBytes(availableStorage)}
            </Text>
            {estimatedSize > availableStorage * 0.8 && (
              <Text style={styles.warningText}>
                Depolama Uyarısı
              </Text>
            )}
          </Card>

          {/* Progress */}
          {isDownloading && progress && (
            <Card title="İndiriliyor">
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  {progress.downloaded} / {progress.total} karo
                </Text>
                <Text style={styles.progressText}>
                  Mevcut Karo: {progress.currentTile}
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${getProgressPercentage()}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {getProgressPercentage()}%
                </Text>
              </View>
            </Card>
          )}
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="İptal"
            onPress={onClose}
            variant="ghost"
            style={styles.actionButton}
          />
          <Button
            label={isDownloading ? 'İndiriliyor' : 'İndirmeyi Başlat'}
            onPress={handleStartDownload}
            disabled={!center || isDownloading}
            style={styles.actionButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 20,
    color: palette.text.primary,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: spacing(2),
  },
  infoText: {
    color: palette.textDim,
    fontSize: 14,
    marginBottom: spacing(1),
  },
  warningText: {
    color: palette.danger,
    fontSize: 14,
    marginTop: spacing(1),
  },
  smallButton: {
    marginTop: spacing(1),
    alignSelf: 'flex-start',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(2),
  },
  rangeLabel: {
    color: palette.textDim,
    fontSize: 12,
  },
  rangeValue: {
    color: palette.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderButton: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: 8,
    backgroundColor: palette.border,
  },
  sliderButtonActive: {
    backgroundColor: palette.primary.main,
  },
  sliderButtonText: {
    color: palette.text.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  zoomContainer: {
    gap: spacing(2),
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  zoomLabel: {
    color: palette.textDim,
    fontSize: 14,
    minWidth: 80,
  },
  zoomButtons: {
    flexDirection: 'row',
    gap: spacing(1),
  },
  zoomButton: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.5),
    borderRadius: 6,
    backgroundColor: palette.border,
  },
  zoomButtonActive: {
    backgroundColor: palette.primary.main,
  },
  zoomButtonText: {
    color: palette.text.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressContainer: {
    gap: spacing(1),
  },
  progressText: {
    color: palette.textDim,
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    backgroundColor: palette.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary.main,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing(2),
    gap: spacing(2),
  },
  actionButton: {
    flex: 1,
  },
});
