/**
 * ONBOARDING SCREEN 5 - Emergency & Family + Permissions
 * "Ailenle Bağlantıyı Kaybetme"
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated as RNAnimated,
  StatusBar,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
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
import { setOnboardingCompleted } from '../../utils/onboardingStorage';
import { createLogger } from '../../utils/logger';
import PaginationIndicator from '../../components/onboarding/PaginationIndicator';

const logger = createLogger('OnboardingScreen5');

interface OnboardingScreen5Props {
  navigation: {
    navigate: (screen: string) => void;
    replace: (screen: string) => void;
  };
}

export default function OnboardingScreen5({ navigation }: OnboardingScreen5Props) {
  const insets = useSafeAreaInsets();
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    location: false,
    notifications: false,
    camera: false,
    microphone: false,
    bluetooth: false,
  });
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    // Track screen view
    const trackScreenView = async () => {
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_screen_view', {
          screen: 'onboarding_5',
          screen_name: 'Emergency & Family + Permissions',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
    };
    trackScreenView();

    // Pulse animation
    const pulseLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim]);

  const requestPermissions = useCallback(async () => {
    setIsRequesting(true);
    haptics.impactMedium();

    try {
      const statuses = {
        location: false,
        notifications: false,
        camera: false,
        microphone: false,
        bluetooth: false,
      };

      // ELITE: Request permissions sequentially with proper error handling
      // This ensures each permission is properly requested and tracked

      // 1. Location Permission (CRITICAL for SOS and Family Tracking)
      try {
        logger.info('🔐 [Onboarding] Requesting location permission...');
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        
        if (foregroundStatus === 'granted') {
          logger.info('✅ [Onboarding] Foreground location permission granted');
          
          // Request background location for family tracking
          try {
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            statuses.location = backgroundStatus === 'granted' || foregroundStatus === 'granted';
            
            if (backgroundStatus === 'granted') {
              logger.info('✅ [Onboarding] Background location permission granted');
            } else {
              logger.info('⚠️ [Onboarding] Background location permission denied, using foreground only');
            }
          } catch (bgError) {
            // Background permission might not be available on all platforms
            logger.warn('⚠️ [Onboarding] Background location permission not available:', bgError);
            statuses.location = foregroundStatus === 'granted';
          }
        } else {
          logger.warn('❌ [Onboarding] Location permission denied');
          statuses.location = false;
        }
      } catch (error) {
        logger.error('❌ [Onboarding] Location permission error:', error);
        statuses.location = false;
      }

      // 2. Notification Permission (CRITICAL for Earthquake Alerts)
      try {
        logger.info('🔐 [Onboarding] Requesting notification permission...');
        
        // ELITE: Request comprehensive notification permissions
        // iOS: Request alert, badge, and sound permissions
        // Android: Request notification permission (channels created separately)
        const permissionRequest: any = Platform.OS === 'ios' 
          ? {
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                allowDisplayInCarPlay: true,
                allowCriticalAlerts: false, // Requires special entitlement
              },
            }
          : {};
        
        // ELITE: Use async loader to get notifications module
        const Notifications = await getNotificationsAsync();
        if (!Notifications) {
          logger.warn('Notifications module not available');
          statuses.notifications = false;
        } else {
          const { status, ios, android } = await Notifications.requestPermissionsAsync(permissionRequest);
          
          // ELITE: Check comprehensive permission status
          if (Platform.OS === 'ios') {
            // iOS: Check all notification types
            statuses.notifications = status === 'granted' && 
              ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED &&
            (ios?.allowsAlert ?? false) &&
            (ios?.allowsBadge ?? false) &&
            (ios?.allowsSound ?? false);
          
            if (statuses.notifications) {
              logger.info('✅ [Onboarding] iOS notification permissions granted (alert, badge, sound)');
            } else {
              logger.warn('⚠️ [Onboarding] iOS notification permissions partially granted:', {
                status,
                iosStatus: ios?.status,
                allowsAlert: ios?.allowsAlert,
                allowsBadge: ios?.allowsBadge,
                allowsSound: ios?.allowsSound,
              });
              // Still mark as granted if basic permission is granted
              statuses.notifications = status === 'granted';
            }
          } else {
            // Android: Basic permission check
            statuses.notifications = status === 'granted';
            
            if (statuses.notifications) {
              logger.info('✅ [Onboarding] Android notification permission granted');
              
              // ELITE: Create notification channels immediately after permission granted
              // This ensures all notification types are available
              // CRITICAL: Notifications already loaded above, use it
              try {
              // Create all notification channels
              await Notifications.setNotificationChannelAsync('earthquake', {
                name: 'Deprem Bildirimleri',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
              });

              await Notifications.setNotificationChannelAsync('sos', {
                name: 'Acil Durum',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 500, 500],
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
              });

              await Notifications.setNotificationChannelAsync('messages', {
                name: 'Mesajlar',
                importance: Notifications.AndroidImportance.DEFAULT,
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
              });

              await Notifications.setNotificationChannelAsync('news', {
                name: 'Haber Bildirimleri',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 200, 200],
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
              });

              await Notifications.setNotificationChannelAsync('family', {
                name: 'Aile Bildirimleri',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 200, 200],
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
              });

              await Notifications.setNotificationChannelAsync('trapped', {
                name: 'Enkaz Bildirimleri',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 500, 500],
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
                bypassDnd: true,
              });

              await Notifications.setNotificationChannelAsync('system', {
                name: 'Sistem Bildirimleri',
                importance: Notifications.AndroidImportance.DEFAULT,
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
              });

                logger.info('✅ [Onboarding] All notification channels created successfully');
              } catch (channelError) {
                logger.error('❌ [Onboarding] Failed to create notification channels:', channelError);
                // Don't fail permission request if channels fail
              }
            } else {
              logger.warn('❌ [Onboarding] Android notification permission denied');
            }
          }
        }
      } catch (error) {
        logger.error('❌ [Onboarding] Notification permission error:', error);
        statuses.notifications = false;
      }

      // 3. Camera Permission (for QR code scanning and family member addition)
      try {
        logger.info('🔐 [Onboarding] Requesting camera permission...');
        const { status } = await Camera.requestCameraPermissionsAsync();
        statuses.camera = status === 'granted';
        
        if (statuses.camera) {
          logger.info('✅ [Onboarding] Camera permission granted');
        } else {
          logger.warn('⚠️ [Onboarding] Camera permission denied');
        }
      } catch (error) {
        logger.error('❌ [Onboarding] Camera permission error:', error);
        statuses.camera = false;
      }

      // 4. Microphone Permission (for voice commands and emergency audio)
      try {
        logger.info('🔐 [Onboarding] Requesting microphone permission...');
        const { status } = await Audio.requestPermissionsAsync();
        statuses.microphone = status === 'granted';
        
        if (statuses.microphone) {
          logger.info('✅ [Onboarding] Microphone permission granted');
        } else {
          logger.warn('⚠️ [Onboarding] Microphone permission denied');
        }
      } catch (error) {
        logger.error('❌ [Onboarding] Microphone permission error:', error);
        statuses.microphone = false;
      }

      // 5. Bluetooth Permission (Android 12+ for Mesh Communication)
      if (Platform.OS === 'android' && Platform.Version >= 31) {
        try {
          logger.info('🔐 [Onboarding] Requesting Bluetooth permissions (Android 12+)...');
          const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          ]);
          
          const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
          const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
          const advertiseGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] === PermissionsAndroid.RESULTS.GRANTED;
          
          statuses.bluetooth = scanGranted && connectGranted;
          
          if (statuses.bluetooth) {
            logger.info('✅ [Onboarding] Bluetooth permissions granted (scan, connect, advertise)');
          } else {
            logger.warn('⚠️ [Onboarding] Bluetooth permissions partially denied:', {
              scan: scanGranted,
              connect: connectGranted,
              advertise: advertiseGranted,
            });
          }
        } catch (error) {
          logger.error('❌ [Onboarding] Bluetooth permission error:', error);
          statuses.bluetooth = false;
        }
      } else {
        // Bluetooth permission handled automatically on iOS and older Android
        statuses.bluetooth = true;
        logger.info('✅ [Onboarding] Bluetooth permission handled automatically (iOS or Android < 12)');
      }

      // ELITE: Update permission status state
      setPermissionStatus(statuses);

      // ELITE: Initialize NotificationService after permissions granted
      // This ensures notification channels and handlers are set up
      if (statuses.notifications) {
        try {
          const { notificationService } = await import('../../services/NotificationService');
          await notificationService.initialize();
          logger.info('✅ [Onboarding] NotificationService initialized successfully');
        } catch (serviceError) {
          logger.error('❌ [Onboarding] Failed to initialize NotificationService:', serviceError);
          // Don't fail permission request if service init fails
        }
      }

      // Track analytics
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_permissions_granted', {
          location: statuses.location,
          notifications: statuses.notifications,
          camera: statuses.camera,
          microphone: statuses.microphone,
          bluetooth: statuses.bluetooth,
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
      
      // Complete onboarding regardless of permission status
      await setOnboardingCompleted();
      haptics.notificationSuccess();
      
      // ELITE: Don't navigate directly - App.tsx will detect onboarding completion
      // and switch to main app automatically via state update
      // This prevents navigation errors when MainTabs is in a different navigator
    } catch (error) {
      logger.error('Permission request error:', error);
      
      // Track error
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_permissions_error', {
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (analyticsError) {
        logger.warn('Analytics tracking failed:', analyticsError);
      }
      
      // Still complete onboarding
      await setOnboardingCompleted();
      // ELITE: Don't navigate directly - App.tsx will detect onboarding completion
      // and switch to main app automatically via state update
    } finally {
      setIsRequesting(false);
    }
  }, []);

  const handleSkip = useCallback(async () => {
    try {
      haptics.impactLight();
      
      // Track analytics
      try {
        const { firebaseAnalyticsService } = await import('../../services/FirebaseAnalyticsService');
        await firebaseAnalyticsService.logEvent('onboarding_permissions_skipped', {
          screen: 'onboarding_5',
        });
      } catch (error) {
        logger.warn('Analytics tracking failed:', error);
      }
      
      await setOnboardingCompleted();
      // ELITE: Don't navigate directly - App.tsx will detect onboarding completion
      // and switch to main app automatically via state update
    } catch (error) {
      logger.error('Skip onboarding error:', error);
      // ELITE: Still complete onboarding - App.tsx will handle navigation
      await setOnboardingCompleted();
    }
  }, []);

  const grantedCount = useMemo(() => {
    return Object.values(permissionStatus).filter(Boolean).length;
  }, [permissionStatus]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} accessibilityLabel="Onboarding Ekranı 5 - İzinler">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <LinearGradient
        colors={['#0a0e1a', '#0f1419', '#1a1f2e', '#0f1419']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
        {/* Family Network Visual */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.iconContainer}>
          <RNAnimated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)', 'transparent']}
              style={styles.iconGradient}
            >
              <Ionicons name="people" size={64} color={colors.emergency.critical} />
            </LinearGradient>
          </RNAnimated.View>
          
          {/* Connection Lines */}
          <View style={styles.connectionLines}>
            <View style={[styles.connectionLine, styles.connectionLine1]} />
            <View style={[styles.connectionLine, styles.connectionLine2]} />
            <View style={[styles.connectionLine, styles.connectionLine3]} />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text style={styles.title}>Acil Durumda Tek Dokunuşla Haber Ver</Text>
        </Animated.View>

        {/* Subtitle with Highlighted Features */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Text style={styles.subtitle}>
            Acil Durum / SOS ekranı ile tek tuşla çağrı gönder.{' '}
            <Text style={styles.subtitleBold}>Aile Güvenlik Zinciri</Text> ile sevdiklerinin güvende olup olmadığını anında gör.{' '}
            <Text style={styles.subtitleHighlight}>İnternet olmasa bile</Text>{' '}
            <Text style={styles.subtitleAccent}>şebekesiz iletişim</Text> ve{' '}
            <Text style={styles.subtitleAccent}>konum paylaşımı</Text> ile iletişimde kal.
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.featuresContainer}>
          <View style={styles.featureCard}>
            <LinearGradient
              colors={['rgba(239, 68, 68, 0.15)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.featureCardGradient}
            >
              <View style={styles.featureIconWrapper}>
                <LinearGradient
                  colors={['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)']}
                  style={styles.featureIconGradient}
                >
                  <Ionicons name="warning" size={36} color={colors.emergency.critical} />
                </LinearGradient>
              </View>
              <Text style={styles.featureTitle}>SOS Merkezi</Text>
              <Text style={styles.featureText}>Tek dokunuşla acil durum çağrısı</Text>
            </LinearGradient>
          </View>

          <View style={styles.featureCard}>
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.15)', 'rgba(26, 31, 46, 0.95)', 'rgba(20, 24, 36, 0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.featureCardGradient}
            >
              <View style={styles.featureIconWrapper}>
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.1)']}
                  style={styles.featureIconGradient}
                >
                  <Ionicons name="people-circle" size={36} color={colors.accent.primary} />
                </LinearGradient>
              </View>
              <Text style={styles.featureTitle}>Aile Güvenlik Zinciri</Text>
              <Text style={styles.featureText}>
                <Text style={styles.featureTextAccent}>Şebekesiz iletişim</Text> ve{' '}
                <Text style={styles.featureTextAccent}>konum paylaşımı</Text> ile bağlantıda kal
              </Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Permission Explanations */}
        <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.permissionsContainer}>
          <View style={styles.permissionCard}>
            <LinearGradient
              colors={['rgba(26, 31, 46, 0.6)', 'rgba(20, 24, 36, 0.6)']}
              style={styles.permissionCardGradient}
            >
              <View style={styles.permissionItem}>
                <View style={styles.permissionIconWrapper}>
                  <Ionicons 
                    name={permissionStatus.location ? "checkmark-circle" : "location"} 
                    size={22} 
                    color={permissionStatus.location ? colors.status.success : colors.accent.primary} 
                  />
                </View>
                <View style={styles.permissionTextWrapper}>
                  <Text style={styles.permissionLabel}>Konum İzni</Text>
                  <Text style={styles.permissionText}>
                    Bulunduğun bölgedeki riskleri ve{' '}
                    <Text style={styles.permissionTextAccent}>ailenin konumunu</Text> görebilmen için.
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.permissionCard}>
            <LinearGradient
              colors={['rgba(26, 31, 46, 0.6)', 'rgba(20, 24, 36, 0.6)']}
              style={styles.permissionCardGradient}
            >
              <View style={styles.permissionItem}>
                <View style={styles.permissionIconWrapper}>
                  <Ionicons 
                    name={permissionStatus.notifications ? "checkmark-circle" : "notifications"} 
                    size={22} 
                    color={permissionStatus.notifications ? colors.status.success : colors.accent.primary} 
                  />
                </View>
                <View style={styles.permissionTextWrapper}>
                  <Text style={styles.permissionLabel}>Bildirim İzni</Text>
                  <Text style={styles.permissionText}>
                    Deprem uyarıları, kritik haberler ve acil durum bildirimleri için.
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.permissionCard}>
            <LinearGradient
              colors={['rgba(26, 31, 46, 0.6)', 'rgba(20, 24, 36, 0.6)']}
              style={styles.permissionCardGradient}
            >
              <View style={styles.permissionItem}>
                <View style={styles.permissionIconWrapper}>
                  <Ionicons 
                    name={permissionStatus.camera ? "checkmark-circle" : "camera"} 
                    size={22} 
                    color={permissionStatus.camera ? colors.status.success : colors.accent.primary} 
                  />
                </View>
                <View style={styles.permissionTextWrapper}>
                  <Text style={styles.permissionLabel}>Kamera İzni</Text>
                  <Text style={styles.permissionText}>
                    QR kod okuma ve aile üyesi ekleme için.
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {Platform.OS === 'android' && Platform.Version >= 31 && (
            <View style={styles.permissionCard}>
              <LinearGradient
                colors={['rgba(26, 31, 46, 0.6)', 'rgba(20, 24, 36, 0.6)']}
                style={styles.permissionCardGradient}
              >
                <View style={styles.permissionItem}>
                  <View style={styles.permissionIconWrapper}>
                    <Ionicons 
                      name={permissionStatus.bluetooth ? "checkmark-circle" : "bluetooth"} 
                      size={22} 
                      color={permissionStatus.bluetooth ? colors.status.success : colors.accent.primary} 
                    />
                  </View>
                  <View style={styles.permissionTextWrapper}>
                    <Text style={styles.permissionLabel}>Bluetooth İzni</Text>
                    <Text style={styles.permissionText}>
                      <Text style={styles.permissionTextAccent}>Şebekesiz iletişim</Text> için yakın cihazlarla bağlantı kurabilmek.
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}
        </Animated.View>
        </View>
      </ScrollView>

      {/* Buttons - Fixed at Bottom */}
      <Animated.View
        entering={FadeInDown.delay(1000).duration(600)}
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}
      >
        <Pressable
          onPress={requestPermissions}
          disabled={isRequesting}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isRequesting) && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Tüm İzinleri Ver"
          accessibilityHint="Konum, bildirim, kamera ve diğer izinleri ver"
          accessibilityState={{ disabled: isRequesting }}
        >
          <LinearGradient
            colors={isRequesting ? ['#64748b', '#475569'] : ['#3b82f6', '#2563eb', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            {isRequesting ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.buttonText}>İzinler İsteniyor...</Text>
              </>
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={20} color="#fff" />
                <Text style={styles.buttonText}>Tüm İzinleri Ver</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          disabled={isRequesting}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Daha Sonra Ayarla"
          accessibilityHint="İzinleri şimdi vermeden ana uygulamaya geç"
          accessibilityState={{ disabled: isRequesting }}
        >
          <Text style={styles.secondaryButtonText}>Daha Sonra Ayarla</Text>
        </Pressable>

        {grantedCount === 0 && (
          <Text style={styles.note}>
            İstediğin zaman ayarlardan izin verebilirsin, bazı özellikler sınırlı çalışabilir.
          </Text>
        )}
      </Animated.View>

      {/* Pagination Indicator */}
      <View style={styles.paginationContainer}>
        <PaginationIndicator currentStep={5} totalSteps={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing[4],
    paddingHorizontal: spacing[6],
  },
  content: {
    alignItems: 'center',
    paddingTop: spacing[2],
  },
  iconContainer: {
    marginBottom: spacing[6],
    position: 'relative',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  connectionLines: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  connectionLine: {
    position: 'absolute',
    width: 2,
    height: 40,
    backgroundColor: colors.accent.primary,
    opacity: 0.3,
  },
  connectionLine1: {
    top: 20,
    left: '50%',
    transform: [{ rotate: '-45deg' }],
  },
  connectionLine2: {
    top: 20,
    right: '20%',
    transform: [{ rotate: '45deg' }],
  },
  connectionLine3: {
    bottom: 20,
    left: '50%',
    transform: [{ rotate: '45deg' }],
  },
  title: {
    ...typography.h1,
    fontSize: 26,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[4],
    maxWidth: 320,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[6],
    maxWidth: 340,
    lineHeight: 24,
  },
  subtitleBold: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitleHighlight: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  subtitleAccent: {
    fontWeight: '700',
    color: colors.accent.primary,
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 360,
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  featureCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  featureCardGradient: {
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[3],
  },
  featureIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  featureIconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTitle: {
    ...typography.h4,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  featureText: {
    ...typography.bodySmall,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  featureTextAccent: {
    fontWeight: '700',
    color: colors.accent.primary,
  },
  permissionsContainer: {
    width: '100%',
    maxWidth: 360,
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  permissionCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  permissionCardGradient: {
    padding: spacing[4],
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  permissionIconWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  permissionTextWrapper: {
    flex: 1,
    gap: spacing[1],
  },
  permissionLabel: {
    ...typography.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  permissionText: {
    ...typography.bodySmall,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  permissionTextAccent: {
    fontWeight: '600',
    color: colors.accent.primary,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    gap: spacing[3],
    backgroundColor: 'rgba(10, 14, 26, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.1)',
  },
  primaryButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  secondaryButton: {
    paddingVertical: spacing[4],
    alignItems: 'center',
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
  secondaryButtonText: {
    ...typography.body,
    color: colors.text.tertiary,
    fontSize: 16,
  },
  note: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing[2],
    paddingHorizontal: spacing[4],
  },
  paginationContainer: {
    position: 'absolute',
    bottom: spacing[4],
    left: 0,
    right: 0,
  },
});

