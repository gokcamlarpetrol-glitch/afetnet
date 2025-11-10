/**
 * ONBOARDING SCREEN 2 - ELITE Early Warning System
 * "Dünyanın En Gelişmiş Erken Uyarı Sistemi"
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Video, ResizeMode } from 'expo-av';
import PaginationIndicator from '../../components/onboarding/PaginationIndicator';
import SkipButton from '../../components/onboarding/SkipButton';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OnboardingScreen2');
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';

interface OnboardingScreen2Props {
  navigation: {
    navigate: (screen: string) => void;
    replace: (screen: string) => void;
  };
}

export default function OnboardingScreen2({ navigation }: OnboardingScreen2Props) {
  const insets = useSafeAreaInsets();
  const rotateAnim = useRef(new RNAnimated.Value(0)).current;
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    // Track screen view
    const trackScreenView = async () => {
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_screen_view', {
          screen: 'onboarding_2',
          screen_name: 'ELITE Early Warning System',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
    };
    trackScreenView();

    // Rotate animation for background circles
    const rotateLoop = RNAnimated.loop(
      RNAnimated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    );
    rotateLoop.start();

    return () => {
      rotateLoop.stop();
    };
  }, [rotateAnim]);

  const handleContinue = useCallback(() => {
    try {
      haptics.impactMedium();
      logger.info('Devam Et butonuna tıklandı - Onboarding3\'e geçiliyor');
      if (navigation && navigation.navigate) {
        navigation.navigate('Onboarding3');
      } else {
        logger.error('Navigation prop eksik veya geçersiz:', navigation);
      }
    } catch (error) {
      logger.error('Navigation error:', error);
    }
  }, [navigation]);

  const [countdownDisplay, setCountdownDisplay] = useState(30);

  // Gerçek saniye sayacı - yavaş ve gerçekçi
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownDisplay((prev) => {
        if (prev <= 0) {
          return 30; // 0'a ulaştığında 30'a dön
        }
        return prev - 1;
      });
    }, 1000); // Her 1 saniyede bir azalt

    return () => clearInterval(interval);
  }, []);

  const rotateInterpolate = useMemo(
    () =>
      rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [rotateAnim]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} accessibilityLabel="Onboarding Ekranı 2 - Erken Uyarı Sistemi">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Skip Button */}
      <View style={[styles.skipContainer, { paddingTop: insets.top + spacing[2] }]}>
        <SkipButton onSkip={() => {}} navigation={navigation} />
      </View>
      
      {/* Background - Komple siyah arka plan */}
      <View style={styles.blackBackground} />

      {/* Premium: Animated Background Circles */}
      <RNAnimated.View
        style={[
          styles.backgroundCircle1,
          {
            transform: [{ rotate: rotateInterpolate }],
          },
        ]}
      />
      <RNAnimated.View
        style={[
          styles.backgroundCircle2,
          {
            transform: [{ rotate: rotateInterpolate }],
          },
        ]}
      />

      {/* Premium: Background Video - Dönen Dünya */}
      <Animated.View entering={FadeIn.duration(800)} style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={require('../../../../assets/videos/globe.mp4')}
          style={styles.backgroundVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          useNativeControls={false}
          onLoad={() => {
            setVideoLoaded(true);
            logger.debug('✅ Background video yüklendi');
          }}
          onError={(error) => {
            logger.warn('⚠️ Background video yükleme hatası:', error);
            setVideoLoaded(false);
          }}
        />
        {!videoLoaded && (
          <View style={styles.videoFallback}>
            <Ionicons name="globe" size={300} color="rgba(239, 68, 68, 0.1)" />
          </View>
        )}
      </Animated.View>

      <View style={styles.contentWrapper}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title - Yukarı Çekildi */}
          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <Text style={styles.title} accessibilityRole="header">
              Deprem Olmadan Önce{'\n'}Uyarı Al
            </Text>
          </Animated.View>

          {/* Subtitle - Gelişmiş ve Profesyonel */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <View style={styles.subtitleContainer}>
              <Text style={styles.subtitle}>
                <Text style={styles.subtitleAccent}>Yapay Zeka Destekli</Text> erken uyarı sistemi •{' '}
                <Text style={styles.subtitleAccent}>6 kaynak</Text> eşzamanlı doğrulama
              </Text>
              <Text style={styles.subtitleLine}>
                <Text style={styles.subtitleAccent}>Global Monitoring</Text> (USGS/EMSC) •{' '}
                <Text style={styles.subtitleAccent}>10-20 saniye</Text> önceden bildirim •{' '}
                <Text style={styles.subtitleAccent}>AFAD'dan daha hızlı</Text> tespit
              </Text>
              <Text style={styles.subtitleLine}>
                <Text style={styles.subtitleAccent}>Multi-channel</Text> uyarı sistemi •{' '}
                <Text style={styles.subtitleAccent}>Gerçek zamanlı</Text> güncelleme
              </Text>
            </View>
          </Animated.View>

          {/* Premium: Countdown Preview Card - Şeffaf ve Minimal */}
          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.countdownCardContainer}>
            <View style={styles.countdownCard}>
              <View style={styles.countdownCardGradient}>
                <View style={styles.countdownContent}>
                  <Text style={styles.countdownNumber}>
                    {countdownDisplay}
                  </Text>
                  <Text style={styles.countdownUnit}>saniye</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Açıklayıcı Özellikler - Yazı ile */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.featuresTextContainer}>
            <View style={styles.featureItem}>
              <Ionicons name="flash" size={18} color={colors.status.success} style={styles.featureIcon} />
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureTitle}>Ultra Düşük Gecikme</Text>
                <Text style={styles.featureDescription}>3-5 saniye aralıklarla veri çekerek en hızlı uyarıyı sağlar</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="pulse" size={18} color={colors.status.success} style={styles.featureIcon} />
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureTitle}>P-Wave Tespiti</Text>
                <Text style={styles.featureDescription}>En erken deprem dalgasını algılayarak saniyeler önceden uyarı verir</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={18} color={colors.accent.primary} style={styles.featureIcon} />
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureTitle}>6 Kaynak Doğrulama</Text>
                <Text style={styles.featureDescription}>AFAD, USGS, EMSC, Kandilli, Sensör ve Crowdsourcing verilerini eşzamanlı karşılaştırarak yüksek doğruluk sağlar</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="globe" size={18} color="#10b981" style={styles.featureIcon} />
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureTitle}>Global Erken Uyarı</Text>
                <Text style={styles.featureDescription}>USGS ve EMSC'den dünya çapında depremleri izleyerek Türkiye'ye ulaşmadan 10-20 saniye önce erken uyarı verir. AFAD'dan daha hızlı tespit</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="sparkles" size={18} color="#8b5cf6" style={styles.featureIcon} />
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureTitle}>AI Destekli Tahmin</Text>
                <Text style={styles.featureDescription}>Yapay zeka analizi ile deprem büyüklüğü ve etki alanını önceden tahmin eder</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="notifications" size={18} color={colors.emergency.critical} style={styles.featureIcon} />
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureTitle}>Full-Screen Bildirim</Text>
                <Text style={styles.featureDescription}>Sessiz modu ve rahatsız etmeyi aşan, her zaman görünür kritik uyarılar</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="volume-high" size={18} color={colors.accent.primary} style={styles.featureIcon} />
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureTitle}>Sesli Uyarı ve TTS</Text>
                <Text style={styles.featureDescription}>Yüksek sesli alarm ve sesli anons ile deprem bilgilerini duyarsınız</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="phone-portrait" size={18} color="#8b5cf6" style={styles.featureIcon} />
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureTitle}>Titreşim Desenleri</Text>
                <Text style={styles.featureDescription}>Özel titreşim desenleri ile cebinizde bile uyarı alırsınız</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </View>

      {/* Continue Button - ScrollView dışında, her zaman görünür */}
      <View style={[styles.buttonWrapper, { paddingBottom: insets.bottom + 20 }]}>
        <Animated.View
          entering={FadeInDown.delay(500).duration(600)}
          style={styles.buttonContainer}
        >
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Devam Et"
            accessibilityHint="Bir sonraki onboarding ekranına geç"
          >
            <LinearGradient
              colors={['#3b82f6', '#2563eb', '#1e40af']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Devam Et</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {/* Pagination Indicator */}
      <View style={styles.paginationContainer}>
        <PaginationIndicator currentStep={2} totalSteps={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  skipContainer: {
    position: 'absolute',
    top: 0,
    right: spacing[4],
    zIndex: 10,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: spacing[4],
    left: 0,
    right: 0,
  },
  blackBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 0,
  },
  backgroundCircle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
    top: -100,
    right: -100,
    zIndex: 1,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    bottom: -50,
    left: -50,
    zIndex: 1,
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    opacity: 0.15,
  },
  backgroundVideo: {
    width: '100%',
    height: '100%',
  },
  videoFallback: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    zIndex: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[4],
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[4],
    maxWidth: 320,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 36,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitleContainer: {
    alignItems: 'center',
    marginBottom: spacing[5],
    maxWidth: 340,
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing[2],
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  subtitleLine: {
    ...typography.body,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  subtitleAccent: {
    fontWeight: '700',
    color: colors.accent.primary,
  },
  countdownCardContainer: {
    width: '100%',
    maxWidth: 300,
    marginBottom: spacing[5],
    position: 'relative',
  },
  countdownCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  countdownCardGradient: {
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  countdownContent: {
    alignItems: 'center',
  },
  countdownNumber: {
    ...typography.display,
    fontSize: 60,
    color: colors.text.primary,
    fontWeight: '900',
    marginBottom: spacing[1],
    lineHeight: 68,
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  countdownUnit: {
    ...typography.h4,
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  featuresTextContainer: {
    width: '100%',
    maxWidth: 340,
    marginTop: spacing[4],
    marginBottom: spacing[4],
    gap: spacing[3],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  featureIcon: {
    marginTop: spacing[1],
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    ...typography.bodyMedium,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: spacing[1],
  },
  featureDescription: {
    ...typography.bodySmall,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  buttonWrapper: {
    backgroundColor: colors.background.primary,
    zIndex: 10,
    elevation: 10,
    paddingTop: spacing[4],
  },
  buttonContainer: {
    paddingHorizontal: spacing[6],
  },
  button: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[8],
    gap: spacing[2],
  },
  buttonText: {
    ...typography.buttonLarge,
    color: '#fff',
    fontSize: 18,
  },
});
