/**
 * CLUSTER MARKER
 * Visual component for aggregated map points.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors } from '../../theme';
import { Cluster } from '../../utils/markerClustering';

interface Props {
  cluster: Cluster;
  onPress: (cluster: Cluster) => void;
}

export const ClusterMarker: React.FC<Props> = ({ cluster, onPress }) => {
  const count = cluster.point_count || 0;
  const coordinate = {
    latitude: cluster.latitude,
    longitude: cluster.longitude,
  };
  // Determine size/color based on count
  const size = count > 100 ? 50 : count > 20 ? 40 : 30;
  const color = count > 100 ? '#ef4444' : count > 20 ? '#f97316' : '#3b82f6';

  return (
    <Marker coordinate={coordinate} onPress={() => onPress(cluster)}>
      <View style={[styles.clusterContainer, { width: size, height: size, backgroundColor: color }]}>
        <Text style={styles.clusterText}>{count}</Text>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  clusterContainer: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
