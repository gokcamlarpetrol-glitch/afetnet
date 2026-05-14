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
                ACİL DURUM HİZMETLERİ UYARISI
              </Text>
              <Text style={styles.emergencyBannerText}>
                AfetNet, resmi bir acil durum servisi DEĞİLDİR.{'\n'}
                Hayati tehlike durumunda DERHAL 112&apos;yi arayın.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>1. Acil Durum Hizmetleri Sorumluluk Reddi</Text>
            <Text style={styles.text}>
              <Text style={styles.bold}>ÖNEMLİ — LÜTFEN DİKKATLE OKUYUNUZ:</Text>
            </Text>
            <Text style={styles.text}>
              AfetNet bir topluluk güvenliği ve afet iletişim uygulamasıdır. Aşağıdaki hususları açıkça anlayıp kabul etmeniz gerekmektedir:
            </Text>

            <Text style={styles.subSectionTitle}>1.1. AfetNet Resmi Acil Servis DEĞİLDİR</Text>
            <Text style={styles.text}>
              AfetNet; 112 Acil Çağrı Merkezi, itfaiye, ambulans, polis, jandarma, AFAD, Kızılay
              veya herhangi bir resmi acil servis birimiyle doğrudan entegre değildir ve bu kurumlara
              bağlı değildir. Uygulama, acil çağrı merkezlerine bildirim göndermez, acil servislere
              çağrı iletmez ve resmi kurtarma operasyonları başlatamaz.
            </Text>

            <Text style={styles.subSectionTitle}>1.2. Uygulamanın Sunduğu Acil Durum Özellikleri</Text>
            <Text style={styles.text}>
              AfetNet&apos;in SOS ve acil durum özellikleri yalnızca aşağıdaki işlevleri sağlar:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Konum ve durum bilginizi uygulama içerisinde belirlediğiniz aile üyeleri ve yakın çevre kişilerine iletir.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Bluetooth Low Energy (BLE) mesh ağı üzerinden internet kesintisi sırasında yakın çevredeki diğer AfetNet kullanıcılarına mesaj iletir.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Deprem erken uyarı bildirimlerini iletir (uygulama içerisinde, resmi uyarı sistemlerinden bağımsız).</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Afet hazırlığı, ilk yardım rehberliği ve toplanma noktası bilgisi sağlar.</Text>
            </View>
            <Text style={styles.text}>
              Bu özellikler topluluk temelli iletişim araçlarıdır; resmi acil müdahale hizmetlerinin yerini tutmaz ve tutamaz.
            </Text>

            <Text style={styles.subSectionTitle}>1.3. Acil Servis Sevk ve Müdahale Garantisi Yoktur</Text>
            <Text style={styles.text}>
              AfetNet, herhangi bir acil servis biriminin SOS sinyalinizi alacağını, konumunuzu tespit edeceğini
              veya size müdahale edeceğini garanti etmez ve edemez. Uygulama üzerinden gönderilen SOS sinyalleri
              YALNIZCA uygulama içerisinde kayıtlı diğer kullanıcılara (aile, yakınlar) iletilir. Resmi acil
              servisler bu sinyalleri almaz.
            </Text>

            <Text style={styles.subSectionTitle}>1.4. Konum Doğruluğu Sınırlamaları</Text>
            <Text style={styles.text}>
              Uygulamanın ileteceği konum bilgisinin doğruluğu aşağıdaki faktörlere bağlıdır ve garanti edilemez:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>GPS sinyal kalitesi (açık alan, kapalı alan, bodrum kat, tünel, enkaz altı vb.)</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Internet ve mobil ağ bağlantısı durumu</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Cihaz sensörünün hassasiyeti ve yazılım sürümü</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hava koşulları ve çevresel engeller</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Kullanıcı tarafından verilen konum izni seviyesi (ön plan / arka plan)</Text>
            </View>
            <Text style={styles.text}>
              Enkaz altı, kapalı yapı ve GPS sinyalinin zayıf olduğu ortamlarda konum doğruluğu önemli ölçüde
              düşebilir, gecikebilir veya konum hiç iletilmeyebilir. Geliştirici, iletilen konum bilgisinin
              doğruluğunu, zamanlılığını veya eksiksizliğini garanti etmez.
            </Text>

            <Text style={styles.subSectionTitle}>1.5. Kullanıcı Sorumluluğu</Text>
            <Text style={styles.text}>
              Bu uygulamayı kullanarak aşağıdakileri açıkça kabul etmiş olursunuz:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hayati tehlike içeren her türlü acil durumda DERHAL 112&apos;yi arayacağınızı.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>AfetNet&apos;in 112 veya diğer resmi acil servislerin yerini tutmadığını ve ASLA onların ikamesi olarak kullanılmayacağını.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>SOS ve konum paylaşımı özelliklerinin yalnızca uygulama içerisindeki kullanıcılara (aile, yakınlar) bildirim yaptığını; resmi acil servislere HİÇBİR bildirim göndermediğini.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Konum bilgisinin hatalı, gecikmeli veya eksik olabileceğini ve bunun sonucu olarak konumunuzun tespit edilemeyebileceğini.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Uygulamanın internet, Bluetooth veya cihaz arıza durumlarında çalışmayabileceğini.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Geliştiricinin, uygulamanın kullanımından veya kullanılamamasından kaynaklanan hiçbir doğrudan, dolaylı, özel veya sonuçsal zarardan sorumlu tutulamayacağını.</Text>
            </View>

            <View style={styles.emergencyCallout}>
              <Ionicons name="call" size={20} color="#dc2626" />
              <Text style={styles.emergencyCalloutText}>
                HAYATİ TEHLİKE DURUMLARINDA DERHAL 112&apos;Yİ ARAYIN.{'\n'}
                AfetNet, resmi acil servislerin yerine geçmez.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>2. Kullanıcı İçeriği (UGC)</Text>
            <Text style={styles.text}>
              AfetNet, kullanıcıların mesajlaşmasına ve harita üzerinde işaretleme yapmasına olanak tanır.
              Aşağıdaki davranışlara <Text style={styles.bold}>KESİNLİKLE TOLERANS GÖSTERİLMEZ</Text>:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hakaret, küfür, nefret söylemi veya taciz edici içerikler.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Yasa dışı aktiviteleri teşvik eden veya pornografik materyaller.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Yanlış ihbarlar veya panik yaratmayı amaçlayan dezenformasyon.</Text>
            </View>

            <Text style={styles.sectionTitle}>3. Yaptırımlar</Text>
            <Text style={styles.text}>
              Bu kuralları ihlal eden kullanıcılar:
            </Text>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Hesapları askıya alınabilir veya kalıcı olarak kapatılabilir.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>İlgili içerikler kaldırmaya tabi tutulabilir.</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>Gerektiğinde yasal mercilere bildirilecektir.</Text>
            </View>

            <Text style={styles.sectionTitle}>4. Raporlama</Text>
            <Text style={styles.text}>
              Rahatsız edici bir içerik veya kullanıcı gördüğünüzde support@afetnet.app adresine bildirimde bulunabilirsiniz.
              Uygunsuz içerik bildirimleriniz tarafımıza iletilir ve en kısa sürede değerlendirilir.
            </Text>

            <Text style={styles.sectionTitle}>5. Lisans ve Kapsam</Text>
            <Text style={styles.text}>
              AfetNet size kişisel, devredilemez ve ticari olmayan kullanım lisansı verir.
              Uygulama kullanımı, bu sözleşmeye ek olarak Apple Standart Son Kullanıcı Lisans Sözleşmesi (EULA) koşullarına da tabidir.
            </Text>

            <Text style={styles.sectionTitle}>6. Veri Güvenliği</Text>
            <Text style={styles.text}>
              AfetNet, aktarılan verileri güvenli şekilde işlemeye çalışır; ancak ağ kesintisi, cihaz arızası veya üçüncü taraf altyapı sorunlarında
              iletimin kesintisiz olacağı garanti edilmez.
            </Text>

            <Text style={styles.sectionTitle}>7. İletişim</Text>
            <Text style={styles.text}>
              Sorularınız için: support@afetnet.app{'\n'}
              Geliştirici: Gökhan Çamcı — İstanbul, Türkiye
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
