/**
 * PERMISSION GUARD - Critical Permission Requests
 * Requests all life-saving permissions on app startup
 * This is a DISASTER APP - permissions are CRITICAL for saving lives
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { colors } from '../theme';
import { createLogger } from '../utils/logger';

const logger = createLogger('PermissionGuard');

interface PermissionStatus {
  location: boolean;
  notifications: boolean;
  camera: boolean;
  microphone: boolean;
  bluetooth: boolean; // Can't request Bluetooth permission directly in React Native
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
    bluetooth: false, // Will be true by default
  });
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(() => {
      if (isMounted && !permissionsChecked) {
        logger.warn('Permission timeout - skipping');
        setPermissionsChecked(true);
        setIsRequesting(false);
      }
    }, 5000); // 5 second timeout

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAllPermissions = async () => {
    setIsRequesting(true);
    logger.info('🔐 Requesting all critical permissions...');

    const statuses: PermissionStatus = {
      location: false,
      notifications: false,
      camera: false,
      microphone: false,
      bluetooth: true, // Bluetooth permission is requested automatically by iOS/Android
    };

    // 1. Location Permission (CRITICAL for SOS)
    try {
      logger.info('Requesting location permission...');
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus === 'granted') {
        // Request background location for family tracking
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

    // 2. Notification Permission (CRITICAL for earthquake alerts)
    try {
      logger.info('Requesting notification permission...');
      const { status } = await Notifications.requestPermissionsAsync();
      statuses.notifications = status === 'granted';
      
      if (status === 'granted') {
        logger.info('Notification permission: GRANTED');
      } else {
        logger.warn('Notification permission DENIED - continuing anyway');
      }
    } catch (error) {
      logger.error('Notification permission error:', error);
    }

    // 3. Camera Permission (for QR code scanning - family member addition)
    try {
      logger.info('Requesting camera permission...');
      const { status } = await Camera.requestCameraPermissionsAsync();
      statuses.camera = status === 'granted';
      
      if (status === 'granted') {
        logger.info('Camera permission: GRANTED');
      } else {
        logger.warn('Camera permission DENIED');
        // Not critical - user can add family manually
      }
    } catch (error) {
      logger.error('Camera permission error:', error);
    }

    // 4. Microphone Permission (for voice commands)
    try {
      logger.info('Requesting microphone permission...');
      const { status } = await Audio.requestPermissionsAsync();
      statuses.microphone = status === 'granted';
      
      if (status === 'granted') {
        logger.info('Microphone permission: GRANTED');
      } else {
        logger.warn('Microphone permission DENIED');
        // Not critical - user can use buttons
      }
    } catch (error) {
      logger.error('Microphone permission error:', error);
      // Continue even if microphone permission fails
    }

    // Always set checked to true, even if some permissions failed
    setPermissionStatus(statuses);
    setPermissionsChecked(true);
    setIsRequesting(false);

    // Log summary - always proceed
    const criticalGranted = statuses.location && statuses.notifications;
    if (criticalGranted) {
      logger.info('✅ All CRITICAL permissions granted');
    } else {
      logger.warn('⚠️ Some CRITICAL permissions denied - app will continue');
    }
    
    // Always call callback
    onPermissionsGranted?.();
  };

  // Show loading while checking permissions
  if (!permissionsChecked) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Ionicons name="shield-checkmark" size={64} color={colors.accent.primary} />
          <Text style={styles.title}>AfetNet Başlatılıyor</Text>
          <Text style={styles.subtitle}>Hayat kurtarıcı izinler kontrol ediliyor...</Text>
          <ActivityIndicator size="large" color={colors.accent.primary} style={{ marginTop: 24 }} />
          
          <View style={styles.permissionList}>
            <PermissionItem 
              icon="location" 
              label="Konum" 
              status={permissionStatus.location}
              loading={isRequesting}
            />
            <PermissionItem 
              icon="notifications" 
              label="Bildirimler" 
              status={permissionStatus.notifications}
              loading={isRequesting}
            />
            <PermissionItem 
              icon="camera" 
              label="Kamera" 
              status={permissionStatus.camera}
              loading={isRequesting}
            />
            <PermissionItem 
              icon="mic" 
              label="Mikrofon" 
              status={permissionStatus.microphone}
              loading={isRequesting}
            />
            <PermissionItem 
              icon="bluetooth" 
              label="Bluetooth" 
              status={permissionStatus.bluetooth}
              loading={isRequesting}
            />
          </View>
        </View>
      </View>
    );
  }

  // All checks done - render app
  return <>{children}</>;
}

interface PermissionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  status: boolean;
  loading: boolean;
}

function PermissionItem({ icon, label, status, loading }: PermissionItemProps) {
  return (
    <View style={styles.permissionItem}>
      <Ionicons name={icon} size={24} color={status ? colors.status.success : colors.text.secondary} />
      <Text style={styles.permissionLabel}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.text.secondary} />
      ) : status ? (
        <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
      ) : (
        <Ionicons name="close-circle" size={20} color={colors.text.muted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  permissionList: {
    width: '100%',
    marginTop: 32,
    gap: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  permissionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

