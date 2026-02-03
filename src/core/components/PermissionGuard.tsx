/**
 * ELITE PERMISSION GUARD
 * Critical permission requests with zero bundling-time dependencies
 * 
 * CRITICAL: Never imports expo-notifications at module level
 * Notification permissions are requested on-demand when needed
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { colors } from '../theme';
import { createLogger } from '../utils/logger';

const logger = createLogger('PermissionGuard');

// ============================================================================
// PERMISSION GUARD COMPONENT
// ============================================================================

interface PermissionStatus {
  location: boolean;
  notifications: boolean;
  camera: boolean;
  microphone: boolean;
  bluetooth: boolean;
}

interface Props {
  children: React.ReactNode;
  onPermissionsGranted?: () => void;
}

export default function PermissionGuard({ children, onPermissionsGranted }: Props) {
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    location: false,
    notifications: false,
    camera: false,
    microphone: false,
    bluetooth: false,
  });
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(() => {
      if (isMounted && !permissionsChecked) {
        // ELITE: Don't log - timeout is expected behavior and happens silently
        // Permission requests can take time, especially on first launch
        setPermissionsChecked(true);
        setIsRequesting(false);
      }
    }, 10000); // Reduced from 30s to 10s - permissions should be faster

    const init = async () => {
      try {
        await requestAllPermissions();
      } catch (error) {
        logger.error('Permission request failed:', error);
        if (isMounted) {
          setPermissionsChecked(true);
          setIsRequesting(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
    // ELITE: Empty dependency array is intentional - permissions should only be
    // requested once on component mount, not on re-renders
  }, []);

  const requestAllPermissions = async () => {
    setIsRequesting(true);
    logger.info('🔐 Requesting all critical permissions...');

    const statuses: PermissionStatus = {
      location: false,
      notifications: false,
      camera: false,
      microphone: false,
      bluetooth: true,
    };

    // 1. Location Permission
    try {
      logger.info('Requesting location permission...');
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus === 'granted') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        statuses.location = backgroundStatus === 'granted' || foregroundStatus === 'granted';
        logger.info(`Location permission: ${backgroundStatus === 'granted' ? 'FULL' : 'FOREGROUND ONLY'}`);
      } else {
        statuses.location = false;
        logger.warn('Location permission DENIED - continuing anyway');
      }
    } catch (error) {
      logger.error('Location permission error:', error);
    }

    // 2. Notification Permission (SKIPPED during startup)
    // CRITICAL: Notification permissions will be requested on-demand when notifications are actually needed
    // This prevents any bundling-time or startup-time module loading
    logger.info('Skipping notification permission request during startup - will request on-demand');
    statuses.notifications = false;

    // 3. Camera Permission
    try {
      logger.info('Requesting camera permission...');
      const { status } = await Camera.requestCameraPermissionsAsync();
      statuses.camera = status === 'granted';
      if (status === 'granted') {
        logger.info('Camera permission: GRANTED');
      } else {
        logger.warn('Camera permission DENIED');
      }
    } catch (error) {
      logger.error('Camera permission error:', error);
    }

    // 4. Microphone Permission
    try {
      logger.info('Requesting microphone permission...');
      const { status } = await Audio.requestPermissionsAsync();
      statuses.microphone = status === 'granted';
      if (status === 'granted') {
        logger.info('Microphone permission: GRANTED');
      } else {
        logger.warn('Microphone permission DENIED');
      }
    } catch (error) {
      logger.error('Microphone permission error:', error);
    }

    setPermissionStatus(statuses);
    setPermissionsChecked(true);
    setIsRequesting(false);

    if (onPermissionsGranted) {
      onPermissionsGranted();
    }
  };

  // CRITICAL: Always render children - never block app
  if (permissionsChecked) {
    return <>{children}</>;
  }

  // Show permission request UI while checking
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="shield-checkmark" size={64} color={((colors as any).accent?.primary) || ((colors as any).primary?.main) || '#3b82f6'} />
        <Text style={styles.title}>Kritik İzinler</Text>
        <Text style={styles.description}>
          AfetNet'in hayat kurtaran özelliklerini kullanmak için bazı izinlere ihtiyacımız var.
        </Text>

        {isRequesting && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={((colors as any).accent?.primary) || ((colors as any).primary?.main) || '#3b82f6'} />
            <Text style={styles.loadingText}>İzinler isteniyor...</Text>
          </View>
        )}

        {!isRequesting && (
          <Pressable
            style={styles.button}
            onPress={requestAllPermissions}
          >
            <Text style={styles.buttonText}>İzinleri Ver</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.skipButton}
          onPress={() => {
            setPermissionsChecked(true);
            setIsRequesting(false);
          }}
        >
          <Text style={styles.skipButtonText}>Şimdi Değil</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  button: {
    backgroundColor: ((colors as any).accent?.primary) || ((colors as any).primary?.main) || '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
});
