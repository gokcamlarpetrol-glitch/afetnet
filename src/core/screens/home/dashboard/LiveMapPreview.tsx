import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../../../theme';

interface LiveMapPreviewProps {
    onPress: () => void;
}

export const LiveMapPreview: React.FC<LiveMapPreviewProps> = ({ onPress }) => {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.container}>
      <View style={styles.mapContainer}>
        {/* Placeholder for actual MapView - using a dark gradient/image for now to simulate "Elite" look without heavy map load */}
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mapBackground}
        >
          {/* Grid lines to simulate tactical map */}
          <View style={styles.gridLineVertical} />
          <View style={styles.gridLineHorizontal} />

          {/* Pulse effect for user location */}
          <View style={styles.userLocation}>
            <View style={styles.pulseRing} />
            <View style={styles.userDot} />
          </View>

          {/* Simulated Fault Lines */}
          <View style={styles.faultLine} />
        </LinearGradient>

        {/* Overlay Info */}
        <View style={styles.overlay}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE SEISMIC DATA</Text>
          </View>

          <View style={styles.expandButton}>
            <Ionicons name="expand" size={16} color="#FFF" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 280,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 24,
    ...shadows.medium,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0F172A',
  },
  mapBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLineVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    left: '50%',
  },
  gridLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    top: '50%',
  },
  userLocation: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  faultLine: {
    position: 'absolute',
    width: 200,
    height: 2,
    backgroundColor: '#EF4444',
    opacity: 0.4,
    transform: [{ rotate: '45deg' }, { translateY: 40 }],
  },
  overlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
