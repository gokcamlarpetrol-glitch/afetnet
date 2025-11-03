/**
 * MESH STATUS CARD
 * Display BLE mesh network status
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import StatusBadge from '../badges/StatusBadge';

interface MeshStatusCardProps {
  peerCount: number;
  status: 'online' | 'offline';
  onPress?: () => void;
  messageCount?: number;
  earthquakeCount?: number;
}

export default function MeshStatusCard({ 
  peerCount, 
  status, 
  onPress,
  messageCount = 0,
  earthquakeCount = 0,
}: MeshStatusCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons 
            name="git-network-outline" 
            size={24} 
            color={status === 'online' ? colors.status.online : colors.status.offline} 
          />
          <Text style={styles.title}>Mesh Ağı & Sistem</Text>
        </View>
        <StatusBadge status={status} />
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Ionicons name="wifi-outline" size={20} color={colors.text.tertiary} />
          <Text style={styles.statValue}>{messageCount}</Text>
          <Text style={styles.statLabel}>Mesaj</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="people-outline" size={20} color={colors.text.tertiary} />
          <Text style={styles.statValue}>{peerCount}</Text>
          <Text style={styles.statLabel}>Kişi</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="pulse-outline" size={20} color={colors.text.tertiary} />
          <Text style={styles.statValue}>{earthquakeCount}</Text>
          <Text style={styles.statLabel}>Deprem</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
        <Text style={styles.footerText}>OK</Text>
        
        <Ionicons name="trending-up" size={16} color={colors.status.info} style={styles.footerIcon} />
        <Text style={styles.footerText}>Aktif</Text>
        
        <View style={{ flex: 1 }} />
        
        <Text style={styles.footerLink}>Detay</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.brand.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  pressed: {
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
    marginLeft: 8,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  footerIcon: {
    marginLeft: 16,
  },
  footerText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  footerLink: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: '600',
    marginRight: 4,
  },
});

