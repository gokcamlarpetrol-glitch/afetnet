import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import { tileCacheService } from '../../../offline/TileCacheService';
import HapticButton from '../HapticButton';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface OfflineMapManagerProps {
    visible: boolean;
    onClose: () => void;
    currentRegion: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
}

export const OfflineMapManager: React.FC<OfflineMapManagerProps> = ({ visible, onClose, currentRegion }) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [estimatedSize, setEstimatedSize] = useState<string>('Hesaplanıyor...');
  const [tileCount, setTileCount] = useState<number>(0);

  useEffect(() => {
    if (visible) {
      calculateSize();
    }
  }, [visible, currentRegion]);

  const calculateSize = () => {
    const count = tileCacheService.estimateTileCount(currentRegion, 10, 15);
    setTileCount(count);
    // Avg tile size ~15KB
    const sizeMB = (count * 15) / 1024;
    setEstimatedSize(`~${sizeMB.toFixed(1)} MB`);
  };

  const handleDownload = async () => {
    if (tileCount > 5000) {
      Alert.alert(
        'Büyük Alan Uyarısı',
        'Bu alan çok geniş (${tileCount} parça). İndirme uzun sürebilir ve çok yer kaplayabilir. Emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'İndir', onPress: startDownload },
        ],
      );
    } else {
      startDownload();
    }
  };

  const startDownload = async () => {
    setDownloading(true);
    setProgress(0);

    await tileCacheService.downloadRegion(
      currentRegion,
      10,
      15,
      (current, total) => {
        setProgress(current / total);
      },
    );

    setDownloading(false);
    Alert.alert('Tamamlandı', 'Harita bölgesi çevrimdışı kullanım için hazır.');
    onClose();
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Önbelleği Temizle',
      'İndirilen tüm harita verileri silinecek. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await tileCacheService.clearCache();
            Alert.alert('Temizlendi', 'Disk alanı açıldı.');
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <BlurView intensity={80} tint="dark" style={styles.blur}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Çevrimdışı Harita</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.infoText}>
                            Şu anki harita bölgesini cihazınıza indirin. İnternet olmadığında bile detaylı haritayı görebileceksiniz.
            </Text>

            <View style={styles.statsContainer}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Tahmini Boyut</Text>
                <Text style={styles.statValue}>{estimatedSize}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Parça Sayısı</Text>
                <Text style={styles.statValue}>{tileCount}</Text>
              </View>
            </View>

            {downloading ? (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color={colors.brand.primary} />
                <Text style={styles.progressText}>
                                    İndiriliyor... %{(progress * 100).toFixed(0)}
                </Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                </View>
              </View>
            ) : (
              <HapticButton
                style={styles.downloadButton}
                onPress={handleDownload}
                hapticType="success"
              >
                <Ionicons name="cloud-download-outline" size={24} color="#FFF" style={styles.icon} />
                <Text style={styles.buttonText}>Bölgeyi İndir</Text>
              </HapticButton>
            )}

            <TouchableOpacity style={styles.clearButton} onPress={handleClearCache}>
              <Text style={styles.clearButtonText}>Depolama Alanını Temizle</Text>
            </TouchableOpacity>

          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '85%',
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  infoText: {
    color: '#CCC',
    marginBottom: 20,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  progressText: {
    color: '#FFF',
    marginTop: 10,
    marginBottom: 8,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.success.main,
  },
  clearButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FF453A',
    fontSize: 14,
  },
});
