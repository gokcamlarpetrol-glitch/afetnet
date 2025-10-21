import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState, useEffect } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccessibility } from '../store/accessibility';
import { useEmergency } from '../store/emergency';
import { useFamily } from '../store/family';
import { usePremium, usePremiumFeatures } from '../store/premium';
import { useAppSettings } from '../store/appSettings';
// ACTIVE: Premium screen with full IAP support
import PremiumActiveScreen from './PremiumActive';
import LanguageRegionScreen from './LanguageRegionScreen';
import ProfileEditScreen from './ProfileEditScreen';
import ComprehensiveFeaturesScreen from './ComprehensiveFeaturesScreen';

export default function Settings() {
  const { updateSetting, initializeSettings } = useAppSettings();
  const { ultra } = useEmergency();
  const { generateMyAfnId } = useFamily();
  const { isPremium } = usePremium();
  const { canUseFeature, getRemainingUsage } = usePremiumFeatures();
  const { setHighContrast, setBigText, setHapticsStrong } = useAccessibility();

  // Initialize settings on component mount
  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  // State management
  // Premium kullanıcı için ilk section'ı profile yap
  const [activeSection, setActiveSection] = useState(isPremium ? 'profile' : 'premium');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);

  // Profile settings
  const [profileData, setProfileData] = useState({
    name: 'Kullanıcı Adı',
    email: 'kullanici@example.com',
    phone: '+90 555 123 45 67',
    address: 'İstanbul, Türkiye',
    bloodType: 'A+',
    allergies: 'Polen, Toz',
    medications: 'Hiçbiri',
    emergencyContact: '+90 555 987 65 43',
    medicalNotes: 'Hiçbir özel durum yok',
    birthDate: '01.01.1990',
    gender: 'Belirtmek istemiyorum',
    occupation: 'Yazılım Geliştirici',
    insuranceNumber: '12345678901',
  });

  // Get current settings from store
  const settings = useAppSettings();

  const handleSettingChange = async (key: string, value: boolean) => {
    try {
      await updateSetting(key as any, value);
      Alert.alert('✅ Güncellendi', `${key} ayarı ${value ? 'aktif' : 'pasif'} edildi.`);
    } catch (error) {
      Alert.alert('❌ Hata', 'Ayar güncellenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleSaveProfile = () => {
    setShowProfileModal(false);
    Alert.alert('✅ Başarılı', 'Profil bilgileri güncellendi!');
  };

  const handleSaveLanguage = () => {
    setShowLanguageModal(false);
    Alert.alert('✅ Başarılı', 'Dil ve tema ayarları güncellendi!');
  };

  const handleSaveTheme = () => {
    setShowThemeModal(false);
    Alert.alert('✅ Başarılı', 'Tema ayarları güncellendi!');
  };

  const handleSaveNotification = () => {
    setShowNotificationModal(false);
    Alert.alert('✅ Başarılı', 'Bildirim ayarları güncellendi!');
  };

  const handleSaveSecurity = () => {
    setShowSecurityModal(false);
    Alert.alert('✅ Başarılı', 'Güvenlik ayarları güncellendi!');
  };

  const handleSaveData = () => {
    setShowDataModal(false);
    Alert.alert('✅ Başarılı', 'Veri ayarları güncellendi!');
  };

  // Premium section render
  const renderPremiumSection = () => {
    if (!isPremium) {
      return (
        <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
          {/* Free User Premium Section */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}>
                <Ionicons name="lock-closed" size={24} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Premium Üyelik Gerekli</Text>
                <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                  Tüm özellikler için Premium satın alın
                </Text>
              </View>
            </View>

            <View style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(16, 185, 129, 0.2)',
            }}>
              <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
                Ücretsiz Özellikler
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Deprem bildirimleri (Sınırsız)
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Temel deprem takibi
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Temel ayarlar
                </Text>
              </View>
            </View>

            <View style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.2)',
            }}>
              <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
                Premium Özellikler
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Aile takibi ve mesajlaşma
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Offline harita ve navigasyon
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  SOS ve kurtarma araçları
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Şebekesiz offline mesajlaşma
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Bluetooth mesh ağı iletişimi
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  İnternet olmadan P2P mesajlaşma
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Gelişmiş güvenlik özellikleri
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
                <Text style={{ color: '#e2e8f0', fontSize: 14, marginLeft: 8 }}>
                  Ve 200+ diğer özellik
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: '#10b981',
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                marginTop: 16,
              }}
              onPress={() => {
                // Navigate to premium purchase screen
                setActiveSection('premium');
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800' }}>
                Premium Satın Al
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }
    return (
      <View style={styles.premiumContainer}>
        <PremiumActiveScreen />
      </View>
    );
  };

  // Language & Region section render
  const renderLanguageRegionSection = () => {
    return (
      <View style={styles.languageRegionContainer}>
        <LanguageRegionScreen />
      </View>
    );
  };

  // Profile Edit section render
  const renderProfileEditSection = () => {
    return (
      <View style={styles.profileEditContainer}>
        <ProfileEditScreen />
      </View>
    );
  };

  // Profile section render
  const renderProfileSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Ionicons name="person" size={40} color="#FFFFFF" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profileData.name}</Text>
          <Text style={styles.profileEmail}>{profileData.email}</Text>
          <View style={styles.profileStatus}>
            <View style={[styles.statusDot, { backgroundColor: isPremium ? '#10B981' : '#6B7280' }]} />
            <Text style={styles.statusText}>
              {isPremium ? 'Premium Üye' : 'Ücretsiz Üye'}
            </Text>
          </View>
        </View>
        </View>

      {/* Profile Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hızlı İşlemler</Text>
        <View style={styles.actionGrid}>
          <Pressable style={styles.actionButton} onPress={() => setActiveSection('profile')}>
            <Ionicons name="create-outline" size={24} color="#3B82F6" />
            <Text style={styles.actionText}>Profili Düzenle</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => {
            Clipboard.setStringAsync(generateMyAfnId());
            Alert.alert('✅ Kopyalandı', 'AFN-ID panoya kopyalandı');
          }}>
            <Ionicons name="copy-outline" size={24} color="#10B981" />
            <Text style={styles.actionText}>AFN-ID Kopyala</Text>
          </Pressable>
        </View>
        </View>

      {/* Personal Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
        <View style={styles.infoList}>
          <View style={styles.infoItem}>
            <Ionicons name="call-outline" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Telefon</Text>
              <Text style={styles.infoValue}>{profileData.phone}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Adres</Text>
              <Text style={styles.infoValue}>{profileData.address}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="medical-outline" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Kan Grubu</Text>
              <Text style={styles.infoValue}>{profileData.bloodType}</Text>
            </View>
          </View>
        </View>
        </View>

      {/* Health Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sağlık Bilgileri</Text>
        <View style={styles.infoList}>
          <View style={styles.infoItem}>
            <Ionicons name="warning-outline" size={20} color="#F59E0B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Alerjiler</Text>
              <Text style={styles.infoValue}>{profileData.allergies}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="medical-outline" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>İlaçlar</Text>
              <Text style={styles.infoValue}>{profileData.medications}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="call-outline" size={20} color="#EF4444" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Acil İletişim</Text>
              <Text style={styles.infoValue}>{profileData.emergencyContact}</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  // General section render
  const renderGeneralSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* App Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Uygulama Ayarları</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="refresh-outline" size={20} color="#3B82F6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Otomatik Güncelleme</Text>
                <Text style={styles.settingDescription}>Uygulama otomatik güncellensin</Text>
              </View>
            </View>
            <Switch
              value={settings.autoUpdate}
              onValueChange={(value) => handleSettingChange('autoUpdate', value)}
              trackColor={{ false: '#374151', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="bug-outline" size={20} color="#10B981" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Hata Raporları</Text>
                <Text style={styles.settingDescription}>Hataları otomatik bildir</Text>
              </View>
            </View>
            <Switch
              value={settings.errorReports}
              onValueChange={(value) => handleSettingChange('errorReports', value)}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="analytics-outline" size={20} color="#F59E0B" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Analitik Veriler</Text>
                <Text style={styles.settingDescription}>Uygulama performans verileri</Text>
              </View>
            </View>
            <Switch
              value={settings.analyticsData}
              onValueChange={(value) => handleSettingChange('analyticsData', value)}
              trackColor={{ false: '#374151', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon-outline" size={20} color="#6B7280" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Karanlık Mod</Text>
                <Text style={styles.settingDescription}>Karanlık tema kullan</Text>
              </View>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={(value) => handleSettingChange('darkMode', value)}
              trackColor={{ false: '#374151', true: '#6B7280' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="language-outline" size={20} color="#F59E0B" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Dil</Text>
                <Text style={styles.settingDescription}>Türkçe</Text>
              </View>
            </View>
            <Pressable onPress={() => setActiveSection('language')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="location-outline" size={20} color="#EF4444" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Bölge</Text>
                <Text style={styles.settingDescription}>Türkiye</Text>
              </View>
            </View>
            <Pressable onPress={() => setActiveSection('region')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Accessibility */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Erişilebilirlik</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="contrast-outline" size={20} color="#F59E0B" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Yüksek Kontrast</Text>
                <Text style={styles.settingDescription}>Daha net görünüm için</Text>
              </View>
            </View>
          <Switch
              value={true}
              onValueChange={(value) => setHighContrast(value)}
              trackColor={{ false: '#374151', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
          />
        </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="text-outline" size={20} color="#3B82F6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Büyük Metin</Text>
                <Text style={styles.settingDescription}>Metinleri büyüt</Text>
              </View>
            </View>
          <Switch
              value={true}
              onValueChange={(value) => setBigText(value)}
              trackColor={{ false: '#374151', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
          />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="phone-portrait-outline" size={20} color="#10B981" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Güçlü Titreşim</Text>
                <Text style={styles.settingDescription}>Daha güçlü haptic feedback</Text>
              </View>
            </View>
          <Switch
              value={true}
              onValueChange={(value) => setHapticsStrong(value)}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor="#FFFFFF"
          />
        </View>
        </View>
        </View>

      {/* Emergency Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Acil Durum</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="flash-outline" size={20} color="#EF4444" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Canlı Mod</Text>
                <Text style={styles.settingDescription}>Gerçek zamanlı deprem takibi</Text>
              </View>
            </View>
          <Switch
              value={settings.liveMode}
              onValueChange={(value) => handleSettingChange('liveMode', value)}
              trackColor={{ false: '#374151', true: '#EF4444' }}
              thumbColor="#FFFFFF"
          />
        </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="pulse-outline" size={20} color="#8B5CF6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>P-dalgası (Deneysel)</Text>
                <Text style={styles.settingDescription}>Erken uyarı sistemi</Text>
              </View>
            </View>
          <Switch
              value={settings.experimentalPWave}
              onValueChange={(value) => handleSettingChange('experimentalPWave', value)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#FFFFFF"
          />
            </View>
              </View>
      </View>
    </ScrollView>
  );

  // Notifications section render
  const renderNotificationSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        {/* Notification Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bildirim Ayarları</Text>
          <View style={styles.settingList}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={20} color="#3B82F6" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Push Bildirimleri</Text>
                  <Text style={styles.settingDescription}>Tüm bildirimleri al</Text>
                </View>
              </View>
              <Switch
                value={settings.pushNotifications}
                onValueChange={(value) => handleSettingChange('pushNotifications', value)}
                trackColor={{ false: '#374151', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="volume-high-outline" size={20} color="#10B981" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Ses</Text>
                  <Text style={styles.settingDescription}>Bildirim sesi çalsın</Text>
                </View>
              </View>
              <Switch
                value={settings.soundEnabled}
                onValueChange={(value) => handleSettingChange('soundEnabled', value)}
                trackColor={{ false: '#374151', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="phone-portrait-outline" size={20} color="#F59E0B" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Titreşim</Text>
                  <Text style={styles.settingDescription}>Bildirimde titreşim</Text>
                </View>
              </View>
              <Switch
                value={settings.vibrationEnabled}
                onValueChange={(value) => handleSettingChange('vibrationEnabled', value)}
                trackColor={{ false: '#374151', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="bulb-outline" size={20} color="#8B5CF6" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>LED Bildirimi</Text>
                  <Text style={styles.settingDescription}>LED ışığı ile bildirim</Text>
                </View>
              </View>
              <Switch
                value={settings.ledNotification}
                onValueChange={(value) => handleSettingChange('ledNotification', value)}
                trackColor={{ false: '#374151', true: '#8B5CF6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-circle-outline" size={20} color="#06B6D4" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Rozet Sayısı</Text>
                  <Text style={styles.settingDescription}>Uygulama ikonunda sayı göster</Text>
                </View>
              </View>
              <Switch
                value={settings.badgeCount}
                onValueChange={(value) => handleSettingChange('badgeCount', value)}
                trackColor={{ false: '#374151', true: '#06B6D4' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="moon-outline" size={20} color="#6B7280" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Sessiz Saatler</Text>
                  <Text style={styles.settingDescription}>Gece saatlerinde bildirimleri sustur</Text>
                </View>
              </View>
              <Switch
                value={settings.quietHours}
                onValueChange={(value) => handleSettingChange('quietHours', value)}
                trackColor={{ false: '#374151', true: '#6B7280' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>
        
        {/* Alert Types */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bildirim Türleri</Text>
          <View style={styles.settingList}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="warning-outline" size={20} color="#EF4444" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Acil Durum</Text>
                  <Text style={styles.settingDescription}>Deprem ve afet uyarıları</Text>
                </View>
              </View>
              <Switch
                value={settings.emergencyAlerts}
                onValueChange={(value) => handleSettingChange('emergencyAlerts', value)}
                trackColor={{ false: '#374151', true: '#EF4444' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="people-outline" size={20} color="#3B82F6" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Aile Bildirimleri</Text>
                  <Text style={styles.settingDescription}>Aile üyelerinden gelen mesajlar</Text>
                </View>
              </View>
              <Switch
                value={settings.familyAlerts}
                onValueChange={(value) => handleSettingChange('familyAlerts', value)}
                trackColor={{ false: '#374151', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="chatbubble-outline" size={20} color="#10B981" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Mesaj Bildirimleri</Text>
                  <Text style={styles.settingDescription}>Yeni mesaj bildirimleri</Text>
                </View>
              </View>
              <Switch
                value={settings.messageAlerts}
                onValueChange={(value) => handleSettingChange('messageAlerts', value)}
                trackColor={{ false: '#374151', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="settings-outline" size={20} color="#6B7280" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Sistem Bildirimleri</Text>
                  <Text style={styles.settingDescription}>Uygulama güncellemeleri ve sistem mesajları</Text>
                </View>
              </View>
              <Switch
                value={settings.systemAlerts}
                onValueChange={(value) => handleSettingChange('systemAlerts', value)}
                trackColor={{ false: '#374151', true: '#6B7280' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="megaphone-outline" size={20} color="#F59E0B" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Pazarlama Bildirimleri</Text>
                  <Text style={styles.settingDescription}>Yeni özellikler ve kampanyalar</Text>
                </View>
              </View>
              <Switch
                value={settings.marketingAlerts}
                onValueChange={(value) => handleSettingChange('marketingAlerts', value)}
                trackColor={{ false: '#374151', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    );

  // Main sections configuration
  // Premium kullanıcı için Premium tab'ını gizle
  const sections = isPremium ? [
    { id: 'profile', label: 'Profil', icon: 'person-outline', color: '#3B82F6' },
    { id: 'general', label: 'Genel', icon: 'settings-outline', color: '#10B981' },
    { id: 'notifications', label: 'Bildirimler', icon: 'notifications-outline', color: '#F59E0B' },
    { id: 'earthquake', label: 'Deprem', icon: 'pulse-outline', color: '#EF4444' },
    { id: 'comprehensive', label: 'Kapsamlı Özellikler', icon: 'grid-outline', color: '#8B5CF6' },
    { id: 'mesh', label: 'Mesh', icon: 'radio-outline', color: '#8B5CF6' },
    { id: 'security', label: 'Güvenlik', icon: 'shield-outline', color: '#06B6D4' },
    { id: 'data', label: 'Veri', icon: 'server-outline', color: '#84CC16' },
  ] : [
    { id: 'premium', label: 'Premium', icon: 'shield-checkmark-outline', color: '#10B981' },
    { id: 'profile', label: 'Profil', icon: 'person-outline', color: '#3B82F6', premium: true },
    { id: 'general', label: 'Genel', icon: 'settings-outline', color: '#10B981' },
    { id: 'notifications', label: 'Bildirimler', icon: 'notifications-outline', color: '#F59E0B', premium: true },
    { id: 'earthquake', label: 'Deprem', icon: 'pulse-outline', color: '#EF4444' },
    { id: 'comprehensive', label: 'Kapsamlı Özellikler', icon: 'grid-outline', color: '#8B5CF6', premium: true },
    { id: 'mesh', label: 'Mesh', icon: 'radio-outline', color: '#8B5CF6', premium: true },
    { id: 'security', label: 'Güvenlik', icon: 'shield-outline', color: '#06B6D4', premium: true },
    { id: 'data', label: 'Veri', icon: 'server-outline', color: '#84CC16', premium: true },
  ];

  // Comprehensive features section render
  const renderComprehensiveFeaturesSection = () => {
    return (
      <View style={styles.comprehensiveContainer}>
        <ComprehensiveFeaturesScreen />
      </View>
    );
  };

  // Earthquake section render
  const renderEarthquakeSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Earthquake Monitoring */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Deprem İzleme</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="flash-outline" size={20} color="#EF4444" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Canlı Mod</Text>
                <Text style={styles.settingDescription}>Gerçek zamanlı deprem takibi</Text>
              </View>
            </View>
          <Switch
              value={settings.liveMode}
              onValueChange={(value) => handleSettingChange('liveMode', value)}
              trackColor={{ false: '#374151', true: '#EF4444' }}
              thumbColor="#FFFFFF"
          />
        </View>
        
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="pulse-outline" size={20} color="#8B5CF6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>P-dalgası Algılama</Text>
                <Text style={styles.settingDescription}>Erken uyarı sistemi (deneysel)</Text>
              </View>
            </View>
          <Switch
              value={settings.experimentalPWave}
              onValueChange={(value) => handleSettingChange('experimentalPWave', value)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#FFFFFF"
          />
        </View>
          </View>
        </View>
        
      {/* Alert Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Uyarı Ayarları</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="warning-outline" size={20} color="#F59E0B" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Büyüklük Eşiği</Text>
                <Text style={styles.settingDescription}>Minimum {settings.magnitudeThreshold} büyüklükte uyarı</Text>
              </View>
            </View>
            <Pressable onPress={() => Alert.alert('Büyüklük Eşiği', '4.0 - 3.5 - 3.0 büyüklük seçenekleri')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="location-outline" size={20} color="#10B981" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Uyarı Mesafesi</Text>
                <Text style={styles.settingDescription}>{settings.alertRadius}km çevredeki depremler</Text>
              </View>
            </View>
            <Pressable onPress={() => Alert.alert('Uyarı Mesafesi', '100km - 300km - 500km - 1000km seçenekleri')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="time-outline" size={20} color="#8B5CF6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Uyarı Gecikmesi</Text>
                <Text style={styles.settingDescription}>{settings.alertDelay} saniye gecikme</Text>
              </View>
            </View>
            <Pressable onPress={() => Alert.alert('Uyarı Gecikmesi', '0sn - 5sn - 10sn - 30sn seçenekleri')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="server-outline" size={20} color="#06B6D4" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Veri Kaynağı</Text>
                <Text style={styles.settingDescription}>{settings.dataSource}</Text>
              </View>
            </View>
            <Pressable onPress={() => Alert.alert('Veri Kaynağı', 'AFAD - USGS - EMSC seçenekleri')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  // Mesh section render
  const renderMeshSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* BLE Mesh Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>BLE Mesh Ağı</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="radio-outline" size={20} color="#8B5CF6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>BLE Aktif</Text>
                <Text style={styles.settingDescription}>Bluetooth Low Energy mesh</Text>
              </View>
            </View>
          <Switch
              value={settings.bleEnabled}
              onValueChange={(value) => handleSettingChange('bleEnabled', value)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#FFFFFF"
          />
        </View>
        
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="search-outline" size={20} color="#3B82F6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Mesh Keşfi</Text>
                <Text style={styles.settingDescription}>Yakındaki cihazları bul</Text>
              </View>
            </View>
          <Switch
              value={settings.meshDiscovery}
              onValueChange={(value) => handleSettingChange('meshDiscovery', value)}
              trackColor={{ false: '#374151', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
          />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="repeat-outline" size={20} color="#10B981" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Röle Modu</Text>
                <Text style={styles.settingDescription}>Mesajları ilet</Text>
              </View>
            </View>
          <Switch
              value={settings.relayMode}
              onValueChange={(value) => handleSettingChange('relayMode', value)}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor="#FFFFFF"
          />
        </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="battery-half-outline" size={20} color="#F59E0B" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Güç Tasarrufu</Text>
                <Text style={styles.settingDescription}>Batarya optimizasyonu</Text>
      </View>
            </View>
          <Switch
              value={settings.powerSaving}
              onValueChange={(value) => handleSettingChange('powerSaving', value)}
              trackColor={{ false: '#374151', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
          />
        </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed-outline" size={20} color="#EF4444" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Mesh Şifreleme</Text>
                <Text style={styles.settingDescription}>Mesajları şifrele</Text>
        </View>
            </View>
            <Switch
              value={settings.meshEncryption}
              onValueChange={(value) => handleSettingChange('meshEncryption', value)}
              trackColor={{ false: '#374151', true: '#EF4444' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );

  // Security section render
  const renderSecuritySection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Authentication */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kimlik Doğrulama</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="finger-print-outline" size={20} color="#06B6D4" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Biyometrik</Text>
                <Text style={styles.settingDescription}>Parmak izi / Yüz tanıma</Text>
      </View>
            </View>
          <Switch
              value={settings.biometricEnabled}
              onValueChange={(value) => handleSettingChange('biometricEnabled', value)}
              trackColor={{ false: '#374151', true: '#06B6D4' }}
              thumbColor="#FFFFFF"
          />
        </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="shield-outline" size={20} color="#10B981" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Şifre Koruması</Text>
                <Text style={styles.settingDescription}>Uygulama şifresi</Text>
              </View>
            </View>
          <Switch
              value={settings.appLockEnabled}
              onValueChange={(value) => handleSettingChange('appLockEnabled', value)}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor="#FFFFFF"
          />
        </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="key-outline" size={20} color="#8B5CF6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>2FA</Text>
                <Text style={styles.settingDescription}>İki faktörlü kimlik doğrulama</Text>
              </View>
            </View>
          <Switch
              value={settings.twoFactorAuth}
              onValueChange={(value) => handleSettingChange('twoFactorAuth', value)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#FFFFFF"
          />
        </View>
          </View>
          </View>

      {/* Data Protection */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Veri Koruması</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed-outline" size={20} color="#EF4444" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Şifreleme</Text>
                <Text style={styles.settingDescription}>Verileri şifrele</Text>
          </View>
          </View>
            <Switch
              value={settings.encryptionEnabled}
              onValueChange={(value) => handleSettingChange('encryptionEnabled', value)}
              trackColor={{ false: '#374151', true: '#EF4444' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Oturum Zaman Aşımı</Text>
                <Text style={styles.settingDescription}>15 dakika sonra çıkış</Text>
          </View>
            </View>
            <Pressable onPress={() => Alert.alert('Oturum Zaman Aşımı', '5dk - 15dk - 30dk - 1saat seçenekleri')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </Pressable>
        </View>
        </View>
      </View>
    </ScrollView>
  );

  // Data section render
  const renderDataSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Backup & Sync */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Yedekleme & Senkronizasyon</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="cloud-upload-outline" size={20} color="#84CC16" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Otomatik Yedekleme</Text>
                <Text style={styles.settingDescription}>Verileri otomatik yedekle</Text>
          </View>
            </View>
          <Switch
              value={settings.autoBackup}
              onValueChange={(value) => handleSettingChange('autoBackup', value)}
              trackColor={{ false: '#374151', true: '#84CC16' }}
              thumbColor="#FFFFFF"
          />
        </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="sync-outline" size={20} color="#3B82F6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Bulut Senkronizasyonu</Text>
                <Text style={styles.settingDescription}>Cihazlar arası senkronizasyon</Text>
              </View>
            </View>
            <Switch
              value={settings.cloudSync}
              onValueChange={(value) => handleSettingChange('cloudSync', value)}
              trackColor={{ false: '#374151', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
        </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="wifi-outline" size={20} color="#10B981" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Sadece WiFi</Text>
                <Text style={styles.settingDescription}>Sadece WiFi'da senkronize et</Text>
              </View>
            </View>
            <Switch
              value={settings.syncWifiOnly}
              onValueChange={(value) => handleSettingChange('syncWifiOnly', value)}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        </View>

      {/* Storage Management */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Depolama Yönetimi</Text>
        <View style={styles.settingList}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="server-outline" size={20} color="#6B7280" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Yerel Depolama</Text>
                <Text style={styles.settingDescription}>256 MB kullanılıyor</Text>
              </View>
            </View>
            <Pressable onPress={() => Alert.alert('Depolama', 'Temizle - Yedekle - Genişlet seçenekleri')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </Pressable>
      </View>
            
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Önbellek Temizle</Text>
                <Text style={styles.settingDescription}>Geçici dosyaları temizle</Text>
              </View>
              </View>
            <Pressable onPress={() => Alert.alert('Önbellek Temizlendi', '45 MB alan boşaltıldı')}>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </Pressable>
              </View>
              </View>
      </View>
    </ScrollView>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'premium':
        return renderPremiumSection();
      case 'language':
      case 'region':
        return renderLanguageRegionSection();
      case 'profile':
        return renderProfileEditSection();
      case 'general':
        return renderGeneralSection();
      case 'notifications':
        return renderNotificationSection();
      case 'comprehensive':
        return renderComprehensiveFeaturesSection();
      case 'earthquake':
        return renderEarthquakeSection();
      case 'mesh':
        return renderMeshSection();
      case 'security':
        return renderSecuritySection();
      case 'data':
        return renderDataSection();
      default:
        return renderPremiumSection();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
          <Text style={styles.headerSubtitle}>Kapsamlı ve detaylı ayar yönetimi</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark" size={16} color="#10B981" />
        </View>
      </View>

      {/* Section Navigation */}
      <View style={styles.sectionNav}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNavContent}>
          {sections.map((section) => {
            const isPremiumRequired = section.premium && !isPremium;
            return (
            <Pressable accessible={true}
                key={section.id}
                onPress={() => {
                  if (isPremiumRequired) {
                    Alert.alert(
                      'Premium Gerekli',
                      `${section.label} özelliği Premium üyelik gerektirir.`,
                      [
                        { text: 'İptal', style: 'cancel' },
                        { 
                          text: 'Premium Satın Al', 
                          style: 'default',
                          onPress: () => setActiveSection('premium')
                        }
                      ]
                    );
                    return;
                  }
                  setActiveSection(section.id);
                }}
              style={[
                  styles.sectionButton,
                  activeSection === section.id && styles.activeSectionButton,
                  isPremiumRequired && { opacity: 0.6 }
              ]}
            >
                <View style={[
                  styles.sectionIcon,
                  { backgroundColor: activeSection === section.id ? section.color : 'transparent' }
                ]}>
              <Ionicons 
                    name={section.icon as any} 
                    size={20} 
                    color={isPremiumRequired ? '#6b7280' : (activeSection === section.id ? '#FFFFFF' : '#6B7280')} 
                  />
                </View>
              <Text style={[
                  styles.sectionLabel,
                  activeSection === section.id && styles.activeSectionLabel,
                  isPremiumRequired && { color: '#6b7280' }
              ]}>
                  {section.label}
              </Text>
              {isPremiumRequired && (
                <Ionicons name="lock-closed" size={12} color="#6b7280" style={{ marginLeft: 4 }} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
        </View>

      {/* Section Content */}
      {renderSectionContent()}

      {/* Profile Modal */}
      <Modal
          accessible={true}
          accessibilityViewIsModal={true}
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={styles.modalCancelText}>İptal</Text>
            </TouchableOpacity>
              <Text style={styles.modalTitle}>Profil Düzenle</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={styles.modalSaveText}>Kaydet</Text>
            </TouchableOpacity>
            </View>
            
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ad Soyad</Text>
              <TextInput
          accessibilityRole="text"
                style={styles.input}
                value={profileData.name}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, name: text }))}
                placeholder="Adınızı girin"
                placeholderTextColor="#6B7280"
              />
              </View>
              
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>E-posta</Text>
              <TextInput
          accessibilityRole="text"
                style={styles.input}
                value={profileData.email}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, email: text }))}
                placeholder="E-posta adresinizi girin"
                placeholderTextColor="#6B7280"
                keyboardType="email-address"
              />
              </View>
              
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Telefon</Text>
              <TextInput
          accessibilityRole="text"
                style={styles.input}
                value={profileData.phone}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, phone: text }))}
                placeholder="Telefon numaranızı girin"
                placeholderTextColor="#6B7280"
                keyboardType="phone-pad"
              />
              </View>
              
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Adres</Text>
              <TextInput
          accessibilityRole="text"
                style={[styles.input, styles.textArea]}
                value={profileData.address}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, address: text }))}
                placeholder="Adresinizi girin"
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={3}
              />
              </View>
            </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 44, // Status bar için
    paddingBottom: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Section Navigation
  sectionNav: {
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  sectionNavContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionButton: {
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  activeSectionButton: {
    backgroundColor: '#374151',
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeSectionLabel: {
    color: '#FFFFFF',
  },
  
  // Section Content
  sectionContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 0,
    paddingBottom: 80, // Alt navigation bar için boşluk
  },
  premiumContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  languageRegionContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  profileEditContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  comprehensiveContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  
  // Cards
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  
  // Profile
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
  },
  profileStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  
  // Actions
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 6,
    textAlign: 'center',
  },
  
  // Info List
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  
  // Settings
  settingList: {
    gap: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingContent: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  
  // Input
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
});