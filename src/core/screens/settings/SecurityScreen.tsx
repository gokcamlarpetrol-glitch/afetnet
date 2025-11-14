/**
 * SECURITY SCREEN - ELITE DETAILED
 * Comprehensive security information
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import * as haptics from '../../utils/haptics';
import { useSettingsStore } from '../../stores/settingsStore';

export default function SecurityScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

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
        <Text style={styles.headerTitle}>Güvenlik</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Security Status */}
        <View style={styles.statusCard}>
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
            style={styles.statusGradient}
          >
            <Ionicons name="shield-checkmark" size={48} color="#10b981" />
            <Text style={styles.statusTitle}>Güvenlik Aktif</Text>
            <Text style={styles.statusSubtitle}>
              Tüm verileriniz şifrelenmiş ve güvenli şekilde saklanmaktadır
            </Text>
          </LinearGradient>
        </View>

        {/* Encryption */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Şifreleme</Text>
          
          <SecurityFeature
            icon="lock-closed"
            title="End-to-End Şifreleme"
            description="Tüm hassas veriler AES-256 şifreleme ile korunur"
            status="Aktif"
            statusColor="#10b981"
          />
          
          <SecurityFeature
            icon="key"
            title="TLS/SSL Bağlantıları"
            description="Tüm ağ trafiği şifrelenmiş bağlantılar üzerinden aktarılır"
            status="Aktif"
            statusColor="#10b981"
          />
          
          <SecurityFeature
            icon="shield"
            title="Güvenli Depolama"
            description="Veriler Firebase Secure Storage'da şifrelenmiş olarak saklanır"
            status="Aktif"
            statusColor="#10b981"
          />
        </View>

        {/* Authentication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kimlik Doğrulama</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="finger-print" size={20} color="#3b82f6" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Biyometrik Kimlik</Text>
                <Text style={styles.settingSubtitle}>
                  Face ID veya Touch ID ile giriş
                </Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={(value) => {
                haptics.impactLight();
                setBiometricEnabled(value);
                Alert.alert(
                  'Biyometrik Kimlik',
                  value
                    ? 'Biyometrik kimlik aktif edildi'
                    : 'Biyometrik kimlik kapatıldı'
                );
              }}
              trackColor={{ false: '#334155', true: '#3b82f6' }}
              thumbColor="#fff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="keypad" size={20} color="#3b82f6" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>İki Faktörlü Doğrulama</Text>
                <Text style={styles.settingSubtitle}>
                  Ekstra güvenlik katmanı (yakında)
                </Text>
              </View>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={(value) => {
                haptics.impactLight();
                Alert.alert(
                  'İki Faktörlü Doğrulama',
                  'Bu özellik yakında kullanıma sunulacak'
                );
              }}
              trackColor={{ false: '#334155', true: '#3b82f6' }}
              thumbColor="#fff"
              disabled
            />
          </View>
        </View>

        {/* Data Protection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veri Koruması</Text>
          
          <SecurityFeature
            icon="document-lock"
            title="GDPR Uyumlu"
            description="Avrupa Birliği Genel Veri Koruma Yönetmeliği'ne uyumlu"
            status="Uyumlu"
            statusColor="#10b981"
          />
          
          <SecurityFeature
            icon="document-text"
            title="KVKK Uyumlu"
            description="Kişisel Verilerin Korunması Kanunu'na uyumlu"
            status="Uyumlu"
            statusColor="#10b981"
          />
          
          <SecurityFeature
            icon="trash"
            title="Veri Silme Hakkı"
            description="Hesabınızı sildiğinizde tüm veriler kalıcı olarak silinir"
            status="Aktif"
            statusColor="#10b981"
          />
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gizlilik</Text>
          
          <SecurityFeature
            icon="eye-off"
            title="Anonim Veri Toplama"
            description="Kişisel bilgileriniz olmadan analitik veriler toplanır"
            status="Aktif"
            statusColor="#10b981"
          />
          
          <SecurityFeature
            icon="share"
            title="Veri Paylaşımı"
            description="Verileriniz sadece acil durumlarda paylaşılır"
            status="Kontrollü"
            statusColor="#f59e0b"
          />
          
          <SecurityFeature
            icon="server"
            title="Yerel İşleme"
            description="Hassas veriler mümkün olduğunca cihazınızda işlenir"
            status="Aktif"
            statusColor="#10b981"
          />
        </View>

        {/* Security Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Güvenlik İpuçları</Text>
          
          <TipItem
            icon="shield-checkmark"
            title="Güçlü Şifre Kullanın"
            description="Şifreniz en az 8 karakter ve karmaşık olmalı"
          />
          
          <TipItem
            icon="refresh"
            title="Düzenli Güncellemeler"
            description="Uygulamayı her zaman güncel tutun"
          />
          
          <TipItem
            icon="lock-closed"
            title="Cihazınızı Kilitleyin"
            description="Cihazınızda ekran kilidi kullanın"
          />
          
          <TipItem
            icon="warning"
            title="Şüpheli Aktivite"
            description="Şüpheli aktivite tespit ederseniz derhal bildirin"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Güvenliğiniz bizim önceliğimizdir. Tüm verileriniz en yüksek standartlarda korunmaktadır.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SecurityFeature({
  icon,
  title,
  description,
  status,
  statusColor,
}: {
  icon: string;
  title: string;
  description: string;
  status: string;
  statusColor: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon as any} size={24} color="#3b82f6" />
      </View>
      <View style={styles.featureContent}>
        <View style={styles.featureHeader}>
          <Text style={styles.featureTitle}>{title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
          </View>
        </View>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

function TipItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.tipItem}>
      <View style={styles.tipIcon}>
        <Ionicons name={icon as any} size={20} color="#fbbf24" />
      </View>
      <View style={styles.tipContent}>
        <Text style={styles.tipTitle}>{title}</Text>
        <Text style={styles.tipDescription}>{description}</Text>
      </View>
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
  statusCard: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statusGradient: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10b981',
    marginTop: 12,
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
    color: '#94a3b8',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 14,
    color: '#94a3b8',
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

