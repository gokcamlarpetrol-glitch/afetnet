import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePremium } from '../../store/premium';
import { useAppSettings } from '../../store/appSettings';
import LanguageRegionScreen from '../LanguageRegionScreen';
import ProfileEditScreen from '../ProfileEditScreen';
import ComprehensiveFeaturesScreen from '../ComprehensiveFeaturesScreen';

// Import settings components
import { PremiumSection } from './components/PremiumSection';
import { ProfileSection } from './components/ProfileSection';
import { GeneralSection } from './components/GeneralSection';
import { NotificationSection } from './components/NotificationSection';
import { SecuritySection } from './components/SecuritySection';
import { DataSection } from './components/DataSection';

export default function Settings() {
  const { isPremium } = usePremium();

  // State management
  const [activeSection, setActiveSection] = useState(isPremium ? 'profile' : 'premium');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);



  const renderSectionContent = () => {
    switch (activeSection) {
    case 'premium':
      return <PremiumSection />;
    case 'profile':
      return <ProfileSection />;
    case 'general':
      return <GeneralSection />;
    case 'notifications':
      return <NotificationSection />;
    case 'security':
      return <SecuritySection />;
    case 'data':
      return <DataSection />;
    default:
      return <PremiumSection />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ Ayarlar</Text>
          <Text style={styles.subtitle}>AfetNet uygulamasını kişiselleştirin</Text>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabsContainer}>
          {[
            { key: 'premium', label: 'Premium', icon: 'star' },
            { key: 'profile', label: 'Profil', icon: 'person' },
            { key: 'general', label: 'Genel', icon: 'settings' },
            { key: 'notifications', label: 'Bildirimler', icon: 'notifications' },
            { key: 'security', label: 'Güvenlik', icon: 'shield' },
            { key: 'data', label: 'Veri', icon: 'server' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeSection === tab.key && styles.activeTab,
              ]}
              onPress={() => setActiveSection(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={activeSection === tab.key ? '#000' : '#64748b'}
              />
              <Text style={[
                styles.tabText,
                activeSection === tab.key && styles.activeTabText,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section Content */}
        <View style={styles.content}>
          {renderSectionContent()}
        </View>
      </ScrollView>

      {/* Profile Modal */}
      <Modal visible={showProfileModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 16 }}>Profil Düzenleme</Text>
            </View>
            <ProfileEditScreen />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal visible={showLanguageModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 16 }}>Dil ve Bölge</Text>
            </View>
            <LanguageRegionScreen />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Comprehensive Features Modal */}
      <Modal visible={showAdvancedModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
              <TouchableOpacity onPress={() => setShowAdvancedModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 16 }}>Gelişmiş Özellikler</Text>
            </View>
            <ComprehensiveFeaturesScreen />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
});
