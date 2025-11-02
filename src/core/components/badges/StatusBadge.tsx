/**
 * STATUS BADGE
 * Display status (CANLI, OFFLINE, AKTİF)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'active';
  text?: string;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'online':
      return {
        color: colors.online,
        text: 'CANLI',
        backgroundColor: colors.online + '20',
      };
    case 'offline':
      return {
        color: colors.offline,
        text: 'OFFLINE',
        backgroundColor: colors.offline + '20',
      };
    case 'active':
      return {
        color: colors.status.success,
        text: 'AKTİF',
        backgroundColor: colors.status.success + '20',
      };
    default:
      return {
        color: colors.text.muted,
        text: 'UNKNOWN',
        backgroundColor: colors.background.tertiary,
      };
  }
}

export default function StatusBadge({ status, text }: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }]}>
        {text || config.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    ...typography.badge,
    fontWeight: '700',
  },
});

