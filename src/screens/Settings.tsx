import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccessibility } from '../store/accessibility';
import { useEmergency } from '../store/emergency';
import { useFamily } from '../store/family';
import { usePremium } from '../store/premium';
import { useSettings } from '../store/settings';
// ACTIVE: Premium screen with full IAP support
import PremiumActiveScreen from './PremiumActive';

export default function Settings() {
  const { updateSettings } = useSettings();
  const { ultra, updateEmergency } = useEmergency();
  const { generateMyAfnId } = useFamily();
  const { isPremium, canUseFeature, getRemainingUsage } = usePremium();
  const { setHighContrast, setBigText, setHapticsStrong } = useAccessibility();

  // State management
  const [activeSection, setActiveSection] = useState('premium');
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

  // Settings state
  const [settings, setSettings] = useState({
    // Uygulama Ayarları
    autoUpdate: true,
    errorReports: true,
    analyticsData: true,
    usageStatistics: true,
    darkMode: true,
    language: 'tr',
    region: 'TR',
    timezone: 'Europe/Istanbul',
    
    // Deprem Ayarları
    liveMode: true,
    experimentalPWave: true,
    magnitudeThreshold: 4.0,
    alertRadius: 500,
    alertDelay: 0,
    dataSource: 'AFAD',
    
    // Bildirim Ayarları
    pushNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
    emergencyAlerts: true,
    familyAlerts: true,
    messageAlerts: true,
    systemAlerts: true,
    marketingAlerts: true,
    quietHours: true,
    ledNotification: true,
    badgeCount: true,
    notificationSound: 'default',
    vibrationPattern: 'default',
    quietStartTime: '22:00',
    quietEndTime: '08:00',
    
    // Mesh Ağ Ayarları
    bleEnabled: true,
    meshDiscovery: true,
    relayMode: true,
    powerSaving: true,
    meshEncryption: true,
    autoConnect: true,
    meshRange: 100,
    
    // Güvenlik Ayarları
    biometricEnabled: true,
    encryptionEnabled: true,
    screenLockEnabled: true,
    appLockEnabled: true,
    twoFactorAuth: true,
    loginNotifications: true,
    suspiciousActivityAlerts: true,
    sessionTimeout: 15,
    passwordComplexity: 'high',
    dataSharing: true,
    analyticsSharing: true,
    crashReports: true,
    
    // Veri Ayarları
    autoBackup: true,
    cloudSync: true,
    syncWifiOnly: true,
    debugMode: true,
    backupFrequency: 'daily',
    dataRetention: 365,
    localStorage: 256,
    compressionLevel: 'medium',
    encryptionLevel: 'high',
    dataUsageLimit: 1024,
    cacheSize: 100,
    logLevel: 'info',
  });

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    updateSettings({ [key]: value });
    Alert.alert('✅ Güncellendi', `${key} ayarı ${value ? 'aktif' : 'pasif'} edildi.`);
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
    return (
      <View style={styles.premiumContainer}>
        <PremiumActiveScreen />
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
          <Pressable style={styles.actionButton} onPress={() => setShowProfileModal(true)}>
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
              <Ionicons name="analytics-outline" size={20} color="#8B5CF6" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Kullanım İstatistikleri</Text>
                <Text style={styles.settingDescription}>Anonim kullanım verileri gönder</Text>
              </View>
            </View>
            <Switch
              value={settings.usageStatistics}
              onValueChange={(value) => handleSettingChange('usageStatistics', value)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
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
            <Pressable onPress={() => Alert.alert('Dil Seçimi', 'Türkçe - English - العربية seçenekleri')}>
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
            <Pressable onPress={() => Alert.alert('Bölge Seçimi', 'Türkiye - USA - EU - MENA seçenekleri')}>
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
            </View>
      </View>
    </ScrollView>
  );

  // Main sections configuration
  const sections = [
    { id: 'premium', label: 'Premium', icon: 'shield-checkmark-outline', color: '#10B981' },
    { id: 'profile', label: 'Profil', icon: 'person-outline', color: '#3B82F6' },
    { id: 'general', label: 'Genel', icon: 'settings-outline', color: '#10B981' },
    { id: 'notifications', label: 'Bildirimler', icon: 'notifications-outline', color: '#F59E0B' },
    { id: 'earthquake', label: 'Deprem', icon: 'pulse-outline', color: '#EF4444' },
    { id: 'mesh', label: 'Mesh', icon: 'radio-outline', color: '#8B5CF6' },
    { id: 'security', label: 'Güvenlik', icon: 'shield-outline', color: '#06B6D4' },
    { id: 'data', label: 'Veri', icon: 'server-outline', color: '#84CC16' },
  ];

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
      case 'profile':
        return renderProfileSection();
      case 'general':
        return renderGeneralSection();
      case 'notifications':
        return renderNotificationSection();
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
          {sections.map((section) => (
          <Pressable accessible={true}
              key={section.id}
              onPress={() => setActiveSection(section.id)}
            style={[
                styles.sectionButton,
                activeSection === section.id && styles.activeSectionButton,
            ]}
          >
              <View style={[
                styles.sectionIcon,
                { backgroundColor: activeSection === section.id ? section.color : 'transparent' }
              ]}>
            <Ionicons 
                  name={section.icon} 
                  size={20} 
                  color={activeSection === section.id ? '#FFFFFF' : '#6B7280'} 
                />
              </View>
            <Text style={[
                styles.sectionLabel,
                activeSection === section.id && styles.activeSectionLabel
            ]}>
                {section.label}
            </Text>
          </Pressable>
        ))}
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