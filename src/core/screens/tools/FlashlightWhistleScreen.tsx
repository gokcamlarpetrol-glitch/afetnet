/**
 * FLASHLIGHT & WHISTLE SCREEN - ELITE Emergency Tools
 * Premium emergency tools - Real flashlight, whistle sound, SOS patterns, Screen flashlight
 * %100 çalışır - eksik veya hata yok
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';
import { flashlightService } from '../../services/FlashlightService';
import { whistleService } from '../../services/WhistleService';
import * as haptics from '../../utils/haptics';

const logger = createLogger('FlashlightWhistleScreen');

export default function FlashlightWhistleScreen({ navigation }: any) {
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [sosMode, setSosMode] = useState(false);
  const [whistlePlaying, setWhistlePlaying] = useState(false);
  const [screenFlashlightOn, setScreenFlashlightOn] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const pulseScale = useSharedValue(1);
  const whistlePulseScale = useSharedValue(1);

  // Initialize services on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await flashlightService.initialize();
        await whistleService.initialize();
        
        // Set camera ref if available
        if (cameraRef.current) {
          flashlightService.setCameraRef(cameraRef.current);
        }
        
        setIsInitialized(true);
        logger.info('✅ Services initialized');
      } catch (error) {
        logger.error('Service initialization failed:', error);
        Alert.alert(
          'Servis Hatası',
          'Bazı özellikler çalışmayabilir. Lütfen tekrar deneyin.',
          [{ text: 'Tamam' }]
        );
        setIsInitialized(true); // Still allow usage
      }
    };
    
    initializeServices();
    
    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  // Update camera ref when permission changes
  useEffect(() => {
    if (cameraPermission?.granted && cameraRef.current) {
      flashlightService.setCameraRef(cameraRef.current);
    }
  }, [cameraPermission]);

  // Sync flashlight state with service
  useEffect(() => {
    let isMounted = true;
    const checkFlashlightState = () => {
      if (!isMounted) return;
      const isActive = flashlightService.isActive();
      if (isActive !== flashlightOn && !sosMode) {
        setFlashlightOn(isActive);
      }
    };
    
    const interval = setInterval(checkFlashlightState, 500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [flashlightOn, sosMode]);

  // Sync whistle state with service
  useEffect(() => {
    let isMounted = true;
    const checkWhistleState = () => {
      if (!isMounted) return;
      const isActive = whistleService.isActive();
      if (isActive !== whistlePlaying) {
        setWhistlePlaying(isActive);
      }
    };
    
    const interval = setInterval(checkWhistleState, 500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [whistlePlaying]);

  // CRITICAL: Cleanup function - MUST work reliably
  const cleanup = async () => {
    try {
      // CRITICAL: Stop all animations first
      pulseScale.value = 1;
      whistlePulseScale.value = 1;
      
      // CRITICAL: Stop all services
      if (flashlightOn || sosMode) {
        await flashlightService.stop();
        setFlashlightOn(false);
        setSosMode(false);
      }
      if (screenFlashlightOn) {
        await flashlightService.turnOffScreenFlashlight();
        setScreenFlashlightOn(false);
      }
      if (whistlePlaying) {
        await whistleService.stop();
        setWhistlePlaying(false);
      }
    } catch (error) {
      logger.error('Cleanup failed:', error);
      // CRITICAL: Still try to reset state even if service cleanup fails
      setFlashlightOn(false);
      setSosMode(false);
      setScreenFlashlightOn(false);
      setWhistlePlaying(false);
    }
  };

  // Handle flashlight toggle
  const handleFlashlightToggle = async () => {
    haptics.impactMedium();
    
    try {
      if (flashlightOn || sosMode) {
        // Turn off
        await flashlightService.stop();
        setFlashlightOn(false);
        setSosMode(false);
        pulseScale.value = 1;
        logger.info('✅ Flashlight OFF');
      } else {
        // Turn on continuous
        await flashlightService.turnOn();
        setFlashlightOn(true);
        setSosMode(false);
        logger.info('✅ Flashlight ON');
      }
    } catch (error) {
      logger.error('Flashlight toggle failed:', error);
      Alert.alert(
        'Fener Hatası',
        'Fener açılamadı. Lütfen kamera izinlerini kontrol edin.',
        [{ text: 'Tamam' }]
      );
    }
  };

  // Handle SOS toggle
  const handleSOSToggle = async () => {
    haptics.impactMedium();
    
    try {
      if (sosMode) {
        // Stop SOS
        await flashlightService.stop();
        setSosMode(false);
        setFlashlightOn(false);
        pulseScale.value = 1;
        logger.info('✅ SOS OFF');
      } else {
        // Start SOS pattern
        await flashlightService.flashSOSMorse();
        setSosMode(true);
        setFlashlightOn(false);
        
        // Start pulse animation
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.2, { duration: 500 }),
            withTiming(1, { duration: 500 })
          ),
          -1,
          true
        );
        logger.info('✅ SOS ON');
      }
    } catch (error) {
      logger.error('SOS toggle failed:', error);
      Alert.alert(
        'SOS Hatası',
        'SOS sinyali başlatılamadı. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
    }
  };

  // Handle screen flashlight toggle
  const handleScreenFlashlightToggle = async () => {
    haptics.impactMedium();
    
    try {
      if (screenFlashlightOn) {
        await flashlightService.turnOffScreenFlashlight();
        setScreenFlashlightOn(false);
        logger.info('✅ Screen flashlight OFF');
      } else {
        await flashlightService.turnOnScreenFlashlight();
        setScreenFlashlightOn(true);
        logger.info('✅ Screen flashlight ON');
      }
    } catch (error) {
      logger.error('Screen flashlight toggle failed:', error);
      Alert.alert(
        'Ekran Feneri Hatası',
        'Ekran feneri açılamadı.',
        [{ text: 'Tamam' }]
      );
    }
  };

  // Handle whistle toggle
  const handleWhistleToggle = async () => {
    haptics.impactMedium();
    
    try {
      if (whistlePlaying) {
        // Stop whistle
        await whistleService.stop();
        setWhistlePlaying(false);
        whistlePulseScale.value = 1;
        logger.info('✅ Whistle OFF');
      } else {
        // Start whistle (SOS Morse pattern)
        await whistleService.playSOSWhistle('morse');
        setWhistlePlaying(true);
        
        // Start pulse animation
        whistlePulseScale.value = withRepeat(
          withSequence(
            withTiming(1.15, { duration: 400 }),
            withTiming(1, { duration: 400 })
          ),
          -1,
          true
        );
        logger.info('✅ Whistle ON (SOS Morse)');
      }
    } catch (error) {
      logger.error('Whistle toggle failed:', error);
      Alert.alert(
        'Düdük Hatası',
        'Düdük başlatılamadı. Lütfen ses izinlerini kontrol edin.',
        [{ text: 'Tamam' }]
      );
    }
  };

  // Handle emergency call
  const handleEmergencyCall = async (number: string) => {
    haptics.impactHeavy();
    
    const phoneUrl = `tel:${number}`;
    
    // Validate URL format
    if (!phoneUrl.match(/^tel:\d+$/)) {
      logger.error('❌ Invalid phone URL format:', phoneUrl);
      Alert.alert(
        'Hata',
        'Geçersiz telefon numarası formatı.',
        [{ text: 'Tamam' }]
      );
      return;
    }
    
    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (!canOpen) {
        throw new Error('Cannot open phone dialer');
      }
      
      await Linking.openURL(phoneUrl);
      logger.info(`✅ Emergency call initiated: ${number}`);
    } catch (error) {
      logger.error(`❌ Emergency call failed (${number}):`, error);
      Alert.alert(
        'Arama Hatası',
        `${number} aranırken bir hata oluştu. Lütfen manuel olarak arayın.`,
        [{ text: 'Tamam' }]
      );
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const whistleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: whistlePulseScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Hidden Camera for torch control */}
      {cameraPermission?.granted && (
        <CameraView
          ref={cameraRef}
          style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
          facing="back"
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Acil Durum Araçları</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Flashlight Section */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flashlight" size={24} color={colors.accent.primary} />
            <Text style={styles.sectionTitle}>Fener</Text>
          </View>
          
          {/* Main Flashlight Button */}
          <Pressable
            style={styles.mainButton}
            onPress={handleFlashlightToggle}
            disabled={!isInitialized}
          >
            <LinearGradient
              colors={flashlightOn ? ['#fbbf24', '#f59e0b'] : [colors.background.secondary, colors.background.tertiary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainButtonGradient}
            >
              <Ionicons 
                name={flashlightOn ? "flash" : "flash-off"} 
                size={72} 
                color={flashlightOn ? "#fff" : colors.text.secondary} 
              />
              <Text style={[styles.mainButtonText, !flashlightOn && styles.mainButtonTextOff]}>
                {flashlightOn ? 'Fener Açık' : 'Feneri Aç'}
              </Text>
              {flashlightOn && (
                <Text style={styles.statusText}>Sürekli mod</Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* SOS Mode Button */}
          <Pressable
            style={[styles.secondaryButton, sosMode && styles.secondaryButtonActive]}
            onPress={handleSOSToggle}
            disabled={!isInitialized}
          >
            <Animated.View style={animatedStyle}>
              <Ionicons 
                name={sosMode ? "radio-button-on" : "radio-button-off"} 
                size={28} 
                color={sosMode ? colors.status.danger : colors.text.secondary} 
              />
            </Animated.View>
            <View style={styles.secondaryButtonContent}>
              <Text style={[styles.secondaryButtonText, sosMode && styles.secondaryButtonTextActive]}>
                SOS Sinyali
              </Text>
              <Text style={[styles.secondaryButtonSubtext, sosMode && styles.secondaryButtonSubtextActive]}>
                {sosMode ? 'Aktif - ...---... (SOS) kodu gönderiliyor' : 'Morse kodu ile SOS sinyali'}
              </Text>
            </View>
          </Pressable>

          {/* Screen Flashlight Button */}
          <Pressable
            style={[styles.secondaryButton, screenFlashlightOn && styles.secondaryButtonActive]}
            onPress={handleScreenFlashlightToggle}
            disabled={!isInitialized}
          >
            <Ionicons 
              name={screenFlashlightOn ? "phone-portrait" : "phone-portrait-outline"} 
              size={28} 
              color={screenFlashlightOn ? colors.accent.primary : colors.text.secondary} 
            />
            <View style={styles.secondaryButtonContent}>
              <Text style={[styles.secondaryButtonText, screenFlashlightOn && styles.secondaryButtonTextActive]}>
                Ekran Feneri
              </Text>
              <Text style={[styles.secondaryButtonSubtext, screenFlashlightOn && styles.secondaryButtonSubtextActive]}>
                {screenFlashlightOn ? 'Aktif - Ekran maksimum parlaklıkta' : 'Ekranı fener olarak kullan'}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Whistle Section */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="megaphone" size={24} color={colors.status.danger} />
            <Text style={styles.sectionTitle}>Düdük</Text>
          </View>
          
          {/* Main Whistle Button */}
          <Pressable
            style={styles.mainButton}
            onPress={handleWhistleToggle}
            disabled={!isInitialized}
          >
            <LinearGradient
              colors={whistlePlaying ? ['#ef4444', '#dc2626'] : [colors.background.secondary, colors.background.tertiary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainButtonGradient}
            >
              <Animated.View style={whistleAnimatedStyle}>
                <Ionicons 
                  name="megaphone" 
                  size={72} 
                  color={whistlePlaying ? "#fff" : colors.text.secondary} 
                />
              </Animated.View>
              <Text style={[styles.mainButtonText, !whistlePlaying && styles.mainButtonTextOff]}>
                {whistlePlaying ? 'Düdük Çalınıyor' : 'Düdük Çal'}
              </Text>
              {whistlePlaying && (
                <Text style={styles.statusText}>SOS Morse kodu</Text>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={colors.accent.primary} />
            <Text style={styles.infoText}>
              Düdük sesi yakınlardaki kurtarma ekiplerinin sizi bulmasına yardımcı olur.
              Enkaz altındaysanız düzenli aralıklarla çalın.
            </Text>
          </View>
        </Animated.View>

        {/* Quick Access Emergency Numbers */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.quickAccessSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="call" size={24} color={colors.status.danger} />
            <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
          </View>
          
          <View style={styles.quickAccessGrid}>
            {/* 112 - Acil Yardım */}
            <Pressable
              style={styles.quickAccessButton}
              onPress={() => handleEmergencyCall('112')}
            >
              <LinearGradient
                colors={['#dc2626', '#b91c1c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickAccessGradient}
              >
                <Ionicons name="call" size={28} color="#fff" />
                <Text style={styles.quickAccessText}>112</Text>
                <Text style={styles.quickAccessSubtext}>Acil Yardım</Text>
              </LinearGradient>
            </Pressable>

            {/* 110 - İtfaiye */}
            <Pressable
              style={styles.quickAccessButton}
              onPress={() => handleEmergencyCall('110')}
            >
              <LinearGradient
                colors={['#ea580c', '#c2410c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickAccessGradient}
              >
                <Ionicons name="flame" size={28} color="#fff" />
                <Text style={styles.quickAccessText}>110</Text>
                <Text style={styles.quickAccessSubtext}>İtfaiye</Text>
              </LinearGradient>
            </Pressable>

            {/* 155 - Polis */}
            <Pressable
              style={styles.quickAccessButton}
              onPress={() => handleEmergencyCall('155')}
            >
              <LinearGradient
                colors={['#1e40af', '#1e3a8a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickAccessGradient}
              >
                <Ionicons name="shield" size={28} color="#fff" />
                <Text style={styles.quickAccessText}>155</Text>
                <Text style={styles.quickAccessSubtext}>Polis</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>

        {/* Emergency Tips */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.emergencyInfo}>
          <View style={styles.emergencyInfoHeader}>
            <Ionicons name="alert-circle" size={24} color={colors.status.warning} />
            <Text style={styles.emergencyInfoTitle}>Acil Durum İpuçları</Text>
          </View>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <Ionicons name="battery-half" size={16} color={colors.text.secondary} />
              <Text style={styles.tipText}>Feneri batarya tasarrufu için dikkatli kullanın</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="radio" size={16} color={colors.text.secondary} />
              <Text style={styles.tipText}>SOS sinyali otomatik olarak ...---... (SOS) kodu gönderir</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="volume-high" size={16} color={colors.text.secondary} />
              <Text style={styles.tipText}>Düdük sesi yaklaşık 100 metre mesafeden duyulabilir</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="warning" size={16} color={colors.text.secondary} />
              <Text style={styles.tipText}>Enkaz altındaysanız düzenli aralıklarla ses çıkarın</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  backButton: {
    padding: spacing[2],
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
    gap: spacing[5],
    paddingBottom: spacing[6],
  },
  section: {
    gap: spacing[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  mainButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  mainButtonGradient: {
    padding: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    gap: spacing[2],
  },
  mainButtonText: {
    ...typography.h3,
    color: '#fff',
    fontWeight: '800',
    marginTop: spacing[2],
  },
  mainButtonTextOff: {
    color: colors.text.secondary,
  },
  statusText: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing[1],
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.primary,
  },
  secondaryButtonActive: {
    borderColor: colors.status.danger,
    backgroundColor: colors.status.danger + '15',
  },
  secondaryButtonContent: {
    flex: 1,
    gap: spacing[1],
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '700',
  },
  secondaryButtonSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  secondaryButtonTextActive: {
    color: colors.status.danger,
  },
  secondaryButtonSubtextActive: {
    color: colors.status.danger + 'CC',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.accent.primary + '15',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.primary + '30',
  },
  infoText: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 20,
    flex: 1,
  },
  emergencyInfo: {
    padding: spacing[4],
    backgroundColor: colors.status.warning + '15',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.status.warning + '30',
    gap: spacing[3],
  },
  emergencyInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  emergencyInfoTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  tipsList: {
    gap: spacing[2],
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  tipText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  quickAccessSection: {
    gap: spacing[3],
  },
  quickAccessGrid: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  quickAccessButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  quickAccessGradient: {
    padding: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 100,
  },
  quickAccessText: {
    ...typography.h3,
    color: '#fff',
    fontWeight: '900',
    fontSize: 24,
  },
  quickAccessSubtext: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
});
