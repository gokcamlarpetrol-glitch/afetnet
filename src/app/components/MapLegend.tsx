import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/app/theme/colors';
import { spacing } from '@/app/theme/spacing';
import { textStyles } from '@/app/theme/typography';

interface MapLegendProps {
  visible: boolean;
  onToggle: () => void;
}

interface LegendItem {
  color: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function MapLegend({ visible, onToggle }: MapLegendProps) {
  const legendItems: LegendItem[] = [
    {
      color: colors.status.critical,
      label: 'Kritik Yardım Talebi',
      icon: 'help-circle',
    },
    {
      color: colors.status.high,
      label: 'Yüksek Öncelikli',
      icon: 'warning',
    },
    {
      color: colors.status.normal,
      label: 'Normal Öncelik',
      icon: 'information-circle',
    },
    {
      color: colors.status.safe,
      label: 'Güvenli Konum',
      icon: 'checkmark-circle',
    },
    {
      color: colors.resources.water,
      label: 'Su',
      icon: 'water',
    },
    {
      color: colors.resources.food,
      label: 'Yemek',
      icon: 'restaurant',
    },
    {
      color: colors.resources.blanket,
      label: 'Battaniye',
      icon: 'bed',
    },
    {
      color: colors.resources.powerbank,
      label: 'Powerbank',
      icon: 'battery-charging',
    },
    {
      color: colors.resources.med,
      label: 'İlaç',
      icon: 'medical',
    },
  ];

  if (!visible) {
    return (
      <TouchableOpacity style={styles.toggleButton} onPress={onToggle}>
        <Ionicons name="information-circle" size={24} color={colors.text.primary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Açıklama</Text>
        <TouchableOpacity onPress={onToggle} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Yardım Talepleri</Text>
        {legendItems.slice(0, 4).map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
            <Ionicons
              name={item.icon!}
              size={16}
              color={colors.text.secondary}
              style={styles.icon}
            />
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
        
        <Text style={styles.sectionTitle}>Kaynaklar</Text>
        {legendItems.slice(4).map((item, index) => (
          <View key={index + 4} style={styles.legendItem}>
            <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
            <Ionicons
              name={item.icon!}
              size={16}
              color={colors.text.secondary}
              style={styles.icon}
            />
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
    minWidth: 200,
    maxWidth: 250,
  },
  toggleButton: {
    position: 'absolute',
    bottom: 100,
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  title: {
    ...textStyles.labelLarge,
    color: colors.text.primary,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...textStyles.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  icon: {
    marginRight: spacing.sm,
  },
  label: {
    ...textStyles.bodySmall,
    color: colors.text.primary,
    flex: 1,
  },
});
