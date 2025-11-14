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
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { earthquakeService } from '../../services/EarthquakeService';
import { Earthquake } from '../../stores/earthquakeStore';
import * as haptics from '../../utils/haptics';
import { formatToTurkishDateTime, formatToTurkishTimeOnly, getTimeDifferenceTurkish } from '../../utils/timeUtils';
import { createLogger } from '../../utils/logger';
import { i18nService } from '../../services/I18nService';
import { calculateDistance, ISTANBUL_CENTER } from '../../utils/locationUtils';
import * as Location from 'expo-location';

const logger = createLogger('EarthquakeDetailScreen');

// ELITE: Lazy load WebBrowser module - native bridge hazır olana kadar beklemeli
let webBrowserModuleCache: any = null;
const getWebBrowserModule = async (): Promise<any> => {
  if (webBrowserModuleCache) {
    return webBrowserModuleCache;
  }
  
  try {
    const expoPart = 'expo';
    const webBrowserPart = 'web-browser';
    const moduleName = expoPart + '-' + webBrowserPart;
    const module = await import(moduleName);
    webBrowserModuleCache = module?.default || module || null;
    
    if (webBrowserModuleCache) {
      logger.info('✅ WebBrowser module loaded successfully');
    } else {
      logger.warn('⚠️ WebBrowser module loaded but is null');
    }
    
    return webBrowserModuleCache;
  } catch (error: any) {
    logger.warn('⚠️ expo-web-browser module load failed (will use Linking fallback):', error?.message || error);
    return null;
  }
};

interface Props {
  navigation: any;
  route?: {
    params?: {
      earthquake?: Earthquake;
    };
  };
}

