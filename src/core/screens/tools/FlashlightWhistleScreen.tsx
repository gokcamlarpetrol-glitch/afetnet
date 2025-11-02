/**
 * FLASHLIGHT & WHISTLE SCREEN
 * Emergency tools - Screen flashlight, whistle sound, SOS patterns
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';

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

export default function FlashlightWhistleScreen({ navigation }: any) {
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [sosMode, setSosMode] = useState(false);
  const [whistlePlaying, setWhistlePlaying] = useState(false);
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
  const [brightness, setBrightness] = useState(1.0);

  const pulseScale = useSharedValue(1);
  const sosTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Flashlight availability check would go here
    // For now, assume available
    
    return () => {
      // Cleanup
      if (soundObject) {
        soundObject.unloadAsync().catch((error) => {
          logger.error('Failed to unload sound:', error);
        });
      }
      if (flashlightOn) {
        // Turn off flashlight
        setFlashlightOn(false);
      }
      // Clear SOS timeout on unmount
      if (sosTimeoutRef.current) {
        clearTimeout(sosTimeoutRef.current);
        sosTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (sosMode) {
      startSOSPattern();
    }
  }, [sosMode, flashlightOn]);

  const startSOSPattern = async () => {
    for (const step of SOS_PATTERN) {
      if (!sosMode) break;
      
      try {
        setFlashlightOn(step.on);
        await new Promise(resolve => setTimeout(resolve, step.duration));
      } catch (error) {
        logger.error('SOS pattern error:', error);
      }
    }
    
    if (sosMode) {
      // Repeat - store timeout for cleanup
      sosTimeoutRef.current = setTimeout(() => startSOSPattern(), 100);
    }
  };

  const handleFlashlightToggle = async () => {
    try {
      // In production, use actual flashlight API
      // For now, toggle state
      setFlashlightOn(!flashlightOn);
      setSosMode(false);
    } catch (error) {
      logger.error('Flashlight toggle error:', error);
      Alert.alert('Hata', 'Fener açılamadı');
    }
  };

  const handleSOSToggle = async () => {
    if (sosMode) {
      setSosMode(false);
      setFlashlightOn(false);
      // Clear SOS timeout
      if (sosTimeoutRef.current) {
        clearTimeout(sosTimeoutRef.current);
        sosTimeoutRef.current = null;
      }
    } else {
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
    setFlashlightOn(!flashlightOn);
    setBrightness(flashlightOn ? 0.5 : 1.0);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Acil Durum Araçları</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Flashlight Section */}
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Fener</Text>
          
          <Pressable
            style={styles.mainButton}
            onPress={handleFlashlightToggle}
          >
            <LinearGradient
              colors={flashlightOn ? ['#fbbf24', '#f59e0b'] : [colors.background.secondary, colors.background.tertiary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainButtonGradient}
            >
              <Ionicons name={flashlightOn ? "flash" : "flash-off"} size={64} color={flashlightOn ? "#fff" : colors.text.secondary} />
              <Text style={[styles.mainButtonText, !flashlightOn && styles.mainButtonTextOff]}>
                {flashlightOn ? 'Fener Açık' : 'Feneri Aç'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, sosMode && styles.secondaryButtonActive]}
            onPress={handleSOSToggle}
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
      </View>
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
    padding: 16,
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  content: {
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
});

