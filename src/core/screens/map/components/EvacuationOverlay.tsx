import React, { useMemo } from 'react';
import { Polyline, Marker } from 'react-native-maps';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMapStore } from '../../../stores/mapStore';
import { offlineMapService } from '../../../services/OfflineMapService';
import { calculateDistance } from '../../../utils/mapUtils';
import { colors } from '../../../theme';

interface Props {
    userLocation: { latitude: number; longitude: number } | null;
}

export const EvacuationOverlay = ({ userLocation }: Props) => {
  const mode = useMapStore((state) => state.mode);

  // Find nearest 3 assembly points
  const nearestAssemblyPoints = useMemo(() => {
    if (!userLocation) return [];

    const assemblyPoints = offlineMapService.getAllLocations().filter(l => l.type === 'assembly');

    return assemblyPoints
      .map(point => ({
        ...point,
        distance: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          point.latitude,
          point.longitude,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }, [userLocation]);

  // Only show in evacuation mode
  if (mode !== 'evacuation' || !userLocation) return null;

  return (
    <>
      {nearestAssemblyPoints.map((point, index) => (
        <View key={`route-${point.id}`}>
          {/* Route Line */}
          <Polyline
            coordinates={[
              userLocation,
              { latitude: point.latitude, longitude: point.longitude },
            ]}
            strokeColor={index === 0 ? colors.status.success : colors.status.warning} // Green for nearest
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />

          {/* Distance Badge on Line Midpoint */}
          <Marker
            coordinate={{
              latitude: (userLocation.latitude + point.latitude) / 2,
              longitude: (userLocation.longitude + point.longitude) / 2,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[
              styles.distanceBadge,
              { backgroundColor: index === 0 ? colors.status.success : colors.status.warning },
            ]}>
              <Text style={styles.distanceText}>
                {point.distance < 1 ?
                  `${Math.round(point.distance * 1000)}m` :
                  `${point.distance.toFixed(1)}km`
                }
              </Text>
            </View>
          </Marker>
        </View>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  distanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  distanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
