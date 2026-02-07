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
        <Text style={styles.lastUpdated}>Son Güncelleme: 7 Şubat 2026 | Sürüm 2.0</Text>

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
            • Konum Bilgileri: Acil durumlarda konumunuzu paylaşmak için{'\n'}
            • Sağlık Bilgileri: Acil durumlarda sağlık profiliniz (isteğe bağlı){'\n'}
            • İletişim Bilgileri: Aile üyeleri ve acil durum kişileri (ICE){'\n'}
            • Mesajlaşma Verileri: Offline mesajlaşma içeriği
          </Text>

          <Text style={styles.subsectionTitle}>2.2. Teknik Bilgiler</Text>
          <Text style={styles.paragraph}>
            • Cihaz Bilgileri: İşletim sistemi, model, versiyon{'\n'}
            • Kullanım Verileri: Uygulama kullanım istatistikleri{'\n'}
            • Sensör Verileri: Deprem algılama için ivmeölçer verileri{'\n'}
            • Ağ Bilgileri: Bluetooth ve WiFi durumu
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
            • Servis Sağlayıcılar: Firebase, Analytics gibi servisler (şifrelenmiş){'\n'}
            • Kullanıcı İzni: Açıkça izin verdiğiniz durumlarda
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. VERİ GÜVENLİĞİ</Text>
          <Text style={styles.paragraph}>
            • End-to-End Şifreleme: Tüm hassas veriler şifrelenir{'\n'}
            • Güvenli Depolama: Firebase Secure Storage kullanılır{'\n'}
            • Erişim Kontrolü: Sadece yetkili kullanıcılar erişebilir{'\n'}
            • Düzenli Güvenlik Denetimleri: Güvenlik açıkları kontrol edilir
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. VERİ SAKLAMA</Text>
          <Text style={styles.paragraph}>
            • Aktif Kullanım: Hesabınız aktif olduğu sürece veriler saklanır{'\n'}
            • Konum Geçmişi: Son 24 saat (cihaz üzerinde), sunucuda saklanmaz{'\n'}
            • SOS Mesajları: 30 gün{'\n'}
            • Chat Mesajları: 90 gün{'\n'}
            • Crash Raporları: 90 gün (Firebase Crashlytics){'\n'}
            • Hesap Silme: Hesabınızı sildiğinizde tüm veriler 30 gün içinde kalıcı olarak silinir
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
            • AI sorguları OpenAI API aracılığıyla işlenir{'\n'}
            • Sorgular anonim olarak gönderilir — kişisel bilgiler AI sağlayıcısıyla paylaşılmaz{'\n'}
            • AI yanıtları cihazınızda önbelleğe alınır{'\n'}
            • İnternetsiz ortamda 241 maddeden oluşan çevrimdışı bilgi tabanı kullanılır
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
          <Text style={styles.sectionTitle}>8. ÇEREZLER VE TAKİP</Text>
          <Text style={styles.paragraph}>
            • Analitik Çerezler: Uygulama performansını izlemek için{'\n'}
            • Reklam Çerezleri: Kullanılmaz{'\n'}
            • Üçüncü Taraf Takip: Sadece Firebase Analytics (anonim)
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
          <Text style={styles.sectionTitle}>10. DEĞİŞİKLİKLER</Text>
          <Text style={styles.paragraph}>
            Bu Gizlilik Politikası zaman zaman güncellenebilir. Önemli değişikliklerde size bildirim
            gönderilecektir. Değişiklikleri kabul etmek için uygulamayı kullanmaya devam edebilirsiniz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. İLETİŞİM</Text>
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

