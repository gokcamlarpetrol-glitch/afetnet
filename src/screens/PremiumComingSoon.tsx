import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';

export default function PremiumComingSoonScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="star" size={64} color={palette.warning.main} />
          <Text style={styles.title}>Premium Özellikler</Text>
          <Text style={styles.subtitle}>Çok Yakında!</Text>
        </View>

        <Card style={styles.messageCard}>
          <Text style={styles.message}>
            Premium özellikler şu anda geliştirme aşamasında.
          </Text>
          <Text style={styles.message}>
            Yakında Apple In-App Purchase ile aktif olacak!
          </Text>
        </Card>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Gelecek Premium Özellikler:</Text>
          
          {[
            {
              icon: 'people',
              title: 'Gelişmiş Aile Takibi',
              description: 'Sınırsız aile üyesi, gerçek zamanlı konum takibi',
            },
            {
              icon: 'notifications',
              title: 'Öncelikli Deprem Uyarıları',
              description: 'En hızlı bildirimler, özelleştirilebilir filtreler',
            },
            {
              icon: 'map',
              title: 'Offline Haritalar',
              description: 'İnternet olmadan tüm harita özellikleri',
            },
            {
              icon: 'chatbubbles',
              title: 'Grup Mesajlaşma',
              description: 'Sınırsız grup ve mesaj',
            },
            {
              icon: 'shield-checkmark',
              title: 'Öncelikli Destek',
              description: '7/24 teknik destek, hızlı yanıt',
            },
          ].map((feature, index) => (
            <Card key={index} style={styles.featureCard}>
              <Ionicons name={feature.icon as any} size={32} color={palette.primary.main} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </Card>
          ))}
        </View>

        <Card style={styles.currentFeaturesCard}>
          <Text style={styles.currentTitle}>Şu Anda Kullanılabilir (Ücretsiz):</Text>
          <Text style={styles.currentItem}>✅ SOS Sistemi</Text>
          <Text style={styles.currentItem}>✅ Bluetooth Mesh Ağı</Text>
          <Text style={styles.currentItem}>✅ Temel Deprem Bildirimleri</Text>
          <Text style={styles.currentItem}>✅ Aile Mesajlaşma</Text>
          <Text style={styles.currentItem}>✅ Enkaz Modu</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.primary,
  },
  content: {
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: 20,
    color: palette.warning.main,
    marginTop: spacing.xs,
  },
  messageCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    color: palette.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  featuresContainer: {
    marginBottom: spacing.lg,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.md,
  },
  featureCard: {
    flexDirection: 'row',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  featureText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text.primary,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    fontSize: 14,
    color: palette.text.secondary,
  },
  currentFeaturesCard: {
    padding: spacing.lg,
    backgroundColor: palette.success.main + '20',
  },
  currentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.md,
  },
  currentItem: {
    fontSize: 16,
    color: palette.text.primary,
    marginBottom: spacing.xs,
  },
});

