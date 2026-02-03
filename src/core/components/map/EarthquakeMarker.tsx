import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { getMagnitudeColor, getMagnitudeSize } from '../../utils/mapUtils';

interface EarthquakeMarkerProps {
  magnitude: number;
  selected?: boolean;
}

// Memoized for performance
export const EarthquakeMarker = memo(function EarthquakeMarker({ magnitude, selected = false }: EarthquakeMarkerProps) {
  const pulse = useSharedValue(1);
  const scale = useSharedValue(selected ? 1.2 : 1);
  const size = getMagnitudeSize(magnitude);
  const color = getMagnitudeColor(magnitude);

  useEffect(() => {
    // Pulse animation for all markers
    // Optimization: Only pulse significant earthquakes or if selected to save resources
    if (magnitude >= 4.0 || selected) {
      pulse.value = withRepeat(
        withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = 1; // Reset if not pulsing
    }

    // Scale animation when selected
    scale.value = withTiming(selected ? 1.2 : 1, { duration: 200 });
  }, [selected, magnitude]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.3,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, animatedStyle]}>
      {/* Pulse ring for high magnitude or selected */}
      {(magnitude >= 4.0 || selected) && (
        <Animated.View
          style={[
            styles.pulseRing,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
            pulseStyle,
          ]}
        />
      )}

      {/* Main marker */}
      <LinearGradient
        colors={[color, color + 'CC']}
        style={[styles.marker, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={[styles.magnitudeText, { fontSize: size > 30 ? 14 : 10 }]}>
          {magnitude.toFixed(1)}
        </Text>
      </LinearGradient>

      {/* Selection ring */}
      {selected && (
        <View
          style={[
            styles.selectionRing,
            { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderColor: color },
          ]}
        />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  marker: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  magnitudeText: {
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  selectionRing: {
    position: 'absolute',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
});
