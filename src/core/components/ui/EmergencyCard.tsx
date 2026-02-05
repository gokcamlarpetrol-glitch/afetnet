import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, spacing, layout } from '../../theme';
import { EmergencyAlert } from '../../types/alerts';

interface EmergencyCardProps {
  alert: EmergencyAlert;
}

const severityColorMap = {
  danger: palette.status.danger,
  warning: palette.status.warning,
  info: palette.status.info,
};

const EmergencyCard = React.memo(function EmergencyCard({ alert }: EmergencyCardProps) {
  const severityText = alert.severity === 'danger' ? 'Tehlikeli' : alert.severity === 'warning' ? 'Uyarı' : 'Bilgi';

  return (
    <View
      style={[styles.container, { borderColor: severityColorMap[alert.severity] ?? palette.border.light }]}
      accessibilityLabel={`${severityText} seviyesinde acil durum: ${alert.title}`}
      accessibilityHint={`Konum: ${alert.location}. ${alert.message}`}
      accessibilityRole="alert"
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>{alert.title}</Text>
        <Text style={styles.badge}>{alert.location}</Text>
      </View>
      <Text style={styles.message}>{alert.message}</Text>
      <Text style={styles.timestamp}>{new Date(alert.timestamp).toLocaleTimeString('tr-TR')}</Text>
    </View>
  );
});

export default EmergencyCard;

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: palette.background.card,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: palette.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    color: palette.text.secondary,
    fontSize: 12,
  },
  message: {
    color: palette.text.secondary,
    marginTop: spacing.sm,
    fontSize: 14,
  },
  timestamp: {
    color: palette.text.secondary,
    marginTop: spacing.sm,
    fontSize: 12,
    textAlign: 'right',
  },
});
