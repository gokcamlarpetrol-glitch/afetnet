/**
 * ASSEMBLY POINTS MAP SCREEN
 * Real-time assembly point map with nearest points, directions, and offline support
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { usePremiumStore } from '../../stores/premiumStore';
import PremiumGate from '../../components/PremiumGate';
import { calculateDistance, formatDistance } from '../../utils/mapUtils';
import { createLogger } from '../../utils/logger';
import { offlineMapService, MapLocation } from '../../services/OfflineMapService';
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
  isSample?: boolean;
}

const mapLocationToAssemblyPoint = (loc: MapLocation): AssemblyPoint => ({
  id: loc.id,
  name: loc.name,
  latitude: loc.latitude,
  longitude: loc.longitude,
  address: loc.address,
  capacity: loc.capacity || 0,
  facilities: [],
  type:
    loc.type === 'assembly'
      ? 'park'
      : loc.type === 'home'
      ? 'park'
      : loc.type === 'shelter' || loc.type === 'hospital'
      ? 'emergency'
      : 'park',
  isActive: true,
  isSample: !!loc.isSample,
});

export default function AssemblyPointsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  // CRITICAL: Read premium status from store (includes trial check)
  // Trial aktifken isPremium otomatik olarak true olur (syncPremiumAccess tarafından)
  const isPremium = usePremiumStore((state) => state.isPremium);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [basePoints, setBasePoints] = useState<AssemblyPoint[]>([]);
  const [points, setPoints] = useState<AssemblyPoint[]>([]);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<AssemblyPoint | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'capacity'>('distance');
  const [showAddButton, setShowAddButton] = useState(true);

  useEffect(() => {
    getUserLocation();
    loadAssemblyPoints();
    
    const unsubscribe = navigation.addListener?.('focus', () => {
      loadAssemblyPoints();
    });
    
    return () => {
      unsubscribe?.();
    };
  }, [navigation, loadAssemblyPoints]);

  const loadAssemblyPoints = useCallback(() => {
    try {
      const official = offlineMapService.getAllLocations().filter(loc => loc.type === 'assembly');
      const custom = offlineMapService.getCustomLocations().filter(loc => loc.type === 'assembly');
      const combined = [...official, ...custom].map(mapLocationToAssemblyPoint);
      setBasePoints(combined);
      setUsingSampleData(offlineMapService.isUsingSampleData());
    } catch (error) {
      logger.error('Failed to load assembly locations:', error);
    }
  }, []);

  useEffect(() => {
    try {
      const enriched = basePoints.map(point => {
        if (!userLocation) {
          return { ...point, distance: undefined };
        }
        try {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            point.latitude,
            point.longitude
          );
          return {
            ...point,
            distance: Number.isFinite(distance) ? distance : undefined,
          };
        } catch (error) {
          logger.error(`Distance calculation error for point ${point.id}:`, error);
          return { ...point, distance: undefined };
        }
      });

      const sorted = enriched.sort((a, b) => {
        if (sortBy === 'distance') {
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
        }
        return b.capacity - a.capacity;
      });

      setPoints(sorted);
    } catch (error) {
      logger.error('Points processing error:', error);
      setPoints(basePoints);
    }
  }, [basePoints, userLocation, sortBy]);

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

  // ELITE: Handle add button
  const handleAddLocation = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('AddAssemblyPoint');
    } catch (error) {
      logger.error('Error navigating to AddAssemblyPoint:', error);
    }
  }, [navigation]);

  // ELITE: Handle edit location
  const handleEditLocation = useCallback((point: AssemblyPoint) => {
    try {
      // Check if it's a custom location
      if (point.id.startsWith('custom-')) {
        haptics.impactMedium();
        navigation.navigate('AddAssemblyPoint', {
          editLocationId: point.id,
        });
      }
    } catch (error) {
      logger.error('Error navigating to edit:', error);
    }
  }, [navigation]);

  // ELITE: Handle delete location
  const handleDeleteLocation = useCallback(async (pointId: string) => {
    if (!pointId.startsWith('custom-')) {
      Alert.alert('Hata', 'Resmi toplanma noktaları silinemez.');
      return;
    }

    const point = points.find(p => p.id === pointId);
    const pointName = point?.name || 'Konum';

    Alert.alert(
      'Konumu Sil',
      `${pointName} adlı konumu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      [
        { 
          text: 'İptal', 
          style: 'cancel',
          onPress: () => haptics.impactLight(),
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await offlineMapService.removeCustomLocation(pointId);
              if (success) {
                haptics.notificationSuccess();
                loadAssemblyPoints();
                Alert.alert('Başarılı', `${pointName} başarıyla silindi.`);
              } else {
                throw new Error('Failed to delete');
              }
            } catch (error) {
              logger.error('Failed to delete location:', error);
              Alert.alert('Hata', 'Konum silinirken bir hata oluştu.');
              haptics.notificationError();
            }
          },
        },
      ]
    );
  }, [points, loadAssemblyPoints]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
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
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Toplanma Noktaları</Text>
          <Text style={styles.headerSubtitle}>
            {points.filter(p => p.isActive).length} aktif nokta
          </Text>
        </View>
        <Pressable style={styles.headerButton} onPress={getUserLocation}>
          <Ionicons name="locate" size={20} color={colors.brand.primary} />
        </Pressable>
      </View>

      {usingSampleData && (
        <View style={styles.sampleNotice}>
          <Ionicons name="information-circle" size={16} color="#fbbf24" style={{ marginRight: 8 }} />
          <Text style={styles.sampleNoticeText}>
            Bu liste örnek veriler içeriyor. Bölgenize özel toplanma noktaları yakında eklenecek.
          </Text>
        </View>
      )}

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

      {/* Add Button */}
      <View style={styles.addButtonContainer}>
        <Pressable style={styles.addButton} onPress={handleAddLocation}>
          <LinearGradient
            colors={[colors.brand.primary, colors.brand.secondary]}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Yeni Konum Ekle</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Points List */}
      <View style={styles.listContainer}>
        <ScrollView contentContainerStyle={styles.listContent}>
          {points.filter(p => p.isActive).map((point, index) => {
            const isCustom = point.id.startsWith('custom-');
            return (
              <Animated.View
                key={point.id}
                entering={FadeInDown.delay(index * 50)}
              >
                <Pressable
                  style={styles.pointCard}
                  onPress={() => setSelectedPoint(selectedPoint?.id === point.id ? null : point)}
                  onLongPress={() => {
                    if (isCustom) {
                      haptics.impactMedium();
                      Alert.alert(
                        point.name,
                        'Ne yapmak istersiniz?',
                        [
                          { text: 'İptal', style: 'cancel' },
                          {
                            text: 'Düzenle',
                            onPress: () => handleEditLocation(point),
                          },
                          {
                            text: 'Sil',
                            style: 'destructive',
                            onPress: () => handleDeleteLocation(point.id),
                          },
                        ]
                      );
                    }
                  }}
                >
                  {isCustom && (
                    <View style={styles.customBadge}>
                      <Ionicons name="star" size={12} color={colors.brand.primary} />
                      <Text style={styles.customBadgeText}>Özel</Text>
                    </View>
                  )}
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
            );
          })}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerButton: {
    padding: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
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
  sampleNotice: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sampleNoticeText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 12,
    lineHeight: 16,
  },
  addButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  addButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  customBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.brand.primary + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  customBadgeText: {
    ...typography.small,
    color: colors.brand.primary,
    fontWeight: '700',
    fontSize: 10,
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
