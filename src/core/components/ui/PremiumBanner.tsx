import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, spacing, layout } from '../../theme';

interface PremiumBannerProps {
  tier: string;
}

export default function PremiumBanner({ tier }: PremiumBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Premium modu</Text>
      <Text style={styles.tier}>{tier.toUpperCase()}</Text>
      <Text style={styles.description}>Öncelikli uydu verisi, yapay zeka destekli risk analizi ve kesintisiz offline iletişim.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111d3d',
    borderRadius: layout.borderRadius,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: palette.accent.primary,
  },
  label: {
    color: palette.text.secondary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  tier: {
    color: palette.text.primary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  description: {
    color: palette.text.secondary,
    fontSize: 14,
  },
});
