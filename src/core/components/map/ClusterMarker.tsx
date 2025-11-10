/**
 * CLUSTER MARKER
 * Displays clustered markers on the map
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Cluster } from '../../utils/markerClustering';

interface Props {
  cluster: Cluster;
  onPress?: (cluster: Cluster) => void;
}

export default function ClusterMarker({ cluster, onPress }: Props) {
  // Size based on count
  const size = Math.min(50 + cluster.count * 2, 80);
  
  // Color based on count
  const getColors = (count: number): [string, string] => {
    if (count > 50) return ['#dc2626', '#991b1b'];
    if (count > 20) return ['#f59e0b', '#d97706'];
    if (count > 10) return ['#3b82f6', '#2563eb'];
    return ['#10b981', '#059669'];
  };

  const colors = getColors(cluster.count);

  return (
    <Marker
      coordinate={{
        latitude: cluster.latitude,
        longitude: cluster.longitude,
      }}
      onPress={() => onPress?.(cluster)}
      tracksViewChanges={false}
    >
      <View style={[styles.container, { width: size, height: size }]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={[styles.text, { fontSize: size > 60 ? 18 : 14 }]}>
            {cluster.count}
          </Text>
        </LinearGradient>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    color: '#ffffff',
  },
});


