/**
 * DISASTER MAP SCREEN
 * Real-time disaster map with active events, impact zones, and user reports
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useEarthquakeStore } from '../../stores/earthquakeStore';
import { usePremiumStore } from '../../stores/premiumStore';
import PremiumGate from '../../components/PremiumGate';
import { getMagnitudeColor, getMagnitudeSize, calculateDistance, formatDistance } from '../../utils/mapUtils';
import { createLogger } from '../../utils/logger';

const logger = createLogger('DisasterMapScreen');

interface DisasterEvent {
  id: string;
  type: 'earthquake' | 'flood' | 'fire' | 'landslide' | 'tsunami';
  latitude: number;
  longitude: number;
  magnitude?: number;
  intensity?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportedAt: number;
  source: string;
  description?: string;
  impactRadius?: number; // km
}

interface ImpactZone {
  center: { lat: number; lng: number };
  radius: number; // km
  intensity: number; // 1-10
  expectedDamage: 'severe' | 'moderate' | 'light' | 'minimal';
  population: number;
}

const TURKEY_CENTER = {
  latitude: 39.0,
  longitude: 35.0,
  latitudeDelta: 10,
  longitudeDelta: 10,
};

export default function DisasterMapScreen({ navigation }: any) {
  // CRITICAL: Read premium status from store (includes trial check)
  // Trial aktifken isPremium otomatik olarak true olur (syncPremiumAccess tarafından)
  const isPremium = usePremiumStore((state) => state.isPremium);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [disasterEvents, setDisasterEvents] = useState<DisasterEvent[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DisasterEvent | null>(null);
  const [showImpactZones, setShowImpactZones] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const eqData = useEarthquakeStore.getState().items;
      setEarthquakes(eqData);
      
      // Convert earthquakes to disaster events
      const events: DisasterEvent[] = eqData.map(eq => ({
        id: eq.id,
        type: 'earthquake' as const,
        latitude: eq.latitude,
        longitude: eq.longitude,
        magnitude: eq.magnitude,
        severity: eq.magnitude >= 6.0 ? 'critical' : 
                 eq.magnitude >= 5.0 ? 'high' : 
                 eq.magnitude >= 4.0 ? 'medium' : 'low',
        reportedAt: eq.time,
        source: eq.source,
        description: eq.location,
        impactRadius: eq.magnitude * 10, // Rough estimate: 10km per magnitude
      }));
      
      setDisasterEvents(events);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    getUserLocation();
  }, []);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Harita için konum izni gereklidir');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      logger.error('Location error:', error);
    }
  };

  const handleEventPress = (event: DisasterEvent) => {
    setSelectedEvent(event);
  };

  const getImpactZones = (event: DisasterEvent): ImpactZone[] => {
    if (event.type !== 'earthquake' || !event.magnitude) return [];

    const zones: ImpactZone[] = [];
    const magnitude = event.magnitude;

    // Severe zone (inner)
    zones.push({
      center: { lat: event.latitude, lng: event.longitude },
      radius: magnitude * 5, // 5km per magnitude
      intensity: Math.min(10, magnitude + 2),
      expectedDamage: 'severe',
      population: Math.round(magnitude * 50000),
    });

    // Moderate zone (middle)
    zones.push({
      center: { lat: event.latitude, lng: event.longitude },
      radius: magnitude * 15, // 15km per magnitude
      intensity: Math.min(9, magnitude + 1),
      expectedDamage: 'moderate',
      population: Math.round(magnitude * 150000),
    });

    // Light zone (outer)
    zones.push({
      center: { lat: event.latitude, lng: event.longitude },
      radius: magnitude * 30, // 30km per magnitude
      intensity: Math.min(7, magnitude),
      expectedDamage: 'light',
      population: Math.round(magnitude * 300000),
    });

    return zones;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'earthquake': return 'pulse';
      case 'flood': return 'water';
      case 'fire': return 'flame';
      case 'landslide': return 'triangle';
      case 'tsunami': return 'water';
      default: return 'alert-circle';
    }
  };

  const getEventColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#DC143C';
      case 'high': return '#FF4500';
      case 'medium': return '#FFA500';
      case 'low': return '#FFD700';
      default: return colors.text.secondary;
    }
  };

  const filteredEvents = filterType 
    ? disasterEvents.filter(e => e.type === filterType)
    : disasterEvents;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Aktif Afet Haritası</Text>
          <Text style={styles.headerSubtitle}>
            {disasterEvents.length} aktif olay • {earthquakes.length} deprem
          </Text>
        </View>
        
        <View style={styles.headerButtons}>
          <Pressable 
            style={[styles.headerButton, showImpactZones && styles.headerButtonActive]}
            onPress={() => setShowImpactZones(!showImpactZones)}
          >
            <Ionicons name="layers" size={20} color={showImpactZones ? colors.brand.primary : colors.text.primary} />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={getUserLocation}>
            <Ionicons name="locate" size={20} color={colors.brand.primary} />
          </Pressable>
        </View>
      </View>

      {/* Filter Bar */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        <Pressable
          style={[styles.filterChip, !filterType && styles.filterChipActive]}
          onPress={() => setFilterType(null)}
        >
          <Text style={[styles.filterChipText, !filterType && styles.filterChipTextActive]}>
            Tümü
          </Text>
        </Pressable>
        
        <Pressable
          style={[styles.filterChip, filterType === 'earthquake' && styles.filterChipActive]}
          onPress={() => setFilterType('earthquake')}
        >
          <Ionicons name="pulse" size={16} color={filterType === 'earthquake' ? '#fff' : colors.text.secondary} />
          <Text style={[styles.filterChipText, filterType === 'earthquake' && styles.filterChipTextActive]}>
            Deprem
          </Text>
        </Pressable>
        
        <Pressable
          style={[styles.filterChip, filterType === 'flood' && styles.filterChipActive]}
          onPress={() => setFilterType('flood')}
        >
          <Ionicons name="water" size={16} color={filterType === 'flood' ? '#fff' : colors.text.secondary} />
          <Text style={[styles.filterChipText, filterType === 'flood' && styles.filterChipTextActive]}>
            Sel
          </Text>
        </Pressable>
        
        <Pressable
          style={[styles.filterChip, filterType === 'fire' && styles.filterChipActive]}
          onPress={() => setFilterType('fire')}
        >
          <Ionicons name="flame" size={16} color={filterType === 'fire' ? '#fff' : colors.text.secondary} />
          <Text style={[styles.filterChipText, filterType === 'fire' && styles.filterChipTextActive]}>
            Yangın
          </Text>
        </Pressable>
      </ScrollView>

      {/* Map Placeholder */}
      <View style={styles.map}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={64} color={colors.text.tertiary} />
          <Text style={styles.mapPlaceholderText}>Aktif Afet Haritası</Text>
          <Text style={styles.mapPlaceholderSubtext}>
            Offline harita desteği yakında aktif olacak
          </Text>
        </View>

        {/* Event List */}
        <ScrollView style={styles.eventList} contentContainerStyle={styles.eventListContent}>
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyStateText}>Aktif afet yok</Text>
              <Text style={styles.emptyStateSubtext}>Tüm bölgeler güvende</Text>
            </View>
          ) : (
            filteredEvents.map((event) => {
              const zones = getImpactZones(event);
              const distance = userLocation 
                ? calculateDistance(userLocation.latitude, userLocation.longitude, event.latitude, event.longitude)
                : null;

              return (
                <Pressable
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => handleEventPress(event)}
                >
                  <View style={[styles.eventIcon, { backgroundColor: getEventColor(event.severity) + '20' }]}>
                    <Ionicons 
                      name={getEventIcon(event.type)} 
                      size={24} 
                      color={getEventColor(event.severity)} 
                    />
                  </View>

                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>
                        {event.type === 'earthquake' 
                          ? `${event.magnitude?.toFixed(1)} ML Deprem`
                          : event.type === 'flood' ? 'Sel'
                          : event.type === 'fire' ? 'Yangın'
                          : event.type === 'landslide' ? 'Heyelan'
                          : 'Tsunami'}
                      </Text>
                      <View style={[styles.severityBadge, { backgroundColor: getEventColor(event.severity) }]}>
                        <Text style={styles.severityText}>
                          {event.severity === 'critical' ? 'KRİTİK' :
                           event.severity === 'high' ? 'YÜKSEK' :
                           event.severity === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.eventDescription}>{event.description || event.source}</Text>

                    <View style={styles.eventDetails}>
                      <View style={styles.eventDetailItem}>
                        <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                        <Text style={styles.eventDetailText}>
                          {new Date(event.reportedAt).toLocaleString('tr-TR')}
                        </Text>
                      </View>

                      {distance !== null && (
                        <View style={styles.eventDetailItem}>
                          <Ionicons name="navigate-outline" size={14} color={colors.text.tertiary} />
                          <Text style={styles.eventDetailText}>
                            {formatDistance(distance)} uzaklıkta
                          </Text>
                        </View>
                      )}

                      {event.impactRadius && (
                        <View style={styles.eventDetailItem}>
                          <Ionicons name="radio-button-on-outline" size={14} color={colors.text.tertiary} />
                          <Text style={styles.eventDetailText}>
                            {event.impactRadius.toFixed(0)}km etki alanı
                          </Text>
                        </View>
                      )}
                    </View>

                    {showImpactZones && zones.length > 0 && (
                      <View style={styles.zonesContainer}>
                        <Text style={styles.zonesTitle}>Etki Zonları:</Text>
                        {zones.map((zone, index) => (
                          <View key={index} style={styles.zoneItem}>
                            <View style={[
                              styles.zoneDot,
                              { backgroundColor: zone.expectedDamage === 'severe' ? '#DC143C' :
                                                zone.expectedDamage === 'moderate' ? '#FF4500' :
                                                zone.expectedDamage === 'light' ? '#FFA500' : '#FFD700' }
                            ]} />
                            <Text style={styles.zoneText}>
                              {zone.expectedDamage === 'severe' ? 'Ağır' :
                               zone.expectedDamage === 'moderate' ? 'Orta' :
                               zone.expectedDamage === 'light' ? 'Hafif' : 'Minimal'} hasar
                              {' • '}{zone.radius.toFixed(0)}km yarıçap
                              {' • '}~{zone.population.toLocaleString('tr-TR')} kişi
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Selected Event Info */}
      {selectedEvent && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View>
              <Text style={styles.infoTitle}>
                {selectedEvent.type === 'earthquake' 
                  ? `${selectedEvent.magnitude?.toFixed(1)} ML Deprem`
                  : selectedEvent.type}
              </Text>
              <Text style={styles.infoLocation}>{selectedEvent.description || selectedEvent.source}</Text>
            </View>
            <Pressable onPress={() => setSelectedEvent(null)}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </Pressable>
          </View>

          <View style={styles.infoDetails}>
            <View style={styles.infoDetailRow}>
              <View style={styles.infoDetailItem}>
                <Ionicons name="time-outline" size={16} color={colors.text.tertiary} />
                <Text style={styles.infoDetailText}>
                  {new Date(selectedEvent.reportedAt).toLocaleString('tr-TR')}
                </Text>
              </View>

              <View style={styles.infoDetailItem}>
                <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
                <Text style={styles.infoDetailText}>{selectedEvent.source}</Text>
              </View>
            </View>

            {userLocation && (
              <View style={styles.infoDetailItem}>
                <Ionicons name="navigate-outline" size={16} color={colors.text.tertiary} />
                <Text style={styles.infoDetailText}>
                  Mesafe: {formatDistance(
                    calculateDistance(
                      userLocation.latitude,
                      userLocation.longitude,
                      selectedEvent.latitude,
                      selectedEvent.longitude
                    )
                  )}
                </Text>
              </View>
            )}

            {selectedEvent.impactRadius && (
              <View style={styles.infoDetailItem}>
                <Ionicons name="radio-button-on-outline" size={16} color={colors.text.tertiary} />
                <Text style={styles.infoDetailText}>
                  Etki yarıçapı: {selectedEvent.impactRadius.toFixed(0)} km
                </Text>
              </View>
            )}
          </View>

          <Pressable 
            style={styles.reportButton}
            onPress={() => {
              // Navigate to user reports screen (ReportDisaster screen not implemented yet)
              navigation.navigate('UserReports');
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.brand.primary} />
            <Text style={styles.reportButtonText}>Bu olayı raporla</Text>
          </Pressable>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Şiddet</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#DC143C' }]} />
            <Text style={styles.legendText}>Kritik</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF4500' }]} />
            <Text style={styles.legendText}>Yüksek</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFA500' }]} />
            <Text style={styles.legendText}>Orta</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFD700' }]} />
            <Text style={styles.legendText}>Düşük</Text>
          </View>
        </View>
      </View>

      {/* Premium Gate */}
      {!isPremium && (
        <PremiumGate
          featureName="Aktif Afet Haritası"
          onUpgradePress={() => navigation?.navigate?.('Paywall')}
        />
      )}
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonActive: {
    backgroundColor: colors.brand.primary + '20',
  },
  filterBar: {
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  filterBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: colors.background.tertiary,
    gap: 4,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.brand.primary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  map: {
    flex: 1,
    position: 'relative',
  },
  mapPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
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
  eventList: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '60%',
    backgroundColor: colors.background.secondary + 'F0',
  },
  eventListContent: {
    padding: 12,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    ...typography.h4,
    color: colors.text.primary,
    marginTop: 12,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginBottom: 8,
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  severityText: {
    ...typography.small,
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
  },
  eventDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  eventDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventDetailText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  zonesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  zonesTitle: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  infoCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  infoLocation: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  infoDetails: {
    gap: 8,
    marginBottom: 12,
  },
  infoDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoDetailText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.brand.primary + '20',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  reportButtonText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    top: 140,
    right: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  legendTitle: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  legendItems: {
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fff',
  },
  legendText: {
    ...typography.small,
    color: colors.text.secondary,
  },
});

