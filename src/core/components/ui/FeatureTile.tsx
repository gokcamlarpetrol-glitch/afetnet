import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, layout } from '../../theme';
import { FeatureTile } from '../../types/feature';

interface FeatureTileProps {
  feature: FeatureTile;
  onPress: (route: string) => void;
}

export default function FeatureTileComponent({ feature, onPress }: FeatureTileProps) {
  return (
    <TouchableOpacity
      style={[styles.container, feature.premium && styles.premium]}
      onPress={() => onPress(feature.route)}
      activeOpacity={0.7}
      accessibilityLabel={feature.title}
      accessibilityHint={`${feature.description}. ${feature.premium ? 'Premium özellik.' : ''}`}
      accessibilityRole="button"
    >
      <View style={styles.iconWrapper}>
        <Ionicons name={feature.icon as any} size={22} color={palette.text.primary} />
      </View>
      <View style={styles.textGroup}>
        <Text style={styles.title}>{feature.title}</Text>
        <Text style={styles.description}>{feature.description}</Text>
      </View>
      {feature.premium && <Text style={styles.badge}>Premium</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: palette.background.card,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: palette.border.light,
  },
  premium: {
    borderColor: palette.accent.primary,
  },
  iconWrapper: {
    marginRight: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#14203f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: palette.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  description: {
    color: palette.text.secondary,
    marginTop: 4,
    fontSize: 14,
  },
  badge: {
    color: palette.status.warning,
    fontSize: 11,
    fontWeight: '600',
  },
});
