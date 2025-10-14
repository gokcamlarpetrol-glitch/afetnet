import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';

export default function PrivacyScreen() {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    setAccepted(true);
  };

  const handleDecline = () => {
    setAccepted(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.headerCard}>
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={48} color={palette.primary.main} />
            <Text style={styles.title}>Gizlilik ve Veri Koruma</Text>
            <Text style={styles.subtitle}>
              AfetNet, kişisel verilerinizi güvende tutar
            </Text>
          </View>
        </Card>

        <Card title="Veri Toplama ve Kullanım">
          <Text style={styles.sectionTitle}>Kişisel Veriler</Text>
          <Text style={styles.text}>
            • Tüm kişisel verileriniz cihazınızda saklanır ve dışarı gönderilmez
          </Text>
          <Text style={styles.text}>
            • Telefon numaraları sadece yerel olarak işlenir, hiçbir sunucuya yüklenmez
          </Text>
          <Text style={styles.text}>
            • Konum bilgileri sadece acil durum bildirimleri için kullanılır
          </Text>

          <Text style={styles.sectionTitle}>Eşleşme ve İletişim</Text>
          <Text style={styles.text}>
            • AFN-ID'ler sadece güvenli eşleşme için kullanılır
          </Text>
          <Text style={styles.text}>
            • Mesajlar uçtan uca şifrelenir ve sadece alıcı tarafından okunabilir
          </Text>
          <Text style={styles.text}>
            • Grup iletişiminde paylaşılan anahtarlar sadece grup üyeleri tarafından bilinir
          </Text>
        </Card>

        <Card title="Harita ve Uydu Verileri">
          <Text style={styles.sectionTitle}>Lisanslı İçerik</Text>
          <Text style={styles.text}>
            • Uydu görüntüleri lisanslı kaynaklardan sağlanır
          </Text>
          <Text style={styles.text}>
            • OpenStreetMap (OSM) verileri Creative Commons lisansı altındadır
          </Text>
          <Text style={styles.text}>
            • ESA Sentinel uydu görüntüleri Copernicus programı kapsamındadır
          </Text>
          <Text style={styles.text}>
            • Tüm harita verileri yerel olarak önbelleğe alınır, sürekli internet bağlantısı gerektirmez
          </Text>
        </Card>

        <Card title="Güvenlik ve Şifreleme">
          <Text style={styles.sectionTitle}>Veri Güvenliği</Text>
          <Text style={styles.text}>
            • Ed25519 kriptografik anahtarlar ile güvenli eşleşme
          </Text>
          <Text style={styles.text}>
            • NaCl box şifreleme ile uçtan uca güvenli mesajlaşma
          </Text>
          <Text style={styles.text}>
            • Güvenlik PIN'i ile kritik işlemlerin korunması
          </Text>
          <Text style={styles.text}>
            • Tüm şifreleme anahtarları cihazınızda üretilir ve saklanır
          </Text>
        </Card>

        <Card title="Acil Durum İstisnaları">
          <Text style={styles.sectionTitle}>Hayat Kurtarıcı İstisnalar</Text>
          <Text style={styles.text}>
            • Acil durumlarda (SOS) konum bilgisi otomatik olarak paylaşılabilir
          </Text>
          <Text style={styles.text}>
            • Bu durumda sadece gerekli minimum bilgi paylaşılır
          </Text>
          <Text style={styles.text}>
            • Acil durum sona erdiğinde otomatik olarak durdurulur
          </Text>
        </Card>

        <Card title="Haklarınız">
          <Text style={styles.sectionTitle}>Veri Kontrolü</Text>
          <Text style={styles.text}>
            • Tüm kişisel verilerinizi istediğiniz zaman silebilirsiniz
          </Text>
          <Text style={styles.text}>
            • Eşleşmeleri istediğiniz zaman sonlandırabilirsiniz
          </Text>
          <Text style={styles.text}>
            • Uygulamayı silerek tüm verilerinizi kaldırabilirsiniz
          </Text>
          <Text style={styles.text}>
            • Veri aktarımı veya dışa aktarma seçenekleri mevcuttur
          </Text>
        </Card>

        <Card title="İletişim">
          <Text style={styles.sectionTitle}>Sorularınız İçin</Text>
          <Text style={styles.text}>
            • Gizlilik politikası ile ilgili sorularınız için uygulama içi destek
          </Text>
          <Text style={styles.text}>
            • Teknik sorunlar için tanı raporu oluşturabilirsiniz
          </Text>
          <Text style={styles.text}>
            • Geri bildirimlerinizi "Sorun Bildir" özelliği ile iletebilirsiniz
          </Text>
        </Card>

        <View style={styles.consentContainer}>
          <View style={styles.consentRow}>
            <Button
              label="Kabul Etmiyorum"
              onPress={handleDecline}
              variant="ghost"
              style={!accepted ? { ...styles.consentButton, ...styles.consentButtonActive } : styles.consentButton}
            />
            <Button
              label="Kabul Ediyorum"
              onPress={handleAccept}
              variant="primary"
              style={accepted ? { ...styles.consentButton, ...styles.consentButtonActive } : styles.consentButton}
            />
          </View>
          <Text style={styles.consentNote}>
            Gizlilik politikasını kabul ederek devam edebilirsiniz.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.primary,
  },
  content: {
    padding: spacing.lg,
  },
  headerCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: palette.text.secondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: 14,
    color: palette.text.primary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  consentContainer: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: palette.background.secondary,
    borderRadius: 12,
  },
  consentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  consentButton: {
    flex: 1,
  },
  consentButtonActive: {
    opacity: 1,
  },
  consentNote: {
    fontSize: 12,
    color: palette.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
