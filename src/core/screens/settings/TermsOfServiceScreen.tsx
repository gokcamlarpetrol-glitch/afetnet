/**
 * TERMS OF SERVICE SCREEN - ELITE DETAILED
 * Comprehensive terms of service
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
interface TermsOfServiceScreenProps {
  navigation?: StackNavigationProp<Record<string, undefined>>;
}

export default function TermsOfServiceScreen({ navigation }: TermsOfServiceScreenProps) {
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
        <Text style={styles.headerTitle}>Kullanım Koşulları</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Son Güncelleme: 1 Nisan 2026 | Sürüm 2.2</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. KABUL</Text>
          <Text style={styles.paragraph}>
            AfetNet uygulamasını ("Uygulama") kullanarak, bu Kullanım Koşullarını kabul etmiş olursunuz.
            Bu koşulları kabul etmiyorsanız, lütfen uygulamayı kullanmayın.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1.1. YAŞ SINIRI</Text>
          <Text style={styles.paragraph}>
            AfetNet'i kullanabilmek için en az 13 yaşında olmanız gerekmektedir. 13-18 yaş arası
            kullanıcılar, bir ebeveyn veya yasal vasinin gözetiminde ve onayıyla kullanabilir.
            13 yaşından küçük bireylerin AfetNet'i kullanması yasaktır.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1.2. APPLE LİSANS SÖZLEŞMESİ (EULA)</Text>
          <Text style={styles.paragraph}>
            Bu uygulama Apple App Store üzerinden dağıtılmaktadır. Uygulamanın kullanımı,
            bu Koşullara ek olarak Apple'ın Standart Son Kullanıcı Lisans Sözleşmesi (EULA)
            ile de yönetilmektedir. Bu koşullar ile Apple EULA arasında çelişki olması durumunda
            Apple EULA geçerli olacaktır.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. UYGULAMA KULLANIMI</Text>

          <Text style={styles.subsectionTitle}>2.1. Lisans</Text>
          <Text style={styles.paragraph}>
            Size kişisel, ticari olmayan, devredilemez ve münhasır olmayan bir lisans veriyoruz.
            Bu lisans sadece uygulamayı kişisel kullanımınız için kullanmanıza izin verir.
          </Text>

          <Text style={styles.subsectionTitle}>2.2. Kısıtlamalar</Text>
          <Text style={styles.paragraph}>
            Uygulamayı şu şekillerde kullanamazsınız:{'\n\n'}
            • Yasadışı amaçlarla{'\n'}
            • Başkalarının haklarını ihlal etmek için{'\n'}
            • Zararlı içerik yaymak için{'\n'}
            • Uygulamanın güvenliğini ihlal etmek için{'\n'}
            • Tersine mühendislik yapmak için
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. HESAP GÜVENLİĞİ</Text>
          <Text style={styles.paragraph}>
            • Hesabınızın güvenliğinden siz sorumlusunuz{'\n'}
            • Şifrenizi kimseyle paylaşmayın{'\n'}
            • Şüpheli aktivite tespit ederseniz derhal bildirin{'\n'}
            • Hesabınızın güvenliğini sağlamak için gerekli önlemleri alın
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. KULLANICI İÇERİĞİ</Text>
          <Text style={styles.paragraph}>
            • Yüklediğiniz içerikten siz sorumlusunuz{'\n'}
            • Yasadışı, zararlı veya hak ihlali içeren içerik yükleyemezsiniz{'\n'}
            • İçeriğiniz Firebase güvenlik kuralları ve Google Cloud altyapısı ile korunur{'\n'}
            • Cihazlar arası mesh iletişimi uçtan uca şifrelenir{'\n'}
            • Acil durumlarda içeriğiniz paylaşılabilir
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. FİKRİ MÜLKİYET</Text>
          <Text style={styles.paragraph}>
            • Uygulama ve içeriği telif hakkıyla korunmaktadır{'\n'}
            • Ticari markalar ve logolar korunmaktadır{'\n'}
            • İçeriği izinsiz kopyalayamaz veya dağıtamazsınız{'\n'}
            • Açık kaynak bileşenler kendi lisansları altındadır
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. SORUMLULUK REDDİ</Text>
          <Text style={styles.paragraph}>
            • Uygulama "olduğu gibi" sunulmaktadır{'\n'}
            • Acil durumlarda uygulamanın kesintisiz çalışacağını garanti etmiyoruz{'\n'}
            • Veri kaybından sorumlu değiliz{'\n'}
            • Üçüncü taraf servislerden kaynaklanan sorunlardan sorumlu değiliz
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. SINIRLAMA</Text>
          <Text style={styles.paragraph}>
            Yasal olarak izin verilen maksimum ölçüde, hiçbir durumda zararlardan sorumlu olmayacağız.
            Bu, doğrudan, dolaylı, özel, örnek veya sonuçsal zararları içerir.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. İPTAL VE FESİH</Text>
          <Text style={styles.paragraph}>
            • Bu koşulları herhangi bir zamanda iptal edebiliriz{'\n'}
            • Koşulları ihlal ederseniz hesabınız kapatılabilir{'\n'}
            • Hesabınızı istediğiniz zaman silebilirsiniz{'\n'}
            • İptal durumunda verileriniz silinir
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. DEĞİŞİKLİKLER</Text>
          <Text style={styles.paragraph}>
            Bu Kullanım Koşullarını zaman zaman güncelleyebiliriz. Önemli değişikliklerde size bildirim
            gönderilecektir. Değişiklikleri kabul etmek için uygulamayı kullanmaya devam edebilirsiniz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. UYGULANACAK HUKUK</Text>
          <Text style={styles.paragraph}>
            Bu koşullar Türkiye Cumhuriyeti yasalarına tabidir. Herhangi bir anlaşmazlık Türkiye
            mahkemelerinde çözülecektir.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. İLETİŞİM</Text>
          <Text style={styles.paragraph}>
            Sorularınız için:{'\n\n'}
            E-posta: support@afetnet.app{'\n'}
            Geliştirici: Gökhan Çamcı — İstanbul, Türkiye
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. ACİL DURUM HİZMETLERİ VE KONUM SERVİSLERİ — SORUMLULUK REDDİ</Text>

          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerText}>
              ÖNEMLİ: AfetNet resmî bir acil durum servisi DEĞİLDİR.{'\n'}
              Hayatî tehlike durumunda DERHAL 112'yi arayın.
            </Text>
          </View>

          <Text style={styles.subsectionTitle}>12.1. AfetNet Resmî Acil Servis Değildir</Text>
          <Text style={styles.paragraph}>
            AfetNet bir topluluk güvenliği ve afet iletişim uygulamasıdır. Uygulama, 112 Acil Çağrı
            Merkezi, itfaiye, ambulans, polis, jandarma, AFAD, Kızılay veya herhangi bir resmî acil
            servis birimiyle doğrudan entegre DEĞİLDİR ve bu kurumlara bağlı değildir.
            {'\n\n'}
            Uygulama:{'\n'}
            • Acil çağrı merkezlerine bildirim göndermez{'\n'}
            • Acil servislere çağrı iletmez{'\n'}
            • Resmî kurtarma operasyonları başlatamaz{'\n'}
            • Acil servis birimlerinin konumunuzu alacağını veya size müdahale edeceğini garanti edemez
          </Text>

          <Text style={styles.subsectionTitle}>12.2. Uygulamanın Sunduğu Acil Durum Özellikleri</Text>
          <Text style={styles.paragraph}>
            AfetNet'in SOS ve acil durum özellikleri yalnızca aşağıdaki işlevleri sağlar:{'\n\n'}
            • Konum ve durum bilginizi uygulama içerisinde belirlediğiniz aile üyeleri ve yakın çevre kişilerine iletir{'\n'}
            • BLE mesh ağı üzerinden internet kesintisi sırasında yakın çevredeki diğer AfetNet kullanıcılarına mesaj iletir{'\n'}
            • Deprem erken uyarı bildirimlerini uygulama içerisinde iletir (resmî uyarı sistemlerinden bağımsız){'\n'}
            • Afet hazırlığı, ilk yardım rehberliği ve toplanma noktası bilgisi sağlar{'\n\n'}
            Bu özellikler topluluk temelli iletişim araçlarıdır; resmî acil müdahale hizmetlerinin yerini tutmaz ve tutamaz.
          </Text>

          <Text style={styles.subsectionTitle}>12.3. Acil Servis Sevk ve Müdahale Garantisi Yoktur</Text>
          <Text style={styles.paragraph}>
            AfetNet, herhangi bir acil servis biriminin SOS sinyalinizi alacağını, konumunuzu tespit
            edeceğini veya size müdahale edeceğini garanti etmez ve edemez. Uygulama üzerinden
            gönderilen SOS sinyalleri YALNIZCA uygulama içerisinde kayıtlı diğer kullanıcılara
            (aile, yakınlar) iletilir. Resmî acil servisler bu sinyalleri almaz.
          </Text>

          <Text style={styles.subsectionTitle}>12.4. Konum Doğruluğu ve Sınırlamaları</Text>
          <Text style={styles.paragraph}>
            Konum bilgisinin doğruluğu aşağıdaki faktörlere bağlıdır ve garanti edilemez:{'\n\n'}
            • GPS sinyal kalitesi (açık alan, kapalı alan, bodrum kat, tünel, enkaz altı vb.){'\n'}
            • İnternet ve mobil ağ bağlantısı durumu{'\n'}
            • Cihaz sensörünün hassasiyeti ve yazılım sürümü{'\n'}
            • Hava koşulları ve çevresel engeller{'\n'}
            • Kullanıcı tarafından verilen konum izni seviyesi (ön plan / arka plan){'\n\n'}
            Enkaz altı, kapalı yapı ve GPS sinyalinin zayıf olduğu ortamlarda konum doğruluğu
            önemli ölçüde düşebilir, gecikebilir veya konum hiç iletilmeyebilir. Geliştirici,
            iletilen konum bilgisinin doğruluğunu, zamanlılığını veya eksiksizliğini garanti etmez.
          </Text>

          <Text style={styles.subsectionTitle}>12.5. Kullanıcı Sorumluluğu</Text>
          <Text style={styles.paragraph}>
            Bu uygulamayı kullanarak aşağıdakileri açıkça kabul etmiş olursunuz:{'\n\n'}
            • Hayatî tehlike içeren her türlü acil durumda DERHAL 112'yi arayacağınızı{'\n'}
            • AfetNet'in 112 veya diğer resmî acil servislerin yerini tutmadığını ve ASLA onların ikamesi olarak kullanılmayacağını{'\n'}
            • SOS ve konum paylaşımı özelliklerinin yalnızca uygulama içerisindeki kullanıcılara (aile, yakınlar) bildirim yaptığını; resmî acil servislere HİÇBİR bildirim göndermediğini{'\n'}
            • Konum bilgisinin hatalı, gecikmeli veya eksik olabileceğini ve bunun sonucu olarak konumunuzun tespit edilemeyebileceğini{'\n'}
            • Uygulamanın internet, Bluetooth veya cihaz arıza durumlarında çalışmayabileceğini{'\n'}
            • Geliştiricinin, uygulamanın kullanımından veya kullanılamamasından kaynaklanan hiçbir doğrudan, dolaylı, özel veya sonuçsal zarardan sorumlu tutulamayacağını
          </Text>

          <Text style={styles.subsectionTitle}>12.6. Konum Verisi Güvenliği</Text>
          <Text style={styles.paragraph}>
            Konum verileriniz:{'\n\n'}
            • Yalnızca belirlediğiniz kişilerle (aile, yakın çevre) paylaşılır{'\n'}
            • Firebase altyapısı ve güvenlik kuralları ile korunarak iletilir{'\n'}
            • Üçüncü taraf reklam veya analitik sistemlere satılmaz{'\n'}
            • Hesap silindiğinde konum geçmişi de silinir
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Bu koşulları kabul ederek uygulamayı kullanmaya başlayabilirsiniz.
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

