import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
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
      colors={['#FFFFFF', '#FDFBF7']} // Gentle Cream Gradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="information" size={20} color={colors.brand.primary} />
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
    borderColor: 'rgba(15, 23, 42, 0.05)', // Gentle border
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // White glass
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
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
    backgroundColor: 'rgba(37, 99, 235, 0.08)', // Gentle blue
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary, // White
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.secondary, // Slate 400
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
    color: colors.text.secondary, // Slate 400
    fontWeight: '500',
  },
});


