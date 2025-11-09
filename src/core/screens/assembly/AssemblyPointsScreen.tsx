/**
 * ASSEMBLY POINTS MAP SCREEN
 * Real-time assembly point map with nearest points, directions, and offline support
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { premiumService } from '../../services/PremiumService';
import PremiumGate from '../../components/PremiumGate';
import { calculateDistance, formatDistance } from '../../utils/mapUtils';
import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';

const logger = createLogger('AssemblyPointsScreen');

interface AssemblyPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  capacity: number; // Estimated capacity
  facilities: string[]; // e.g., ['water', 'toilet', 'medical', 'food']
  type: 'park' | 'stadium' | 'school' | 'community-center' | 'emergency';
  isActive: boolean;
  distance?: number; // Calculated distance from user
}

// Simplified database - In production, fetch from API or local database
const ASSEMBLY_POINTS: AssemblyPoint[] = [
  {
    id: '1',
    name: 'Küçükçekmece Stadyumu',
    latitude: 41.0176,
    longitude: 28.7769,
    address: 'Küçükçekmece, İstanbul',
    capacity: 5000,
    facilities: ['water', 'toilet', 'medical', 'food'],
    type: 'stadium',
    isActive: true,
  },
  {
    id: '2',
    name: 'Atatürk Parkı',
    latitude: 41.0082,
    longitude: 28.9784,
    address: 'Avcılar, İstanbul',
    capacity: 3000,
    facilities: ['water', 'toilet'],
    type: 'park',
    isActive: true,
  },
  {
    id: '3',
    name: 'Avcılar İlkokulu',
    latitude: 41.0123,
    longitude: 28.9823,
    address: 'Avcılar, İstanbul',
    capacity: 1500,
    facilities: ['water', 'toilet', 'medical'],
    type: 'school',
    isActive: true,
  },
  {
    id: '4',
    name: 'Bakırköy Belediye Binası',
    latitude: 40.9876,
    longitude: 28.8592,
    address: 'Bakırköy, İstanbul',
    capacity: 2000,
    facilities: ['water', 'toilet', 'medical', 'food'],
    type: 'community-center',
    isActive: true,
  },
  {
    id: '5',
    name: 'AFAD Toplanma Alanı',
    latitude: 41.0425,
    longitude: 28.9801,
    address: 'Yeşilköy, İstanbul',
    capacity: 10000,
    facilities: ['water', 'toilet', 'medical', 'food', 'shelter'],
    type: 'emergency',
    isActive: true,
  },
];

export default function AssemblyPointsScreen({ navigation }: any) {
  // ELITE: Check premium access (includes 3-day trial)
  // CRITICAL: First 3 days free, then premium required
  const insets = useSafeAreaInsets();
  const hasAccess = premiumService.hasPremiumAccess();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [points, setPoints] = useState<AssemblyPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<AssemblyPoint | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'capacity'>('distance');

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    // CRITICAL: Safe distance calculation with error handling
    try {
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        const pointsWithDistance = ASSEMBLY_POINTS.map(point => {
          try {
            const distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              point.latitude,
              point.longitude
            );
            return {
              ...point,
              distance: isNaN(distance) || !isFinite(distance) ? undefined : distance,
            };
          } catch (error) {
            logger.error(`Distance calculation error for point ${point.id}:`, error);
            return { ...point, distance: undefined };
          }
        });

        // Sort by distance or capacity
        const sorted = pointsWithDistance.sort((a, b) => {
          if (sortBy === 'distance') {
            return (a.distance || Infinity) - (b.distance || Infinity);
          } else {
            return b.capacity - a.capacity;
          }
        });

        setPoints(sorted);
      } else {
        setPoints(ASSEMBLY_POINTS);
      }
    } catch (error) {
      logger.error('Points processing error:', error);
      // Fallback: Show points without distance
      setPoints(ASSEMBLY_POINTS);
    }
  }, [userLocation, sortBy]);

  const getUserLocation = async () => {
    // CRITICAL: Location fetching with timeout and comprehensive error handling
    try {
      // Request permission with timeout
      const permissionPromise = Location.requestForegroundPermissionsAsync();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Permission timeout')), 10000)
      );
      
      const { status } = await Promise.race([permissionPromise, timeoutPromise]) as any;
      
      if (status !== 'granted') {
        Alert.alert(
          'Konum İzni Gerekli',
          'En yakın toplanma noktalarını görmek için konum izni gereklidir. Lütfen ayarlardan izin verin.',
          [
            { text: 'Tamam', style: 'default' },
            { 
              text: 'Ayarlara Git', 
              onPress: () => {
                Linking.openSettings().catch((err) => {
                  logger.error('Failed to open settings:', err);
                });
              }
            }
          ]
        );
        return;
      }

      // Get position with timeout and fallback
      try {
        const positionPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const positionTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Position timeout')), 15000)
        );
        
        const location = await Promise.race([positionPromise, positionTimeoutPromise]) as any;

        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (posError) {
        // Try with lower accuracy
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (fallbackError) {
          logger.error('Location error (all methods failed):', fallbackError);
          Alert.alert(
            'Konum Alınamadı',
            'Konumunuz alınamadı. Toplanma noktaları mesafeye göre sıralanamayacak ancak tüm noktalar görüntülenecek.',
            [{ text: 'Tamam' }]
          );
        }
      }
    } catch (error: any) {
      logger.error('Location permission error:', error);
      Alert.alert(
        'Konum Hatası',
        'Konum izni alınırken bir hata oluştu. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
    }
  };

  const handleGetDirections = async (point: AssemblyPoint) => {
    // CRITICAL: Directions with comprehensive error handling and fallback
    try {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`;
      
      // Check if URL can be opened
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        throw new Error('Cannot open maps URL');
      }
      
      await Linking.openURL(url);
    } catch (error: any) {
      logger.error('Failed to open maps:', error);
      
      // CRITICAL: Try alternative methods
      try {
        // Try Apple Maps on iOS
        if (Platform.OS === 'ios') {
          const appleMapsUrl = `http://maps.apple.com/?daddr=${point.latitude},${point.longitude}`;
          const canOpen = await Linking.canOpenURL(appleMapsUrl);
          if (canOpen) {
            await Linking.openURL(appleMapsUrl);
            return;
          }
        }
        
        // Fallback: Show coordinates
        Alert.alert(
          'Yol Tarifi',
          `Harita uygulaması açılamadı. Koordinatlar:\n${point.latitude}, ${point.longitude}\n\nBu koordinatları harita uygulamanızda arayabilirsiniz.`,
          [
            { text: 'Tamam', style: 'default' },
            { 
              text: 'Tekrar Dene', 
              onPress: () => handleGetDirections(point)
            }
          ]
        );
      } catch (fallbackError) {
        logger.error('Fallback maps error:', fallbackError);
        Alert.alert(
          'Hata',
          'Harita uygulaması açılamadı. Lütfen manuel olarak harita uygulamanızı kullanın.',
          [{ text: 'Tamam' }]
        );
      }
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'park': return 'leaf';
      case 'stadium': return 'football';
      case 'school': return 'school';
      case 'community-center': return 'business';
      case 'emergency': return 'shield-checkmark';
      default: return 'location';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'park': return '#10b981';
      case 'stadium': return '#3b82f6';
      case 'school': return '#8b5cf6';
      case 'community-center': return '#f59e0b';
      case 'emergency': return '#ef4444';
      default: return colors.text.secondary;
    }
  };

  const getFacilityIcon = (facility: string) => {
    switch (facility) {
      case 'water': return 'water';
      case 'toilet': return 'restaurant';
      case 'medical': return 'medical';
      case 'food': return 'restaurant';
      case 'shelter': return 'home';
      default: return 'checkmark-circle';
    }
  };

  if (!hasAccess) {
    return (
      <PremiumGate
        featureName="Toplanma Noktaları Haritası"
        onUpgradePress={() => navigation?.navigate?.('Paywall')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Compact Header - No white card, transparent overlay */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.2)', 'transparent']}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <Pressable 
              style={styles.backButton}
              onPress={() => {
                haptics.impactLight();
                // CRITICAL: Navigation with error handling
                try {
                  if (navigation && typeof navigation.goBack === 'function') {
                    navigation.goBack();
                  } else {
                    logger.warn('Navigation goBack not available');
                  }
                } catch (error) {
                  logger.error('Navigation error:', error);
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Toplanma Noktaları</Text>
              <Text style={styles.headerSubtitle}>
                {points.filter(p => p.isActive).length} aktif nokta
              </Text>
            </View>
            
            <Pressable 
              style={styles.locateButton} 
              onPress={() => {
                haptics.impactLight();
                getUserLocation();
              }}
            >
              <Ionicons name="locate" size={20} color="#fff" />
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      {/* Sort Tabs - Professional Design */}
      <View style={[styles.tabContainer, { marginTop: insets.top + 60 }]}>
        <Pressable
          style={[styles.tab, sortBy === 'distance' && styles.tabActive]}
          onPress={() => {
            haptics.impactLight();
            setSortBy('distance');
          }}
        >
          <LinearGradient
            colors={sortBy === 'distance' 
              ? [colors.brand.primary + '20', colors.brand.primary + '10']
              : ['transparent', 'transparent']
            }
            style={styles.tabGradient}
          >
            <Ionicons 
              name="navigate" 
              size={18} 
              color={sortBy === 'distance' ? colors.brand.primary : colors.text.secondary} 
            />
            <Text style={[styles.tabText, sortBy === 'distance' && styles.tabTextActive]}>
              Mesafeye Göre
            </Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          style={[styles.tab, sortBy === 'capacity' && styles.tabActive]}
          onPress={() => {
            haptics.impactLight();
            setSortBy('capacity');
          }}
        >
          <LinearGradient
            colors={sortBy === 'capacity' 
              ? [colors.brand.primary + '20', colors.brand.primary + '10']
              : ['transparent', 'transparent']
            }
            style={styles.tabGradient}
          >
            <Ionicons 
              name="people" 
              size={18} 
              color={sortBy === 'capacity' ? colors.brand.primary : colors.text.secondary} 
            />
            <Text style={[styles.tabText, sortBy === 'capacity' && styles.tabTextActive]}>
              Kapasiteye Göre
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Map Placeholder - Professional Design */}
      <View style={styles.map}>
        <LinearGradient
          colors={[colors.background.tertiary, colors.background.secondary]}
          style={styles.mapGradient}
        >
          <View style={styles.mapPlaceholder}>
            <View style={styles.mapIconContainer}>
              <Ionicons name="map" size={48} color={colors.brand.primary} />
            </View>
            <Text style={styles.mapPlaceholderText}>Toplanma Noktaları Listesi</Text>
            <Text style={styles.mapPlaceholderSubtext}>
              Tüm toplanma noktaları aşağıda listelenmektedir
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* Points List */}
      <View style={styles.listContainer}>
        <ScrollView contentContainerStyle={styles.listContent}>
          {points.filter(p => p.isActive).map((point, index) => (
            <Animated.View
              key={point.id}
              entering={FadeInDown.delay(index * 50)}
            >
              <Pressable
                style={styles.pointCard}
                onPress={() => {
                  haptics.impactLight();
                  setSelectedPoint(selectedPoint?.id === point.id ? null : point);
                }}
              >
                <View style={styles.pointHeader}>
                  <View style={[styles.pointIcon, { backgroundColor: getTypeColor(point.type) + '20' }]}>
                    <Ionicons name={getTypeIcon(point.type) as keyof typeof Ionicons.glyphMap} size={24} color={getTypeColor(point.type)} />
                  </View>

                  <View style={styles.pointInfo}>
                    <Text style={styles.pointName}>{point.name}</Text>
                    <Text style={styles.pointAddress}>{point.address}</Text>
                    
                    <View style={styles.pointDetails}>
                      {point.distance !== undefined && (
                        <View style={styles.detailItem}>
                          <Ionicons name="navigate" size={14} color={colors.text.tertiary} />
                          <Text style={styles.detailText}>
                            {formatDistance(point.distance)}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.detailItem}>
                        <Ionicons name="people" size={14} color={colors.text.tertiary} />
                        <Text style={styles.detailText}>
                          ~{point.capacity.toLocaleString('tr-TR')} kişi
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Ionicons
                    name={selectedPoint?.id === point.id ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.text.tertiary}
                  />
                </View>

                {/* Expanded Details */}
                {selectedPoint?.id === point.id && (
                  <View style={styles.expandedDetails}>
                    <View style={styles.facilitiesContainer}>
                      <Text style={styles.facilitiesTitle}>Olanaklar:</Text>
                      <View style={styles.facilitiesList}>
                        {point.facilities.map((facility, idx) => (
                          <View key={idx} style={styles.facilityItem}>
                            <Ionicons name={getFacilityIcon(facility) as keyof typeof Ionicons.glyphMap} size={16} color={colors.status.success} />
                            <Text style={styles.facilityText}>
                              {facility === 'water' ? 'Su' :
                               facility === 'toilet' ? 'Tuvalet' :
                               facility === 'medical' ? 'Tıbbi Yardım' :
                               facility === 'food' ? 'Yiyecek' :
                               facility === 'shelter' ? 'Barınak' : facility}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <Pressable
                      style={styles.directionsButton}
                      onPress={() => {
                        haptics.impactMedium();
                        handleGetDirections(point);
                      }}
                    >
                      <LinearGradient
                        colors={[colors.brand.primary, colors.brand.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.directionsButtonGradient}
                      >
                        <Ionicons name="navigate" size={20} color="#fff" />
                        <Text style={styles.directionsButtonText}>Yol Tarifi Al</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={colors.brand.primary} />
        <Text style={styles.infoText}>
          Toplanma noktaları afet durumunda aktif hale gelir. Güncel bilgiler için yetkililere danışın.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerGradient: {
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  tabActive: {
    // Handled by gradient
  },
  tabText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  map: {
    height: 220,
    overflow: 'hidden',
  },
  mapGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mapIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  listContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  pointCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pointIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  pointInfo: {
    flex: 1,
  },
  pointName: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  pointAddress: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  pointDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  expandedDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  facilitiesContainer: {
    marginBottom: 12,
  },
  facilitiesTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  facilitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
  },
  facilityText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  directionsButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  directionsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  directionsButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    paddingBottom: Math.max(16, 16),
    backgroundColor: colors.brand.primary + '15',
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  infoText: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
});

