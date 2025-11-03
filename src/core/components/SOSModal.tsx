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

export default function SOSModal({ visible, onClose, onConfirm }: SOSModalProps) {
  const [countdown, setCountdown] = useState(3);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sosService = getSOSService();

  useEffect(() => {
    if (visible) {
      // Reset state
      setCountdown(3);
      setIsSending(false);
      setIsSent(false);

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

      return () => clearInterval(timer);
    }
  }, [visible]);

  const sendSOS = async () => {
    setIsSending(true);
    haptics.impactHeavy();

    try {
      // Get actual location from device
      let location: { latitude: number; longitude: number; accuracy: number } | null = null;
      
      try {
        // Use static import instead of dynamic import to avoid undefined errors
        const Location = await import('expo-location');
        const LocationModule = Location.default || Location;
        
        if (!LocationModule || typeof LocationModule.requestForegroundPermissionsAsync !== 'function') {
          throw new Error('Location module not available');
        }
        
        const { status } = await LocationModule.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await LocationModule.getCurrentPositionAsync({
            accuracy: LocationModule.Accuracy.High,
          });
          
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 10,
          };
        }
      } catch (locError) {
        logger.warn('Could not get location, sending SOS without location:', locError);
        // Continue without location - still send SOS
      }

      await sosService.sendSOSSignal(location, 'Acil yardım gerekiyor!');
      
      setIsSending(false);
      setIsSent(true);
      onConfirm();

      // Auto close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setIsSending(false);
      logger.error('SOS send failed:', error);
      
      // Show error message to user
      const Alert = await import('react-native').then(m => m.Alert);
      Alert.alert(
        'SOS Gönderilemedi',
        'Acil yardım sinyali gönderilemedi. Lütfen manuel olarak yardım çağırın.',
        [{ text: 'Tamam' }]
      );
    }
  };

  const handleCancel = () => {
    haptics.impactLight();
    onClose();
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

            {/* Info Cards */}
            {(isSending || isSent) && (
              <View style={styles.infoCards}>
                <View style={styles.infoCard}>
                  <Ionicons name="bluetooth" size={24} color={colors.text.primary} />
                  <Text style={styles.infoText}>BLE Mesh</Text>
                  <Text style={styles.infoStatus}>Aktif</Text>
                </View>
                <View style={styles.infoCard}>
                  <Ionicons name="location" size={24} color={colors.text.primary} />
                  <Text style={styles.infoText}>Konum</Text>
                  <Text style={styles.infoStatus}>Paylaşıldı</Text>
                </View>
                <View style={styles.infoCard}>
                  <Ionicons name="people" size={24} color={colors.text.primary} />
                  <Text style={styles.infoText}>Yakındakiler</Text>
                  <Text style={styles.infoStatus}>Bilgilendirildi</Text>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    </Modal>
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
  infoCards: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 40,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minWidth: 100,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 8,
  },
  infoStatus: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
});

