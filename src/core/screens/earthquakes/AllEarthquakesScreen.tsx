/**
 * ALL EARTHQUAKES SCREEN - Premium Design
 * Filtreleme, konum bazlı, FlatList optimizations
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors } from '../../theme/colors';
import { useEarthquakes } from '../../hooks/useEarthquakes';
import * as Location from 'expo-location';
import { filterByDistance, calculateDistance } from '../../utils/locationUtils';
import * as haptics from '../../utils/haptics';
import { Earthquake } from '../../stores/earthquakeStore';
import { formatToTurkishTimeOnly, formatToTurkishDateTime } from '../../utils/timeUtils';
import { createLogger } from '../../utils/logger';
import { i18nService } from '../../services/I18nService';

const logger = createLogger('AllEarthquakesScreen');

// ELITE: Typed navigation
type AllEarthquakesNavigationProp = StackNavigationProp<Record<string, object>>;

// ELITE: Lazy load WebBrowser module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let webBrowserModuleCache: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getWebBrowserModule = async (): Promise<any> => {
  if (webBrowserModuleCache) return webBrowserModuleCache;
  try {
    const module = await import('expo-web-browser');
    webBrowserModuleCache = module?.default || module || null;
    return webBrowserModuleCache;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('⚠️ expo-web-browser module load failed:', errorMessage);
    return null;
  }
};

const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return '---';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '---';

  const diffMs = Date.now() - date.getTime();
  const within48h = diffMs <= 48 * 60 * 60 * 1000;

  // Son 48 saat içindeyse sadece saat göster
  if (within48h) {
    return formatToTurkishTimeOnly(timestamp);
  }

  // Daha eskiyse tam tarih göster
  return formatToTurkishDateTime(timestamp);
};

type TimeFilter = '1h' | '24h' | '7d' | '30d' | 'all';
type LocationFilter = 25 | 50 | 100 | 999999; // 999999 = all Turkey
type MagnitudeFilter = 0 | 3 | 4 | 5;
type SourceFilter = 'AFAD' | 'KANDILLI' | 'USGS' | 'EMSC' | null; // null = all sources

export default function AllEarthquakesScreen({ navigation }: { navigation: AllEarthquakesNavigationProp }) {
  const insets = useSafeAreaInsets();
  const { earthquakes, loading, refresh, lastUpdate } = useEarthquakes(); // CRITICAL: Get lastUpdate from hook

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all'); // Show all time by default
  const [locationFilter, setLocationFilter] = useState<LocationFilter>(999999); // Show all Turkey by default
  const [magnitudeFilter, setMagnitudeFilter] = useState<MagnitudeFilter>(0); // Show all magnitudes by default
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(null); // Show all sources by default
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'requesting' | 'granted' | 'denied' | 'error'>('unknown');

  useEffect(() => {
    // ELITE: Ekran açıldığında en güncel veriyi çek
    refresh().catch((error) => {
      logger.error('Failed to refresh earthquakes:', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestLocationPermission = useCallback(async () => {
    try {
      setLocationStatus('requesting');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        setUserLocation(null);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationStatus('granted');
    } catch (error) {
      logger.error('Failed to fetch location for earthquake filters:', error);
      setUserLocation(null);
      setLocationStatus('error');
    }
  }, []);

  useEffect(() => {
    requestLocationPermission();
  }, [requestLocationPermission]);

  // CRITICAL: Open original source website in Safari View Controller
  const openOriginalSource = async (source: Exclude<SourceFilter, null>) => {
    haptics.impactLight();

    const sourceUrls: Record<Exclude<SourceFilter, null>, string> = {
      AFAD: 'https://deprem.afad.gov.tr/last-earthquakes.html',
      KANDILLI: 'https://www.koeri.boun.edu.tr/scripts/lst0.asp',
      USGS: 'https://earthquake.usgs.gov/earthquakes/map/',
      EMSC: 'https://www.emsc-csem.org/Earthquake/',
    };

    const url = sourceUrls[source];

    try {
      if (Platform.OS === 'ios') {
        try {
          const WebBrowser = await getWebBrowserModule();
          if (WebBrowser?.openBrowserAsync) {
            await WebBrowser.openBrowserAsync(url, {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle?.FULL_SCREEN,
              controlsColor: '#8b5cf6',
              toolbarColor: '#1e293b',
            });
            return;
          }
        } catch (error) {
          logger.warn('Safari View Controller failed, using fallback');
        }
      }
      await Linking.openURL(url);
    } catch (error) {
      logger.error(`Failed to open source ${source}:`, error);
    }
  };

  // Filter earthquakes
  const filteredEarthquakes = useMemo(() => {
    let filtered = [...earthquakes];

    // Source filter
    if (sourceFilter) {
      filtered = filtered.filter((eq) => eq.source === sourceFilter);
    }

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

    if (userLocation && locationFilter < 999999) {
      filtered = filterByDistance(
        filtered,
        userLocation.latitude,
        userLocation.longitude,
        locationFilter
      );
    }

    // Magnitude filter
    if (magnitudeFilter > 0) {
      filtered = filtered.filter((eq) => eq.magnitude >= magnitudeFilter);
    }

    // Sort by time (newest first)
    return filtered.sort((a, b) => b.time - a.time);
  }, [earthquakes, sourceFilter, timeFilter, locationFilter, magnitudeFilter, userLocation]);

  // CRITICAL: Use store's lastUpdate timestamp for real-time updates
  const lastUpdatedText = useMemo(() => {
    // Use store's lastUpdate timestamp (when data was last fetched)
    if (lastUpdate) {
      return formatToTurkishTimeOnly(lastUpdate);
    }
    // Fallback to latest earthquake time if lastUpdate not available
    const reference = filteredEarthquakes[0] ?? earthquakes[0];
    return reference ? formatTimestamp(reference.time) : '---';
  }, [lastUpdate, filteredEarthquakes, earthquakes]); // CRITICAL: Include lastUpdate in dependencies

  const getMagnitudeColor = (mag: number) => {
    if (mag >= 5.0) return colors.earthquake.major;
    if (mag >= 4.0) return colors.earthquake.moderate;
    return colors.earthquake.minor;
  };

  const renderItem = ({ item }: { item: Earthquake }) => {
    const distance = userLocation
      ? Math.round(
        calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.latitude,
          item.longitude
        )
      )
      : null;

    // Source badge color
    const getSourceColor = (source: string) => {
      switch (source) {
        case 'AFAD':
          return '#3b82f6';
        case 'KANDILLI':
          return '#f59e0b';
        case 'USGS':
          return '#10b981';
        case 'EMSC':
          return '#8b5cf6';
        default:
          return '#64748b';
      }
    };

    const getSourceLabel = (source: string) => {
      return source === 'KANDILLI' ? 'Kandilli' : source;
    };

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
        </View>

        {/* Info */}
        <View style={styles.itemInfo}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemLocation} numberOfLines={2}>
              {item.location}
            </Text>
            {/* Source Badge */}
            <View style={[styles.sourceBadge, { backgroundColor: getSourceColor(item.source) }]}>
              <Text style={styles.sourceBadgeText}>{getSourceLabel(item.source)}</Text>
            </View>
          </View>
          <View style={styles.itemMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.text.secondary} />
              <Text style={styles.metaText}>{formatTimestamp(item.time)}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="arrow-down-outline" size={13} color={colors.text.secondary} />
              <Text style={styles.metaText}>{item.depth.toFixed(1)} {i18nService.t('earthquake.km')}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={13} color={colors.text.secondary} />
              <Text style={styles.metaText}>
                {distance !== null
                  ? `${distance} ${i18nService.t('earthquake.km')}`
                  : 'Konum paylaşılamadı'}
              </Text>
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

        {/* Title */}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{i18nService.t('earthquake.title') || 'Depremler'}</Text>
        </View>

        {/* ELITE: Premium Filter Button */}
        <TouchableOpacity
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          onPress={() => {
            haptics.impactLight();
            setShowFilters(!showFilters);
          }}
        >
          <Ionicons
            name={showFilters ? "close" : "options"}
            size={22}
            color={showFilters ? colors.text.primary : colors.text.secondary}
          />
          {showFilters && (
            <View style={styles.filterButtonBadge}>
              <Text style={styles.filterButtonBadgeText}>
                {filteredEarthquakes.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Time Filter */}
          <Text style={styles.filterLabel}>{i18nService.t('earthquake.timeFilter')}</Text>
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
          <Text style={styles.filterLabel}>{i18nService.t('earthquake.locationFilter')}</Text>
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
                  {filter === 999999 ? i18nService.t('earthquake.locationAllTurkey') : i18nService.t('earthquake.locationKm', { km: filter.toString() })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Magnitude Filter */}
          <Text style={styles.filterLabel}>{i18nService.t('earthquake.magnitudeFilter')}</Text>
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
                  {filter === 0 ? i18nService.t('earthquake.magnitudeAll') : i18nService.t('earthquake.magnitudeGreater', { mag: filter.toString() })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Source Filter */}
          <Text style={styles.filterLabel}>Kaynak Filtresi</Text>
          <View style={styles.filterRow}>
            {([null, 'AFAD', 'KANDILLI', 'USGS', 'EMSC'] as SourceFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter ?? 'ALL'}
                style={[styles.filterChip, sourceFilter === filter && styles.filterChipActive]}
                onPress={() => {
                  haptics.impactLight();
                  setSourceFilter(filter);
                }}
              >
                <Text style={[styles.filterChipText, sourceFilter === filter && styles.filterChipTextActive]}>
                  {filter === null ? 'Tümü' : (filter === 'KANDILLI' ? 'Kandilli' : filter)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {locationStatus !== 'granted' && (
        <View style={styles.locationNotice}>
          <Ionicons
            name={locationStatus === 'denied' ? 'alert-circle' : 'navigate-circle'}
            size={18}
            color="#f97316"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.locationNoticeText}>
            {locationStatus === 'denied'
              ? 'Mesafe filtresi için konum izni gerekiyor.'
              : locationStatus === 'requesting'
                ? 'Konum bilgisi alınıyor...'
                : 'Konum belirlenemedi; mesafe bilgisi devre dışı.'}
          </Text>
          {locationStatus !== 'requesting' && (
            <TouchableOpacity style={styles.locationNoticeButton} onPress={requestLocationPermission}>
              <Text style={styles.locationNoticeButtonText}>Tekrar Dene</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Result Count & Info */}
      <View style={styles.resultCount}>
        <Text style={styles.resultText}>
          {filteredEarthquakes.length} {i18nService.t('earthquake.found')} ({sourceFilter ?? 'Tüm Kaynaklar'})
        </Text>
        <Text style={styles.resultSubtext}>
          {i18nService.t('earthquake.lastUpdate')}: {lastUpdatedText} • {i18nService.t('earthquake.fromSource')} {sourceFilter ?? 'AFAD/Kandilli/USGS/EMSC'} {i18nService.t('earthquake.realTimeData')}
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
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['#1e293b', '#0f172a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIcon}
              >
                <Ionicons name="pulse-outline" size={64} color={colors.earthquake.moderate} />
              </LinearGradient>
              <Text style={styles.emptyText}>
                {earthquakes.length === 0
                  ? i18nService.t('earthquake.noDataYet')
                  : i18nService.t('earthquake.noFilterResults')}
              </Text>
              <Text style={styles.emptySubtext}>
                {earthquakes.length === 0
                  ? i18nService.t('earthquake.loadingOrNoData')
                  : i18nService.t('earthquake.tryDifferentFilters')}
              </Text>
              {earthquakes.length === 0 && (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => {
                    haptics.impactMedium();
                    refresh();
                  }}
                >
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emptyButtonGradient}
                  >
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.emptyButtonText}>{i18nService.t('earthquake.refresh')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )
        }
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
    justifyContent: 'space-between',
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  headerSourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sourceButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8b5cf6',
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sourceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  sourceButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  sourceInfoButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  filterButtonBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  filterButtonBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
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
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  locationNoticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.primary,
  },
  locationNoticeButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  locationNoticeButtonText: {
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 20,
    fontWeight: '900',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  itemInfo: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  itemLocation: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
