/**
 * SETTINGS SCREEN - App Settings (FREE)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePremiumStore } from '../stores/premiumStore';
import { useMeshStore } from '../stores/meshStore';
import { premiumService } from '../services/PremiumService';

export default function SettingsScreen() {
  const [isPremium, setIsPremium] = useState(false);
  const [meshStats, setMeshStats] = useState({ messagesSent: 0, messagesReceived: 0, peersDiscovered: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setIsPremium(usePremiumStore.getState().isPremium);
      setMeshStats(useMeshStore.getState().stats);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleRestorePurchases = async () => {
    Alert.alert('Satın Alımları Geri Yükle', 'Önceki satın alımlarınız kontrol ediliyor...');
    const restored = await premiumService.restorePurchases();
    if (restored) {
      Alert.alert('Başarılı', 'Premium üyeliğiniz geri yüklendi!');
    } else {
      Alert.alert('Bilgi', 'Geri yüklenecek satın alım bulunamadı.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Premium Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Durum</Text>
          <View style={styles.card}>
            <View style={styles.premiumStatus}>
              <Ionicons 
                name={isPremium ? "checkmark-circle" : "close-circle"} 
                size={24} 
                color={isPremium ? "#10b981" : "#64748b"} 
              />
              <Text style={styles.premiumText}>
                {isPremium ? 'Premium Üye' : 'Ücretsiz Üye'}
              </Text>
            </View>
            {!isPremium && (
              <Pressable style={styles.upgradeButton}>
                <Text style={styles.upgradeButtonText}>Premium'a Geç</Text>
              </Pressable>
            )}
            {isPremium && (
              <Pressable style={styles.restoreButton} onPress={handleRestorePurchases}>
                <Text style={styles.restoreButtonText}>Satın Alımları Geri Yükle</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* BLE Mesh Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BLE Mesh İstatistikleri</Text>
          <View style={styles.card}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Gönderilen Mesajlar</Text>
              <Text style={styles.statValue}>{meshStats.messagesSent}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Alınan Mesajlar</Text>
              <Text style={styles.statValue}>{meshStats.messagesReceived}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Keşfedilen Cihazlar</Text>
              <Text style={styles.statValue}>{meshStats.peersDiscovered}</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hakkında</Text>
          <View style={styles.card}>
            <Text style={styles.aboutText}>AfetNet v1.0.0</Text>
            <Text style={styles.aboutSubtext}>
              Afet durumlarında offline iletişim için tasarlanmış acil durum uygulaması
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  premiumStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  premiumText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  upgradeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  statValue: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  aboutText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  aboutSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
});

