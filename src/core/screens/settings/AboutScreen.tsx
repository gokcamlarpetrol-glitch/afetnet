/**
 * ABOUT SCREEN - ELITE DETAILED
 * Comprehensive about screen with app details
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  StatusBar,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import * as haptics from '../../utils/haptics';
import Constants from 'expo-constants';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

// ELITE: Properly typed navigation prop
type AboutScreenNavigationProp = StackNavigationProp<ParamListBase>;

interface AboutScreenProps {
  navigation: AboutScreenNavigationProp;
}

export default function AboutScreen({ navigation }: AboutScreenProps) {
  const insets = useSafeAreaInsets();
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';

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
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Hakkında</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            style={styles.logo}
          >
            <Ionicons name="shield-checkmark" size={64} color="#fff" />
          </LinearGradient>
          <Text style={styles.appName}>AfetNet</Text>
          <Text style={styles.appVersion}>v{appVersion} (Build {buildNumber})</Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.description}>
            AfetNet, acil durumlarda offline iletişim için tasarlanmış profesyonel bir acil durum
            uygulamasıdır. Deprem, sel, yangın ve diğer afet durumlarında hayat kurtaran teknolojiler
            sunar.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Özellikler</Text>
          <FeatureItem icon="warning" title="Erken Deprem Uyarısı" description="P ve S dalgası analizi ile erken uyarı" />
          <FeatureItem icon="bluetooth" title="Offline Mesajlaşma" description="BLE mesh ile şebeke olmadan iletişim" />
          <FeatureItem icon="people" title="Aile Takibi" description="Aile üyelerinizin gerçek zamanlı konumu" />
          <FeatureItem icon="map" title="Offline Haritalar" description="İnternet olmadan harita kullanımı" />
          <FeatureItem icon="sparkles" title="AI Asistan" description="Yapay zeka destekli risk analizi" />
          <FeatureItem icon="heart" title="Sağlık Profili" description="Acil durum tıbbi bilgileri" />
        </View>

        {/* Technology */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teknoloji</Text>
          <Text style={styles.paragraph}>
            • React Native & Expo{'\n'}
            • Firebase (Firestore, Cloud Messaging, Analytics){'\n'}
            • BLE Mesh Networking{'\n'}
            • AI/ML (Risk Analysis, Earthquake Prediction){'\n'}
            • Real-time Sensor Data Processing{'\n'}
            • Offline-first Architecture
          </Text>
        </View>

        {/* Team */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Geliştirici</Text>
          <Text style={styles.paragraph}>
            AfetNet, acil durum yönetimi ve hayat kurtarma teknolojileri konusunda uzman bir ekip
            tarafından geliştirilmiştir.
          </Text>
        </View>

        {/* Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bağlantılar</Text>
          <LinkItem
            icon="globe"
            title="Web Sitesi"
            url="https://gokhancamci.github.io/AfetNet1"
          />
          <LinkItem
            icon="logo-github"
            title="GitHub"
            url="https://github.com/gokhancamci/AfetNet1"
          />
          <LinkItem
            icon="mail"
            title="E-posta"
            url="mailto:support@afetnet.app"
          />
        </View>

        {/* License */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lisans</Text>
          <Text style={styles.paragraph}>
            Bu uygulama açık kaynak kodludur ve MIT lisansı altında lisanslanmıştır.
          </Text>
        </View>

        {/* Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teşekkürler</Text>
          <Text style={styles.paragraph}>
            • AFAD - Deprem verileri için{'\n'}
            • Kandilli Rasathanesi - Deprem verileri için{'\n'}
            • EMSC - Global deprem verileri için{'\n'}
            • Tüm açık kaynak topluluğu
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2025 AfetNet. Tüm hakları saklıdır.
          </Text>
          <Text style={styles.footerSubtext}>
            Hayat kurtarma teknolojileri
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon as any} size={20} color="#3b82f6" />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

function LinkItem({ icon, title, url }: { icon: string; title: string; url: string }) {
  return (
    <Pressable
      style={styles.linkItem}
      onPress={async () => {
        haptics.impactLight();
        try {
          await Linking.openURL(url);
        } catch (error) {
          // Handle error
        }
      }}
    >
      <Ionicons name={icon as any} size={20} color="#3b82f6" />
      <Text style={styles.linkTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </Pressable>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 14,
    color: '#94a3b8',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 24,
  },
  paragraph: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#94a3b8',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  linkTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  footer: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#64748b',
  },
});

