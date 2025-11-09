/**
 * EMERGENCY BUTTON - Life-Saving 4-Button System
 * Main SOS + Whistle + Flashlight + 112 Call
 * Integrated with rubble detection for automatic activation
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as haptics from '../../../utils/haptics';
import { colors, typography } from '../../../theme';
import { useUserStatusStore } from '../../../stores/userStatusStore';
import { whistleService } from '../../../services/WhistleService';
import { flashlightService } from '../../../services/FlashlightService';
import { batterySaverService } from '../../../services/BatterySaverService';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('EmergencyButton');

const logDebug = (message: string, ...args: any[]) => {
  if (__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<CameraView | null>(null); // ELITE: Camera ref for torch control
  const [cameraPermission] = useCameraPermissions();

  useEffect(() => {
    // Idle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.01, // Daha subtle pulse
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ELITE: Initialize services on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await whistleService.initialize();
        await flashlightService.initialize();
        // ELITE: Set camera ref for torch control
        if (cameraRef.current) {
          flashlightService.setCameraRef(cameraRef.current);
        }
        logger.info('Emergency services initialized');
      } catch (error) {
        logger.error('Service initialization failed:', error);
        // Continue - services may still work
      }
    };
    
    initializeServices();
  }, []);

  // CRITICAL: Auto-activate if trapped - MUST work reliably
  useEffect(() => {
    if (status === 'trapped') {
      // Enable battery saver
      try {
        batterySaverService.enable();
      } catch (batteryError) {
        logger.error('Battery saver enable failed:', batteryError);
        // Continue - other features still work
      }

      // CRITICAL: Auto-start whistle and flashlight with error handling
      handleWhistle().catch((whistleError) => {
        logger.error('Auto-whistle failed:', whistleError);
        // Continue - flashlight may still work
      });
      
      handleFlashlight().catch((flashError) => {
        logger.error('Auto-flashlight failed:', flashError);
        // Continue - whistle may still work
      });
      
      // Show alert after a short delay to ensure services started
      setTimeout(() => {
        Alert.alert(
          '🚨 Enkaz Algılandı',
          'Düdük ve fener otomatik başlatıldı. Pil tasarrufu aktif. Yardım gelene kadar bekleyin.',
          [{ text: 'Tamam' }]
        );
      }, 500);
    }
    
    // Cleanup: Stop whistle and flashlight when status changes from trapped
    return () => {
      if (status !== 'trapped') {
        if (whistleActive) {
          whistleService.stop().catch((err) => logger.error('Whistle stop failed:', err));
        }
        if (flashActive) {
          flashlightService.stop().catch((err) => logger.error('Flashlight stop failed:', err));
        }
      }
    };
  }, [status, whistleActive, flashActive]);

  const handlePressIn = () => {
    setIsPressed(true);
    haptics.impactMedium();
    
    logDebug('🆘 SOS butonu basıldı - 3 saniye bekleniyor...', {});

    // Scale animation
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();

    // Progress animation (3 seconds)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    // Set timer for 3 seconds
    pressTimer.current = setTimeout(() => {
      logDebug('✅ SOS butonu 3 saniye tutuldu - SOS gönderiliyor!', {});
      haptics.impactHeavy();
      haptics.notificationSuccess();
      onPress(); // Trigger SOS modal
      setIsPressed(false);
      progressAnim.setValue(0);
    }, 3000);
  };

  const handlePressOut = () => {
    // Cancel timer if released before 3 seconds
    if (pressTimer.current) {
      logDebug('⚠️ SOS butonu erken bırakıldı', {});
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    
    setIsPressed(false);

    // Reset animations
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleWhistle = useCallback(async () => {
    haptics.impactMedium();
    logDebug('Düdük butonu tıklandı, mevcut durum:', { whistleActive });
    
    try {
      // ELITE: Ensure service is initialized
      try {
        await whistleService.initialize();
      } catch (initError) {
        logger.warn('WhistleService initialization warning:', initError);
        // Continue - service may still work
      }
      
      if (whistleActive) {
        // ELITE: Stop whistle with proper error handling
        try {
          await whistleService.stop();
          // ELITE: Wait a bit for cleanup to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          setWhistleActive(false);
          logDebug('✅ Düdük durduruldu', {});
        } catch (stopError) {
          logger.error('❌ Whistle stop failed:', stopError);
          // Still update UI state
          setWhistleActive(false);
          // Show error to user
          Alert.alert(
            'Düdük Durdurma Hatası',
            'Düdük durdurulurken bir hata oluştu. Lütfen tekrar deneyin.',
            [{ text: 'Tamam' }]
          );
        }
      } else {
        // ELITE: Start whistle with proper error handling
        try {
          // ELITE: Ensure service is ready before starting
          if (!whistleService.isActive || typeof whistleService.isActive !== 'function') {
            await whistleService.initialize();
          }
          
          await whistleService.playSOSWhistle('morse');
          setWhistleActive(true);
          logDebug('✅ Düdük başlatıldı (SOS Morse)', {});
        } catch (playError) {
          logger.error('❌ Whistle play failed:', playError);
          setWhistleActive(false);
          throw playError; // Re-throw to show alert
        }
      }
    } catch (error) {
      logger.error('❌ Whistle operation failed:', error);
      Alert.alert(
        'Düdük Hatası',
        'Düdük başlatılamadı. Lütfen ses izinlerini kontrol edin veya tekrar deneyin.',
        [
          { 
            text: 'Tekrar Dene', 
            onPress: handleWhistle,
            style: 'default'
          },
          { text: 'Tamam', style: 'cancel' }
        ]
      );
      // Reset state on error
      setWhistleActive(false);
    }
  }, [whistleActive]);

  const handleFlashlight = useCallback(async () => {
    haptics.impactMedium();
    logDebug('Fener butonu tıklandı, mevcut durum:', { flashActive });
    
    try {
      // ELITE: Ensure service is initialized
      try {
        await flashlightService.initialize();
      } catch (initError) {
        logger.warn('FlashlightService initialization warning:', initError);
        // Continue - service may still work with haptic feedback
      }
      
      // ELITE: Check permission but don't block - haptic feedback will work
      if (!flashlightService.isAvailable || !flashlightService.isAvailable()) {
        // Show info but continue - haptic feedback will work
        logger.info('Camera permission not granted, using haptic feedback');
      }
      
      if (flashActive) {
        // ELITE: Stop flashlight with proper error handling
        try {
          await flashlightService.stop();
          // ELITE: Wait a bit for cleanup to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          setFlashActive(false);
          logDebug('✅ Fener kapatıldı', {});
        } catch (stopError) {
          logger.error('❌ Flashlight stop failed:', stopError);
          // Still update UI state
          setFlashActive(false);
          // Show error to user
          Alert.alert(
            'Fener Durdurma Hatası',
            'Fener durdurulurken bir hata oluştu. Lütfen tekrar deneyin.',
            [{ text: 'Tamam' }]
          );
        }
      } else {
        // ELITE: Start flashlight with proper error handling
        try {
          // ELITE: Start flashing (async pattern loop)
          // Note: flashSOSMorse() will work with haptic feedback if torch unavailable
          await flashlightService.flashSOSMorse();
          setFlashActive(true);
          logDebug('✅ Fener başlatıldı (SOS Morse)', {});
        } catch (flashError) {
          logger.error('❌ Flashlight play failed:', flashError);
          setFlashActive(false);
          throw flashError; // Re-throw to show alert
        }
      }
    } catch (error) {
      logger.error('❌ Flashlight operation failed:', error);
      Alert.alert(
        'Fener Hatası',
        'Fener başlatılamadı. Titreşim modu ile çalışmaya devam edecektir.',
        [
          { 
            text: 'Tekrar Dene', 
            onPress: handleFlashlight,
            style: 'default'
          },
          { text: 'Tamam', style: 'cancel' }
        ]
      );
      // Reset state on error
      setFlashActive(false);
    }
  }, [flashActive]);

  const handle112Call = useCallback(async () => {
    haptics.impactHeavy();
    logDebug('112 arama butonu tıklandı', {});
    
    // ELITE: Input validation - ensure phone number is safe
    const emergencyNumber = '112';
    const phoneUrl = `tel:${emergencyNumber}`;
    
    // ELITE: Validate URL format to prevent injection
    if (!phoneUrl.match(/^tel:\d+$/)) {
      logger.error('❌ Invalid phone URL format:', phoneUrl);
      Alert.alert(
        'Hata',
        'Geçersiz telefon numarası formatı.',
        [{ text: 'Tamam' }]
      );
      return;
    }
    
    // CRITICAL: Direct call - no confirmation needed in emergency
    // But provide fallback options if call fails
    try {
      // ELITE: Check if phone dialer is available
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (!canOpen) {
        throw new Error('Cannot open phone dialer - device may not support phone calls');
      }
      
      // ELITE: Open phone dialer with timeout protection
      const openPromise = Linking.openURL(phoneUrl);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Phone dialer timeout')), 5000)
      );
      
      await Promise.race([openPromise, timeoutPromise]);
      logDebug('✅ 112 arama başlatıldı', {});
      
      // ELITE: Log analytics event
      try {
        const { firebaseAnalyticsService } = await import('../../../services/FirebaseAnalyticsService');
        firebaseAnalyticsService.logEvent('emergency_112_called', {
          timestamp: Date.now(),
        });
      } catch (analyticsError) {
        logger.debug('Analytics logging failed:', analyticsError);
      }
    } catch (error: any) {
      logger.error('❌ CRITICAL: 112 call failed:', error);
      
      // ELITE: Extract user-friendly error message
      let errorMessage = '112 aranırken bir hata oluştu.';
      if (error?.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Telefon arama ekranı açılırken zaman aşımı oluştu.';
        } else if (error.message.includes('Cannot open')) {
          errorMessage = 'Telefon arama özelliği kullanılamıyor. Cihazınızın telefon desteği olup olmadığını kontrol edin.';
        }
      }
      
      // CRITICAL: Provide alternative options
      Alert.alert(
        '⚠️ 112 Aranamadı',
        `${errorMessage} Lütfen manuel olarak arayın veya alternatif yöntemleri kullanın.`,
        [
          { 
            text: 'Tekrar Dene', 
            onPress: handle112Call,
            style: 'default'
          },
          { 
            text: 'SOS Gönder', 
            onPress: onPress,
            style: 'destructive'
          },
          { 
            text: 'Tamam', 
            style: 'cancel'
          }
        ]
      );
    }
  }, [onPress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* ELITE: Hidden Camera for torch control */}
      {cameraPermission?.granted && (
        <CameraView
          ref={(ref) => {
            cameraRef.current = ref;
            if (ref) {
              flashlightService.setCameraRef(ref);
            }
          }}
          style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
          facing="back"
        />
      )}
      
      {/* Main SOS Button */}
      <Animated.View
        style={[
          styles.mainButtonWrapper,
          {
            transform: [{ scale: pulseAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel="Acil Durum SOS Butonu"
          accessibilityHint="3 saniye basılı tutarak acil durum çağrısı gönderin"
          accessibilityState={{ disabled: false }}
        >
          <LinearGradient
            colors={isPressed 
              ? ['#cc0000', '#990000'] // Daha koyu ve dramatik (basılı)
              : ['#ff3333', '#cc0000'] // Daha canlı ve parlak kırmızı (normal)
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainButton}
          >
            {/* Glow effect */}
            <View style={styles.glow} />
            
            {/* Icon - Daha büyük */}
            <View style={styles.iconContainer}>
              <Ionicons name="warning" size={72} color="#ffffff" />
            </View>
            
            {/* Text - Referans tasarım */}
            <Text style={styles.mainTitle}>ACİL DURUM / SOS</Text>
            <Text style={styles.mainSubtitle}>
              {isPressed ? 'Basılı tutun...' : 'Anında yardım çağrısı gönder'}
            </Text>
            
            {/* Location Info */}
            {!isPressed && (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color="#ffffff" />
                <Text style={styles.locationText}>Konumunuz otomatik gönderilir</Text>
              </View>
            )}
            
            {/* Progress bar */}
            {isPressed && (
              <View style={styles.progressContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    { width: progressWidth },
                  ]}
                />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Action Buttons */}
      <View style={styles.quickActions}>
        {/* Whistle */}
        <TouchableOpacity
          style={styles.quickButton}
          onPress={handleWhistle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={whistleActive ? 'Düdük Durdur' : 'Düdük Başlat'}
          accessibilityHint="SOS düdük sinyali göndermek için basın"
          accessibilityState={{ disabled: false }}
        >
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
        <TouchableOpacity
          style={styles.quickButton}
          onPress={handleFlashlight}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={flashActive ? 'Fener Kapat' : 'Fener Aç'}
          accessibilityHint="SOS fener sinyali göndermek için basın"
          accessibilityState={{ disabled: false }}
        >
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

        {/* 112 Call */}
        <TouchableOpacity
          style={styles.quickButton}
          onPress={handle112Call}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="112 Acil Çağrı"
          accessibilityHint="112 acil servisi aramak için basın"
          accessibilityState={{ disabled: false }}
        >
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
  container: {
    marginBottom: 20,
    gap: 12,
  },
  mainButtonWrapper: {
    borderRadius: 28,
    shadowColor: '#ff3333',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7, // Çok daha belirgin shadow (güçlendirildi)
    shadowRadius: 32,
    elevation: 20,
  },
  mainButton: {
    minHeight: 200, // Daha büyük
    borderRadius: 28, // Daha yuvarlak
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0, // Border kaldırıldı
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 51, 51, 0.3)', // Daha belirgin glow efekti
    borderRadius: 28,
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)', // Daha belirgin arka plan (artırıldı)
    borderRadius: 50,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)', // Icon container'a border eklendi
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mainTitle: {
    fontSize: 28, // Daha büyük
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  mainSubtitle: {
    fontSize: 15, // Biraz daha büyük
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 12,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickButton: {
    flex: 1,
  },
  quickButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
  },
  quickButtonTextActive: {
    color: '#ffffff',
  },
});
