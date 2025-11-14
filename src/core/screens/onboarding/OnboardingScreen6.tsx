/**
 * ONBOARDING SCREEN 6 - ELITE Family Safety Chain
 * "Ailenle Bağlantıyı Asla Kaybetme"
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Video, ResizeMode } from 'expo-av';
import * as Location from 'expo-location';
// ELITE: Lazy import expo-notifications to prevent NativeEventEmitter errors
// CRITICAL: Do NOT import at top level - use async loader instead
let NotificationsModule: any = null;
async function getNotificationsAsync(): Promise<any> {
  if (NotificationsModule) return NotificationsModule;
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // ELITE: Use eval to prevent static analysis
    const moduleName = 'expo-' + 'notifications';
    NotificationsModule = eval(`require('${moduleName}')`);
    return NotificationsModule;
  } catch (error) {
    return null;
  }
}
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { PermissionsAndroid } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import PaginationIndicator from '../../components/onboarding/PaginationIndicator';
import SkipButton from '../../components/onboarding/SkipButton';
import { createLogger } from '../../utils/logger';
import { setOnboardingCompleted } from '../../utils/onboardingStorage';

const logger = createLogger('OnboardingScreen6');

interface OnboardingScreen6Props {
  navigation: {
    navigate: (screen: string) => void;
    replace: (screen: string) => void;
  };
}

export default function OnboardingScreen6({ navigation }: OnboardingScreen6Props) {
  const insets = useSafeAreaInsets();
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<Video>(null);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    location: false,
    notifications: false,
    camera: false,
    microphone: false,
    bluetooth: false,
  });

  useEffect(() => {
    // Track screen view
    const trackScreenView = async () => {
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_screen_view', {
          screen: 'onboarding_6',
          screen_name: 'Family Safety Chain',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
    };
    trackScreenView();
  }, []);

  const handleRequestPermissions = useCallback(async () => {
    if (isRequestingPermissions) return;
    
    setIsRequestingPermissions(true);
    haptics.impactMedium();
    
    try {
      const statuses = {
        location: false,
        notifications: false,
        camera: false,
        microphone: false,
        bluetooth: false,
      };

      // 1. Location Permission (Always - for real-time tracking)
      try {
        logger.info('🔐 [Onboarding] Requesting location permission...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
          statuses.location = backgroundStatus.status === 'granted';
        }
        
        if (statuses.location) {
          logger.info('✅ [Onboarding] Location permission granted (foreground + background)');
        } else {
          logger.warn('⚠️ [Onboarding] Location permission denied or background not granted');
        }
      } catch (error) {
        logger.error('❌ [Onboarding] Location permission error:', error);
        statuses.location = false;
      }

      // 2. Notifications Permission
      try {
        logger.info('🔐 [Onboarding] Requesting notification permission...');
        // ELITE: Use async loader to get notifications module
        const Notifications = await getNotificationsAsync();
        if (!Notifications) {
          logger.warn('Notifications module not available');
          statuses.notifications = false;
        } else {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
          statuses.notifications = status === 'granted';
          
          if (statuses.notifications) {
            logger.info('✅ [Onboarding] Notification permission granted');
            
            // Create notification channels for Android
            if (Platform.OS === 'android') {
              try {
                await Notifications.setNotificationChannelAsync('eew', {
                  name: 'Erken Deprem Uyarısı',
                  importance: Notifications.AndroidImportance.MAX,
                  vibrationPattern: [0, 500, 500, 500],
                  sound: 'default',
                  enableVibrate: true,
                  showBadge: true,
                  bypassDnd: true,
                });
                logger.info('✅ [Onboarding] Notification channels created');
              } catch (channelError) {
                logger.error('❌ [Onboarding] Failed to create notification channels:', channelError);
              }
            }
          } else {
            logger.warn('❌ [Onboarding] Notification permission denied');
          }
        }
      } catch (error) {
        logger.error('❌ [Onboarding] Notification permission error:', error);
        statuses.notifications = false;
      }

      // 3. Camera Permission
      try {
        logger.info('🔐 [Onboarding] Requesting camera permission...');
        const { status } = await Camera.requestCameraPermissionsAsync();
        statuses.camera = status === 'granted';
        if (statuses.camera) {
          logger.info('✅ [Onboarding] Camera permission granted');
        }
      } catch (error) {
        logger.error('❌ [Onboarding] Camera permission error:', error);
        statuses.camera = false;
      }

      // 4. Microphone Permission
      try {
        logger.info('🔐 [Onboarding] Requesting microphone permission...');
        const { status } = await Audio.requestPermissionsAsync();
        statuses.microphone = status === 'granted';
        if (statuses.microphone) {
          logger.info('✅ [Onboarding] Microphone permission granted');
        }
      } catch (error) {
        logger.error('❌ [Onboarding] Microphone permission error:', error);
        statuses.microphone = false;
      }

      // 5. Bluetooth Permission (Android 12+)
      if (Platform.OS === 'android' && Platform.Version >= 31) {
        try {
          logger.info('🔐 [Onboarding] Requesting Bluetooth permissions...');
          const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          ]);
          
          const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
          const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
          
          statuses.bluetooth = scanGranted && connectGranted;
          if (statuses.bluetooth) {
            logger.info('✅ [Onboarding] Bluetooth permissions granted');
          }
        } catch (error) {
          logger.error('❌ [Onboarding] Bluetooth permission error:', error);
          statuses.bluetooth = false;
        }
      } else {
        statuses.bluetooth = true; // iOS or older Android
      }

      setPermissionStatus(statuses);
      haptics.notificationSuccess();
      
      // Track analytics
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_permissions_granted', statuses);
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
      
      // Show success message
      Alert.alert(
        'İzinler Alındı',
        'Tüm izinler başarıyla alındı. Uygulamayı kullanmaya başlayabilirsiniz.',
        [{ text: 'Tamam', onPress: () => {
          // Complete onboarding after permissions granted
          setOnboardingCompleted().then(() => {
            const parentNavigation = navigation as any;
            if (parentNavigation?.getParent) {
              const rootNavigation = parentNavigation.getParent();
              if (rootNavigation) {
                rootNavigation.replace('MainTabs');
              } else {
                parentNavigation.replace('MainTabs');
              }
            } else {
              parentNavigation.replace('MainTabs');
            }
          }).catch((err) => {
            logger.error('Error completing onboarding:', err);
          });
        }}]
      );
    } catch (error) {
      logger.error('Permission request error:', error);
      Alert.alert(
        'Hata',
        'İzinler alınırken bir hata oluştu. Ayarlardan manuel olarak izin verebilirsiniz.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsRequestingPermissions(false);
    }
  }, [isRequestingPermissions, navigation]);

  const handleComplete = useCallback(async () => {
    try {
      haptics.impactMedium();
      logger.info('Başlayalım butonuna tıklandı - Onboarding tamamlanıyor');
      await setOnboardingCompleted();
      
      // Navigate to MainTabs
      try {
        const parentNavigation = navigation as any;
        if (parentNavigation?.getParent) {
          const rootNavigation = parentNavigation.getParent();
          if (rootNavigation) {
            rootNavigation.replace('MainTabs');
          } else {
            parentNavigation.replace('MainTabs');
          }
        } else {
          parentNavigation.replace('MainTabs');
        }
      } catch (navError) {
        logger.warn('Navigation error, App.tsx will handle:', navError);
      }
    } catch (error) {
      logger.error('Complete onboarding error:', error);
      await setOnboardingCompleted();
      try {
        const parentNavigation = navigation as any;
        if (parentNavigation?.getParent) {
          const rootNavigation = parentNavigation.getParent();
          if (rootNavigation) {
            rootNavigation.replace('MainTabs');
          } else {
            parentNavigation.replace('MainTabs');
          }
        } else {
          parentNavigation.replace('MainTabs');
        }
      } catch (navError) {
        logger.warn('Navigation error:', navError);
      }
    }
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} accessibilityLabel="Onboarding Ekranı 6 - Aile Güvenlik Zinciri">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Skip Button */}
      <View style={[styles.skipContainer, { paddingTop: insets.top + spacing[2] }]}>
        <SkipButton onSkip={handleComplete} navigation={navigation} />
      </View>
      
      {/* Background - Komple siyah arka plan */}
      <View style={styles.blackBackground} />

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
            <Ionicons name="globe" size={300} color="rgba(59, 130, 246, 0.1)" />
          </View>
        )}
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Title */}
          <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.titleContainer}>
            <Text style={styles.title} accessibilityRole="header">
              Ailenle Bağlantıyı{'\n'}Asla Kaybetme
            </Text>
          </Animated.View>

          {/* Subtitle */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <Text style={styles.subtitle}>
              <Text style={styles.subtitleAccent}>Tek tıkla</Text> bildirim gönder,{' '}
              <Text style={styles.subtitleAccent}>gerçek zamanlı konum</Text> gör,{' '}
              <Text style={styles.subtitleAccent}>şebekesiz iletişim</Text> ile bağlantıda kal.
            </Text>
          </Animated.View>

          {/* Premium Features - Compact Cards */}
          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.featuresContainer}>
            {/* Tek Tıkla Bildirim Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="notifications" size={24} color={colors.accent.primary} />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Tek Tıkla Bildirim</Text>
                <Text style={styles.featureCardText}>
                  Tüm aile bireylerine tek dokunuşla durum bildirimi gönder.{' '}
                  <Text style={styles.featureCardAccent}>Güvende</Text>,{' '}
                  <Text style={styles.featureCardAccent}>yardıma ihtiyacım var</Text> veya{' '}
                  <Text style={styles.featureCardAccent}>kritik durum</Text>.
                </Text>
              </LinearGradient>
            </View>

            {/* Gerçek Zamanlı Konum Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.4)', 'rgba(16, 185, 129, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="location" size={24} color={colors.status.success} />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Gerçek Zamanlı Konum</Text>
                <Text style={styles.featureCardText}>
                  Aile üyelerinin konumunu haritada gör,{' '}
                  <Text style={styles.featureCardAccent}>son görülme zamanını</Text> takip et,{' '}
                  <Text style={styles.featureCardAccent}>otomatik konum paylaşımı</Text> ile her zaman bilgi sahibi ol.
                </Text>
              </LinearGradient>
            </View>

            {/* Şebekesiz İletişim Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(139, 92, 246, 0.4)', 'rgba(139, 92, 246, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="bluetooth" size={24} color="#8b5cf6" />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Şebekesiz İletişim</Text>
                <Text style={styles.featureCardText}>
                  <Text style={styles.featureCardAccent}>İnternet olmasa bile</Text> BLE Mesh teknolojisi ile yakındaki aile üyeleriyle{' '}
                  <Text style={styles.featureCardAccent}>mesajlaş</Text>,{' '}
                  <Text style={styles.featureCardAccent}>konum paylaş</Text> ve{' '}
                  <Text style={styles.featureCardAccent}>acil durum sinyali</Text> gönder.
                </Text>
              </LinearGradient>
            </View>

            {/* Aile Güvenlik Zinciri Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="shield-checkmark" size={24} color={colors.emergency.critical} />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Aile Güvenlik Zinciri</Text>
                <Text style={styles.featureCardText}>
                  Tüm aile üyelerinin durumunu{' '}
                  <Text style={styles.featureCardAccent}>tek ekranda</Text> gör,{' '}
                  <Text style={styles.featureCardAccent}>güvenlik durumunu</Text> takip et,{' '}
                  <Text style={styles.featureCardAccent}>otomatik uyarılar</Text> al.
                </Text>
              </LinearGradient>
            </View>

            {/* Offline Harita Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(251, 191, 36, 0.4)', 'rgba(251, 191, 36, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="map" size={24} color="#fbbf24" />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Offline Harita</Text>
                <Text style={styles.featureCardText}>
                  <Text style={styles.featureCardAccent}>İnternet olmasa bile</Text> offline harita ile{' '}
                  <Text style={styles.featureCardAccent}>yön bul</Text>,{' '}
                  <Text style={styles.featureCardAccent}>toplanma noktalarını</Text> gör,{' '}
                  <Text style={styles.featureCardAccent}>güvenli rotaları</Text> takip et.
                </Text>
              </LinearGradient>
            </View>

            {/* Toplanma Noktaları Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(34, 197, 94, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(34, 197, 94, 0.4)', 'rgba(34, 197, 94, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="location" size={28} color="#22c55e" />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Toplanma Noktaları</Text>
                <Text style={styles.featureCardText}>
                  Yakındaki toplanma noktalarını haritada gör,{' '}
                  <Text style={styles.featureCardAccent}>en güvenli rotayı</Text> öğren,{' '}
                  <Text style={styles.featureCardAccent}>aile üyeleriyle</Text> buluşma planı yap.
                </Text>
              </LinearGradient>
            </View>

            {/* Erken Deprem Uyarısı Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="warning" size={24} color={colors.emergency.critical} />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Erken Deprem Uyarısı</Text>
                <Text style={styles.featureCardText}>
                  <Text style={styles.featureCardAccent}>10-20 saniye önceden</Text> uyarı,{' '}
                  <Text style={styles.featureCardAccent}>6 kaynak</Text> doğrulama,{' '}
                  <Text style={styles.featureCardAccent}>AI destekli</Text> tahmin ile hayatınızı koruyun.
                </Text>
              </LinearGradient>
            </View>

            {/* AI Asistan Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(139, 92, 246, 0.4)', 'rgba(139, 92, 246, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="sparkles" size={24} color="#8b5cf6" />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>AI Asistan</Text>
                <Text style={styles.featureCardText}>
                  <Text style={styles.featureCardAccent}>Risk skoru</Text> hesaplama,{' '}
                  <Text style={styles.featureCardAccent}>hazırlık planı</Text> ve{' '}
                  <Text style={styles.featureCardAccent}>panik asistanı</Text> ile her zaman hazır olun.
                </Text>
              </LinearGradient>
            </View>

            {/* Haberler Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="newspaper" size={24} color={colors.accent.primary} />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>AI Destekli Haberler</Text>
                <Text style={styles.featureCardText}>
                  <Text style={styles.featureCardAccent}>6 kaynak</Text> doğrulama,{' '}
                  <Text style={styles.featureCardAccent}>AI özeti</Text> ve{' '}
                  <Text style={styles.featureCardAccent}>gerçek zamanlı</Text> güncelleme ile bilgi kirliliğinden uzak kalın.
                </Text>
              </LinearGradient>
            </View>

            {/* SOS Merkezi Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="alert-circle" size={24} color={colors.emergency.critical} />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>SOS Merkezi</Text>
                <Text style={styles.featureCardText}>
                  <Text style={styles.featureCardAccent}>Tek tıkla</Text> acil durum çağrısı,{' '}
                  <Text style={styles.featureCardAccent}>konum paylaşımı</Text> ve{' '}
                  <Text style={styles.featureCardAccent}>enkaz tespiti</Text> ile hayatınızı koruyun.
                </Text>
              </LinearGradient>
            </View>

            {/* Acil Durum Araçları Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(251, 191, 36, 0.4)', 'rgba(251, 191, 36, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="flash" size={24} color="#fbbf24" />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Acil Durum Araçları</Text>
                <Text style={styles.featureCardText}>
                  <Text style={styles.featureCardAccent}>Düdük</Text>,{' '}
                  <Text style={styles.featureCardAccent}>fener</Text> ve{' '}
                  <Text style={styles.featureCardAccent}>Morse kodu</Text> ile yardım çağırın.
                </Text>
              </LinearGradient>
            </View>

            {/* Deprem İzleme Card */}
            <View style={styles.featureCard}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.2)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featureCardGradient}
              >
                <View style={styles.featureIconContainer}>
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.4)', 'rgba(16, 185, 129, 0.1)']}
                    style={styles.featureIconGradient}
                  >
                    <Ionicons name="pulse" size={24} color={colors.status.success} />
                  </LinearGradient>
                </View>
                <Text style={styles.featureCardTitle}>Deprem İzleme</Text>
                <Text style={styles.featureCardText}>
                  <Text style={styles.featureCardAccent}>Gerçek zamanlı</Text> deprem takibi,{' '}
                  <Text style={styles.featureCardAccent}>magnitude filtreleme</Text> ve{' '}
                  <Text style={styles.featureCardAccent}>harita görünümü</Text> ile bilgi sahibi olun.
                </Text>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Permissions Request Section */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.permissionsContainer}>
            <View style={styles.permissionsCard}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.15)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.permissionsCardGradient}
              >
                <View style={styles.permissionsHeader}>
                  <Ionicons name="shield-checkmark" size={24} color={colors.accent.primary} />
                  <Text style={styles.permissionsTitle}>Gerekli İzinler</Text>
                </View>
                <Text style={styles.permissionsText}>
                  Uygulamanın tüm özelliklerini kullanabilmek için aşağıdaki izinlere ihtiyacımız var:
                </Text>
                <View style={styles.permissionsList}>
                  <View style={styles.permissionItem}>
                    <Ionicons name="location" size={18} color={permissionStatus.location ? colors.status.success : colors.text.tertiary} />
                    <Text style={[styles.permissionText, !permissionStatus.location && styles.permissionTextPending]}>
                      Konum (Arka plan dahil)
                    </Text>
                  </View>
                  <View style={styles.permissionItem}>
                    <Ionicons name="notifications" size={18} color={permissionStatus.notifications ? colors.status.success : colors.text.tertiary} />
                    <Text style={[styles.permissionText, !permissionStatus.notifications && styles.permissionTextPending]}>
                      Bildirimler
                    </Text>
                  </View>
                  <View style={styles.permissionItem}>
                    <Ionicons name="bluetooth" size={18} color={permissionStatus.bluetooth ? colors.status.success : colors.text.tertiary} />
                    <Text style={[styles.permissionText, !permissionStatus.bluetooth && styles.permissionTextPending]}>
                      Bluetooth (Şebekesiz iletişim)
                    </Text>
                  </View>
                  <View style={styles.permissionItem}>
                    <Ionicons name="camera" size={18} color={permissionStatus.camera ? colors.status.success : colors.text.tertiary} />
                    <Text style={[styles.permissionText, !permissionStatus.camera && styles.permissionTextPending]}>
                      Kamera (QR kod okuma)
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={handleRequestPermissions}
                  disabled={isRequestingPermissions}
                  style={({ pressed }) => [
                    styles.permissionButton,
                    pressed && styles.permissionButtonPressed,
                    isRequestingPermissions && styles.permissionButtonDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={isRequestingPermissions 
                      ? ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.2)']
                      : ['rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0.3)']
                    }
                    style={styles.permissionButtonGradient}
                  >
                    <Ionicons 
                      name={isRequestingPermissions ? "hourglass" : "shield-checkmark"} 
                      size={20} 
                      color={colors.accent.primary} 
                    />
                    <Text style={styles.permissionButtonText}>
                      {isRequestingPermissions ? 'İzinler Alınıyor...' : 'İzinleri Ver'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </LinearGradient>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Complete Button */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(600)}
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}
      >
        <Pressable
          onPress={handleComplete}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Başlayalım"
          accessibilityHint="Onboarding'i tamamla ve uygulamaya başla"
        >
          <LinearGradient
            colors={['#3b82f6', '#2563eb', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.buttonText}>Başlayalım</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Pagination Indicator */}
      <View style={styles.paginationContainer}>
        <PaginationIndicator currentStep={6} totalSteps={6} />
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
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    opacity: 0.12,
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
  scrollView: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    paddingBottom: spacing[6],
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
  },
  titleContainer: {
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  title: {
    ...typography.h1,
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    maxWidth: 340,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: '#E5E7EB',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing[3],
    maxWidth: 340,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitleAccent: {
    fontWeight: '700',
    color: colors.accent.primary,
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  featureCard: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  featureCardGradient: {
    padding: spacing[2],
    alignItems: 'center',
    gap: spacing[0.5],
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[0.5],
  },
  featureIconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureCardTitle: {
    ...typography.h4,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[0.5],
  },
  featureCardText: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  featureCardAccent: {
    fontWeight: '700',
    color: colors.accent.primary,
  },
  permissionsContainer: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  permissionsCard: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionsCardGradient: {
    padding: spacing[3],
  },
  permissionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  permissionsTitle: {
    ...typography.h4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  permissionsText: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  permissionsList: {
    gap: spacing[1.5],
    marginBottom: spacing[3],
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  permissionText: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.text.primary,
  },
  permissionTextPending: {
    color: colors.text.tertiary,
  },
  permissionButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  permissionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  permissionButtonDisabled: {
    opacity: 0.6,
  },
  permissionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  permissionButtonText: {
    ...typography.button,
    fontSize: 15,
    color: colors.accent.primary,
    fontWeight: '700',
  },
  buttonContainer: {
    paddingHorizontal: spacing[6],
    zIndex: 3,
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

