// ALL EARTHQUAKES SCREEN - COMPLETE LIST WITH DETAILS
// Shows all earthquakes fetched from real APIs (AFAD, USGS, Kandilli)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuakes } from '../services/quake/useQuakes';
import { QuakeItem } from '../services/quake/types';
import { logger } from '../utils/productionLogger';

export default function AllEarthquakes({ navigation }: { navigation?: any }) {
  const { items: earthquakes, loading, refresh, source, error } = useQuakes();
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'magnitude'>('time');

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Sort earthquakes
  const sortedQuakes = [...earthquakes].sort((a, b) => {
    if (sortBy === 'time') {
      return b.time - a.time; // Most recent first
    } else {
      return (b.mag || 0) - (a.mag || 0); // Largest first
    }
  });

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMagnitudeColor = (mag: number) => {
    if (mag >= 6.0) return '#dc2626'; // Red - Critical
    if (mag >= 5.0) return '#ea580c'; // Orange - High
    if (mag >= 4.0) return '#f59e0b'; // Amber - Medium
    if (mag >= 3.0) return '#eab308'; // Yellow - Low
    return '#84cc16'; // Green - Very Low
  };

  const renderEarthquake = ({ item }: { item: QuakeItem }) => {
    const magnitude = item.mag || 0;
    const color = getMagnitudeColor(magnitude);

    return (
      <Pressable
        style={styles.quakeCard}
        onPress={() => {
          Alert.alert(
            'Deprem Detayları',
            `Büyüklük: ${magnitude.toFixed(1)} ML\n` +
            `Konum: ${item.place}\n` +
            `Tarih: ${new Date(item.time).toLocaleString('tr-TR')}\n` +
            `Derinlik: ${item.depth ? `${item.depth.toFixed(1)} km` : 'N/A'}\n` +
            `Kaynak: ${item.source || 'Bilinmiyor'}\n` +
            (item.lat && item.lon
              ? `Koordinatlar: ${item.lat.toFixed(4)}°, ${item.lon.toFixed(4)}°`
              : ''),
          );
        }}
      >
        <View style={styles.quakeHeader}>
          <View style={[styles.magnitudeBadge, { backgroundColor: color }]}>
            <Text style={styles.magnitudeText}>{magnitude.toFixed(1)}</Text>
            <Text style={styles.magnitudeLabel}>ML</Text>
          </View>
          <View style={styles.quakeInfo}>
            <Text style={styles.placeText} numberOfLines={2}>
              {item.place || 'Bilinmeyen Konum'}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={12} color="#94a3b8" />
              <Text style={styles.metaText}>{formatTime(item.time)}</Text>
              {item.source && (
                <>
                  <Text style={styles.metaText}> • </Text>
                  <Text style={styles.metaText}>{item.source}</Text>
                </>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </View>

        {(item.depth || (item.lat && item.lon)) && (
          <View style={styles.quakeDetails}>
            {item.depth && (
              <View style={styles.detailItem}>
                <Ionicons name="arrow-down" size={14} color="#64748b" />
                <Text style={styles.detailText}>Derinlik: {item.depth.toFixed(1)} km</Text>
              </View>
            )}
            {item.lat && item.lon && (
              <View style={styles.detailItem}>
                <Ionicons name="location-outline" size={14} color="#64748b" />
                <Text style={styles.detailText}>
                  {item.lat.toFixed(4)}°, {item.lon.toFixed(4)}°
                </Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text style={styles.headerTitle}>Tüm Depremler</Text>
        <View style={styles.headerRight}>
          {/* Sort Button */}
          <Pressable
            style={styles.sortButton}
            onPress={() => {
              setSortBy(sortBy === 'time' ? 'magnitude' : 'time');
            }}
            accessibilityRole="button"
            accessibilityLabel={sortBy === 'time' ? 'Büyüklüğe göre sırala' : 'Zamana göre sırala'}
          >
            <Ionicons
              name={sortBy === 'time' ? 'stats-chart' : 'time'}
              size={20}
              color="#ffffff"
            />
          </Pressable>
        </View>
      </View>

      {/* Status Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {source && (
        <View style={styles.sourceBanner}>
          <Ionicons name="information-circle" size={16} color="#3b82f6" />
          <Text style={styles.sourceText}>
            Veri Kaynağı: {source}
            {earthquakes.length > 0 && ` • ${earthquakes.length} deprem`}
          </Text>
        </View>
      )}

      {/* List */}
      {loading && earthquakes.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Deprem verileri yükleniyor...</Text>
        </View>
      ) : earthquakes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="earth-outline" size={64} color="#64748b" />
          <Text style={styles.emptyText}>Deprem verisi bulunamadı</Text>
          <Text style={styles.emptySubtext}>
            İnternet bağlantınızı kontrol edin ve yenileyin
          </Text>
          <Pressable style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Yenile</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sortedQuakes}
          renderItem={renderEarthquake}
          keyExtractor={(item, index) => item.id || `quake-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
          ListHeaderComponent={
            <View style={styles.statsHeader}>
              <Text style={styles.statsText}>
                {earthquakes.length} deprem listeleniyor
                {sortBy === 'time' ? ' (En yeni ilk)' : ' (En büyük ilk)'}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="earth-outline" size={64} color="#64748b" />
              <Text style={styles.emptyText}>Deprem verisi bulunamadı</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  sortButton: {
    padding: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    flex: 1,
  },
  sourceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  sourceText: {
    color: '#93c5fd',
    fontSize: 12,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  statsHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statsText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  quakeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quakeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  magnitudeBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  magnitudeText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  magnitudeLabel: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
  quakeInfo: {
    flex: 1,
    gap: 4,
  },
  placeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  quakeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});


