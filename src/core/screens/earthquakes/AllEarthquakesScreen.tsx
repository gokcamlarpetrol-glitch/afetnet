/**
 * ALL EARTHQUAKES SCREEN - Premium Design
 * Filtreleme, konum bazlı, FlatList optimizations
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import { filterByDistance, sortByDistance, ISTANBUL_CENTER, calculateDistance } from '../../utils/locationUtils';
import * as haptics from '../../utils/haptics';
import { Earthquake } from '../../stores/earthquakeStore';

type TimeFilter = '1h' | '24h' | '7d' | '30d' | 'all';
type LocationFilter = 25 | 50 | 100 | 999999; // 999999 = all Turkey
type MagnitudeFilter = 0 | 3 | 4 | 5;


export default function AllEarthquakesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { earthquakes, loading, refresh } = useEarthquakes();
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all'); // Show all time by default
  const [locationFilter, setLocationFilter] = useState<LocationFilter>(999999); // Show all Turkey by default
  const [magnitudeFilter, setMagnitudeFilter] = useState<MagnitudeFilter>(0); // Show all magnitudes by default
  const [showFilters, setShowFilters] = useState(false);

  // Filter earthquakes
  const filteredEarthquakes = useMemo(() => {
    let filtered = [...earthquakes];

    // Time filter
    const now = Date.now();
    const timeFilters: Record<TimeFilter, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    filtered = filtered.filter((eq) => now - eq.time < timeFilters[timeFilter]);

    // Location filter
    if (locationFilter < 999999) {
      filtered = filterByDistance(
        filtered,
        ISTANBUL_CENTER.latitude,
        ISTANBUL_CENTER.longitude,
        locationFilter
      );
    }

    // Magnitude filter
    if (magnitudeFilter > 0) {
      filtered = filtered.filter((eq) => eq.magnitude >= magnitudeFilter);
    }

    // Sort by time (newest first)
    return filtered.sort((a, b) => b.time - a.time);
  }, [earthquakes, timeFilter, locationFilter, magnitudeFilter]);

  const getMagnitudeColor = (mag: number) => {
    if (mag >= 5.0) return colors.earthquake.major;
    if (mag >= 4.0) return colors.earthquake.moderate;
    return colors.earthquake.minor;
  };

  const getTimeAgo = (timestamp: number): string => {
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

  const renderItem = ({ item }: { item: Earthquake }) => {
    const distance = Math.round(
      calculateDistance(
        ISTANBUL_CENTER.latitude,
        ISTANBUL_CENTER.longitude,
        item.latitude,
        item.longitude
      )
    );

    return (
      <TouchableOpacity
        style={styles.earthquakeItem}
        activeOpacity={0.7}
        onPress={() => {
          haptics.impactLight();
          navigation?.navigate?.('EarthquakeDetail', { earthquake: item });
        }}
      >
        {/* Magnitude Badge */}
        <View style={[styles.magnitudeBadge, { backgroundColor: getMagnitudeColor(item.magnitude) }]}>
          <Text style={styles.magnitudeText}>{item.magnitude.toFixed(1)}</Text>
          <Text style={styles.magnitudeLabel}>ML</Text>
        </View>

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemLocation} numberOfLines={2}>
            {item.location}
          </Text>
          <View style={styles.itemMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.text.secondary} />
              <Text style={styles.metaText}>{getTimeAgo(item.time)}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="arrow-down-outline" size={13} color={colors.text.secondary} />
              <Text style={styles.metaText}>{item.depth.toFixed(1)} km</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={13} color={colors.text.secondary} />
              <Text style={styles.metaText}>{distance} km</Text>
            </View>
          </View>
        </View>

        {/* Map Button */}
        <TouchableOpacity
          style={styles.mapButton}
          onPress={() => {
            haptics.impactLight();
            navigation?.navigate?.('DisasterMap', { earthquake: item });
          }}
        >
          <Ionicons name="map" size={20} color="#8b5cf6" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header */}
        <LinearGradient
          colors={['#1e293b', '#334155']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            haptics.impactLight();
            navigation?.goBack?.();
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tüm Depremler</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            haptics.impactLight();
            setShowFilters(!showFilters);
          }}
        >
          <Ionicons name="options" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Time Filter */}
          <Text style={styles.filterLabel}>Zaman</Text>
          <View style={styles.filterRow}>
            {(['1h', '24h', '7d', '30d', 'all'] as TimeFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, timeFilter === filter && styles.filterChipActive]}
                onPress={() => {
                  haptics.impactLight();
                  setTimeFilter(filter);
                }}
              >
                <Text style={[styles.filterChipText, timeFilter === filter && styles.filterChipTextActive]}>
                  {filter === '1h' ? '1 Saat' : filter === '24h' ? '24 Saat' : filter === '7d' ? '7 Gün' : filter === '30d' ? '30 Gün' : 'Tümü'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Location Filter */}
          <Text style={styles.filterLabel}>Konum (İstanbul)</Text>
          <View style={styles.filterRow}>
            {([25, 50, 100, 999999] as LocationFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, locationFilter === filter && styles.filterChipActive]}
                onPress={() => {
                  haptics.impactLight();
                  setLocationFilter(filter);
                }}
              >
                <Text style={[styles.filterChipText, locationFilter === filter && styles.filterChipTextActive]}>
                  {filter === 999999 ? 'Tüm Türkiye' : `${filter} km`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Magnitude Filter */}
          <Text style={styles.filterLabel}>Büyüklük</Text>
          <View style={styles.filterRow}>
            {([0, 3, 4, 5] as MagnitudeFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, magnitudeFilter === filter && styles.filterChipActive]}
                onPress={() => {
                  haptics.impactLight();
                  setMagnitudeFilter(filter);
                }}
              >
                <Text style={[styles.filterChipText, magnitudeFilter === filter && styles.filterChipTextActive]}>
                  {filter === 0 ? 'Tümü' : `>${filter}.0`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Result Count & Info */}
      <View style={styles.resultCount}>
        <Text style={styles.resultText}>
          {filteredEarthquakes.length} deprem bulundu (Türkiye - AFAD)
        </Text>
        <Text style={styles.resultSubtext}>
          Son 100 deprem gösteriliyor
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={filteredEarthquakes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={refresh}
        refreshing={loading}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        getItemLayout={(data, index) => ({
          length: 100,
          offset: 100 * index,
          index,
        })}
      />
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    backgroundColor: colors.background.secondary,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 10,
    marginTop: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  filterChipActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.text.primary,
  },
  resultCount: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  resultSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  earthquakeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  magnitudeBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  magnitudeText: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text.primary,
  },
  magnitudeLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemLocation: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.muted,
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});

