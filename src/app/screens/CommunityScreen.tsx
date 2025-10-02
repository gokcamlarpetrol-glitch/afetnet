import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DamageReportForm } from '../components/DamageReportForm';
import { VolunteerQRVerifier } from '../../core/volunteer/qr';
import * as Location from 'expo-location';

export const CommunityScreen: React.FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'resources' | 'volunteers' | 'damage'>('resources');
  const [scannedVolunteer, setScannedVolunteer] = useState<any>(null);
  const [showDamageReportForm, setShowDamageReportForm] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);

  const volunteerQRVerifier = VolunteerQRVerifier.getInstance();

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni Gerekli', 'Hasar raporu göndermek için konum izni vermelisiniz.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
    } catch (error) {
      console.error('Failed to get current location:', error);
      Alert.alert('Hata', 'Konum alınırken bir hata oluştu.');
      return null;
    }
  };

  const handleDamageReport = async () => {
    try {
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        setShowDamageReportForm(true);
      }
    } catch (error) {
      console.error('Failed to handle damage report:', error);
    }
  };

  const handleScanVolunteerQR = async () => {
    try {
      // In a real implementation, this would open a QR scanner
      // For now, we'll simulate scanning a QR code
      Alert.alert(
        'QR Tarama',
        'QR kod tarama özelliği henüz implement edilmedi. Demo için sahte bir QR kodu kullanacağız.',
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Demo QR', 
            onPress: () => {
              // Simulate scanning a volunteer QR
              const demoQRData = 'demo_volunteer_qr_data';
              verifyVolunteerQR(demoQRData);
            }
          },
        ]
      );
    } catch (error) {
      console.error('Failed to scan volunteer QR:', error);
      Alert.alert('Hata', 'QR kod taranırken bir hata oluştu.');
    }
  };

  const verifyVolunteerQR = async (qrData: string) => {
    try {
      const result = await volunteerQRVerifier.verifyVolunteerQR(qrData);
      
      if (result.isValid && result.profile) {
        setScannedVolunteer(result.profile);
        Alert.alert(
          'Gönüllü Doğrulandı',
          `${result.profile.name} - ${volunteerQRVerifier.getRoleDisplayName(result.profile.role)}\n\nSüre: ${volunteerQRVerifier.formatExpiryTime(result.profile.expiresAt)}`
        );
      } else {
        Alert.alert('Geçersiz QR', result.error || 'QR kodu geçersiz');
        setScannedVolunteer(null);
      }
    } catch (error) {
      console.error('Failed to verify volunteer QR:', error);
      Alert.alert('Hata', 'QR kodu doğrulanırken bir hata oluştu.');
      setScannedVolunteer(null);
    }
  };

  const renderResources = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Kaynaklar</Text>
      
      <Card style={styles.resourceCard}>
        <Text style={styles.resourceTitle}>💧 Su</Text>
        <Text style={styles.resourceInfo}>Konum: Kadıköy Merkez</Text>
        <Text style={styles.resourceInfo}>Miktar: 1000L</Text>
        <Text style={styles.resourceInfo}>Mesafe: 2.5 km</Text>
      </Card>

      <Card style={styles.resourceCard}>
        <Text style={styles.resourceTitle}>🍞 Ekmek</Text>
        <Text style={styles.resourceInfo}>Konum: Beşiktaş</Text>
        <Text style={styles.resourceInfo}>Miktar: 500 adet</Text>
        <Text style={styles.resourceInfo}>Mesafe: 3.1 km</Text>
      </Card>

      <Card style={styles.resourceCard}>
        <Text style={styles.resourceTitle}>🛏️ Battaniye</Text>
        <Text style={styles.resourceInfo}>Konum: Üsküdar</Text>
        <Text style={styles.resourceInfo}>Miktar: 200 adet</Text>
        <Text style={styles.resourceInfo}>Mesafe: 1.8 km</Text>
      </Card>

      <Button
        title="Kaynak Paylaş"
        onPress={() => Alert.alert('Bilgi', 'Kaynak paylaşma özelliği geliştiriliyor.')}
        style={styles.actionButton}
      />
    </View>
  );

  const renderVolunteers = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Gönüllüler</Text>
      
      <Button
        title="Gönüllü Tara (QR)"
        onPress={handleScanVolunteerQR}
        style={styles.actionButton}
      />

      {scannedVolunteer && (
        <Card style={styles.volunteerCard}>
          <View style={styles.volunteerHeader}>
            <Text style={styles.volunteerIcon}>
              {volunteerQRVerifier.getRoleIcon(scannedVolunteer.role)}
            </Text>
            <View style={styles.volunteerInfo}>
              <Text style={styles.volunteerName}>{scannedVolunteer.name}</Text>
              <Text style={[
                styles.volunteerRole,
                { color: volunteerQRVerifier.getRoleColor(scannedVolunteer.role) }
              ]}>
                {volunteerQRVerifier.getRoleDisplayName(scannedVolunteer.role)}
              </Text>
            </View>
          </View>
          
          <Text style={styles.volunteerStatus}>
            Durum: {scannedVolunteer.isValid ? '✅ Geçerli' : '❌ Geçersiz'}
          </Text>
          
          <Text style={styles.volunteerExpiry}>
            Süre: {volunteerQRVerifier.formatExpiryTime(scannedVolunteer.expiresAt)}
          </Text>

          <View style={styles.volunteerActions}>
            <TouchableOpacity
              style={styles.volunteerActionButton}
              onPress={() => {
                Alert.alert('Yetki Kontrolü', 'Bu gönüllünün yetkileri kontrol ediliyor...');
              }}
            >
              <Text style={styles.volunteerActionText}>Yetki Kontrolü</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.volunteerActionButton, styles.secondaryButton]}
              onPress={() => {
                Alert.alert('Aktivite Kaydı', 'Gönüllü aktivitesi kaydediliyor...');
              }}
            >
              <Text style={[styles.volunteerActionText, styles.secondaryButtonText]}>
                Aktivite Kaydet
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>Gönüllü Rolleri</Text>
        <Text style={styles.infoText}>🏥 Tıbbi Personel - Acil tıbbi müdahale</Text>
        <Text style={styles.infoText}>🚁 Arama Kurtarma - Arama ve kurtarma operasyonları</Text>
        <Text style={styles.infoText}>📋 Koordinatör - Operasyon koordinasyonu</Text>
        <Text style={styles.infoText}>🚒 İtfaiyeci - Yangın söndürme</Text>
        <Text style={styles.infoText}>👮 Polis - Güvenlik ve trafik kontrolü</Text>
        <Text style={styles.infoText}>🛡️ Sivil Savunma - Sivil koruma</Text>
        <Text style={styles.infoText}>🤝 Gönüllü - Temel yardım</Text>
      </Card>
    </View>
  );

  const renderDamageReports = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Hasar Bildirimi</Text>
      
      <Card style={styles.damageCard}>
        <Text style={styles.damageTitle}>🏢 Bina Hasarı</Text>
        <Text style={styles.damageInfo}>Konum: Şişli Merkez</Text>
        <Text style={styles.damageInfo}>Şiddet: Orta</Text>
        <Text style={styles.damageInfo}>Durum: Bildirildi</Text>
      </Card>

      <Card style={styles.damageCard}>
        <Text style={styles.damageTitle}>🚗 Araç Hasarı</Text>
        <Text style={styles.damageInfo}>Konum: Beşiktaş</Text>
        <Text style={styles.damageInfo}>Şiddet: Düşük</Text>
        <Text style={styles.damageInfo}>Durum: Kontrol Edildi</Text>
      </Card>

      <Button
        title="Hasar Bildir"
        onPress={handleDamageReport}
        style={styles.actionButton}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('community.title')}</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'resources' && styles.activeTab]}
          onPress={() => setActiveTab('resources')}
        >
          <Text style={[styles.tabText, activeTab === 'resources' && styles.activeTabText]}>
            Kaynak
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'volunteers' && styles.activeTab]}
          onPress={() => setActiveTab('volunteers')}
        >
          <Text style={[styles.tabText, activeTab === 'volunteers' && styles.activeTabText]}>
            Gönüllü
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'damage' && styles.activeTab]}
          onPress={() => setActiveTab('damage')}
        >
          <Text style={[styles.tabText, activeTab === 'damage' && styles.activeTabText]}>
            Hasar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'resources' && renderResources()}
      {activeTab === 'volunteers' && renderVolunteers()}
      {activeTab === 'damage' && renderDamageReports()}

      {/* Damage Report Form Modal */}
      <Modal
        visible={showDamageReportForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <DamageReportForm
          onClose={() => {
            setShowDamageReportForm(false);
            setCurrentLocation(null);
          }}
          initialLocation={currentLocation || undefined}
        />
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  resourceCard: {
    marginBottom: 12,
  },
  resourceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  resourceInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  actionButton: {
    marginTop: 16,
  },
  volunteerCard: {
    marginBottom: 16,
  },
  volunteerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  volunteerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  volunteerInfo: {
    flex: 1,
  },
  volunteerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  volunteerRole: {
    fontSize: 16,
    fontWeight: '500',
  },
  volunteerStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  volunteerExpiry: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  volunteerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  volunteerActionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  volunteerActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#007AFF',
  },
  infoCard: {
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  damageCard: {
    marginBottom: 12,
  },
  damageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  damageInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});