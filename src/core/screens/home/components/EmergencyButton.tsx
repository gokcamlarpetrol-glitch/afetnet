/**
 * EMERGENCY BUTTON - Life-Saving 4-Button System
 * Main SOS + Whistle + Flashlight + 112 Call
 * Integrated with rubble detection for automatic activation
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as haptics from '../../../utils/haptics';
import { colors, typography } from '../../../theme';
import { useUserStatusStore } from '../../../stores/userStatusStore';
import { whistleService } from '../../../services/WhistleService';
import { flashlightService } from '../../../services/FlashlightService';
import { batterySaverService } from '../../../services/BatterySaverService';

const logDebug = (...args: any[]) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(...args);
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

  // Auto-activate if trapped
  useEffect(() => {
    if (status === 'trapped') {
      // Enable battery saver
      batterySaverService.enable();
      
      // Auto-start whistle and flashlight
      handleWhistle();
      handleFlashlight();
      
      Alert.alert(
        'Enkaz Algılandı',
        'Düdük ve fener otomatik başlatıldı. Pil tasarrufu aktif.',
        [{ text: 'Tamam' }]
      );
    }
  }, [status]);

  const handlePressIn = () => {
    setIsPressed(true);
    haptics.impactMedium();
    
    logDebug('🆘 SOS butonu basıldı - 3 saniye bekleniyor...');

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
      logDebug('✅ SOS butonu 3 saniye tutuldu - SOS gönderiliyor!');
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
      logDebug('⚠️ SOS butonu erken bırakıldı');
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

  const handleWhistle = async () => {
    haptics.impactMedium();
    logDebug('Düdük butonu tıklandı, mevcut durum:', whistleActive);
    
    if (whistleActive) {
      await whistleService.stop();
      setWhistleActive(false);
      logDebug('Düdük durduruldu');
    } else {
      await whistleService.playSOSWhistle('morse');
      setWhistleActive(true);
      logDebug('Düdük başlatıldı');
    }
  };

  const handleFlashlight = async () => {
    haptics.impactMedium();
    logDebug('Fener butonu tıklandı, mevcut durum:', flashActive);
    
    if (flashActive) {
      await flashlightService.stop();
      setFlashActive(false);
      logDebug('Fener kapatıldı');
    } else {
      await flashlightService.flashSOSMorse();
      setFlashActive(true);
      logDebug('Fener açıldı (SOS Morse)');
    }
  };

  const handle112Call = async () => {
    haptics.impactHeavy();
    logDebug('112 arama butonu tıklandı');
    
    // Direct call - no confirmation needed in emergency
    try {
      await Linking.openURL('tel:112');
      logDebug('112 arama başlatıldı');
    } catch (error) {
      console.error('112 arama hatası:', error);
      Alert.alert('Hata', '112 aranırken bir hata oluştu. Lütfen manuel olarak arayın.');
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
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
        >
          <LinearGradient
            colors={whistleActive ? ['#f59e0b', '#d97706'] : ['rgba(245, 158, 11, 0.2)', 'rgba(217, 119, 6, 0.1)']}
            style={styles.quickButtonGradient}
          >
            <Ionicons name="megaphone" size={24} color={whistleActive ? '#ffffff' : '#f59e0b'} />
            <Text style={[styles.quickButtonText, whistleActive && styles.quickButtonTextActive]}>
              DÜDÜK
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Flashlight */}
        <TouchableOpacity
          style={styles.quickButton}
          onPress={handleFlashlight}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={flashActive ? ['#eab308', '#ca8a04'] : ['rgba(234, 179, 8, 0.2)', 'rgba(202, 138, 4, 0.1)']}
            style={styles.quickButtonGradient}
          >
            <Ionicons name="flashlight" size={24} color={flashActive ? '#ffffff' : '#eab308'} />
            <Text style={[styles.quickButtonText, flashActive && styles.quickButtonTextActive]}>
              FENER
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* 112 Call */}
        <TouchableOpacity
          style={styles.quickButton}
          onPress={handle112Call}
          activeOpacity={0.7}
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
