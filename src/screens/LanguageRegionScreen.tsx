import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalLanguage } from '../services/GlobalLanguageManager';

// Supported languages
const SUPPORTED_LANGUAGES = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

// Supported regions
const SUPPORTED_REGIONS = [
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷', timezone: 'Europe/Istanbul' },
  { code: 'US', name: 'United States', flag: '🇺🇸', timezone: 'America/New_York' },
  { code: 'EU', name: 'Europe', flag: '🇪🇺', timezone: 'Europe/London' },
  { code: 'MENA', name: 'Middle East & North Africa', flag: '🌍', timezone: 'Asia/Dubai' },
  { code: 'ASIA', name: 'Asia Pacific', flag: '🌏', timezone: 'Asia/Tokyo' },
  { code: 'LATAM', name: 'Latin America', flag: '🌎', timezone: 'America/Sao_Paulo' },
];

export default function LanguageRegionScreen() {
  const { language, region, isLoading, changeLanguage, changeRegion } = useGlobalLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [selectedRegion, setSelectedRegion] = useState(region);

  useEffect(() => {
    setSelectedLanguage(language);
    setSelectedRegion(region);
  }, [language, region]);

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await changeLanguage(languageCode);
      setSelectedLanguage(languageCode);
      
      Alert.alert(
        'Dil Değiştirildi',
        'Uygulama dili başarıyla değiştirildi. Değişikliklerin etkili olması için uygulamayı yeniden başlatmanız önerilir.',
        [{ text: 'Tamam', style: 'default' }],
      );
    } catch (error) {
      Alert.alert('Hata', 'Dil değiştirilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleRegionChange = async (regionCode: string) => {
    try {
      const region = SUPPORTED_REGIONS.find(r => r.code === regionCode);
      if (!region) return;
      
      await changeRegion(regionCode);
      setSelectedRegion(regionCode);
      
      Alert.alert(
        'Bölge Değiştirildi',
        `Bölge ${region.name} olarak ayarlandı. Deprem verileri ve bildirimler bu bölgeye göre güncellenecek.`,
        [{ text: 'Tamam', style: 'default' }],
      );
    } catch (error) {
      Alert.alert('Hata', 'Bölge değiştirilemedi. Lütfen tekrar deneyin.');
    }
  };

  const renderLanguageItem = (language: typeof SUPPORTED_LANGUAGES[0]) => (
    <Pressable
      key={language.code}
      style={[
        styles.languageItem,
        selectedLanguage === language.code && styles.selectedItem,
      ]}
      onPress={() => handleLanguageChange(language.code)}
      disabled={isLoading}
    >
      <View style={styles.languageContent}>
        <Text style={styles.flag}>{language.flag}</Text>
        <View style={styles.languageInfo}>
          <Text style={[
            styles.languageName,
            selectedLanguage === language.code && styles.selectedText,
          ]}>
            {language.name}
          </Text>
          <Text style={[
            styles.languageCode,
            selectedLanguage === language.code && styles.selectedSubText,
          ]}>
            {language.code.toUpperCase()}
          </Text>
        </View>
      </View>
      {selectedLanguage === language.code && (
        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
      )}
    </Pressable>
  );

  const renderRegionItem = (region: typeof SUPPORTED_REGIONS[0]) => (
    <Pressable
      key={region.code}
      style={[
        styles.regionItem,
        selectedRegion === region.code && styles.selectedItem,
      ]}
      onPress={() => handleRegionChange(region.code)}
      disabled={isLoading}
    >
      <View style={styles.regionContent}>
        <Text style={styles.flag}>{region.flag}</Text>
        <View style={styles.regionInfo}>
          <Text style={[
            styles.regionName,
            selectedRegion === region.code && styles.selectedText,
          ]}>
            {region.name}
          </Text>
          <Text style={[
            styles.regionCode,
            selectedRegion === region.code && styles.selectedSubText,
          ]}>
            {region.code} • {region.timezone}
          </Text>
        </View>
      </View>
      {selectedRegion === region.code && (
        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dil ve Bölge</Text>
          <Text style={styles.subtitle}>
            Uygulama dilini ve bölgenizi seçin. Bu ayarlar deprem verileri ve bildirimlerinizi etkiler.
          </Text>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language-outline" size={24} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Dil Seçimi</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Uygulama arayüzü için dil seçin. Seçtiğiniz dil tüm menüler ve mesajlarda kullanılacak.
          </Text>
          
          <View style={styles.itemsContainer}>
            {SUPPORTED_LANGUAGES.map(renderLanguageItem)}
          </View>
        </View>

        {/* Region Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={24} color="#EF4444" />
            <Text style={styles.sectionTitle}>Bölge Seçimi</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Bölgenizi seçin. Bu ayar deprem verilerinin kaynağını ve bildirim zamanlamasını etkiler.
          </Text>
          
          <View style={styles.itemsContainer}>
            {SUPPORTED_REGIONS.map(renderRegionItem)}
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color="#3B82F6" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Otomatik Güncelleme</Text>
              <Text style={styles.infoText}>
                • Dil değişikliği anında uygulanır{'\n'}
                • Bölge değişikliği deprem verilerini etkiler{'\n'}
                • Zaman dilimi otomatik ayarlanır{'\n'}
                • Bildirimler seçilen bölgeye göre gönderilir
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 20,
  },
  itemsContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 8,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  regionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedItem: {
    backgroundColor: '#1E40AF',
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  regionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flag: {
    fontSize: 24,
    marginRight: 16,
  },
  languageInfo: {
    flex: 1,
  },
  regionInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  regionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  languageCode: {
    fontSize: 12,
    color: '#94A3B8',
  },
  regionCode: {
    fontSize: 12,
    color: '#94A3B8',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  selectedSubText: {
    color: '#E5E7EB',
  },
  infoSection: {
    marginTop: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
});
