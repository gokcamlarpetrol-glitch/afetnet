/**
 * FAMILY CHECK-IN MODULE
 * Signature component for AfetNet
 * "Modern Calm Trust" Style: Presence badges, timeline, calm
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, shadow } from '../../theme';
import Card from '../Card';

interface MemberStatus {
    id: string;
    name: string;
    status: 'safe' | 'warning' | 'danger' | 'unknown';
    lastSeen: string;
    avatarUrl?: string;
    isOnline: boolean;
}

interface FamilyCheckInModuleProps {
    members: MemberStatus[];
}

export const FamilyCheckInModule = ({ members }: FamilyCheckInModuleProps) => {
  return (
    <View style={styles.container}>
      {/* Module Header */}
      <View style={styles.header}>
        <View style={styles.headerIconDetails}>
          <View style={styles.iconPlate}>
            <Ionicons name="people" size={18} color={colors.accent.primary} />
          </View>
          <Text style={styles.title}>Aile Durumu</Text>
        </View>
        <Text style={styles.subtitle}>Son güncelleme: Şimdi</Text>
      </View>

      {/* Horizontal Scroll for Badges */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {members.map((member) => (
          <View key={member.id} style={styles.memberBadge}>
            {/* Avatar Circle with Ring */}
            <View style={[
              styles.avatarRing,
              { borderColor: getStatusColor(member.status) },
            ]}>
              {member.avatarUrl ? (
                <Image source={{ uri: member.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{member.name.charAt(0)}</Text>
                </View>
              )}

              {/* Online Indicator Dot */}
              {member.isOnline && (
                <View style={styles.onlineDot} />
              )}
            </View>

            <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>

            {/* Status Badge */}
            <View style={[
              styles.statusPill,
              { backgroundColor: getStatusColor(member.status) + '20' },
            ]}>
              <Text style={[
                styles.statusText,
                { color: getStatusColor(member.status) },
              ]}>
                {getStatusText(member.status)}
              </Text>
            </View>
          </View>
        ))}

        {/* Add Member Button (Ghost) */}
        <View style={styles.addMemberBadge}>
          <View style={styles.addMemberCircle}>
            <Ionicons name="add" size={24} color={colors.text.secondary} />
          </View>
          <Text style={styles.addMemberText}>Ekle</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
  case 'safe': return colors.status.safe;
  case 'warning': return colors.status.warning;
  case 'danger': return colors.status.danger;
  default: return colors.status.offline;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
  case 'safe': return 'Güvende';
  case 'warning': return 'Riskli';
  case 'danger': return 'Tehlike';
  default: return 'Bilinmiyor';
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: 20, // Larger token for container
    borderWidth: 1,
    borderColor: colors.border.light,
    ...(shadow as any).soft,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIconDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconPlate: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: (colors.accent as any).soft || '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  scrollView: {
    marginHorizontal: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  memberBadge: {
    alignItems: 'center',
    width: 80,
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    padding: 3, // Gap
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: colors.background.secondary,
  },
  avatarFallback: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.status.online,
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addMemberBadge: {
    alignItems: 'center',
    width: 80,
    justifyContent: 'center',
  },
  addMemberCircle: {
    width: 56, // Slightly smaller than ring content
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 12, // Align text roughly
    marginTop: 4,
  },
  addMemberText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
});
