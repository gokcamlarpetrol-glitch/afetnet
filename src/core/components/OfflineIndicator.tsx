/**
 * OFFLINE INDICATOR - Network Status Banner
 * Shows user when they're offline - BLE mesh is still active
 * CRITICAL for disaster scenarios where network is down
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { colors } from '../theme';

import { useMeshStore } from '../services/mesh/MeshStore';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];
  const peerCount = useMeshStore(state => state.peers.length);

  useEffect(() => {
    // Subscribe to network state
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected || !state.isInternetReachable;
      // Force offline for dev if needed
      // setIsOffline(true); 
      setIsOffline(offline);

      if (offline) {
        // Show banner
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      } else {
        // Hide banner
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => unsubscribe();
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={20} color={colors.text.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Çevrimdışı Mod</Text>
          <Text style={styles.subtitle}>
            {peerCount > 0
              ? `BLE Mesh Aktif • ${peerCount} cihaz ile bağlantı kuruldu`
              : 'BLE Mesh Aktif • Etrafta cihaz aranıyor...'}
          </Text>
        </View>
        <View style={styles.bleIndicator}>
          <View style={styles.blePulse} />
          <Ionicons name="bluetooth" size={16} color={colors.accent.primary} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#f59e0b',
    paddingTop: 44, // Status bar height
    paddingBottom: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  bleIndicator: {
    position: 'relative',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blePulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent.primary,
    opacity: 0.3,
  },
});

