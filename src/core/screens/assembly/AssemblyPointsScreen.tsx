/**
 * ASSEMBLY POINTS MAP SCREEN
 * Real-time assembly point map with nearest points, directions, and offline support
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { usePremiumStore } from '../../stores/premiumStore';
import PremiumGate from '../../components/PremiumGate';
import { calculateDistance, formatDistance } from '../../utils/mapUtils';
import { createLogger } from '../../utils/logger';

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
  // CRITICAL: Read premium status from store (includes trial check)
  // Trial aktifken isPremium otomatik olarak true olur (syncPremiumAccess tarafından)
  const isPremium = usePremiumStore((state) => state.isPremium);
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

  if (!isPremium) {
    return (
      <PremiumGate
        featureName="Toplanma Noktaları Haritası"
        onUpgradePress={() => navigation?.navigate?.('Paywall')}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
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
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View>
          <Text style={styles.headerSubtitle}>
            {points.filter(p => p.isActive).length} aktif nokta
          </Text>
        </View>
        <Pressable style={styles.locateButton} onPress={getUserLocation}>
          <Ionicons name="locate" size={20} color={colors.brand.primary} />
        </Pressable>
      </View>

      {/* Sort Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, sortBy === 'distance' && styles.tabActive]}
          onPress={() => setSortBy('distance')}
        >
          <Ionicons name="navigate" size={16} color={sortBy === 'distance' ? colors.brand.primary : colors.text.secondary} />
          <Text style={[styles.tabText, sortBy === 'distance' && styles.tabTextActive]}>
            Mesafeye Göre
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, sortBy === 'capacity' && styles.tabActive]}
          onPress={() => setSortBy('capacity')}
        >
          <Ionicons name="people" size={16} color={sortBy === 'capacity' ? colors.brand.primary : colors.text.secondary} />
          <Text style={[styles.tabText, sortBy === 'capacity' && styles.tabTextActive]}>
            Kapasiteye Göre
          </Text>
        </Pressable>
      </View>

      {/* Map Placeholder */}
      <View style={styles.map}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={64} color={colors.text.tertiary} />
          <Text style={styles.mapPlaceholderText}>Toplanma Noktaları Haritası</Text>
          <Text style={styles.mapPlaceholderSubtext}>
            Offline harita desteği yakında aktif olacak
          </Text>
        </View>
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
                onPress={() => setSelectedPoint(selectedPoint?.id === point.id ? null : point)}
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
                      onPress={() => handleGetDirections(point)}
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
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  locateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.brand.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  map: {
    height: 250,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    alignItems: 'center',
  },
  mapPlaceholderText: {
    ...typography.h4,
    color: colors.text.secondary,
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
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
    marginBottom: 8,
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pointIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 8,
    padding: 12,
    backgroundColor: colors.brand.primary + '20',
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  infoText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
});

