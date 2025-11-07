/**
 * ELITE: SYNC STATUS INDICATOR
 * Shows offline sync status to users
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { offlineSyncService } from '../services/OfflineSyncService';
import NetInfo from '@react-native-community/netinfo';

interface SyncStatus {
  queueLength: number;
  isOnline: boolean;
  isRunning: boolean;
  pendingOperations: number;
  failedOperations: number;
}

export default function SyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    queueLength: 0,
    isOnline: true,
    isRunning: false,
    pendingOperations: 0,
    failedOperations: 0,
  });
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Update sync status every 5 seconds
    const interval = setInterval(() => {
      const status = offlineSyncService.getSyncStatus();
      setSyncStatus(status);
      
      // Show indicator if there are pending operations or if offline
      setIsVisible(status.queueLength > 0 || !status.isOnline);
    }, 5000);

    // Initial update
    const status = offlineSyncService.getSyncStatus();
    setSyncStatus(status);
    setIsVisible(status.queueLength > 0 || !status.isOnline);

    // Monitor network state
    const unsubscribe = NetInfo.addEventListener(state => {
      setSyncStatus(prev => ({
        ...prev,
        isOnline: state.isConnected ?? false,
      }));
    });

    // Animate visibility
    Animated.timing(fadeAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [isVisible, fadeAnim]);

  const handlePress = () => {
    setIsExpanded(!isExpanded);
  };

  const handleForceSync = async () => {
    if (syncStatus.isOnline) {
      await offlineSyncService.forceSync();
      // Update status after sync
      setTimeout(() => {
        const status = offlineSyncService.getSyncStatus();
        setSyncStatus(status);
      }, 1000);
    }
  };

  if (!isVisible) {
    return null;
  }

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return colors.status.warning;
    if (syncStatus.failedOperations > 0) return colors.status.danger;
    if (syncStatus.pendingOperations > 0) return colors.status.info;
    return colors.status.success;
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return 'cloud-offline';
    if (syncStatus.failedOperations > 0) return 'alert-circle';
    if (syncStatus.pendingOperations > 0) return 'sync';
    return 'checkmark-circle';
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Çevrimdışı';
    if (syncStatus.failedOperations > 0) return `${syncStatus.failedOperations} başarısız`;
    if (syncStatus.pendingOperations > 0) return `${syncStatus.pendingOperations} bekliyor`;
    return 'Senkronize';
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.indicator, { backgroundColor: getStatusColor() }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Ionicons name={getStatusIcon() as any} size={20} color={colors.text.primary} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {syncStatus.pendingOperations > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{syncStatus.pendingOperations}</Text>
          </View>
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Durum:</Text>
              <Text style={styles.detailValue}>
                {syncStatus.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bekleyen:</Text>
              <Text style={styles.detailValue}>{syncStatus.pendingOperations}</Text>
            </View>
            {syncStatus.failedOperations > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Başarısız:</Text>
                <Text style={[styles.detailValue, { color: colors.status.danger }]}>
                  {syncStatus.failedOperations}
                </Text>
              </View>
            )}
          </View>

          {syncStatus.isOnline && syncStatus.pendingOperations > 0 && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleForceSync}
            >
              <Ionicons name="refresh" size={18} color={colors.text.primary} />
              <Text style={styles.syncButtonText}>Şimdi Senkronize Et</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusText: {
    ...typography.small,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    ...typography.small,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 10,
  },
  expandedContent: {
    marginTop: spacing.xs,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  details: {
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.small,
    color: colors.text.secondary,
  },
  detailValue: {
    ...typography.small,
    color: colors.text.primary,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  syncButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 12,
  },
});

