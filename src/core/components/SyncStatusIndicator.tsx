/**
 * ELITE: SYNC STATUS INDICATOR
 * Shows offline sync status to users
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { offlineSyncService, SyncStatus } from '../services/OfflineSyncService';
import NetInfo from '@react-native-community/netinfo';

export default function SyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    queueLength: 0,
    isOnline: true,
    isSyncing: false,
    failedOperations: 0,
    lastSyncTime: null,
  });
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Update sync status every 5 seconds
    const updateStatus = () => {
      const status = offlineSyncService.getSyncStatus();
      setSyncStatus(status);

      // Show indicator if there are pending operations or if offline
      const shouldBeVisible = status.queueLength > 0 || !status.isOnline;
      setIsVisible(shouldBeVisible);

      // Animate visibility
      Animated.timing(fadeAnim, {
        toValue: shouldBeVisible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };

    // Initial update
    updateStatus();

    // Periodic updates
    const interval = setInterval(updateStatus, 5000);

    // Monitor network state
    const unsubscribe = NetInfo.addEventListener(state => {
      setSyncStatus(prev => ({
        ...prev,
        isOnline: state.isConnected ?? false,
      }));
      // Update visibility when network changes
      updateStatus();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

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
    if (syncStatus.queueLength > 0) return colors.status.info;
    return colors.status.success;
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return 'cloud-offline';
    if (syncStatus.failedOperations > 0) return 'alert-circle';
    if (syncStatus.queueLength > 0) return 'sync';
    return 'checkmark-circle';
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Çevrimdışı';
    if (syncStatus.failedOperations > 0) return `${syncStatus.failedOperations} başarısız`;
    if (syncStatus.queueLength > 0) return `${syncStatus.queueLength} bekliyor`;
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
        {syncStatus.queueLength > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{syncStatus.queueLength}</Text>
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
              <Text style={styles.detailValue}>{syncStatus.queueLength}</Text>
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

          {syncStatus.isOnline && syncStatus.queueLength > 0 && (
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
    left: spacing[12],
    right: spacing[12],
    zIndex: 1000,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.lg,
    gap: spacing[8],
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
    paddingHorizontal: spacing[4],
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
    marginTop: spacing[4],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[12],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  details: {
    gap: spacing[4],
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
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    borderRadius: borderRadius.md,
    marginTop: spacing[12],
    gap: spacing[4],
  },
  syncButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 12,
  },
});

