/**
 * STORAGE WARNING BANNER
 * Shows persistent warning when storage is low
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { storageManagementService } from '../services/StorageManagementService';
import { colors, typography } from '../theme';
import * as haptics from '../utils/haptics';

export default function StorageWarningBanner() {
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

  useEffect(() => {
    checkStorage();
    const interval = setInterval(checkStorage, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const checkStorage = async () => {
    const info = await storageManagementService.getStorageInfo();
    setStorageInfo(info);

    if (info.status === 'warning' || info.status === 'critical') {
      setIsVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else {
      setIsVisible(false);
      Animated.spring(slideAnim, {
        toValue: -100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleCleanup = async () => {
    haptics.impactMedium();
    await storageManagementService.cleanupLowPriorityData();
    await checkStorage();
  };

  if (!isVisible || !storageInfo) return null;

  const isCritical = storageInfo.status === 'critical';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={isCritical ? ['#dc2626', '#991b1b'] : ['#f59e0b', '#d97706']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Ionicons
            name={isCritical ? 'warning' : 'alert-circle'}
            size={20}
            color="#ffffff"
          />
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {isCritical ? 'Depolama Kritik!' : 'Depolama Azalıyor'}
            </Text>
            <Text style={styles.subtitle}>
              {storageInfo.freeMB.toFixed(0)}MB boş alan kaldı
            </Text>
          </View>
          <Pressable style={styles.button} onPress={handleCleanup}>
            <Text style={styles.buttonText}>Temizle</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  gradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
});


