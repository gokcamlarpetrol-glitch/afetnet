import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';

const { width } = Dimensions.get('window');

interface OnboardingPage {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  tips: string[];
}

const pages: OnboardingPage[] = [
  {
    id: 'offline',
    title: 'Çevrimdışı İletişim',
    subtitle: 'Şebeke olmadan da güvenli iletişim',
    icon: 'wifi' as any,
    description: 'AfetNet, Bluetooth mesh teknolojisi ile şebeke olmadan da güvenli iletişim sağlar.',
    tips: [
      'Yakındaki diğer AfetNet kullanıcıları ile otomatik bağlantı',
      'Mesajlar şifreli olarak iletilir',
      'Acil durumlarda hayat kurtarıcı iletişim ağı',
    ],
  },
  {
    id: 'satellite',
    title: 'Uydu + Harita',
    subtitle: 'GPS ve uydu görüntüleri ile konum',
    icon: 'planet' as any,
    description: 'Uydu görüntüleri ve GPS ile kesin konum belirleme ve harita üzerinde görselleştirme.',
    tips: [
      'Yüksek çözünürlüklü uydu görüntüleri',
      'Çevrimdışı harita desteği',
      'Toplanma noktaları ve güvenli alanlar',
    ],
  },
  {
    id: 'sos',
    title: 'SOS ve Aile',
    subtitle: 'Acil durum bildirimi ve aile iletişimi',
    icon: 'warning',
    description: 'Tek dokunuşla SOS sinyali gönderin ve ailenizle güvenli iletişim kurun.',
    tips: [
      'Anında acil durum bildirimi',
      'Aile üyeleri ile şifreli iletişim',
      'Konum paylaşımı ve durum güncellemeleri',
    ],
  },
  {
    id: 'battery',
    title: 'Pil Güvenliği',
    subtitle: 'Uzun süreli kullanım için optimizasyon',
    icon: 'battery-charging',
    description: 'Aşırı pil modu ile kritik durumlarda maksimum pil tasarrufu.',
    tips: [
      'Aşırı pil modu ile 24-48 saat kullanım',
      'Otomatik pil koruma',
      'Düşük pil uyarıları',
    ],
  },
];

export default function Onboarding() {
  const [currentPage, setCurrentPage] = useState(0);
  const navigation = useNavigation();

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      // Navigate to permissions flow
      navigation.navigate('PermissionsFlow' as never);
    }
  };

  const handleSkip = () => {
    navigation.navigate('PermissionsFlow' as never);
  };

  const currentPageData = pages[currentPage];
  const isLastPage = currentPage === pages.length - 1;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>AfetNet'e Hoş Geldiniz</Text>
          <Text style={styles.subtitle}>Acil durumlarda güvenli iletişim</Text>
        </View>

        <Card style={styles.pageCard}>
          <View style={styles.iconContainer}>
            <Ionicons name={currentPageData.icon} size={80} color={palette.primary} />
          </View>
          
          <Text style={styles.pageTitle}>{currentPageData.title}</Text>
          <Text style={styles.pageSubtitle}>{currentPageData.subtitle}</Text>
          
          <Text style={styles.description}>{currentPageData.description}</Text>
          
          <View style={styles.tipsContainer}>
            {currentPageData.tips.map((tip, index) => (
              <View key={index} style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={20} color={palette.success.main} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.pagination}>
          {pages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentPage && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.buttonContainer}>
          {!isLastPage && (
            <Button
              label="Geç"
              onPress={handleSkip}
              variant="ghost"
              style={styles.skipButton}
            />
          )}
          <Button
            label={isLastPage ? 'İzinleri Ayarla' : 'İleri'}
            onPress={handleNext}
            variant="primary"
            style={styles.nextButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.primary,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: palette.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: palette.text.secondary,
    textAlign: 'center',
  },
  pageCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pageSubtitle: {
    fontSize: 16,
    color: palette.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: 16,
    color: palette.text.primary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  tipsContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tipText: {
    fontSize: 14,
    color: palette.text.primary,
    flex: 1,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: (palette.border as any).primary || '#E0E0E0',
  },
  paginationDotActive: {
    backgroundColor: palette.primary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: (palette.border as any).primary || '#E0E0E0',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});
