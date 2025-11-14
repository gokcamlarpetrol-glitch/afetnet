/**
 * SOS MODAL - Emergency Help Modal
 * Full-screen modal with countdown, BLE broadcast, location sharing
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { pulse } from '../theme/animations';
import * as haptics from '../utils/haptics';
import { logger } from '../utils/logger';
import { getSOSService } from '../services/SOSService';

interface SOSModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

type LocationStatusState =
  | 'idle'
  | 'requesting'
  | 'success'
  | 'low-accuracy'
  | 'denied'
  | 'error';

export default function SOSModal({ visible, onClose, onConfirm }: SOSModalProps) {
  const [countdown, setCountdown] = useState(3);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [environmentStatus, setEnvironmentStatus] = useState<{
    batteryLevel: number | null;
    networkStatus: 'connected' | 'disconnected' | 'unknown';
  }>({ batteryLevel: null, networkStatus: 'unknown' });
  const [locationStatus, setLocationStatus] = useState<LocationStatusState>('idle');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sosService = getSOSService();

  useEffect(() => {
    if (visible) {
      // Reset state
      setCountdown(3);
      setIsSending(false);
      setIsSent(false);
      setLocationStatus('idle');

      let isMounted = true;
      sosService.getEnvironmentStatus()
        .then(status => {
          if (isMounted) {
            setEnvironmentStatus(status);
          }
        })
        .catch((error) => {
          logger.warn('Environment status fetch failed:', error);
          if (isMounted) {
            setEnvironmentStatus({ batteryLevel: null, networkStatus: 'unknown' });
          }
        });

      // Start pulse animation
      pulse(pulseAnim, 0.9, 1.1, 800).start();

      // Start countdown
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            sendSOS();
            return 0;
          }
          haptics.impactMedium();
          return prev - 1;
        });
      }, 1000);

      return () => {
        isMounted = false;
        clearInterval(timer);
      };
    } else {
      setEnvironmentStatus({ batteryLevel: null, networkStatus: 'unknown' });
      setLocationStatus('idle');
    }
    return undefined;
  }, [visible]);

  const sendSOS = async () => {
    setIsSending(true);
    haptics.impactHeavy();

    // CRITICAL: This is life-saving - MUST work with retry mechanism
    let retryCount = 0;
    const maxRetries = 3;
    let sosSent = false;
    let location: { latitude: number; longitude: number; accuracy: number } | null = null;
    let resolvedLocationStatus: LocationStatusState = 'requesting';
    setLocationStatus('requesting');

    // Step 1: Get location with timeout and fallback
    try {
      const Location = await import('expo-location');
      const LocationModule = Location.default || Location;
      
      if (!LocationModule || typeof LocationModule.requestForegroundPermissionsAsync !== 'function') {
        throw new Error('Location module not available');
      }
      
      // Request permission with timeout
      const permissionPromise = LocationModule.requestForegroundPermissionsAsync();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Permission timeout')), 5000)
      );
      
      const { status } = await Promise.race([permissionPromise, timeoutPromise]) as any;
      
      if (status === 'granted') {
        try {
          // Try high accuracy first
          const positionPromise = LocationModule.getCurrentPositionAsync({
            accuracy: LocationModule.Accuracy.High,
          });
          const positionTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Position timeout')), 10000)
          );
          
          const position = await Promise.race([positionPromise, positionTimeoutPromise]) as any;
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 10,
          };
          resolvedLocationStatus = 'success';
        } catch (highAccError) {
          // Fallback to balanced accuracy
          try {
            const position = await LocationModule.getCurrentPositionAsync({
              accuracy: LocationModule.Accuracy.Balanced,
            });
            location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || 50,
            };
            resolvedLocationStatus = 'low-accuracy';
          } catch (fallbackError) {
            resolvedLocationStatus = 'error';
            logger.warn('Could not get location, sending SOS without location:', fallbackError);
          }
        }
      } else {
        resolvedLocationStatus = 'denied';
        logger.warn('Location permission denied');
      }
    } catch (locError) {
      resolvedLocationStatus = 'error';
      logger.warn('Location error, sending SOS without location:', locError);
      // Continue without location - still send SOS
    }
    setLocationStatus(resolvedLocationStatus);

    // Step 2: Send SOS with retry mechanism
    while (!sosSent && retryCount < maxRetries) {
      try {
        await sosService.sendSOSSignal(
          location,
          resolvedLocationStatus === 'success' || resolvedLocationStatus === 'low-accuracy'
            ? 'Acil yardım gerekiyor! Konum paylaşıldı.'
            : 'Acil yardım gerekiyor!',
          { autoLocation: false }
        );
        sosSent = true;
      } catch (error) {
        retryCount++;
        logger.error(`SOS send attempt ${retryCount} failed:`, error);
        
        if (retryCount < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        } else {
          // All retries failed
          setIsSending(false);
          logger.error('❌ CRITICAL: All SOS retry attempts failed');
          
          // Show error with retry option
          const Alert = await import('react-native').then(m => m.Alert);
          Alert.alert(
            '⚠️ SOS Gönderilemedi',
            'Acil yardım sinyali gönderilemedi. Lütfen manuel olarak yardım çağırın.',
            [
              { text: 'Tekrar Dene', onPress: sendSOS },
              { 
                text: '112 Ara', 
                onPress: async () => {
                  try {
                    const Linking = await import('react-native').then(m => m.Linking);
                    await Linking.openURL('tel:112');
                  } catch (callError) {
                    logger.error('112 call failed:', callError);
                  }
                },
                style: 'destructive'
              },
              { text: 'İptal', style: 'cancel', onPress: onClose }
            ]
          );
          return;
        }
      }
    }

    // Success
    setIsSending(false);
    setIsSent(true);
    onConfirm();
    haptics.notificationSuccess();

    // Auto close after 3 seconds (longer for user to see success)
    setTimeout(() => {
      onClose();
    }, 3000);
  };

  const handleCancel = () => {
    haptics.impactLight();
    onClose();
  };

  const getBatteryStatusText = () => {
    if (environmentStatus.batteryLevel === null) {
      return 'Veri yok';
    }
    return `${environmentStatus.batteryLevel}%`;
  };

  const getNetworkStatusText = () => {
    switch (environmentStatus.networkStatus) {
      case 'connected':
        return 'Bağlı';
      case 'disconnected':
        return 'Çevrim dışı';
      default:
        return 'Bilinmiyor';
    }
  };

  const getLocationStatusText = () => {
    switch (locationStatus) {
      case 'success':
        return 'Konum paylaşıldı';
      case 'low-accuracy':
        return 'Düşük doğruluk';
      case 'denied':
        return 'İzin gerekli';
      case 'error':
        return 'Belirlenemedi';
      case 'requesting':
        return 'Konum alınıyor...';
      default:
        return 'Beklemede';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#dc2626', '#991b1b']}
          style={styles.gradient}
        >
          {/* Close Button */}
          {countdown > 0 && !isSending && !isSent && (
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Icon */}
            <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons 
                name={isSent ? "checkmark-circle" : "alert-circle"} 
                size={120} 
                color={colors.text.primary} 
              />
            </Animated.View>

            {/* Status Text */}
            {countdown > 0 && !isSending && !isSent && (
              <>
                <Text style={styles.countdownText}>{countdown}</Text>
                <Text style={styles.title}>Yardım Çağrısı Gönderiliyor</Text>
                <Text style={styles.subtitle}>İptal etmek için dokun</Text>
              </>
            )}

            {isSending && !isSent && (
              <>
                <Text style={styles.title}>Gönderiliyor...</Text>
                <Text style={styles.subtitle}>BLE mesh üzerinden yayınlanıyor</Text>
              </>
            )}

            {isSent && (
              <>
                <Text style={styles.title}>Yardım Çağrısı Gönderildi!</Text>
                <Text style={styles.subtitle}>Çevredeki cihazlar bilgilendirildi</Text>
              </>
            )}

            <View style={styles.statusContainer}>
              <StatusItem icon="location" label="Konum" value={getLocationStatusText()} />
              <StatusItem icon="battery-half" label="Batarya" value={getBatteryStatusText()} />
              <StatusItem
                icon={environmentStatus.networkStatus === 'disconnected' ? 'cloud-offline' : 'wifi'}
                label="Ağ"
                value={getNetworkStatusText()}
              />
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

function StatusItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statusItem}>
      <Ionicons name={icon} size={20} color={colors.text.primary} style={styles.statusIcon} />
      <View>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 40,
  },
  countdownText: {
    fontSize: 80,
    fontWeight: '900',
    color: colors.text.primary,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 16,
    marginTop: 32,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    marginRight: 10,
  },
  statusLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
});
