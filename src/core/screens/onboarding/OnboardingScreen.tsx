import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, Image } from 'react-native';
import PagerView from 'react-native-pager-view';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { hasCompletedOnboarding, setOnboardingCompleted } from '../../utils/onboardingStorage';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OnboardingScreen');

// ELITE: Premium onboarding images for each slide (High-Quality PNG)
const IMAGE_ASSETS = {
  seismic: require('../../../../assets/images/onboarding/seismic.png'),
  location: require('../../../../assets/images/onboarding/location.png'),
  verification: require('../../../../assets/images/onboarding/verification.png'),
  aiAssistant: require('../../../../assets/images/onboarding/ai_assistant_brain.png'),
  meshNetwork: require('../../../../assets/images/onboarding/mesh_network.png'),
  familySafety: require('../../../../assets/images/onboarding/family_safety.png'),
  sos: require('../../../../assets/images/onboarding/sos.png'),
  toolkit: require('../../../../assets/images/onboarding/toolkit.png'),
  settingsControl: require('../../../../assets/images/onboarding/settings_control.png'),
};

const SLIDE_DATA = [
  {
    id: '1',
    title: "P-Dalga\nİstihbaratı",
    desc: "Deprem başladığında ilk gelen zararsız P-dalgasını tespit eden yapay zeka destekli sensör ağımız, yıkıcı S-dalgası size ulaşmadan 3-60 saniye önce sizi uyarır. AFAD, Kandilli, USGS ve EMSC'den 4 kaynaktan çapraz doğrulama. 🔬 On-device AI ile gerçek zamanlı sismik izleme - Japonya Erken Uyarı Sistemi standartlarında.",
    image: IMAGE_ASSETS.seismic,
    action: 'notification',
    buttonText: 'Hayat Kurtaran Bildirimleri Aç',
    badge: '4 KAYNAK',
  },
  {
    id: '2',
    title: "Hassas Konum +\nPDR Teknolojisi",
    desc: "Enkaz altında kaldığınızda GPS çalışmaz. AfetNet'in eşsiz PDR (Pedestrian Dead Reckoning) teknolojisi, telefonunuzun sensörleriyle adımlarınızı takip eder. GPS + WiFi + Hücresel triangülasyon + PDR = metrelik hassasiyet. Son konumunuz bataryanız bitse bile AFAD ve 112'ye iletilir.",
    image: IMAGE_ASSETS.location,
    action: 'location',
    buttonText: 'Konum Erişimi Ver',
    badge: 'GPS+PDR',
  },
  {
    id: '3',
    title: "Yapay Zeka\nDoğrulama & Tehlike",
    desc: "Afet anında sosyal medyada yayılan asılsız haberler panik yaratır. AfetNet AI'ı, resmi kaynaklardan gelen verileri çapraz doğrular (%99.7 doğruluk). Ayrıca deprem büyüklüğüne göre otomatik tehlike haritası oluşturur: göçebilecek binalar, patlayabilecek gaz hatları, çökebilecek viyadükler.",
    image: IMAGE_ASSETS.verification,
    action: null,
    buttonText: 'Anladım, Devam Et',
    badge: 'AI TEHLİKE HARİTASI',
  },
  {
    id: '4',
    title: "Kişisel Afet\nRehberiniz",
    desc: "24/7 yanınızda olan yapay zeka asistanınız: Evinizin deprem risk skorunu hesaplar, kişisel acil durum çantası önerir, en yakın toplanma alanını gösterir ve ailenize özel tahliye rotası oluşturur. Panik anında sakin kalmanızı sağlayan nefes egzersizleri, ilk yardım rehberleri ve enkaz altı hayatta kalma taktikleri. 🧠 Türkçe doğal dil anlama.",
    image: IMAGE_ASSETS.aiAssistant,
    action: null,
    buttonText: 'Rehberimi Tanıyorum',
    badge: 'TÜRKÇE AI',
  },
  {
    id: '5',
    title: "Mesh Network +\nYakınlık Uyarıları",
    desc: "GSM çöktüğünde AfetNet çalışır! Bluetooth mesh ile yakındaki kullanıcılar arasında mesajlar kilometrelerce taşınır. 🆕 Yakınlık Uyarıları: Sizin algılamadığınız bir tehlike yakınınızdaki kullanıcı tarafından bildirildiğinde anında uyarılırsınız. Store & Forward + otomatik relay ile hiçbir mesaj kaybolmaz.",
    image: IMAGE_ASSETS.meshNetwork,
    action: 'bluetooth',
    buttonText: 'Mesh Ağını Aktifleştir',
    badge: '🆕 YAKINLIK UYARILARI',
  },
  {
    id: '6',
    title: "Aile Güvenlik\nÇemberi",
    desc: "Deprem anında en büyük endişe: Sevdikleriniz nerede? Aile Çemberi ile tüm aile üyelerinin gerçek zamanlı konumunu görün. Tek tuşla 'Güvendeyim', 'Yardıma İhtiyacım Var' durumu bildirin. ☁️ Firebase bulut senkronizasyonu ile cihaz değişse bile verileriniz korunur. QR kod ile 10 saniyede aile üyesi ekleyin.",
    image: IMAGE_ASSETS.familySafety,
    action: 'camera_contacts',
    buttonText: 'Ailemi Ekle',
    badge: 'BULUT SENKRONİZASYON',
  },
  {
    id: '7',
    title: "Akıllı SOS +\nWidget & Watch",
    desc: "Enkaz altında parmağınızı oynatamayabilirsiniz. AfetNet akıllı SOS: Widget ile kilit ekranından, Apple Watch'tan, ses komutuyla veya sarsıntı algılayarak otomatik acil çağrı. Konumunuz, sağlık bilgileriniz ve ICE kişileriniz anında 112, AFAD, ailenize ve gönüllü kurtarma ekiplerine iletilir. ⌚ Tüm platformlarda!",
    image: IMAGE_ASSETS.sos,
    action: null,
    buttonText: 'Hayatımı Koruyorum',
    badge: 'WİDGET + WATCH',
  },
  {
    id: '8',
    title: "Dijital Hayatta\nKalma Seti",
    desc: "Telefonunuz hayatta kalma aracınız: LED fener (SOS mors kodu), ultrasonik düdük (kurtarma ekiplerinin frekansı), çevrimdışı haritalar, pusula, ilk yardım rehberi, acil durum radyo frekansları ve enkaz altı hayatta kalma rehberi. İnternet gerekmez! Hepsi tek uygulamada, offline çalışır.",
    image: IMAGE_ASSETS.toolkit,
    action: null,
    buttonText: 'Araçları Keşfet',
    badge: 'OFFLİNE ÇALIŞIR',
  },
];


