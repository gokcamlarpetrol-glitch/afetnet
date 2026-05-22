import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, Image, PermissionsAndroid, BackHandler } from 'react-native';
import PagerView from 'react-native-pager-view';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { setOnboardingCompleted } from '../../utils/onboardingStorage';
import { DirectStorage } from '../../utils/storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OnboardingScreen');

// ELITE: Premium onboarding images for each slide (High-Quality PNG)
// Only assets used by SLIDE_DATA below — 5 unused assets were removed after
// the 9→4 slide simplification (sprint 1B).
const IMAGE_ASSETS = {
  seismic: require('../../../../assets/images/onboarding/seismic.jpg'),
  location: require('../../../../assets/images/onboarding/location.jpg'),
  meshNetwork: require('../../../../assets/images/onboarding/mesh_network.jpg'),
  familySafety: require('../../../../assets/images/onboarding/family_safety.jpg'),
};

// SPRINT 1B: 9 slayt → 4 slayt sadeleştirme.
// Sadece izin-isteyen ve özet-bilgi veren slaytlar kaldı. Diğer detaylı tanıtım
// içerikleri uygulama içinde "Tour" + AI Asistan ile keşfedilebilir.
// Kullanıcı zorunlu izin akışını HIZLI geçer (Apple 5.1.1 + Android best practice).
const SLIDE_DATA = [
  {
    id: '1',
    title: "Deprem\nErken Uyarısı",
    // HATA 9 FIX: Yakın deprem fiziği — kullanıcıya gerçeği söyle.
    // Lead time UZAK depremler için işe yarar; yakın merkezli depremde fiziksel olarak gecikir.
    desc: "AFAD, USGS, EMSC ve Kandilli verilerini birleştirir. P-dalgası algılanır algılanmaz cihazınıza bildirim gönderir.\n\nUzak deprem (50km+): saniyeler önce uyarırız.\nYakın deprem: uyarı sarsıntı ile birlikte veya hemen sonra gelir (fizik kuralı).",
    image: IMAGE_ASSETS.seismic,
    action: 'notification',
    buttonText: 'Bildirimleri Aç',
    badge: 'ERKEN UYARI',
  },
  {
    id: '2',
    title: "Konum +\nAile SOS",
    desc: "Acil durumda konumunuz aile üyelerinize ve seçilen kurtarma kanallarına iletilir. Konum izni olmadan SOS sinyaliniz tam etkili olamaz. Veriler şifrelenmiş ve sadece sizin onayınızla paylaşılır.",
    image: IMAGE_ASSETS.location,
    action: 'location',
    buttonText: 'Konumu Etkinleştir',
    badge: 'GPS+SOS',
  },
  {
    id: '3',
    title: "Offline Mesh\nİletişim",
    // HATA 10 FIX: Gerçekçi mesh range — "kilometrelerce" abartı, gerçek BLE 10-30m, hop ile ~500m-1km.
    desc: "GSM çöktüğünde AfetNet çalışır. Bluetooth Low Energy ile yakındaki AfetNet kullanıcılarına mesaj/SOS iletirsiniz.\n\nMesafe: 10-30m doğrudan; hop'lar ile yoğun yerleşimde 500m-1km. App açık iken en iyi çalışır.",
    image: IMAGE_ASSETS.meshNetwork,
    // iOS: BLE permission is OS-triggered on first use (cannot prompt programmatically).
    // Android: request BLUETOOTH_SCAN/CONNECT/ADVERTISE now.
    action: Platform.OS === 'ios' ? null : 'bluetooth',
    buttonText: Platform.OS === 'ios' ? 'Anladım' : 'Bluetooth\'u Etkinleştir',
    badge: 'OFFLİNE',
  },
  {
    id: '4',
    title: "Hazır mısınız?",
    desc: "AfetNet hayat kurtaran bir araçtır ancak resmi acil durum yanıt sistemi değildir. Acil durumda DAİMA önce 112'yi arayın. Diğer özellikleri — aile çemberi, sağlık profili, ilk yardım — uygulama içinde keşfedebilirsiniz.",
    image: IMAGE_ASSETS.familySafety,
    action: null,
    buttonText: 'AfetNet\'e Başla',
    badge: 'BAŞLA',
  },
];


