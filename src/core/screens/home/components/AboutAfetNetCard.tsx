import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../theme';

const HIGHLIGHTS = [
  'İnternet yokken bile çalışan mesh tabanlı iletişim',
  'AFAD ve Kandilli verileriyle canlı deprem uyarıları',
  'AI destekli risk analizi, hazırlık planı ve afet rehberi',
  'Premium güvenlik: uçtan uca şifreleme ve acil durum SOS',
];

export default function AboutAfetNetCard() {
  return (
    <LinearGradient
      colors={['#111a3a', '#0b1225']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="information" size={20} color={colors.accent.primary} />
        </View>
        <Text style={styles.title}>AfetNet Nedir?</Text>
      </View>
      <Text style={styles.description}>
        Deprem ve afet anlarında internet olmasa bile çalışan acil durum iletişim ağı. Bluetooth, mesh
        teknolojisi ve AI destekli özellikler ile sevdiklerinizle bağlantıda kalın, riskleri önceden
        görün ve adım adım yönlendirme alın.
      </Text>
      <View style={styles.highlights}>
        {HIGHLIGHTS.map((item) => (
          <View key={item} style={styles.highlightItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
            <Text style={styles.highlightText}>{item}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: spacing[6],
    marginTop: spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
    gap: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(226, 232, 255, 0.85)',
  },
  highlights: {
    gap: spacing[3],
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  highlightText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(226, 232, 255, 0.8)',
  },
});


