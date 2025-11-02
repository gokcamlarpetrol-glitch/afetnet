/**
 * EARTHQUAKE DETAIL SCREEN
 * Real-time AFAD data for specific earthquake
 * Apple compliance: Real, verifiable government data
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { earthquakeService } from '../../services/EarthquakeService';
import { Earthquake } from '../../stores/earthquakeStore';
import * as haptics from '../../utils/haptics';

interface Props {
  navigation: any;
  route: {
    params: {
      earthquake: Earthquake;
    };
  };
}

export default function EarthquakeDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { earthquake: initialEarthquake } = route.params;
  
  const [earthquake, setEarthquake] = useState<Earthquake>(initialEarthquake);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchEarthquakeDetail();
  }, []);

  const fetchEarthquakeDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Extract eventID from earthquake.id (format: "afad-{eventID}-{random}")
      const eventID = earthquake.id.split('-')[1];
      
      if (eventID && eventID !== 'Date.now()') {
        const detailData = await earthquakeService.fetchEarthquakeDetail(eventID);
        
        if (detailData) {
          setEarthquake(detailData);
          setLastUpdate(new Date());
        }
      } else {
        // If no valid eventID, use cached data
        setEarthquake(initialEarthquake);
      }
    } catch (err) {
      setError('Deprem detayları yüklenemedi');
      // Keep showing initial data
      setEarthquake(initialEarthquake);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    haptics.impactLight();
    fetchEarthquakeDetail();
  };

  const handleBack = () => {
    haptics.impactLight();
    navigation.goBack();
  };

  const getMagnitudeColor = (mag: number) => {
    if (mag >= 5.0) return '#ef4444';
    if (mag >= 4.0) return '#f97316';
    return '#eab308';
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    return `${diffDays} gün önce`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header */}
      <LinearGradient
        colors={['#312e81', '#1e293b']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deprem Detayı</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading && !earthquake ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>AFAD'dan güncel veriler çekiliyor...</Text>
          </View>
        ) : (
          <>
            {/* Magnitude Card */}
            <View style={styles.magnitudeCard}>
              <LinearGradient
                colors={[getMagnitudeColor(earthquake.magnitude), '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.magnitudeGradient}
              >
                <View style={styles.magnitudeContainer}>
                  <Text style={styles.magnitudeValue}>{earthquake.magnitude.toFixed(1)}</Text>
                  <Text style={styles.magnitudeLabel}>Büyüklük (ML)</Text>
                </View>
                <View style={styles.timeContainer}>
                  <Text style={styles.timeAgo}>{getTimeAgo(earthquake.time)}</Text>
                  <Text style={styles.exactTime}>{formatDate(earthquake.time)}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Location Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="location" size={24} color="#ef4444" />
                <Text style={styles.infoTitle}>Konum Bilgisi</Text>
              </View>
              <Text style={styles.locationText}>{earthquake.location}</Text>
              <View style={styles.coordinatesRow}>
                <View style={styles.coordinateItem}>
                  <Text style={styles.coordinateLabel}>Enlem</Text>
                  <Text style={styles.coordinateValue}>{earthquake.latitude.toFixed(4)}°</Text>
                </View>
                <View style={styles.coordinateItem}>
                  <Text style={styles.coordinateLabel}>Boylam</Text>
                  <Text style={styles.coordinateValue}>{earthquake.longitude.toFixed(4)}°</Text>
                </View>
              </View>
            </View>

            {/* Depth Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="arrow-down" size={24} color="#3b82f6" />
                <Text style={styles.infoTitle}>Derinlik</Text>
              </View>
              <Text style={styles.depthValue}>{earthquake.depth.toFixed(1)} km</Text>
              <Text style={styles.depthDescription}>
                {earthquake.depth < 10
                  ? 'Çok sığ deprem - Hasara neden olabilir'
                  : earthquake.depth < 40
                  ? 'Sığ deprem - Yerel etki gösterebilir'
                  : 'Derin deprem - Geniş alana yayılabilir'}
              </Text>
            </View>

            {/* Source Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="shield-checkmark" size={24} color="#10b981" />
                <Text style={styles.infoTitle}>Veri Kaynağı</Text>
              </View>
              <Text style={styles.sourceText}>
                {earthquake.source === 'AFAD'
                  ? 'AFAD (Afet ve Acil Durum Yönetimi Başkanlığı)'
                  : earthquake.source}
              </Text>
              <Text style={styles.sourceSubtext}>
                Resmi devlet kurumu - Güvenilir ve doğrulanmış veri
              </Text>
              {loading && (
                <View style={styles.refreshingBadge}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={styles.refreshingText}>Güncelleniyor...</Text>
                </View>
              )}
              {!loading && (
                <Text style={styles.lastUpdateText}>
                  Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
                </Text>
              )}
            </View>

            {/* Warning Card */}
            <View style={styles.warningCard}>
              <LinearGradient
                colors={['#7f1d1d', '#991b1b']}
                style={styles.warningGradient}
              >
                <Ionicons name="warning" size={32} color="#fef2f2" />
                <Text style={styles.warningTitle}>Önemli Hatırlatma</Text>
                <Text style={styles.warningText}>
                  Deprem sonrası 72 saat boyunca artçı sarsıntılar olabilir. Güvenli alanda kalın
                  ve acil durum çantanızı hazır bulundurun.
                </Text>
              </LinearGradient>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.errorSubtext}>
                  Önbelleğe alınmış veriler gösteriliyor
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  magnitudeCard: {
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  magnitudeGradient: {
    padding: 24,
  },
  magnitudeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  magnitudeValue: {
    fontSize: 64,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -2,
  },
  magnitudeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  timeContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  timeAgo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  exactTime: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  infoCard: {
    marginTop: 16,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  locationText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 24,
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  coordinateItem: {
    flex: 1,
  },
  coordinateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  coordinateValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  depthValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#3b82f6',
    marginBottom: 8,
  },
  depthDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    lineHeight: 20,
  },
  sourceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 8,
  },
  sourceSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    lineHeight: 20,
  },
  refreshingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  refreshingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  lastUpdateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  warningCard: {
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  warningGradient: {
    padding: 20,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fef2f2',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fecaca',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorCard: {
    marginTop: 16,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
    marginTop: 8,
  },
  errorSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 4,
  },
});