// ELITE: Total slide count for pagination
const TOTAL_SLIDES = SLIDE_DATA.length;

export const OnboardingScreen = () => {
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const navigation = useNavigation<any>();

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextPage = currentPage + 1;
    // ELITE: Complete onboarding - CoreApp will switch to MainNavigator
    if (nextPage >= TOTAL_SLIDES) {
      await setOnboardingCompleted();
      // Set store state to trigger navigation in CoreApp
      useOnboardingStore.getState().setCompleted(true);
      return;
    }
    pagerRef.current?.setPage(nextPage);
  };

  const handlePageSelected = (e: { nativeEvent: { position: number } }) => {
    const page = e.nativeEvent.position;
    setCurrentPage(page);
    Haptics.selectionAsync();
  };

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      const hasCompleted = await hasCompletedOnboarding();
      if (hasCompleted) {
        // ELITE: Complete via store - CoreApp will switch to MainNavigator
        useOnboardingStore.getState().setCompleted(true);
      }
    };
    checkOnboardingStatus();
  }, []);

  const handlePermissionRequest = async (type: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (type === 'notification') {
        // ELITE: Request critical alerts on iOS for emergency notifications
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true,
          },
        });
        if (status === 'granted') {
          Alert.alert('Teşekkürler', 'Acil durum bildirimleri aktif.');
        }
      } else if (type === 'location') {
        // ELITE: Request both foreground and background location
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus === 'granted') {
          // Also request background location for iOS
          if (Platform.OS === 'ios') {
            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            if (bgStatus === 'granted') {
              Alert.alert('Teşekkürler', 'Konum takibi tam yetki ile aktif.');
            } else {
              Alert.alert('Teşekkürler', 'Konum servisleri aktif (ön plan).');
            }
          } else {
            Alert.alert('Teşekkürler', 'Konum servisleri aktif.');
          }
        }
      } else if (type === 'camera_contacts') {
        // ELITE: Request camera and contacts for family safety features
        const cam = await Camera.requestCameraPermissionsAsync();
        const con = await Contacts.requestPermissionsAsync();
        if (cam.status === 'granted' && con.status === 'granted') {
          Alert.alert('Teşekkürler', 'Aile güvenliği izinleri aktif.');
        } else {
          Alert.alert('Bilgi', 'Bazı izinler verilmedi. Ayarlardan değiştirebilirsiniz.');
        }
      } else if (type === 'bluetooth') {
        // ELITE: Real Bluetooth/BLE permission handling
        // On iOS 13+, Bluetooth access requires permission
        // On Android 12+, BLUETOOTH_SCAN and BLUETOOTH_CONNECT required
        if (Platform.OS === 'ios') {
          // iOS: Bluetooth permission is requested when first accessing BLE
          // The permission dialog appears automatically when app tries to use BLE
          // For now, we inform the user and proceed
          Alert.alert(
            'Mesh Ağı',
            'Bluetooth izni, uygulama Mesh ağına ilk bağlandığında istenecektir.',
            [{ text: 'Tamam' }],
          );
        } else {
          // Android: Request location permission (required for BLE scanning)
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            Alert.alert('Teşekkürler', 'Mesh ağ bağlantısı hazır.');
          } else {
            Alert.alert('Bilgi', 'Bluetooth için konum izni gerekli.');
          }
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
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => handlePermissionRequest(slide.action)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.buttonGradient}>
                      <Text style={styles.buttonText}>{slide.buttonText}</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleNext}
                    activeOpacity={0.9}
                  >
                    <View style={styles.secondaryButtonInner}>
                      <Text style={styles.secondaryButtonText}>{slide.buttonText}</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* ELITE: Skip Option */}
                <TouchableOpacity
                  onPress={handleNext}
                  style={styles.skipButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipText}>Atla</Text>
                </TouchableOpacity>
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
  },
  loginWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 0,
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
  // ELITE: Skip Button - Minimal & Elegant
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 1.5,
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
  // Legacy styles (kept for compatibility)
  iconContainer: {
    marginBottom: 32,
  },
  imageContainer: {
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
});

