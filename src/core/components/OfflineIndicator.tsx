/**
 * OFFLINE INDICATOR - Network Status Banner
 * Shows user when they're offline - BLE mesh is still active
 * CRITICAL for disaster scenarios where network is down
 *
 * K3 enhancement: when network is offline AND mesh is ALSO unavailable
 * (BLE off / permission denied), the banner explicitly tells the user
 * mesh isn't an option either — so they can act (enable Bluetooth, allow
 * permission) instead of being stranded thinking mesh has their back.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

import { useMeshStore } from '../services/mesh/MeshStore';

export default function OfflineIndicator() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];
  const peerCount = useMeshStore(state => state.peers.length);
  // K3: surface mesh availability so we can downgrade messaging from
  // "BLE Mesh Aktif" to "Mesh kullanılamıyor" when BLE itself is dead.
  const meshUnavailableReason = useMeshStore(state => state.meshUnavailableReason);

  useEffect(() => {
    // Subscribe to network state
    const unsubscribe = NetInfo.addEventListener((state) => {
      // CRITICAL FIX: On iOS, isInternetReachable is `null` during initial check.
      // Treating null as offline causes a false offline banner flash on every launch.
      // Only treat as offline when explicitly `false`, not `null`.
      const offline = state.isConnected === false || state.isInternetReachable === false;
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
  }, [slideAnim]);

  if (!isOffline) {
    return null;
  }

  // K3: pick subtitle by combined network + mesh availability.
  const meshIsAvailable = meshUnavailableReason === null;
  let subtitleText: string;
  if (!meshIsAvailable) {
    // BLE itself is down — most actionable message wins.
    switch (meshUnavailableReason) {
      case 'no-permission':
        subtitleText = 'Mesh ağı kullanılamıyor — Bluetooth izni gerekli (Ayarlar)';
        break;
      case 'bluetooth-off':
        subtitleText = 'Mesh ağı kullanılamıyor — Bluetooth açık mı?';
        break;
      case 'unsupported':
        subtitleText = 'Mesh ağı bu cihazda desteklenmiyor';
        break;
      default:
        subtitleText = 'Mesh ağı kullanılamıyor';
    }
  } else if (peerCount > 0) {
    subtitleText = `BLE Mesh Aktif • ${peerCount} cihaz ile bağlantı kuruldu`;
  } else {
    subtitleText = 'BLE Mesh Aktif • Etrafta cihaz aranıyor...';
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={20} color={colors.text.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Çevrimdışı Mod</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
        </View>
        <View style={styles.bleIndicator}>
          {meshIsAvailable && <View style={styles.blePulse} />}
          <Ionicons
            name={meshIsAvailable ? 'bluetooth' : 'bluetooth-outline'}
            size={16}
            color={meshIsAvailable ? colors.accent.primary : colors.text.tertiary}
          />
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
    paddingTop: 44, // Overridden inline with safe area insets
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

