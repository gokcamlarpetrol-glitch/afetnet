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
        <Text style={styles.lastUpdated}>Son Güncelleme: 12 Kasım 2025</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. KABUL</Text>
          <Text style={styles.paragraph}>
            AfetNet uygulamasını ("Uygulama") kullanarak, bu Kullanım Koşullarını kabul etmiş olursunuz.
            Bu koşulları kabul etmiyorsanız, lütfen uygulamayı kullanmayın.
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
            • İçeriğiniz otomatik olarak şifrelenir ve güvenli şekilde saklanır{'\n'}
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
            E-posta: legal@afetnet.app{'\n'}
            Web: https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html
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

