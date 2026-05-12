/**
 * PRIVACY POLICY SCREEN - ELITE DETAILED
 * Comprehensive privacy policy with all details
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import * as haptics from '../../utils/haptics';
import type { StackNavigationProp } from '@react-navigation/stack';

// ELITE: Proper navigation typing for type safety
interface PrivacyPolicyScreenProps {
  navigation?: StackNavigationProp<Record<string, undefined>>;
}

export default function PrivacyPolicyScreen({ navigation }: PrivacyPolicyScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Pressable
          onPress={() => {
            haptics.impactLight();
            navigation?.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Gizlilik Politikası</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Son Güncelleme: 1 Nisan 2026 | Sürüm 2.2</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. GİRİŞ</Text>
          <Text style={styles.paragraph}>
            AfetNet ("Biz", "Bizim" veya "Uygulama"), kullanıcılarımızın gizliliğini korumayı taahhüt eder.
            Bu Gizlilik Politikası, AfetNet uygulamasını kullandığınızda topladığımız bilgileri, bu bilgileri
            nasıl kullandığımızı ve paylaştığımızı açıklar.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. TOPLANAN BİLGİLER</Text>

          <Text style={styles.subsectionTitle}>2.1. Kişisel Bilgiler</Text>
          <Text style={styles.paragraph}>
            • Cihaz Kimliği: Her cihaz için benzersiz bir kimlik oluşturulur{'\n'}
            • Konum Bilgileri: Acil durumlar ve aile güvenliği özellikleri için{'\n'}
            • Sağlık Bilgileri: Acil durumlarda sağlık profiliniz (isteğe bağlı){'\n'}
            • İletişim Bilgileri: Aile üyeleri ve acil durum kişileri (ICE){'\n'}
            • Mesajlaşma Verileri: Mesajlaşma içeriği (çevrimiçi ve çevrimdışı)
          </Text>

          <Text style={styles.subsectionTitle}>2.2. Teknik Bilgiler</Text>
          <Text style={styles.paragraph}>
            • Cihaz Bilgileri: İşletim sistemi, model, versiyon{'\n'}
            • Kullanım Verileri: Uygulama kullanım istatistikleri (yalnızca cihazınızda saklanır, sunuculara gönderilmez){'\n'}
            • Sensör Verileri: Deprem algılama için ivmeölçer verileri{'\n'}
            • Ağ Bilgileri: Bluetooth ve WiFi durumu{'\n'}
            • Hata Verileri: Uygulama performansı ve hata tespiti için anonim teknik veriler toplanabilir
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. BİLGİLERİN KULLANIMI</Text>
          <Text style={styles.paragraph}>
            Topladığımız bilgiler şu amaçlarla kullanılır:{'\n\n'}
            • Acil durum bildirimleri ve erken uyarı sistemi{'\n'}
            • Aile üyelerinizle iletişim kurma{'\n'}
            • Offline mesajlaşma ve BLE mesh ağı{'\n'}
            • Deprem algılama ve erken uyarı{'\n'}
            • Uygulama performansını iyileştirme{'\n'}
            • Güvenlik ve hata ayıklama
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. BİLGİLERİN PAYLAŞIMI</Text>
          <Text style={styles.paragraph}>
            Bilgileriniz sadece şu durumlarda paylaşılır:{'\n\n'}
            • Acil Durumlar: Hayat kurtarma amaçlı acil durumlarda{'\n'}
            • Hukuki Zorunluluklar: Yasal gereklilikler{'\n'}
            • Servis Sağlayıcılar: Firebase, OpenAI gibi servisler (güvenlik kuralları dahilinde){'\n'}
            • Kullanıcı İzni: Açıkça izin verdiğiniz durumlarda
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. VERİ GÜVENLİĞİ</Text>
          <Text style={styles.paragraph}>
            • Bulut Güvenliği: Verileriniz Firebase güvenlik kuralları ve Google Cloud altyapısı ile korunur{'\n'}
            • Mesh Şifreleme: Cihazlar arası BLE mesh iletişimi uçtan uca şifrelenir{'\n'}
            • Erişim Kontrolü: Firestore güvenlik kuralları ile yetkisiz erişim engellenir{'\n'}
            • Güvenli İletişim: Sunucu bağlantıları TLS/SSL ile şifrelenir
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. VERİ SAKLAMA</Text>
          <Text style={styles.paragraph}>
            • Aktif Kullanım: Hesabınız aktif olduğu sürece veriler saklanır{'\n'}
            • Konum Verileri: Anlık konumunuz ve konum geçmişiniz, aile güvenliği özellikleri için hem cihazınızda hem de sunucularımızda güvenli şekilde saklanır{'\n'}
            • Verileriniz yasal yükümlülükler ve hizmet gereksinimleri doğrultusunda saklanır{'\n'}
            • Hesabınızı sildiğinizde verileriniz mümkün olan en kısa sürede kaldırılır
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6.5. VERİ AKTARIM ÜLKELERİ</Text>
          <Text style={styles.paragraph}>
            Firebase hizmetleri, Google'ın küresel veri merkezi altyapısını kullanır. Verileriniz
            Avrupa Ekonomik Alanı (AEA) içinde ve dışında (ABD dahil) işlenebilir. Google,
            Standart Sözleşme Maddeleri (SCC) kapsamında uygun güvenlik önlemleri sağlar.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6.6. YAPAY ZEKA KULLANIMI</Text>
          <Text style={styles.paragraph}>
            AfetNet, acil durum rehberliği için yapay zeka destekli bir asistan sunar:{'\n\n'}
            • Mesajlarınız, doğru yanıt üretebilmek için konuşma bağlamıyla birlikte OpenAI API'ye iletilir{'\n'}
            • İletim, güvenli sunucu proxy'si üzerinden kimlik doğrulamalı olarak gerçekleştirilir{'\n'}
            • OpenAI, API üzerinden gelen verileri model eğitiminde kullanmaz{'\n'}
            • AI yanıtları cihazınızda önbelleğe alınır{'\n'}
            • İnternetsiz ortamda çevrimdışı bilgi tabanı kullanılır
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. KULLANICI HAKLARI</Text>
          <Text style={styles.paragraph}>
            GDPR ve KVKK kapsamında haklarınız:{'\n\n'}
            • Erişim Hakkı: Verilerinize erişim talep edebilirsiniz{'\n'}
            • Düzeltme Hakkı: Yanlış verileri düzeltebilirsiniz{'\n'}
            • Silme Hakkı: Verilerinizi silebilirsiniz{'\n'}
            • İtiraz Hakkı: Veri işlemeye itiraz edebilirsiniz{'\n'}
            • Taşınabilirlik: Verilerinizi başka bir servise aktarabilirsiniz
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. UYGULAMA İÇİ ANALİTİK</Text>
          <Text style={styles.paragraph}>
            • Üçüncü taraf analitik servisi kullanılmamaktadır{'\n'}
            • Uygulama performans verileri yalnızca yerel olarak cihazınızda saklanır{'\n'}
            • Reklam takibi: Kullanılmaz{'\n'}
            • Çerez: Mobil uygulama olarak çerez kullanılmamaktadır
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. ÇOCUKLARIN GİZLİLİĞİ</Text>
          <Text style={styles.paragraph}>
            AfetNet 13 yaş altı çocuklardan bilerek veri toplamaz. 13 yaş altı kullanıcılar için
            ebeveyn izni gereklidir.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. ACİL DURUM KONUM VERİLERİ VE SINIRLAMALAR</Text>

          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerText}>
              AfetNet resmî bir acil durum servisi DEĞİLDİR.{'\n'}
              Hayatî tehlike durumunda DERHAL 112'yi arayın.
            </Text>
          </View>

          <Text style={styles.paragraph}>
            AfetNet, SOS ve acil durum özellikleri kapsamında konum verilerinizi yalnızca uygulama
            içerisinde kayıtlı diğer kullanıcılara (aile üyeleri, yakın çevre) iletmek amacıyla
            kullanır. Bu veriler:{'\n\n'}
            • 112, AFAD veya herhangi bir resmî acil servis birimine GÖNDERİLMEZ{'\n'}
            • Resmî acil servisler tarafından alınamaz ve kullanılamaz{'\n'}
            • Doğruluğu garanti edilemez (GPS sinyali, cihaz durumu, çevresel koşullara bağlıdır){'\n'}
            • Gecikmeli, hatalı veya eksik olabilir{'\n\n'}
            AfetNet bir topluluk güvenliği uygulamasıdır. Uygulama, acil durum sevki yapamaz,
            kurtarma operasyonu başlatamaz ve herhangi bir resmî kurumla doğrudan entegre değildir.
            Hayatî tehlike durumunda daima 112'yi aramanız gerekmektedir.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. DEĞİŞİKLİKLER</Text>
          <Text style={styles.paragraph}>
            Bu Gizlilik Politikası zaman zaman güncellenebilir. Önemli değişikliklerde size bildirim
            gönderilecektir. Değişiklikleri kabul etmek için uygulamayı kullanmaya devam edebilirsiniz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. İLETİŞİM</Text>
          <Text style={styles.paragraph}>
            Gizlilik ile ilgili sorularınız için:{'\n\n'}
            E-posta: support@afetnet.app{'\n'}
            Geliştirici: Gökhan Çamcı — İstanbul, Türkiye
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Bu politika GDPR ve KVKK uyumludur.
          </Text>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 24,
  },
  emergencyBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  emergencyBannerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fca5a5',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  footerText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

