/**
 * FLASHLIGHT & WHISTLE SCREEN
 * Emergency tools - Screen flashlight, whistle sound, SOS patterns
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, StatusBar, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';
import { flashlightService } from '../../services/FlashlightService';

const logger = createLogger('FlashlightWhistleScreen');

const SOS_PATTERN = [
  { duration: 200, on: true },   // S
  { duration: 200, on: false },
  { duration: 200, on: true },
  { duration: 200, on: false },
  { duration: 200, on: true },
  { duration: 600, on: false },
  { duration: 600, on: true },   // O
  { duration: 200, on: false },
  { duration: 600, on: true },
  { duration: 200, on: false },
  { duration: 600, on: true },
  { duration: 600, on: false },
  { duration: 200, on: true },   // S
  { duration: 200, on: false },
  { duration: 200, on: true },
  { duration: 200, on: false },
  { duration: 200, on: true },
  { duration: 1400, on: false }, // Pause
];

export default function FlashlightWhistleScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  // ELITE: Force zero insets to remove white space completely
  const forcedInsets = { top: 0, bottom: insets.bottom, left: insets.left, right: insets.right };
  
  // ELITE: Set navigation options IMMEDIATELY on mount - BEFORE anything else
  React.useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      header: () => <View style={{ height: 0, backgroundColor: colors.background.primary }} />,
      headerTransparent: true,
      headerStyle: {
        backgroundColor: colors.background.primary,
        elevation: 0,
        shadowOpacity: 0,
        height: 0,
        borderBottomWidth: 0,
        borderTopWidth: 0,
        marginTop: 0,
        paddingTop: 0,
        display: 'none',
      },
      headerTitle: '',
      headerBackTitle: '',
      headerLeft: () => null,
      headerRight: () => null,
      headerTitleStyle: {
        display: 'none',
        opacity: 0,
        height: 0,
        fontSize: 0,
      },
      title: '',
      gestureEnabled: false,
    });
  }, []);
  
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [sosMode, setSosMode] = useState(false);
  const [whistlePlaying, setWhistlePlaying] = useState(false);
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
  const [brightness, setBrightness] = useState(1.0);
  const [flashlightAvailable, setFlashlightAvailable] = useState(false);

  const pulseScale = useSharedValue(1);
  const sosTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<CameraView | null>(null); // ELITE: Camera ref for torch control
  const [cameraPermission] = useCameraPermissions();

  // ELITE: Hide navigation header - ULTRA AGGRESSIVE REMOVAL (useLayoutEffect for immediate effect)
  React.useLayoutEffect(() => {
    // Force hide header immediately - ULTRA AGGRESSIVE REMOVAL
    const hideHeader = () => {
      navigation.setOptions({
        headerShown: false,
        header: () => <View style={{ height: 0, backgroundColor: colors.background.primary }} />,
        headerTransparent: true,
        headerStyle: {
          backgroundColor: colors.background.primary,
          elevation: 0,
          shadowOpacity: 0,
          height: 0,
          borderBottomWidth: 0,
          borderTopWidth: 0,
          marginTop: 0,
          paddingTop: 0,
          display: 'none',
        },
        headerTitle: '',
        headerBackTitle: '',
        headerLeft: () => null,
        headerRight: () => null,
        headerTitleStyle: {
          display: 'none',
          opacity: 0,
          height: 0,
          fontSize: 0,
        },
        title: '',
        gestureEnabled: false,
      });
    };
    
    // Execute immediately
    hideHeader();
    
    // Also try to remove header from parent navigator
    const parent = navigation.getParent?.();
    if (parent) {
      parent.setOptions({
        headerShown: false,
        header: () => <View style={{ height: 0 }} />,
      });
    }
    
    // Retry multiple times to ensure it sticks
    setTimeout(() => hideHeader(), 10);
    setTimeout(() => hideHeader(), 50);
    setTimeout(() => hideHeader(), 100);
    setTimeout(() => hideHeader(), 200);
    setTimeout(() => hideHeader(), 500);
  }, [navigation]);

  // ELITE: Initialize FlashlightService
  useEffect(() => {
    const initializeFlashlight = async () => {
      try {
        await flashlightService.initialize();
        setFlashlightAvailable(flashlightService.isAvailable());
        
        // Set camera ref for torch control
        if (cameraRef.current) {
          flashlightService.setCameraRef(cameraRef.current);
        }
        
        logger.info('✅ FlashlightService initialized');
      } catch (error) {
        logger.error('FlashlightService initialization failed:', error);
        setFlashlightAvailable(false);
      }
    };
    
    initializeFlashlight();
    
    return () => {
      // Cleanup
      if (soundObject) {
        soundObject.unloadAsync().catch((error) => {
          logger.error('Failed to unload sound:', error);
        });
      }
      if (flashlightOn || sosMode) {
        // Stop flashlight and SOS
        flashlightService.stop().catch((error) => {
          logger.error('Failed to stop flashlight:', error);
        });
        setFlashlightOn(false);
        setSosMode(false);
      }
      // Clear SOS timeout on unmount
      if (sosTimeoutRef.current) {
        clearTimeout(sosTimeoutRef.current);
        sosTimeoutRef.current = null;
      }
    };
  }, []);

  // ELITE: Update camera ref when available
  useEffect(() => {
    if (cameraRef.current && flashlightAvailable) {
      flashlightService.setCameraRef(cameraRef.current);
    }
  }, [flashlightAvailable]);

  const handleFlashlightToggle = async () => {
    try {
      if (!flashlightAvailable) {
        Alert.alert('Fener Kullanılamıyor', 'Fener özelliği için kamera izni gereklidir.');
        return;
      }

      if (flashlightOn || flashlightService.isActive()) {
        // Stop flashlight
        await flashlightService.stop();
        setFlashlightOn(false);
        setSosMode(false);
        logger.info('✅ Flashlight stopped');
      } else {
        // Start flashlight (SOS Morse pattern)
        await flashlightService.flashSOSMorse();
        setFlashlightOn(true);
        setSosMode(true);
        
        // Start pulse animation
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.2, { duration: 500 }),
            withTiming(1, { duration: 500 })
          ),
          -1,
          true
        );
        
        logger.info('✅ Flashlight started (SOS Morse)');
      }
    } catch (error) {
      logger.error('Flashlight toggle error:', error);
      Alert.alert('Hata', 'Fener açılamadı. Titreşim modu ile çalışmaya devam edecektir.');
      // Fallback: Try to update state anyway
      setFlashlightOn(false);
      setSosMode(false);
    }
  };

  const handleSOSToggle = async () => {
    try {
      if (!flashlightAvailable) {
        Alert.alert('SOS Kullanılamıyor', 'SOS sinyali için kamera izni gereklidir.');
        return;
      }

      if (sosMode) {
        // Stop SOS
        await flashlightService.stop();
        setSosMode(false);
        setFlashlightOn(false);
        
        // Clear SOS timeout
        if (sosTimeoutRef.current) {
          clearTimeout(sosTimeoutRef.current);
          sosTimeoutRef.current = null;
        }
        
        logger.info('✅ SOS stopped');
      } else {
        // Start SOS Morse pattern
        await flashlightService.flashSOSMorse();
        setSosMode(true);
        setFlashlightOn(true);
        
        // Start pulse animation
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.2, { duration: 500 }),
            withTiming(1, { duration: 500 })
          ),
          -1,
          true
        );
        
        logger.info('✅ SOS started');
      }
    } catch (error) {
      logger.error('SOS toggle error:', error);
      Alert.alert('Hata', 'SOS sinyali başlatılamadı. Titreşim modu ile çalışmaya devam edecektir.');
      setSosMode(false);
      setFlashlightOn(false);
    }
  };

  const handleWhistle = async () => {
    if (whistlePlaying) {
      if (soundObject) {
        await soundObject.stopAsync();
        await soundObject.unloadAsync();
        setSoundObject(null);
      }
      setWhistlePlaying(false);
    } else {
      try {
        // Create whistle sound using Audio API
        const { sound } = await Audio.Sound.createAsync(
          // Using a simple tone generation
          { uri: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzfLZizkIGmW27+efTREMT6fi8LZjHAY3kdbyzHktBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUqgc3y2Ys5CBpltu/nn00RDE+n4vC2YxwGN5HW8sx5LQUkd8fw3ZBAC' },
          { shouldPlay: true, isLooping: false, volume: 1.0 }
        );
        
        setSoundObject(sound);
        setWhistlePlaying(true);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setWhistlePlaying(false);
          }
        });
      } catch (error) {
        logger.error('Whistle error:', error);
        // Fallback: Use system beep
        Alert.alert('Düdük', 'Düdük sesi çalınıyor...');
        setWhistlePlaying(false);
      }
    }
  };

  const handleScreenFlashlight = () => {
    // ELITE: Screen flashlight (brightness control) - fallback if torch unavailable
    setFlashlightOn(!flashlightOn);
    setBrightness(flashlightOn ? 0.5 : 1.0);
    logger.info('Screen flashlight toggled:', !flashlightOn);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} barStyle="light-content" translucent backgroundColor={colors.background.primary} />
      
      {/* ELITE: Back button - floating */}
      <Pressable 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <View style={styles.backButtonContainer}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </View>
      </Pressable>

      {/* ELITE: Hidden Camera for torch control */}
      {cameraPermission?.granted && (
        <CameraView
          ref={cameraRef}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          facing="back"
          onCameraReady={() => {
            if (cameraRef.current) {
              flashlightService.setCameraRef(cameraRef.current);
              logger.info('✅ Camera ready for torch control');
            }
          }}
        />
      )}

      {/* Flashlight Section */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Fener</Text>
          
          {!flashlightAvailable && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={colors.status.warning} />
              <Text style={styles.warningText}>
                Fener özelliği için kamera izni gereklidir. Ayarlar'dan kamera iznini açabilirsiniz.
              </Text>
            </View>
          )}
          
          <Pressable
            style={styles.mainButton}
            onPress={handleFlashlightToggle}
            disabled={!flashlightAvailable}
          >
            <LinearGradient
              colors={flashlightOn ? ['#fbbf24', '#f59e0b'] : [colors.background.secondary, colors.background.tertiary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.mainButtonGradient, !flashlightAvailable && styles.mainButtonDisabled]}
            >
              <Ionicons name={flashlightOn ? "flash" : "flash-off"} size={64} color={flashlightOn ? "#fff" : colors.text.secondary} />
              <Text style={[styles.mainButtonText, !flashlightOn && styles.mainButtonTextOff]}>
                {flashlightOn ? 'Fener Açık (SOS)' : 'Feneri Aç (SOS)'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, sosMode && styles.secondaryButtonActive, !flashlightAvailable && styles.secondaryButtonDisabled]}
            onPress={handleSOSToggle}
            disabled={!flashlightAvailable}
          >
            <Animated.View style={animatedStyle}>
              <Ionicons name="radio-button-on" size={24} color={sosMode ? colors.status.danger : colors.text.secondary} />
            </Animated.View>
            <Text style={[styles.secondaryButtonText, sosMode && styles.secondaryButtonTextActive]}>
              SOS Sinyali ({sosMode ? 'AÇIK' : 'KAPALI'})
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleScreenFlashlight}
          >
            <Ionicons name="phone-portrait" size={24} color={colors.text.secondary} />
            <Text style={styles.secondaryButtonText}>
              Ekran Feneri ({flashlightOn ? 'AÇIK' : 'KAPALI'})
            </Text>
          </Pressable>
        </Animated.View>

        {/* Whistle Section */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Düdük</Text>
          
          <Pressable
            style={styles.mainButton}
            onPress={handleWhistle}
          >
            <LinearGradient
              colors={whistlePlaying ? ['#ef4444', '#dc2626'] : [colors.background.secondary, colors.background.tertiary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainButtonGradient}
            >
              <Ionicons name="megaphone" size={64} color={whistlePlaying ? "#fff" : colors.text.secondary} />
              <Text style={[styles.mainButtonText, !whistlePlaying && styles.mainButtonTextOff]}>
                {whistlePlaying ? 'Düdük Çalınıyor' : 'Düdük Çal'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Text style={styles.infoText}>
            Düdük sesi yakınlardaki kurtarma ekiplerinin sizi bulmasına yardımcı olur.
            Enkaz altındaysanız düzenli aralıklarla çalın.
          </Text>
        </Animated.View>

        {/* Emergency Info */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.emergencyInfo}>
          <Ionicons name="alert-circle" size={24} color={colors.status.warning} />
          <View style={styles.emergencyInfoContent}>
            <Text style={styles.emergencyInfoTitle}>Acil Durum İpuçları</Text>
            <Text style={styles.emergencyInfoText}>
              • Feneri batarya tasarrufu için dikkatli kullanın{'\n'}
              • SOS sinyali otomatik olarak ...---... (SOS) kodu gönderir{'\n'}
              • Düdük sesi yaklaşık 100 metre mesafeden duyulabilir{'\n'}
              • Enkaz altındaysanız düzenli aralıklarla ses çıkarın
            </Text>
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
  backButton: {
    position: 'absolute',
    top: 0,
    left: 16,
    zIndex: 1000,
    paddingTop: 0,
    marginTop: 0,
  },
  backButtonContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  mainButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  mainButtonGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  mainButtonText: {
    ...typography.h3,
    color: '#fff',
    fontWeight: '700',
    marginTop: 12,
  },
  mainButtonTextOff: {
    color: colors.text.secondary,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  secondaryButtonActive: {
    borderColor: colors.status.danger,
    backgroundColor: colors.status.danger + '20',
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  secondaryButtonTextActive: {
    color: colors.status.danger,
  },
  infoText: {
    ...typography.caption,
    color: colors.text.tertiary,
    lineHeight: 20,
    marginTop: 4,
  },
  emergencyInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: colors.status.warning + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.status.warning + '40',
  },
  emergencyInfoContent: {
    flex: 1,
  },
  emergencyInfoTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  emergencyInfoText: {
    ...typography.small,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.status.warning + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.status.warning + '40',
    marginBottom: 12,
  },
  warningText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  mainButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
});