// ELITE: Total slide count for pagination
const TOTAL_SLIDES = SLIDE_DATA.length;

export const OnboardingScreen = () => {
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const navigation = useNavigation<any>();

  // WP-4.1: COPPA yaş kapısı — onboarding tamamlanmadan 13+ beyanı zorunludur.
  // Bir kez onaylanınca tekrar sorulmaz (DirectStorage'da timestamp+sürüm ile kaydedilir).
  const confirmAgeGate = async (): Promise<boolean> => {
    try {
      if (DirectStorage.getString('afetnet_age_gate_v1')) return true;
    } catch { /* okuma hatası — onayı tekrar sor */ }
    return new Promise((resolve) => {
      Alert.alert(
        'Yaş Onayı',
        'AfetNet\'i kullanmak için 13 yaşında veya daha büyük olmalısınız.\n\n13 yaşında veya daha büyük müsünüz?',
        [
          {
            text: 'Hayır',
            style: 'cancel',
            onPress: () => {
              Alert.alert(
                'Yaş Sınırı',
                'AfetNet 13 yaş ve üzeri kullanıcılar içindir. Lütfen bir ebeveyniniz veya bir yetişkinle birlikte kullanın.',
              );
              resolve(false);
            },
          },
          {
            text: 'Evet, 13 veya üzeri',
            onPress: () => {
              try {
                DirectStorage.setString('afetnet_age_gate_v1', JSON.stringify({
                  confirmedAt: Date.now(),
                  version: '1.6.3',
                }));
              } catch { /* kalıcılaştırma best-effort */ }
              resolve(true);
            },
          },
        ],
        { cancelable: false },
      );
    });
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextPage = currentPage + 1;
    // ELITE: Complete onboarding - CoreApp will switch to MainNavigator
    if (nextPage >= TOTAL_SLIDES) {
      // WP-4.1: COPPA — yaş onayı verilmeden onboarding tamamlanamaz.
      const ageConfirmed = await confirmAgeGate();
      if (!ageConfirmed) return;
      await setOnboardingCompleted();
      return;
    }
    pagerRef.current?.setPage(nextPage);
  };

  const handlePageSelected = (e: { nativeEvent: { position: number } }) => {
    const page = e.nativeEvent.position;
    setCurrentPage(page);
    Haptics.selectionAsync();
  };

  // K7: iOS edge-swipe (interactive pop gesture) can bypass permission slides
  // entirely on stack navigators. Disable it for the whole onboarding flow so
  // the user must engage with each permission decision (Apple 5.1.1 parity
  // with Android BackHandler block below).
  useEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({ gestureEnabled: false });
      // Restore on unmount in case the screen is reused elsewhere
      return () => {
        navigation.setOptions({ gestureEnabled: true });
      };
    }
    return undefined;
  }, [navigation]);

  // Apple 5.1.1 / Android: Block hardware back button on permission slides.
  // User must interact with the permission dialog — back button cannot bypass it.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      const slide = SLIDE_DATA[currentPage];
      if (slide.action) {
        // Consume back press — user must grant/deny the permission dialog
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentPage]);

  const handlePermissionRequest = async (type: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (type === 'notification') {
        // Request standard notification permissions during onboarding
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        if (status === 'granted') {
          Alert.alert('Teşekkürler', 'Acil durum bildirimleri aktif.');
          // CRITICAL: Register push token NOW that permission is granted.
          // FCMTokenService.initialize() called during init.ts Phase E returns null
          // if permission wasn't granted yet. Without this re-trigger, the token
          // is never registered until the next app restart — meaning NO push
          // notifications (messages, SOS, earthquakes) are delivered.
          try {
            const { fcmTokenService } = await import('../../services/FCMTokenService');
            fcmTokenService.initialize().catch(e => { if (__DEV__) console.debug('FCM init after onboarding failed:', e); });
          } catch { /* non-blocking */ }
        } else {
          // HATA 7 FIX: Reddedilirse kullanici hayat-guvenligi sonucunu bilmeli.
          // Sessiz devam etmek yerine acik uyari ver. Settings'ten sonradan acabilir.
          Alert.alert(
            'Uyarı — Bildirimler Reddedildi',
            'AfetNet kritik özelliklerin yarısı bildirim gerektirir:\n\n' +
            '• Deprem Erken Uyarı (EEW) — bildirim olmadan uyarı duymazsınız\n' +
            '• Aile SOS sinyalleri — yardım çağrılarını kaçırırsınız\n' +
            '• Toplanma alanı güncellemeleri\n\n' +
            'İstediğiniz zaman Ayarlardan açabilirsiniz.',
            [{ text: 'Anladım', style: 'default' }],
          );
        }
      } else if (type === 'location') {
        // Request foreground location during onboarding.
        // Background location is requested only when the related feature is enabled.
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          Alert.alert('Teşekkürler', 'Konum servisleri aktif.');
        }
      } else if (type === 'bluetooth') {
        // Android only: BLE runtime permissions (iOS triggers at first use, handled as info slide)
        const sdkVersion = Number(Platform.Version || 0);
        const permissions: string[] = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

        if (sdkVersion >= 31) {
          permissions.push(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          );
        }

        const results = await PermissionsAndroid.requestMultiple(permissions as any);
        const allGranted = permissions.every(
          (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED,
        );

        if (allGranted) {
          Alert.alert('Teşekkürler', 'Mesh ağ bağlantısı için gerekli Bluetooth izinleri aktif.');
        } else {
          Alert.alert(
            'Bluetooth İzni Eksik',
            'Offline mesh iletişimi için Bluetooth tarama/bağlantı izinleri zorunludur. İzinleri Ayarlar > Uygulamalar > AfetNet bölümünden açabilirsiniz.',
          );
        }
      }
      handleNext();
    } catch (e) {
      // ELITE: Log error and continue gracefully
      logger.warn('Permission request error:', e);
      Alert.alert('Bilgi', 'İzin isteği atlandı. İsterseniz ayarlardan değiştirebilirsiniz.');
      handleNext(); // Continue even if permission fails
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <PagerView
        style={styles.pagerView}
        initialPage={0}
        ref={pagerRef}
        onPageSelected={handlePageSelected}
        // Apple 5.1.1 hardening:
        // Prevent swipe-bypass of permission slides.
        scrollEnabled={false}
      >
        {SLIDE_DATA.map((slide, index) => (
          <View key={slide.id} style={styles.slideContainer}>
            {/* ELITE: Full-Screen Background Image */}
            <Image
              source={slide.image}
              style={styles.fullScreenImage}
              resizeMode="cover"
            />

            {/* ELITE: Cinematic Gradient Overlay - Bottom focused for text readability */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.98)']}
              locations={[0, 0.4, 0.7, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* ELITE: Premium Content Layout */}
            <View style={styles.contentContainer}>
              <Animated.View
                entering={FadeInUp.delay(400).springify()}
                key={`text-${index}`}
                style={styles.textWrapper}
              >
                {/* ELITE: Premium Badge */}
                {slide.badge && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{slide.badge}</Text>
                  </View>
                )}

                {/* ELITE: Luxury Magazine Typography */}
                <Text style={styles.eyebrow}>AFETNET</Text>
                <Text style={styles.title}>{slide.title}</Text>
                <View style={styles.divider} />
                <Text style={styles.desc}>{slide.desc}</Text>
              </Animated.View>

              <Animated.View
                entering={FadeInUp.delay(600).springify()}
                key={`btn-${index}`}
                style={styles.buttonWrapper}
              >
                {slide.action ? (
                  <>
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => handlePermissionRequest(slide.action)}
                      activeOpacity={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={slide.buttonText}
                      accessibilityHint={`${slide.title.replace(/\n/g, ' ')} için sistem izin penceresi açılır`}
                    >
                      <View style={styles.buttonGradient}>
                        <Text style={styles.buttonText}>{slide.buttonText}</Text>
                      </View>
                    </TouchableOpacity>
                    {/* Apple 5.1.1: İzin slaytlarında "Atla" butonu YOKTUR.
                        Kullanıcı sistem izin diyaloğunu görmek zorundadır.
                        Sisteme "Reddet" diyebilir ama diyaloğu bypass edemez. */}
                    {/* Apple 5.1.5: Konum izni öncesinde EULA erişimi sağlanmalı.
                        Konum paylaşımının 112 ile ENTEGRE OLMADIĞI ve GPS
                        doğruluk sınırlamaları EULA'da (Bölüm 12) açıklanmıştır. */}
                    {slide.action === 'location' && (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('TermsOfService')}
                        style={styles.tosLink}
                        activeOpacity={0.7}
                        accessibilityRole="link"
                        accessibilityLabel="Kullanım Koşulları, Bölüm 12"
                        accessibilityHint="Konum verisinin nasıl kullanıldığını açıklayan koşullar sayfasına gider"
                      >
                        <Text style={styles.tosText}>
                          Konumunuzun nasıl kullanıldığını öğrenmek için{' '}
                          <Text style={styles.tosLinkText}>Kullanım Koşulları</Text>
                          {'\'nı okuyun (Bölüm 12).'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.button}
                      onPress={handleNext}
                      activeOpacity={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={slide.buttonText}
                    >
                      <View style={styles.secondaryButtonInner}>
                        <Text style={styles.secondaryButtonText}>{slide.buttonText}</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Son slayta: ToS kabul metni + link. */}
                    {index === TOTAL_SLIDES - 1 ? (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('TermsOfService')}
                        style={styles.tosLink}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.tosText}>
                          Devam ederek{' '}
                          <Text style={styles.tosLinkText}>Kullanım Koşulları</Text>
                          {'\'nı kabul etmiş olursunuz.'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
              </Animated.View>
            </View>
          </View>
        ))}
      </PagerView>

      {/* ELITE: Premium Pagination Dots */}
      <View style={styles.pagination}>
        {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              currentPage === i && styles.activeDot,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  pagerView: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fullScreenImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    paddingHorizontal: 28,
    paddingBottom: 90,
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    maxWidth: 600, // iPad: constrain content width for readability
    alignSelf: 'center',
  },
  // ELITE: Premium Text Container
  textWrapper: {
    alignItems: 'center',
    marginBottom: 32,
  },
  // ELITE: Premium Badge - Glassmorphism style
  badgeContainer: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(212, 175, 55, 0.95)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // ELITE: Luxury Magazine Eyebrow
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(212, 175, 55, 0.95)', // Gold accent
    letterSpacing: 5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  // ELITE: Premium Title - Magazine Style
  title: {
    fontSize: 28,
    fontWeight: '300', // Light weight for elegance
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
    lineHeight: 36,
  },
  // ELITE: Gold Divider Line
  divider: {
    width: 50,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.6)',
    marginBottom: 20,
  },
  // ELITE: Premium Description - Editorial Style (Optimized for comprehensive text)
  desc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: 0.2,
    paddingHorizontal: 4,
  },
  // ELITE: Button Container
  buttonWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  // ELITE: Premium Button Base - Refined rounded corners
  button: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  // ELITE: Primary Button - Elegant White Glassmorphism
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
  },
  buttonText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // ELITE: Secondary Button - Glass Style with soft border
  secondaryButtonInner: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
  },
  secondaryButtonText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
  },
  // ELITE: Premium Pagination - Refined dots
  pagination: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 6,
  },
  activeDot: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  // Apple 5.1.5: Terms of Service kabul linki (son slayt)
  tosLink: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tosText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  tosLinkText: {
    color: 'rgba(212, 175, 55, 0.85)',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
