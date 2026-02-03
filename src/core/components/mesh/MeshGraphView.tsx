import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { useMeshStore } from '../../services/mesh/MeshStore';
import { colors } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CENTER_X = width / 2;
const CENTER_Y = 150;

/**
 * MESH GRAPH VIEW - ELITE VISUALIZATION
 * Shows the user at the center and peers orbiting around.
 * Lines represent connection strength.
 */
export const MeshGraphView = () => {
  const peers = useMeshStore(state => state.peers);
  const myId = useMeshStore(state => state.myDeviceId);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  // Layout Calculation
  // Place peers in a circle around the center
  const graphData = useMemo(() => {
    const radius = 100;
    return peers.map((peer, index) => {
      const angle = (index / peers.length) * 2 * Math.PI;
      const x = CENTER_X + radius * Math.cos(angle);
      const y = CENTER_Y + radius * Math.sin(angle);

      // Calculate signal quality color
      let color = colors.status.safe;
      if (peer.rssi < -85) color = colors.status.danger;
      else if (peer.rssi < -70) color = colors.status.warning;

      return { ...peer, x, y, color };
    });
  }, [peers]);

  if (peers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bluetooth-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>Etrafta cihaz aranıyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Svg height="300" width={width} style={StyleSheet.absoluteFill}>
        {/* Connection Lines */}
        {graphData.map((peer) => (
          <Line
            key={`line-${peer.id}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={peer.x}
            y2={peer.y}
            stroke={peer.color}
            strokeWidth="2"
            strokeOpacity="0.5"
            strokeDasharray={peer.rssi < -80 ? "5, 5" : ""}
          />
        ))}
      </Svg>

      {/* Center Node (Me) */}
      <View style={[styles.node, styles.centerNode]}>
        <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
        <Ionicons name="person" size={20} color="#FFF" />
      </View>

      {/* Peer Nodes */}
      {graphData.map((peer) => (
        <View key={peer.id} style={[styles.node, { left: peer.x - 20, top: peer.y - 20, borderColor: peer.color }]}>
          <Text style={styles.peerInitials}>
            {peer.name.substring(0, 2).toUpperCase()}
          </Text>
          <View style={[styles.rssiBadge, { backgroundColor: peer.color }]}>
            <Text style={styles.rssiText}>{peer.rssi}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  emptyContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: colors.text.secondary,
    fontSize: 14,
  },
  node: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  centerNode: {
    left: CENTER_X - 25, // Adjust for larger size
    top: CENTER_Y - 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.brand.primary,
    borderColor: '#FFF',
    zIndex: 10,
  },
  pulseCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.brand.primary,
    opacity: 0.2,
    zIndex: -1,
  },
  peerInitials: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  rssiBadge: {
    position: 'absolute',
    bottom: -5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
  },
  rssiText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
});
