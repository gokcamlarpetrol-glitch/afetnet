/**
 * HOME HEADER - ELITE EDITION
 * Status indicators with subtle pulse animations.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '../../../components/SafeBlurView';
import { useMeshStore } from '../../../stores/meshStore';
import { bleMeshService } from '../../../services/BLEMeshService';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../../../theme';

export default function HomeHeader() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Greeting Logic
  const hour = new Date().getHours();
  let greetingText = 'İyi Günler';
  if (hour < 6) greetingText = 'İyi Geceler';
  else if (hour < 12) greetingText = 'Günaydın';
  else if (hour > 18) greetingText = 'İyi Akşamlar';

  // Real Data
  const meshPeers = useMeshStore((state) => state.peers);
  const isMeshRunning = bleMeshService.getIsRunning();
  const peerCount = Object.keys(meshPeers).length;

  // Status Pulse Animation
  const statusOpacity = useSharedValue(0.5);

  useEffect(() => {
    statusOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.5, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStatusStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>AFETNET</Text>
          <Text style={styles.subtitle}>TRUSTED SURVIVAL SYSTEM</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {/* Mesh Status Icon */}
          <TouchableOpacity
            onPress={() => navigation.navigate('MeshNetwork')}
            style={styles.meshButton}
          >
            <Ionicons
              name={isMeshRunning ? "radio" : "radio-outline"}
              size={20}
              color={isMeshRunning ? "#10B981" : colors.text.secondary}
            />
            {isMeshRunning && (
              <View style={styles.activeDot} />
            )}
          </TouchableOpacity>

          <View style={styles.rightSide}>
            <Text style={styles.welcomeText}>
              {greetingText}, <Text style={styles.userName}>Gökhan</Text>
            </Text>
            <View style={styles.locationContainer}>
              <Text style={styles.locationText}>
                İstanbul • <Text style={styles.riskText}>Risk Düşük</Text>
              </Text>
            </View>
          </View>
        </View>
      </View>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8, // Reduced from 24
    marginTop: -10, // Pull up closer to status bar
  },
  greeting: {
    fontSize: 32,
    fontWeight: '300', // Slightly thicker than 200 for navy on cream
    color: colors.text.primary, // Navy
    letterSpacing: 2,
    fontVariant: ['small-caps'],
    // Removed shadows for cleaner look
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary, // Slate 600
    letterSpacing: 3,
    marginTop: 6,
    opacity: 0.8,
  },
  rightSide: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 4,
  },
  welcomeText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  riskText: {
    color: '#10B981',
    fontWeight: '600',
  },
  statusContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)', // Gentle border
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Light glass
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statusBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // Removed heavy shadows from dot
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary, // Navy
    letterSpacing: 1,
  },
  divider: {
    marginHorizontal: 20,
  },
  meshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)',
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#fff',
  },
});
