/**
 * EMERGENCY BUTTON - PREMIUM V3
 * "The Heart of Safety" - Modern Calm Trust Theme
 * 
 * Features:
 * - Modern Calm Trust Theme Integration (Navy & Cream)
 * - Premium rounded corners and shadows
 * - Intensifying Haptic Feedback
 * - Clean, premium UI
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Alert,
  Modal,
  StatusBar,
  Dimensions,
} from 'react-native';
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

// ============================================================================
// CONFIGURATION
// ============================================================================

const HOLD_DURATION = 3000; // 3 seconds to activate

// PREMIUM Emergency Color - Single Bold Red
const COLORS = {
  // Single Premium Red - Rich, Saturated, Bold
  sosColor: '#DC2626', // Premium emergency red
  sosPressed: '#B91C1C', // Darker when pressed
  sosGlow: '#EF4444', // Bright glow

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.9)',
  textMuted: 'rgba(255, 255, 255, 0.7)',

  // Quick action colors (Modern Calm Trust)
  amber: '#D9A441',
  amberBg: 'rgba(217, 164, 65, 0.15)',
  amberBorder: 'rgba(217, 164, 65, 0.3)',

  critical: '#B53A3A',
  criticalBg: 'rgba(181, 58, 58, 0.15)',
  criticalBorder: 'rgba(181, 58, 58, 0.3)',
};

// ============================================================================
// COMPONENT
// ============================================================================

interface EmergencyButtonProps {
  onPress: () => void;
}

export default function EmergencyButton({ onPress }: EmergencyButtonProps) {
  const { status } = useUserStatusStore();

  // Local State
  const [isPressed, setIsPressed] = useState(false);
  const [whistleActive, setWhistleActive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [screenFlashlightVisible, setScreenFlashlightVisible] = useState(false);

  // Animation Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission] = useCameraPermissions();

  // ============================================================================
  // PREMIUM ANIMATIONS
  // ============================================================================

  useEffect(() => {
    // Subtle idle pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  // ============================================================================
  // SERVICE INITIALIZATION
  // ============================================================================

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

  // ============================================================================
  // AUTO-ACTIVATE IF TRAPPED
  // ============================================================================

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
    };
  }, [status]);

  // ============================================================================
  // PRESS HANDLERS
  // ============================================================================

  const handlePressIn = () => {
    setIsPressed(true);
    haptics.impactMedium();
    logger.debug('🆘 SOS Pressed');

    // Spring animation for press
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();

    // Progress fill
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    }).start();

    // Timer for activation
    pressTimer.current = setTimeout(() => {
      logger.info('✅ SOS Triggered');
      haptics.impactHeavy();
      haptics.notificationSuccess();
      onPress();
      setIsPressed(false);
      progressAnim.setValue(0);
    }, HOLD_DURATION);
  };

  const handlePressOut = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setIsPressed(false);

    // Spring back
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();

    // Reset progress
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // ============================================================================
  // HARDWARE TOGGLES
  // ============================================================================

  const handleWhistle = useCallback(async () => {
    haptics.impactMedium();
    try {
      if (whistleActive) {
        await whistleService.stop();
        setWhistleActive(false);
      } else {
        await whistleService.initialize();
        await whistleService.playSOSWhistle('morse');
        setWhistleActive(true);
      }
    } catch (e) {
      logger.error('Whistle toggle error', e);
      Alert.alert('Düdük Hatası', 'Düdük çalınamadı. Lütfen tekrar deneyin.');
      setWhistleActive(false);
    }
  }, [whistleActive]);

  const handleFlashlight = useCallback(async () => {
    haptics.impactMedium();
    try {
      await flashlightService.initialize();

      if (flashActive || screenFlashlightVisible) {
        await flashlightService.stop();
        await flashlightService.turnOffScreenFlashlight();
        setScreenFlashlightVisible(false);
        setFlashActive(false);
      } else {
        // Try hardware torch first, fallback to screen flashlight
        if (flashlightService.isAvailable()) {
          await flashlightService.flashSOSMorse();
          setFlashActive(true);
        } else {
          // Show full white screen as flashlight
          await flashlightService.turnOnScreenFlashlight();
          setScreenFlashlightVisible(true);
          setFlashActive(true);
        }
      }
    } catch (e) {
      logger.error('Flash toggle error', e);
      Alert.alert('Fener Hatası', 'Fener açılamadı. Lütfen tekrar deneyin.');
      setFlashActive(false);
      setScreenFlashlightVisible(false);
    }
  }, [flashActive, screenFlashlightVisible]);

  const closeScreenFlashlight = useCallback(async () => {
    haptics.impactMedium();
    await flashlightService.turnOffScreenFlashlight();
    setScreenFlashlightVisible(false);
    setFlashActive(false);
  }, []);

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

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={styles.container}>
      {/* SCREEN FLASHLIGHT MODAL - Full White Screen */}
      <Modal
        visible={screenFlashlightVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeScreenFlashlight}
      >
        <StatusBar hidden />
        <TouchableOpacity
          style={styles.screenFlashlight}
          activeOpacity={1}
          onPress={closeScreenFlashlight}
        >
          <View style={styles.screenFlashlightContent}>
            <Text style={styles.screenFlashlightText}>FENER</Text>
            <Text style={styles.screenFlashlightSubtext}>Kapatmak için dokunun</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Hidden Camera for Torch */}
      {Device.isDevice && (
        <CameraView
          ref={ref => { cameraRef.current = ref; if (ref) flashlightService.setCameraRef(ref); }}
          style={styles.hiddenCamera}
          facing="back"
        />
      )}

      {/* MAIN SOS BUTTON */}
      <Animated.View
        style={[
          styles.mainButtonWrapper,
          {
            transform: [
              { scale: Animated.multiply(pulseAnim, scaleAnim) },
            ],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.touchable}
        >
          <View
            style={[
              styles.mainButton,
              { backgroundColor: isPressed ? COLORS.sosPressed : COLORS.sosColor }
            ]}
          >
            {/* Icon Container */}
            <View style={styles.iconContainer}>
              <Ionicons
                name="warning"
                size={48}
                color={COLORS.textPrimary}
              />
            </View>

            {/* Text Content */}
            <Text style={styles.mainTitle}>ACİL YARDIM</Text>
            <Text style={styles.mainSubtitle}>
              {isPressed ? 'Basılı tutun...' : 'SOS sinyali gönder'}
            </Text>

            {/* Info Badges */}
            {!isPressed && (
              <View style={styles.badgeContainer}>
                <View style={styles.infoBadge}>
                  <Ionicons name="location" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.badgeText}>Konum paylaşılır</Text>
                </View>
                <View style={styles.infoBadge}>
                  <Ionicons name="radio" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.badgeText}>Yakınlara bildirim</Text>
                </View>
              </View>
            )}

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  { width: progressWidth }
                ]}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* QUICK ACTIONS */}
      <Text style={styles.quickActionsTitle}>HIZLI ERİŞİM</Text>
      <View style={styles.quickActions}>
        {/* Whistle */}
        <TouchableOpacity
          style={styles.quickButton}
          onPress={handleWhistle}
          activeOpacity={0.7}
        >
          <View style={[
            styles.quickButtonInner,
            whistleActive && styles.quickButtonActiveAmber,
          ]}>
            <Ionicons
              name="megaphone"
              size={22}
              color={whistleActive ? '#ffffff' : COLORS.amber}
            />
            <Text style={[
              styles.quickButtonText,
              { color: whistleActive ? '#ffffff' : COLORS.amber },
            ]}>
              {whistleActive ? 'Durdur' : 'Düdük'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Flashlight */}
        <TouchableOpacity
          style={styles.quickButton}
          onPress={handleFlashlight}
          activeOpacity={0.7}
        >
          <View style={[
            styles.quickButtonInner,
            flashActive && styles.quickButtonActiveAmber,
          ]}>
            <Ionicons
              name="flashlight"
              size={22}
              color={flashActive ? '#ffffff' : COLORS.amber}
            />
            <Text style={[
              styles.quickButtonText,
              { color: flashActive ? '#ffffff' : COLORS.amber },
            ]}>
              {flashActive ? 'Durdur' : 'Fener'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 112 */}
        <TouchableOpacity
          style={styles.quickButton}
          onPress={handle112Call}
          activeOpacity={0.7}
        >
          <View style={styles.quickButtonInner112}>
            <Ionicons name="call" size={22} color={COLORS.critical} />
            <Text style={[styles.quickButtonText, { color: COLORS.critical }]}>
              112
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    gap: 14,
  },
  hiddenCamera: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
  },

  // Main Button - PREMIUM STYLING
  mainButtonWrapper: {
    borderRadius: 28,
    shadowColor: COLORS.sosGlow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 16,
  },
  touchable: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  mainButton: {
    minHeight: 220,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconContainer: {
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 40,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  mainSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.textPrimary,
  },

  // Quick Actions
  quickActionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickButton: {
    flex: 1,
  },
  quickButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.amberBg,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
  },
  quickButtonActiveAmber: {
    backgroundColor: COLORS.amber,
    borderColor: COLORS.amber,
  },
  quickButtonText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quickButtonInner112: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.criticalBg,
    borderWidth: 1,
    borderColor: COLORS.criticalBorder,
  },

  // Screen Flashlight Modal
  screenFlashlight: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenFlashlightContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenFlashlightText: {
    fontSize: 48,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.08)',
    letterSpacing: 4,
  },
  screenFlashlightSubtext: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.15)',
    marginTop: 8,
  },
});
