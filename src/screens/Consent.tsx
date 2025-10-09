import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { palette, spacing } from '../ui/theme';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConsentData {
  accepted: boolean;
  acceptedAt: number;
  version: string;
  dataProcessing: boolean;
  emergencySharing: boolean;
  analytics: boolean;
}

export default function ConsentScreen() {
  const [consentData, setConsentData] = useState<ConsentData>({
    accepted: false,
    acceptedAt: 0,
    version: '1.0',
    dataProcessing: false,
    emergencySharing: false,
    analytics: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConsentData();
  }, []);

  const loadConsentData = async () => {
    try {
      const stored = await AsyncStorage.getItem('afn/consent/v1');
      if (stored) {
        setConsentData(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading consent data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConsentData = async (data: ConsentData) => {
    try {
      await AsyncStorage.setItem('afn/consent/v1', JSON.stringify(data));
      setConsentData(data);
    } catch (error) {
      console.error('Error saving consent data:', error);
      Alert.alert('Hata', 'Onam bilgileri kaydedilemedi');
    }
  };

  const handleAcceptAll = () => {
    const newConsent: ConsentData = {
      accepted: true,
      acceptedAt: Date.now(),
      version: '1.0',
      dataProcessing: true,
      emergencySharing: true,
      analytics: false, // Analytics disabled by default for privacy
    };
    saveConsentData(newConsent);
    Alert.alert('Başarılı', 'Tüm onamlar kaydedildi');
  };

  const handleDeclineAll = () => {
    const newConsent: ConsentData = {
      accepted: false,
      acceptedAt: Date.now(),
      version: '1.0',
      dataProcessing: false,
      emergencySharing: false,
      analytics: false,
    };
    saveConsentData(newConsent);
    Alert.alert('Bilgi', 'Onamlar reddedildi. Acil durum özellikleri sınırlı olacaktır.');
  };

  const handleToggleDataProcessing = () => {
    const newConsent = { ...consentData, dataProcessing: !consentData.dataProcessing };
    saveConsentData(newConsent);
  };

  const handleToggleEmergencySharing = () => {
    const newConsent = { ...consentData, emergencySharing: !consentData.emergencySharing };
    saveConsentData(newConsent);
  };

  const handleToggleAnalytics = () => {
    const newConsent = { ...consentData, analytics: !consentData.analytics };
    saveConsentData(newConsent);
  };

  const handleEmergencyAccess = () => {
    Alert.alert(
      'Acil Durum Erişimi',
      'Acil durumdayken bile onam vermeden temel özellikler kullanılabilir. Ancak tam işlevsellik için onam gerekir.',
      [
        { text: 'Tamam' },
        { text: 'Onam Ver', onPress: handleAcceptAll },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.headerCard}>
          <View style={styles.header}>
            <Ionicons name="document-text" size={48} color={palette.primary} />
            <Text style={styles.title}>Onam ve İzinler</Text>
            <Text style={styles.subtitle}>
              Veri işleme ve paylaşım izinleri
            </Text>
          </View>
        </Card>

        {consentData.accepted && (
          <Card title="Mevcut Onam Durumu" style={styles.statusCard}>
            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle" size={20} color={palette.successColors?.main || '#22c55e'} />
              <Text style={styles.statusText}>
                Onam verildi ({new Date(consentData.acceptedAt).toLocaleDateString('tr-TR')})
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons 
                name={consentData.dataProcessing ? "checkmark-circle" : "close-circle"} 
                size={20} 
                color={consentData.dataProcessing ? (palette.successColors?.main || '#22c55e') : (palette.errorColors?.main || '#ef4444')} 
              />
              <Text style={styles.statusText}>Veri İşleme</Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons 
                name={consentData.emergencySharing ? "checkmark-circle" : "close-circle"} 
                size={20} 
                color={consentData.emergencySharing ? (palette.successColors?.main || '#22c55e') : (palette.errorColors?.main || '#ef4444')} 
              />
              <Text style={styles.statusText}>Acil Durum Paylaşımı</Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons 
                name={consentData.analytics ? "checkmark-circle" : "close-circle"} 
                size={20} 
                color={consentData.analytics ? (palette.successColors?.main || '#22c55e') : (palette.errorColors?.main || '#ef4444')} 
              />
              <Text style={styles.statusText}>Analitik Veriler</Text>
            </View>
          </Card>
        )}

        <Card title="Veri İşleme Onamı">
          <Text style={styles.sectionText}>
            Kişisel verilerinizin işlenmesi için onam veriyor musunuz?
          </Text>
          <Text style={styles.descriptionText}>
            Bu onam, cihazınızdaki verilerin işlenmesi, şifrelenmesi ve güvenli iletişim için kullanılması anlamına gelir.
          </Text>
          <Button
            label={consentData.dataProcessing ? "Onam Verildi ✓" : "Onam Ver"}
            onPress={handleToggleDataProcessing}
            variant={consentData.dataProcessing ? "ghost" : "primary"}
            style={styles.consentButton}
          />
        </Card>

        <Card title="Acil Durum Paylaşımı">
          <Text style={styles.sectionText}>
            Acil durumlarda konum ve durum bilgilerinizin paylaşılması için onam veriyor musunuz?
          </Text>
          <Text style={styles.descriptionText}>
            Bu onam, acil durumlarda (SOS) konum ve durum bilgilerinizin güvenli şekilde paylaşılması anlamına gelir.
          </Text>
          <Button
            label={consentData.emergencySharing ? "Onam Verildi ✓" : "Onam Ver"}
            onPress={handleToggleEmergencySharing}
            variant={consentData.emergencySharing ? "ghost" : "primary"}
            style={styles.consentButton}
          />
        </Card>

        <Card title="Analitik Veriler">
          <Text style={styles.sectionText}>
            Anonim kullanım istatistikleri toplanması için onam veriyor musunuz?
          </Text>
          <Text style={styles.descriptionText}>
            Bu onam, uygulamanın geliştirilmesi için anonim kullanım verilerinin toplanması anlamına gelir. Kişisel bilgiler toplanmaz.
          </Text>
          <Button
            label={consentData.analytics ? "Onam Verildi ✓" : "Onam Ver"}
            onPress={handleToggleAnalytics}
            variant={consentData.analytics ? "ghost" : "primary"}
            style={styles.consentButton}
          />
        </Card>

        <Card title="Acil Durum Erişimi">
          <Text style={styles.sectionText}>
            Acil durumlarda bile onam vermeden temel özellikler kullanılabilir.
          </Text>
          <Text style={styles.descriptionText}>
            Bu, hayat kurtarıcı özelliklerin her zaman erişilebilir olmasını sağlar.
          </Text>
          <Button
            label="Acil Durum Erişimi"
            onPress={handleEmergencyAccess}
            variant="ghost"
            style={styles.consentButton}
          />
        </Card>

        <View style={styles.actionContainer}>
          <Button
            label="Tümünü Reddet"
            onPress={handleDeclineAll}
            variant="ghost"
            style={styles.actionButton}
          />
          <Button
            label="Tümünü Kabul Et"
            onPress={handleAcceptAll}
            variant="primary"
            style={styles.actionButton}
          />
        </View>

        <Card title="Bilgi">
          <Text style={styles.infoText}>
            • Onamlarınızı istediğiniz zaman değiştirebilirsiniz
          </Text>
          <Text style={styles.infoText}>
            • Acil durum özellikleri her zaman kullanılabilir
          </Text>
          <Text style={styles.infoText}>
            • Tüm veriler cihazınızda saklanır
          </Text>
          <Text style={styles.infoText}>
            • Onam verseniz de vermeseniz de kişisel verileriniz dışarı gönderilmez
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background.primary,
  },
  loadingText: {
    fontSize: 16,
    color: palette.text.secondary,
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
  statusCard: {
    marginBottom: spacing.lg,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusText: {
    fontSize: 14,
    color: palette.text.primary,
  },
  sectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text.primary,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: 14,
    color: palette.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  consentButton: {
    marginTop: spacing.sm,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: palette.text.primary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
