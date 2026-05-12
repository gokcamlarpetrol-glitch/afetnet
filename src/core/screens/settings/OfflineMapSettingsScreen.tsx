/**
 * OFFLINE MAP SETTINGS SCREEN
 * Offline map tile cache information
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import type { StackNavigationProp } from '@react-navigation/stack';

interface OfflineMapSettingsScreenProps {
  navigation?: StackNavigationProp<Record<string, undefined>>;
}

export default function OfflineMapSettingsScreen({ navigation }: OfflineMapSettingsScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Harita Ayarları</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Offline Map Info */}
      <View style={styles.comingSoonContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="map-outline" size={64} color="#94a3b8" />
        </View>
        <Text style={styles.comingSoonTitle}>Çevrimdışı Haritalar</Text>
        <Text style={styles.comingSoonDescription}>
          Harita görünümü, önbelleğe alınan karolar sayesinde kısa süreli çevrimdışı kullanım için kısmi destek sunmaktadır.
          İnternet bağlantısı olmadığında daha önce görüntülenen bölgeler erişilebilir kalır.
        </Text>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <Text style={styles.infoText}>
            Afet durumlarında çevrimdışı erişim için sık kullandığınız bölgeleri önceden görüntülemenizi öneririz.
          </Text>
        </View>
      </View>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  comingSoonTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  comingSoonDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
});


