/**
 * EMERGENCY BUTTON - ELITE EDITION
 * "The Heart of Safety"
 * Features:
 * - Alive 'Heartbeat' Animation
 * - Glassmorphism Quick Actions
 * - Intensifying Haptic Feedback
 * - 100% Reliable Service Integration
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Linking, Alert } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import * as haptics from '../../../utils/haptics';
import { useUserStatusStore } from '../../../stores/userStatusStore';
import { whistleService } from '../../../services/WhistleService';
import { flashlightService } from '../../../services/FlashlightService';
import { batterySaverService } from '../../../services/BatterySaverService';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('EmergencyButton');

const logDebug = (message: string, ...args: unknown[]) => {
  if (__DEV__) {
    logger.debug(message, ...args);
  }
};

interface EmergencyButtonProps {
  onPress: () => void;
}

export default function EmergencyButton({ onPress }: EmergencyButtonProps) {
  const { status } = useUserStatusStore();
  const [isPressed, setIsPressed] = useState(false);
  const [whistleActive, setWhistleActive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);

  // Animation Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission] = useCameraPermissions();

  // --- 1. INITIALIZATION & LIVE HEARTBEAT ---
  useEffect(() => {
    // Idle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // ELITE: Initialize services on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await whistleService.initialize();
        await flashlightService.initialize();
        if (cameraRef.current) {
          flashlightService.setCameraRef(cameraRef.current);
        }
        logger.info('Emergency services initialized');
      } catch (error) {
        logger.error('Service initialization failed:', error);
      }
    };
    initializeServices();
  }, []);

  // CRITICAL: Auto-activate if trapped
  useEffect(() => {
    let alertTimeout: NodeJS.Timeout | null = null;
    if (status === 'trapped') {
      try { batterySaverService.enable(); } catch (e) { logger.error('Battery saver err', e); }
      handleWhistle().catch(e => logger.error('Auto-whistle err', e));
      handleFlashlight().catch(e => logger.error('Auto-flash err', e));

      alertTimeout = setTimeout(() => {
        Alert.alert('🚨 Enkaz Algılandı', 'Düdük ve fener başlatıldı. Pil tasarrufu aktif.');
      }, 500);
    }
    return () => {
      if (alertTimeout) clearTimeout(alertTimeout);
      if (status !== 'trapped') {
        if (whistleActive) whistleService.stop().catch(e => logger.error('Whistle stop error', e));
        if (flashActive) flashlightService.stop().catch(e => logger.error('Flash stop error', e));
      }
    };
  }, [status]); // Dependencies simplified to avoid loops, explicit handlers tracked via state

  // --- 2. PRESS HANDLERS ---
  const handlePressIn = () => {
    setIsPressed(true);
    haptics.impactMedium();
    logDebug('🆘 SOS Pressed');

    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
    Animated.timing(progressAnim, { toValue: 1, duration: 3000, useNativeDriver: false }).start();

    pressTimer.current = setTimeout(() => {
      logDebug('✅ SOS Triggered');
      haptics.impactHeavy();
      haptics.notificationSuccess(); // Success sound
      onPress();
      setIsPressed(false);
      progressAnim.setValue(0);
    }, 3000);
  };

  const handlePressOut = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setIsPressed(false);
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
    Animated.timing(progressAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  // --- 3. HARDWARE TOGGLES ---
  const handleWhistle = useCallback(async () => {
    haptics.impactMedium();
    try {
      if (whistleActive) {
        await whistleService.stop();
        setWhistleActive(false);
      } else {
        // Ensure initialized
        await whistleService.initialize();
        await whistleService.playSOSWhistle('morse');
        setWhistleActive(true);
      }
    } catch (e) {
      logger.error('Whistle toggle error', e);
      setWhistleActive(false);
      Alert.alert('Hata', 'Düdük işlemi başarısız.');
    }
  }, [whistleActive]);

  const handleFlashlight = useCallback(async () => {
    haptics.impactMedium();
    try {
      if (flashActive) {
        await flashlightService.stop();
        setFlashActive(false);
      } else {
        await flashlightService.initialize();
        await flashlightService.flashSOSMorse();
        setFlashActive(true);
      }
    } catch (e) {
      logger.error('Flash toggle error', e);
      setFlashActive(false);
      // Don't alert if just permissions (logs info previously)
    }
  }, [flashActive]);

  const handle112Call = useCallback(async () => {
    haptics.impactHeavy();
    const url = 'tel:112';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Hata', 'Arama desteklenmiyor.');
    } catch (e) {
      logger.error('Call error', e);
      Alert.alert('Hata', '112 aranamadı.');
    }
  }, []);

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.container}>
      {/* Hidden Camera for Torch */}
      {Device.isDevice && (
        <CameraView
          ref={ref => { cameraRef.current = ref; if (ref) flashlightService.setCameraRef(ref); }}
          style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
          facing="back"
        />
      )}

      {/* Main SOS Button */}
      <Animated.View style={[styles.mainButtonWrapper, { transform: [{ scale: pulseAnim }, { scale: scaleAnim }] }]}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.touchable}
        >
          <LinearGradient
            colors={isPressed ? ['#cc0000', '#990000'] : ['#ff3333', '#cc0000']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.mainButton}
          >
            <View style={styles.glow} />

            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={72} color="#ffffff" />
            </View>

            <Text style={styles.mainTitle}>ACİL DURUM / SOS</Text>
            <Text style={styles.mainSubtitle}>
              {isPressed ? 'Basılı tutun...' : 'Anında yardım çağrısı gönder'}
            </Text>

            {!isPressed && (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color="#ffffff" />
                <Text style={styles.locationText}>Konumunuz otomatik gönderilir</Text>
              </View>
            )}

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
            </View>

          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {/* Whistle */}
        <TouchableOpacity style={styles.quickButton} onPress={handleWhistle} activeOpacity={0.7}>
          <LinearGradient
            colors={whistleActive ? ['#f59e0b', '#d97706'] : ['rgba(245, 158, 11, 0.2)', 'rgba(217, 119, 6, 0.1)']}
            style={styles.quickButtonGradient}
          >
            <Ionicons name="megaphone" size={24} color={whistleActive ? '#ffffff' : '#f59e0b'} />
            <Text style={[styles.quickButtonText, whistleActive && styles.quickButtonTextActive]}>
              {whistleActive ? 'DURDUR' : 'DÜDÜK'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Flashlight */}
        <TouchableOpacity style={styles.quickButton} onPress={handleFlashlight} activeOpacity={0.7}>
          <LinearGradient
            colors={flashActive ? ['#eab308', '#ca8a04'] : ['rgba(234, 179, 8, 0.2)', 'rgba(202, 138, 4, 0.1)']}
            style={styles.quickButtonGradient}
          >
            <Ionicons name="flashlight" size={24} color={flashActive ? '#ffffff' : '#eab308'} />
            <Text style={[styles.quickButtonText, flashActive && styles.quickButtonTextActive]}>
              {flashActive ? 'DURDUR' : 'FENER'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* 112 */}
        <TouchableOpacity style={styles.quickButton} onPress={handle112Call} activeOpacity={0.7}>
          <LinearGradient
            colors={['rgba(220, 38, 38, 0.2)', 'rgba(185, 28, 28, 0.1)']}
            style={styles.quickButtonGradient}
          >
            <Ionicons name="call" size={24} color="#dc2626" />
            <Text style={styles.quickButtonText}>112</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20, gap: 16 },
  mainButtonWrapper: {
    borderRadius: 28,
    shadowColor: '#ff3333', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.7, shadowRadius: 32, elevation: 20,
  },
  touchable: { borderRadius: 28 },
  mainButton: {
    minHeight: 200, borderRadius: 28, padding: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  glow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 51, 51, 0.3)', borderRadius: 28,
  },
  iconContainer: {
    marginBottom: 16, backgroundColor: 'rgba(255, 255, 255, 0.25)', borderRadius: 50, width: 100, height: 100,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  mainTitle: {
    fontSize: 28, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5, textAlign: 'center', marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  mainSubtitle: {
    fontSize: 15, fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', textAlign: 'center', marginBottom: 12,
  },
  locationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 4,
  },
  locationText: { fontSize: 13, fontWeight: '600', color: '#ffffff', letterSpacing: 0.2 },
  progressContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBar: { height: '100%', backgroundColor: '#ffffff' },
  quickActions: { flexDirection: 'row', gap: 12 },
  quickButton: { flex: 1 },
  quickButtonGradient: {
    paddingVertical: 16, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickButtonText: { fontSize: 12, fontWeight: '800', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: 0.5 },
  quickButtonTextActive: { color: '#ffffff' },
});