export default function EarthquakeDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const initialEarthquake = route?.params?.earthquake;

  if (!initialEarthquake) {
    return (
      <View style={styles.fallbackContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['#312e81', '#1e293b']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.refreshButton} />
        </LinearGradient>
        <View style={styles.fallbackBody}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.fallbackTitle}>{i18nService.t('earthquake.noData')}</Text>
          <Text style={styles.fallbackSubtitle}>
            {i18nService.t('earthquake.noDataSubtitle')}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation?.goBack?.()}>
            <Text style={styles.retryButtonText}>{i18nService.t('earthquake.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  const [earthquake, setEarthquake] = useState<Earthquake>(initialEarthquake);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    // CRITICAL: Fetch earthquake detail with mounted check
    fetchEarthquakeDetail(isMounted).catch((error) => {
      if (isMounted) {
        logger.error('Failed to fetch earthquake detail:', error);
      }
    });
    
    // CRITICAL: Get user location with mounted check
    getUserLocation().catch((error) => {
      if (isMounted) {
        logger.debug('Failed to get user location:', error);
      }
    });
    
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (userLocation && earthquake) {
      const dist = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        earthquake.latitude,
        earthquake.longitude
      );
      setDistance(dist);
    } else if (earthquake) {
      // Fallback to Istanbul center distance
      const dist = calculateDistance(
        ISTANBUL_CENTER.latitude,
        ISTANBUL_CENTER.longitude,
        earthquake.latitude,
        earthquake.longitude
      );
      setDistance(dist);
    }
  }, [userLocation, earthquake]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      logger.debug('Location permission denied or error:', error);
    }
  };

  const fetchEarthquakeDetail = async (isMounted?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!earthquake?.id) {
        if (isMounted !== false) {
          setEarthquake(initialEarthquake);
        }
        return;
      }

      // Extract eventID from earthquake.id (format: "afad-{eventID}-{random}")
      const eventID = earthquake.id.split('-')[1];
      
      if (eventID && eventID !== 'Date.now()') {
        const detailData = await earthquakeService.fetchEarthquakeDetail(eventID);
        
        if (detailData && isMounted !== false) {
          setEarthquake(detailData);
          setLastUpdate(new Date());
        }
      } else {
        // If no valid eventID, use cached data
        if (isMounted !== false) {
          setEarthquake(initialEarthquake);
        }
      }
    } catch (err) {
      if (isMounted !== false) {
        setError(i18nService.t('earthquake.detailsError'));
        // Keep showing initial data
        setEarthquake(initialEarthquake);
      }
    } finally {
      if (isMounted !== false) {
        setLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    haptics.impactLight();
    fetchEarthquakeDetail(true); // Pass true for mounted check
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
    return formatToTurkishDateTime(timestamp);
  };

  const getTimeAgo = (timestamp: number) => {
    return getTimeDifferenceTurkish(timestamp);
  };

  const getMagnitudeDescription = (magnitude: number): string => {
    if (magnitude >= 7.0) {
      return i18nService.t('earthquake.magnitude.veryStrong') || 'Çok Güçlü';
    } else if (magnitude >= 6.0) {
      return i18nService.t('earthquake.magnitude.strong') || 'Güçlü';
    } else if (magnitude >= 5.0) {
      return i18nService.t('earthquake.magnitude.moderate') || 'Orta';
    } else if (magnitude >= 4.0) {
      return i18nService.t('earthquake.magnitude.light') || 'Hafif';
    } else {
      return i18nService.t('earthquake.magnitude.minor') || 'Küçük';
    }
  };

  const getImpactRadius = (magnitude: number): string => {
    // Approximate impact radius in kilometers based on magnitude
    let radiusKm = 0;
    if (magnitude >= 7.0) {
      radiusKm = 100;
    } else if (magnitude >= 6.0) {
      radiusKm = 50;
    } else if (magnitude >= 5.0) {
      radiusKm = 20;
    } else if (magnitude >= 4.0) {
      radiusKm = 10;
    } else {
      radiusKm = 5;
    }
    return `${radiusKm} ${i18nService.t('earthquake.km') || 'km'}`;
  };

  // CRITICAL: Open original source website in Safari View Controller (in-app browser)
  const openOriginalSource = async (source: 'AFAD' | 'KANDILLI') => {
    haptics.impactLight();
    
    let url: string;
    if (source === 'AFAD') {
      // AFAD resmi deprem sayfası
      url = 'https://deprem.afad.gov.tr/last-earthquakes.html';
    } else {
      // Kandilli Rasathanesi resmi deprem sayfası
      url = 'https://www.koeri.boun.edu.tr/scripts/lst0.asp';
    }

    try {
      // ELITE: iOS'ta Safari View Controller ile uygulama içinde aç
      if (Platform.OS === 'ios') {
        try {
          const WebBrowser = await getWebBrowserModule();
          
          if (WebBrowser && typeof WebBrowser.openBrowserAsync === 'function') {
            const presentationStyle = WebBrowser.WebBrowserPresentationStyle?.FULL_SCREEN;
            
            logger.info(`🚀 Opening ${source} in Safari View Controller:`, url);
            
            await WebBrowser.openBrowserAsync(url, {
              presentationStyle: presentationStyle,
              controlsColor: '#8b5cf6',
              toolbarColor: '#1e293b',
              enableBarCollapsing: false,
            });
            
            logger.info(`✅ Successfully opened ${source} in Safari View Controller`);
            return;
          } else {
            logger.warn('⚠️ WebBrowser module not available, using Linking fallback');
          }
        } catch (webBrowserError: any) {
          logger.warn('⚠️ Safari View Controller failed, using Linking fallback:', webBrowserError?.message);
        }
      }
      
      // Fallback: External browser
      await Linking.openURL(url);
      logger.info(`Opening ${source} in external browser:`, url);
    } catch (error) {
      logger.error(`Failed to open ${source} URL:`, error);
    }
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
        <Text style={styles.headerTitle}>{i18nService.t('earthquake.earthquakeDetail')}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading && !earthquake ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>{i18nService.t('earthquake.fetchingData')}</Text>
          </View>
        ) : (
          <>
            {/* ELITE: Premium Magnitude Card */}
            <View style={styles.magnitudeCard}>
              <LinearGradient
                colors={[getMagnitudeColor(earthquake.magnitude), '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.magnitudeGradient}
              >
                <View style={styles.magnitudeContainer}>
                  <Text style={styles.magnitudeValue}>{earthquake.magnitude.toFixed(1)}</Text>
                  <Text style={styles.magnitudeLabel}>{i18nService.t('earthquake.magnitudeML')}</Text>
                  <Text style={styles.magnitudeDescription}>{getMagnitudeDescription(earthquake.magnitude)}</Text>
                </View>
                <View style={styles.timeContainer}>
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={16} color="rgba(255, 255, 255, 0.8)" />
                    <Text style={styles.timeAgo}>{getTimeAgo(earthquake.time)}</Text>
                  </View>
                  <Text style={styles.exactTime}>{formatDate(earthquake.time)}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* ELITE: Premium Location Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="location" size={24} color="#ef4444" />
                <Text style={styles.infoTitle}>{i18nService.t('earthquake.locationInfo')}</Text>
              </View>
              <Text style={styles.locationText}>{earthquake.location}</Text>
              
              {/* Distance from user */}
              {distance !== null && (
                <View style={styles.distanceContainer}>
                  <Ionicons name="navigate" size={18} color="#3b82f6" />
                  <Text style={styles.distanceText}>
                    {i18nService.t('earthquake.distanceFromYou')}: {distance.toFixed(1)} {i18nService.t('earthquake.km')}
                  </Text>
                </View>
              )}

              {/* Coordinates */}
              <View style={styles.coordinatesSection}>
                <Text style={styles.sectionSubtitle}>{i18nService.t('earthquake.coordinates')}</Text>
                <View style={styles.coordinatesRow}>
                  <View style={styles.coordinateItem}>
                    <View style={styles.coordinateHeader}>
                      <Ionicons name="globe-outline" size={14} color="#94a3b8" />
                      <Text style={styles.coordinateLabel}>{i18nService.t('earthquake.latitude')}</Text>
                    </View>
                    <Text style={styles.coordinateValue}>{earthquake.latitude.toFixed(4)}°</Text>
                  </View>
                  <View style={styles.coordinateItem}>
                    <View style={styles.coordinateHeader}>
                      <Ionicons name="globe-outline" size={14} color="#94a3b8" />
                      <Text style={styles.coordinateLabel}>{i18nService.t('earthquake.longitude')}</Text>
                    </View>
                    <Text style={styles.coordinateValue}>{earthquake.longitude.toFixed(4)}°</Text>
                  </View>
                </View>
              </View>

              {/* Impact Area */}
              <View style={styles.impactContainer}>
                <View style={styles.impactHeader}>
                  <Ionicons name="radio" size={18} color="#f59e0b" />
                  <Text style={styles.impactLabel}>{i18nService.t('earthquake.impactArea')}</Text>
                </View>
                <Text style={styles.impactValue}>{getImpactRadius(earthquake.magnitude)}</Text>
                <Text style={styles.impactDescription}>{getMagnitudeDescription(earthquake.magnitude)}</Text>
              </View>
            </View>

            {/* ELITE: Premium Depth Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="arrow-down" size={24} color="#3b82f6" />
                <Text style={styles.infoTitle}>{i18nService.t('earthquake.depth')}</Text>
              </View>
              <View style={styles.depthValueContainer}>
                <Text style={styles.depthValue}>{earthquake.depth.toFixed(1)}</Text>
                <Text style={styles.depthUnit}>{i18nService.t('earthquake.km')}</Text>
              </View>
              <Text style={styles.depthDescription}>
                {earthquake.depth < 10
                  ? i18nService.t('earthquake.shallowEarthquake')
                  : earthquake.depth < 40
                  ? i18nService.t('earthquake.moderateDepth')
                  : i18nService.t('earthquake.deepEarthquake')}
              </Text>
              <View style={styles.depthScaleContainer}>
                <View style={styles.depthScaleBar}>
                  <View 
                    style={[
                      styles.depthScaleFill, 
                      { 
                        width: `${Math.min(100, (earthquake.depth / 100) * 100)}%`,
                        backgroundColor: earthquake.depth < 10 ? '#ef4444' : earthquake.depth < 40 ? '#f59e0b' : '#3b82f6'
                      }
                    ]} 
                  />
                </View>
                <View style={styles.depthScaleLabels}>
                  <Text style={styles.depthScaleLabel}>0 km</Text>
                  <Text style={styles.depthScaleLabel}>50 km</Text>
                  <Text style={styles.depthScaleLabel}>100 km</Text>
                </View>
              </View>
            </View>

            {/* ELITE: Premium Source Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="shield-checkmark" size={24} color="#10b981" />
                <Text style={styles.infoTitle}>{i18nService.t('earthquake.dataSource')}</Text>
              </View>
              <View style={styles.sourceBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.sourceText}>
                  {earthquake.source === 'AFAD'
                    ? i18nService.t('earthquake.afadOfficial')
                    : earthquake.source === 'KANDILLI'
                    ? i18nService.t('earthquake.kandilliOfficial')
                    : earthquake.source}
                </Text>
              </View>
              <Text style={styles.sourceSubtext}>
                {i18nService.t('earthquake.officialData')}
              </Text>
              {loading && (
                <View style={styles.refreshingBadge}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={styles.refreshingText}>{i18nService.t('earthquake.updating')}</Text>
                </View>
              )}
              {!loading && (
                <View style={styles.lastUpdateContainer}>
                  <Ionicons name="time-outline" size={14} color="#64748b" />
                  <Text style={styles.lastUpdateText}>
                    {i18nService.t('earthquake.lastUpdate')}: {formatToTurkishTimeOnly(lastUpdate.getTime())}
                  </Text>
                </View>
              )}
            </View>

            {/* Original Source Links Card */}
            <View style={styles.linksCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="globe-outline" size={24} color="#3b82f6" />
                <Text style={styles.infoTitle}>{i18nService.t('earthquake.originalSources')}</Text>
              </View>
              <Text style={styles.linksDescription}>
                {i18nService.t('earthquake.officialSiteDescription')}
              </Text>
              
              {/* AFAD Button */}
              <TouchableOpacity
                style={[styles.sourceButton, styles.afadButton]}
                onPress={() => openOriginalSource('AFAD')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  style={styles.sourceButtonGradient}
                >
                  <Ionicons name="shield" size={20} color="#fff" />
                  <View style={styles.sourceButtonContent}>
                    <Text style={styles.sourceButtonTitle}>{i18nService.t('earthquake.sourceAFAD')} {i18nService.t('earthquake.officialSite')}</Text>
                    <Text style={styles.sourceButtonSubtitle}>deprem.afad.gov.tr</Text>
                  </View>
                  <Ionicons name="open-outline" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Kandilli Button */}
              <TouchableOpacity
                style={[styles.sourceButton, styles.kandilliButton]}
                onPress={() => openOriginalSource('KANDILLI')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={styles.sourceButtonGradient}
                >
                  <Ionicons name="school" size={20} color="#fff" />
                  <View style={styles.sourceButtonContent}>
                    <Text style={styles.sourceButtonTitle}>{i18nService.t('earthquake.sourceKandilli')}</Text>
                    <Text style={styles.sourceButtonSubtitle}>koeri.boun.edu.tr</Text>
                  </View>
                  <Ionicons name="open-outline" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* ELITE: Premium Warning Card */}
            <View style={styles.warningCard}>
              <LinearGradient
                colors={['#7f1d1d', '#991b1b']}
                style={styles.warningGradient}
              >
                <Ionicons name="warning" size={32} color="#fef2f2" />
                <Text style={styles.warningTitle}>{i18nService.t('earthquake.aftershockWarning')}</Text>
                <Text style={styles.warningText}>
                  {i18nService.t('earthquake.aftershockWarningText')}
                </Text>
              </LinearGradient>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.errorSubtext}>
                  {i18nService.t('earthquake.cachedData')}
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
  magnitudeDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  timeContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 26,
    marginBottom: 12,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  distanceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3b82f6',
  },
  coordinatesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coordinatesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  coordinateItem: {
    flex: 1,
  },
  coordinateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  coordinateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  coordinateValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  impactContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  impactLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
  },
  impactValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f59e0b',
    marginBottom: 4,
  },
  impactDescription: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    lineHeight: 18,
  },
  depthValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  depthValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#3b82f6',
  },
  depthUnit: {
    fontSize: 18,
    fontWeight: '700',
    color: '#94a3b8',
  },
  depthDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 16,
  },
  depthScaleContainer: {
    marginTop: 8,
  },
  depthScaleBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  depthScaleFill: {
    height: '100%',
    borderRadius: 4,
  },
  depthScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  depthScaleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  sourceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
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
  lastUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  lastUpdateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
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
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  fallbackBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  fallbackSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  linksCard: {
    marginTop: 16,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  linksDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 20,
  },
  sourceButton: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  afadButton: {
    marginTop: 0,
  },
  kandilliButton: {
    marginTop: 12,
  },
  sourceButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sourceButtonContent: {
    flex: 1,
  },
  sourceButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  sourceButtonSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

