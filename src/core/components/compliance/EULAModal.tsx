/**
 * EULA MODAL - App Store Compliance
 * Mandatory End User License Agreement (Guideline 1.2)
 * Users must agree to this before using the app.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { BlurView } from '../SafeBlurView';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as haptics from '../../utils/haptics';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useSettingsStore } from '../../stores/settingsStore';

const { height } = Dimensions.get('window');

export const EULAModal = () => {
  const eulaAccepted = useSettingsStore((state) => state.eulaAccepted);
  const setEulaAccepted = useSettingsStore((state) => state.setEulaAccepted);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // If already accepted, return null (don't render anything)
  if (eulaAccepted) return null;

  const handleAgree = () => {
    haptics.notificationSuccess();
    setEulaAccepted(true);
  };

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 20;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      if (!scrolledToBottom) {
        setScrolledToBottom(true);
        haptics.impactLight();
      }
    }
  };

  return (
    <Modal
      visible={!eulaAccepted}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Blurred Background */}
        <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />

        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={32} color={colors.brand.primary} />
            </View>
            <Text style={styles.title}>Kullanım Sözleşmesi</Text>
            <Text style={styles.subtitle}>
              AfetNet'i kullanmaya başlamadan önce lütfen aşağıdaki kuralları okuyup onaylayın.
            </Text>
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            indicatorStyle="black"
          >
            {/* ============================================================
                EMERGENCY SERVICES DISCLAIMER — Apple Guideline 5.1.5
                This section MUST appear FIRST and prominently.
                ============================================================ */}
            <View style={styles.emergencyBanner}>
              <Ionicons name="warning" size={24} color="#dc2626" />
              <Text style={styles.emergencyBannerTitle}>
                ACIL DURUM HIZMETLERI UYARISI
              </Text>
              <Text style={styles.emergencyBannerText}>
                AfetNet, resmi bir acil durum servisi DEGILDIR.{'\n'}
                Hayati tehlike durumunda DERHAL 112'yi arayin.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>1. Acil Durum Hizmetleri Sorumluluk Reddi</Text>
            <Text style={styles.text}>
              <Text style={styles.bold}>ONEMLI — LUTFEN DIKKATLE OKUYUNUZ:</Text>
            </Text>
            <Text style={styles.text}>
              AfetNet bir topluluk guvenlik ve afet iletisim uygulamasidir. Asagidaki hususlari acikca anlayip kabul etmeniz gerekmektedir:
            </Text>

            <Text style={styles.subSectionTitle}>1.1. AfetNet Resmi Acil Servis DEGILDIR</Text>
            <Text style={styles.text}>
              AfetNet; 112 Acil Cagri Merkezi, itfaiye, ambulans, polis, jandarma, AFAD, Kizilay
              veya herhangi bir resmi acil servis birimiyle dogrudan entegre degildir ve bu kurumlara
              bagli degildir. Uygulama, acil cagri merkezlerine bildirim gondermez, acil servislere
              cagri iletmez ve resmi kurtarma operasyonlari baslatamaz.
            </Text>

            <Text style={styles.subSectionTitle}>1.2. Uygulamanin Sundugu Acil Durum Ozellikleri</Text>
            <Text style={styles.text}>
              AfetNet'in SOS ve acil durum ozellikleri yalnizca asagidaki islevleri saglar:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Konum ve durum bilginizi uygulama icerisinde belirlediginiz aile uyeleri ve yakin cevre kisilerine iletir.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Bluetooth Low Energy (BLE) mesh agi uzerinden internet kesintisi sirasinda yakin cevredeki diger AfetNet kullanicilarina mesaj iletir.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Deprem erken uyari bildirimlerini iletir (uygulama icerisinde, resmi uyari sistemlerinden bagimsiz).</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Afet hazirligi, ilk yardim rehberligi ve toplanma noktasi bilgisi saglar.</Text>
            </View>
            <Text style={styles.text}>
              Bu ozellikler topluluk temelli iletisim araclaridir; resmi acil mudahale hizmetlerinin yerini tutmaz ve tutamaz.
            </Text>

            <Text style={styles.subSectionTitle}>1.3. Acil Servis Sevk ve Mudahale Garantisi Yoktur</Text>
            <Text style={styles.text}>
              AfetNet, herhangi bir acil servis biriminin SOS sinyalinizi alacagini, konumunuzu tespit edecegini
              veya size mudahale edecegini garanti etmez ve edemez. Uygulama uzerinden gonderilen SOS sinyalleri
              YALNIZCA uygulama icerisinde kayitli diger kullanicilara (aile, yakinlar) iletilir. Resmi acil
              servisler bu sinyalleri almaz.
            </Text>

            <Text style={styles.subSectionTitle}>1.4. Konum Dogrulugu Sinirlamalari</Text>
            <Text style={styles.text}>
              Uygulamanin iletecegi konum bilgisinin dogrulugu asagidaki faktorlere baglidir ve garanti edilemez:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>GPS sinyal kalitesi (acik alan, kapali alan, bodrum kat, tunel, enkaz alti vb.)</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Internet ve mobil ag baglantisi durumu</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Cihaz sensorunun hassasiyeti ve yazilim surumu</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hava kosullari ve cevresel engeller</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Kullanici tarafindan verilen konum izni seviyesi (on plan / arka plan)</Text>
            </View>
            <Text style={styles.text}>
              Enkaz alti, kapali yapi ve GPS sinyalinin zayif oldugu ortamlarda konum dogrulugu onemli olcude
              dusebilir, gecikebilir veya konum hic iletilmeyebilir. Gelistirici, iletilen konum bilgisinin
              dogrulugunu, zamanliligini veya eksiksizligini garanti etmez.
            </Text>

            <Text style={styles.subSectionTitle}>1.5. Kullanici Sorumlulugu</Text>
            <Text style={styles.text}>
              Bu uygulamayi kullanarak asagidakileri acikca kabul etmis olursunuz:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hayati tehlike iceren her turlu acil durumda DERHAL 112'yi arayacaginizi.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>AfetNet'in 112 veya diger resmi acil servislerin yerini tutmadigini ve ASLA onlarin ikamesi olarak kullanilmayacagini.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>SOS ve konum paylasimi ozelliklerinin yalnizca uygulama icerisindeki kullanicilara (aile, yakinlar) bildirim yaptigini; resmi acil servislere HICBIR bildirim gondermedigini.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Konum bilgisinin hatali, gecikmeli veya eksik olabilecegini ve bunun sonucu olarak konumunuzun tespit edilemeyebilecegini.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Uygulamanin internet, Bluetooth veya cihaz ariza durumlarinda calismayabilecegini.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Gelistiricinin, uygulamanin kullanimindan veya kullanilamamisindan kaynaklanan hicbir dogrudan, dolayli, ozel veya sonucsal zarardan sorumlu tutulamayacagini.</Text>
            </View>

            <View style={styles.emergencyCallout}>
              <Ionicons name="call" size={20} color="#dc2626" />
              <Text style={styles.emergencyCalloutText}>
                HAYATI TEHLIKE DURUMLARINDA DERHAL 112'YI ARAYIN.{'\n'}
                AfetNet, resmi acil servislerin yerine gecmez.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>2. Kullanici Icerigi (UGC)</Text>
            <Text style={styles.text}>
              AfetNet, kullanicilarin mesajlasmasina ve harita uzerinde isaretleme yapmasina olanak tanir.
              Asagidaki davranislara <Text style={styles.bold}>KESINLIKLE TOLERANS GOSTERILMEZ</Text>:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hakaret, kufur, nefret soylemi veya taciz edici icerikler.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Yasa disi aktiviteleri tesvik eden veya pornografik materyaller.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Yanlis ihbarlar veya panik yaratmayi amaclayan dezenformasyon.</Text>
            </View>

            <Text style={styles.sectionTitle}>3. Yaptirimlar</Text>
            <Text style={styles.text}>
              Bu kurallari ihlal eden kullanicilar:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hesaplari askiya alinabilir veya kalici olarak kapatilabilir.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Ilgili icerikler kaldirmaya tabi tutulabilir.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Gerektiginde yasal mercilere bildirilecektir.</Text>
            </View>

            <Text style={styles.sectionTitle}>4. Raporlama</Text>
            <Text style={styles.text}>
              Rahatsiz edici bir icerik veya kullanici gordugunuzde support@afetnet.app adresine bildirimde bulunabilirsiniz.
              Uygunsuz icerik bildirimleriniz tarafimiza iletilir ve en kisa surede degerlendirilir.
            </Text>

            <Text style={styles.sectionTitle}>5. Lisans ve Kapsam</Text>
            <Text style={styles.text}>
              AfetNet size kisisel, devredilemez ve ticari olmayan kullanim lisansi verir.
              Uygulama kullanimi, bu sozlesmeye ek olarak Apple Standart Son Kullanici Lisans Sozlesmesi (EULA) kosullarina da tabidir.
            </Text>

            <Text style={styles.sectionTitle}>6. Veri Guvenligi</Text>
            <Text style={styles.text}>
              AfetNet, aktarilan verileri guvenli sekilde islemeye calisir; ancak ag kesintisi, cihaz arizasi veya ucuncu taraf altyapi sorunlarinda
              iletimin kesintisiz olacagi garanti edilmez.
            </Text>

            <Text style={styles.sectionTitle}>7. Iletisim</Text>
            <Text style={styles.text}>
              Sorulariniz icin: support@afetnet.app{'\n'}
              Gelistirici: Gokhan Camci — Istanbul, Turkiye
            </Text>

            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerInfo}>
              Devam ederek, yukaridaki Hizmet Kosullarini, Acil Durum Hizmetleri Sorumluluk Reddini
              ve Gizlilik Politikasini kabul etmis sayilirsiniz. AfetNet'in resmi acil servislerin
              (112) yerini tutmadigini kabul ediyorsunuz.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && { opacity: 0.9 },
                !scrolledToBottom && styles.buttonDisabled,
              ]}
              onPress={handleAgree}
              disabled={!scrolledToBottom}
            >
              <LinearGradient
                colors={scrolledToBottom
                  ? [colors.brand.primary, '#b91c1c']
                  : ['#9ca3af', '#6b7280']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>
                  {scrolledToBottom ? 'Okudum ve Kabul Ediyorum' : 'Lütfen Sona Kadar Okuyun'}
                </Text>
                {scrolledToBottom && <Ionicons name="arrow-forward" size={20} color="#fff" />}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 600, // iPad: prevent overly wide modal card
    height: '90%', // Fixed height to ensure flex works
    maxHeight: height * 0.9,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex', // Explicit flex context
    flexDirection: 'column',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    width: '100%',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 24,
  },
  emergencyBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  emergencyBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#dc2626',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  emergencyBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
    textAlign: 'center',
    lineHeight: 22,
  },
  emergencyCallout: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emergencyCalloutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
    lineHeight: 20,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },
  text: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '700',
    color: '#dc2626',
  },
  bulletPoint: {
    flexDirection: 'row',
    paddingLeft: 8,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 14,
    color: '#475569',
    marginRight: 8,
    fontWeight: 'bold',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  footerInfo: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
