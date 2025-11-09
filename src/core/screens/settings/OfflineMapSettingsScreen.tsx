/**
 * OFFLINE MAP SETTINGS SCREEN
 * Download and manage offline map regions
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  mapDownloadService,
  AVAILABLE_REGIONS,
  MapRegion,
  DownloadProgress,
} from '../../services/MapDownloadService';
import { colors, typography } from '../../theme';
import * as haptics from '../../utils/haptics';

export default function OfflineMapSettingsScreen({ navigation }: any) {
  const [downloadedRegions, setDownloadedRegions] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    
    // Refresh downloads every second
    const interval = setInterval(() => {
      setDownloads(mapDownloadService.getAllDownloads());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const regions = await mapDownloadService.getDownloadedRegions();
    const size = await mapDownloadService.getTotalDownloadedSize();
    setDownloadedRegions(regions);
    setTotalSize(size);
    setLoading(false);
  };

  const handleDownload = async (region: MapRegion) => {
    haptics.impactMedium();

    Alert.alert(
      'Harita İndir',
      `${region.name} bölgesi için ${(region.estimatedSize / 1024 / 1024).toFixed(0)}MB indirme yapılacak. Devam etmek istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'İndir',
          onPress: async () => {
            const success = await mapDownloadService.downloadRegion(region);
            if (success) {
              await loadData();
              Alert.alert('Başarılı', 'Harita indirildi');
            } else {
              Alert.alert('Hata', 'Harita indirilemedi');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (regionId: string, regionName: string) => {
    haptics.impactMedium();

    Alert.alert(
      'Haritayı Sil',
      `${regionName} bölgesi silinsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const success = await mapDownloadService.deleteRegion(regionId);
            if (success) {
              await loadData();
              Alert.alert('Başarılı', 'Harita silindi');
            }
          },
        },
      ]
    );
  };

  const handlePause = async (regionId: string) => {
    haptics.impactLight();
    await mapDownloadService.pauseDownload(regionId);
  };

  const handleResume = async (regionId: string) => {
    haptics.impactLight();
    await mapDownloadService.resumeDownload(regionId);
  };

  const handleCancel = async (regionId: string) => {
    haptics.impactMedium();
    await mapDownloadService.cancelDownload(regionId);
    setDownloads(mapDownloadService.getAllDownloads());
  };

  const isDownloaded = (regionId: string) => downloadedRegions.includes(regionId);
  const getDownloadProgress = (regionId: string) => downloads.find((d) => d.regionId === regionId);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16, backgroundColor: colors.background.primary }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Çevrimdışı Haritalar</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          İnternet olmadan harita kullanabilmek için bölge haritalarını indirin.
        </Text>
      </View>

      {/* Storage Info */}
      <View style={styles.storageCard}>
        <View style={styles.storageHeader}>
          <Ionicons name="server" size={20} color={colors.text.secondary} />
          <Text style={styles.storageTitle}>Toplam Kullanım</Text>
        </View>
        <Text style={styles.storageSize}>
          {(totalSize / 1024 / 1024).toFixed(1)} MB
        </Text>
      </View>

      {/* Regions List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : (
          AVAILABLE_REGIONS
            .sort((a, b) => {
              // Sort: downloaded first, then by name
              const aDownloaded = downloadedRegions.includes(a.id);
              const bDownloaded = downloadedRegions.includes(b.id);
              if (aDownloaded !== bDownloaded) {
                return aDownloaded ? -1 : 1;
              }
              return a.name.localeCompare(b.name, 'tr');
            })
            .map((region) => {
            const downloaded = isDownloaded(region.id);
            const progress = getDownloadProgress(region.id);

            return (
              <View key={region.id} style={styles.regionCard}>
                {/* Region Header */}
                <View style={styles.regionHeader}>
                  <View style={styles.regionInfo}>
                    <Text style={styles.regionName}>{region.name}</Text>
                    <Text style={styles.regionSize}>
                      {(region.estimatedSize / 1024 / 1024).toFixed(0)} MB
                    </Text>
                  </View>
                  
                  {downloaded && (
                    <View style={styles.downloadedBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      <Text style={styles.downloadedText}>İndirildi</Text>
                    </View>
                  )}
                </View>

                {/* Download Progress */}
                {progress && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${progress.percentage}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {progress.percentage.toFixed(0)}% - {progress.status === 'downloading' ? 'İndiriliyor' : progress.status === 'paused' ? 'Duraklatıldı' : progress.status}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsContainer}>
                  {!downloaded && !progress && (
                    <Pressable
                      style={styles.downloadButton}
                      onPress={() => handleDownload(region)}
                    >
                      <LinearGradient
                        colors={['#3b82f6', '#2563eb']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        <Ionicons name="download" size={18} color="#ffffff" />
                        <Text style={styles.buttonText}>İndir</Text>
                      </LinearGradient>
                    </Pressable>
                  )}

                  {progress && progress.status === 'downloading' && (
                    <Pressable
                      style={styles.pauseButton}
                      onPress={() => handlePause(region.id)}
                    >
                      <Ionicons name="pause" size={18} color={colors.text.primary} />
                      <Text style={styles.pauseButtonText}>Duraklat</Text>
                    </Pressable>
                  )}

                  {progress && progress.status === 'paused' && (
                    <>
                      <Pressable
                        style={styles.resumeButton}
                        onPress={() => handleResume(region.id)}
                      >
                        <Ionicons name="play" size={18} color="#ffffff" />
                        <Text style={styles.buttonText}>Devam Et</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cancelButton}
                        onPress={() => handleCancel(region.id)}
                      >
                        <Ionicons name="close" size={18} color="#ef4444" />
                      </Pressable>
                    </>
                  )}

                  {downloaded && (
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => handleDelete(region.id, region.name)}
                    >
                      <Ionicons name="trash" size={18} color="#ef4444" />
                      <Text style={styles.deleteButtonText}>Sil</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  storageCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  storageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  storageSize: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  regionCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  regionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  regionInfo: {
    flex: 1,
  },
  regionName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  regionSize: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  downloadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
  },
  downloadedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  progressText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  pauseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    gap: 8,
  },
  pauseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  resumeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#10b981',
    borderRadius: 8,
    gap: 8,
  },
  cancelButton: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
});


