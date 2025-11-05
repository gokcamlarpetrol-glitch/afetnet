/**
 * RESCUE TEAM SCREEN
 * Shows trapped users detected via BLE mesh beacon
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRescueStore, TrappedUser } from '../../stores/rescueStore';
import { colors, typography } from '../../theme';
import * as haptics from '../../utils/haptics';
import { rescueBeaconService } from '../../services/RescueBeaconService';

export default function RescueTeamScreen({ navigation }: any) {
  const { isRescueTeamMode, trappedUsers, toggleRescueTeamMode, clearTrappedUsers } =
    useRescueStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Cleanup expired users every 30 seconds
    const interval = setInterval(() => {
      rescueBeaconService.cleanupExpiredUsers();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleMode = () => {
    haptics.impactMedium();
    toggleRescueTeamMode();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    rescueBeaconService.cleanupExpiredUsers();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleClearAll = () => {
    haptics.impactMedium();
    clearTrappedUsers();
  };

  const handleNavigateToUser = (user: TrappedUser) => {
    haptics.impactLight();
    if (user.location) {
      navigation.navigate('Map', {
        targetLocation: user.location,
        targetUser: user,
      });
    }
  };

  const getSignalStrength = (rssi?: number): { color: string; text: string; bars: number } => {
    if (!rssi) return { color: '#6b7280', text: 'Bilinmiyor', bars: 0 };

    if (rssi >= -60) return { color: '#10b981', text: 'Çok Güçlü', bars: 4 };
    if (rssi >= -70) return { color: '#3b82f6', text: 'Güçlü', bars: 3 };
    if (rssi >= -80) return { color: '#f59e0b', text: 'Orta', bars: 2 };
    return { color: '#ef4444', text: 'Zayıf', bars: 1 };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'trapped':
        return '#dc2626';
      case 'injured':
        return '#f59e0b';
      case 'safe':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'trapped':
        return 'Enkaz Altında';
      case 'injured':
        return 'Yaralı';
      case 'safe':
        return 'Güvende';
      default:
        return 'Bilinmiyor';
    }
  };

  const sortedUsers = [...trappedUsers].sort((a, b) => {
    // Sort by distance (closest first)
    if (a.distance && b.distance) return a.distance - b.distance;
    if (a.distance) return -1;
    if (b.distance) return 1;
    // Then by signal strength
    if (a.rssi && b.rssi) return b.rssi - a.rssi;
    return 0;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Kurtarma Ekibi Modu</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Mode Toggle */}
      <View style={styles.toggleContainer}>
        <Pressable
          style={[styles.toggleButton, isRescueTeamMode && styles.toggleButtonActive]}
          onPress={handleToggleMode}
        >
          <LinearGradient
            colors={
              isRescueTeamMode
                ? ['#dc2626', '#991b1b']
                : [colors.background.card, colors.background.card]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.toggleGradient}
          >
            <Ionicons
              name={isRescueTeamMode ? 'radio' : 'radio-outline'}
              size={24}
              color={isRescueTeamMode ? '#ffffff' : colors.text.secondary}
            />
            <Text
              style={[
                styles.toggleText,
                isRescueTeamMode && styles.toggleTextActive,
              ]}
            >
              {isRescueTeamMode ? 'Aktif - Tarama Yapılıyor' : 'Pasif - Tıkla Aktif Et'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Info Card */}
      {isRescueTeamMode && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <Text style={styles.infoText}>
            BLE mesh üzerinden SOS sinyali yayınlayan kullanıcılar otomatik olarak
            tespit edilecek.
          </Text>
        </View>
      )}

      {/* Stats */}
      {isRescueTeamMode && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{trappedUsers.length}</Text>
            <Text style={styles.statLabel}>Tespit Edilen</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {trappedUsers.filter((u) => u.status === 'trapped').length}
            </Text>
            <Text style={styles.statLabel}>Enkaz Altında</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {trappedUsers.filter((u) => u.distance && u.distance < 100).length}
            </Text>
            <Text style={styles.statLabel}>Yakında</Text>
          </View>
        </View>
      )}

      {/* Trapped Users List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {!isRescueTeamMode ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.text.secondary} />
            <Text style={styles.emptyTitle}>Kurtarma Ekibi Modu Pasif</Text>
            <Text style={styles.emptyText}>
              Enkaz altındaki kullanıcıları tespit etmek için yukarıdaki butona basarak
              modu aktif edin.
            </Text>
          </View>
        ) : trappedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color={colors.text.secondary} />
            <Text style={styles.emptyTitle}>Kullanıcı Bulunamadı</Text>
            <Text style={styles.emptyText}>
              Yakında SOS sinyali yayınlayan kullanıcı tespit edilmedi. Tarama devam
              ediyor...
            </Text>
          </View>
        ) : (
          <>
            {sortedUsers.map((user) => {
              const signal = getSignalStrength(user.rssi);
              const statusColor = getStatusColor(user.status);

              return (
                <Pressable
                  key={user.id}
                  style={styles.userCard}
                  onPress={() => handleNavigateToUser(user)}
                >
                  {/* Status Indicator */}
                  <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />

                  <View style={styles.userContent}>
                    {/* Header */}
                    <View style={styles.userHeader}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={[styles.userStatus, { color: statusColor }]}>
                          {getStatusText(user.status)}
                        </Text>
                      </View>
                      {user.battery !== undefined && (
                        <View style={styles.batteryContainer}>
                          <Ionicons
                            name={
                              user.battery > 50
                                ? 'battery-full'
                                : user.battery > 20
                                ? 'battery-half'
                                : 'battery-dead'
                            }
                            size={20}
                            color={
                              user.battery > 20 ? colors.text.secondary : '#ef4444'
                            }
                          />
                          <Text style={styles.batteryText}>{user.battery}%</Text>
                        </View>
                      )}
                    </View>

                    {/* Message */}
                    {user.message && (
                      <Text style={styles.userMessage}>{user.message}</Text>
                    )}

                    {/* Metrics */}
                    <View style={styles.metricsContainer}>
                      {/* Distance */}
                      {user.distance !== undefined && (
                        <View style={styles.metric}>
                          <Ionicons name="location" size={16} color={colors.text.secondary} />
                          <Text style={styles.metricText}>
                            {user.distance < 1000
                              ? `${Math.round(user.distance)}m`
                              : `${(user.distance / 1000).toFixed(1)}km`}
                          </Text>
                        </View>
                      )}

                      {/* Signal Strength */}
                      <View style={styles.metric}>
                        <View style={styles.signalBars}>
                          {[1, 2, 3, 4].map((bar) => (
                            <View
                              key={bar}
                              style={[
                                styles.signalBar,
                                {
                                  height: bar * 3,
                                  backgroundColor:
                                    bar <= signal.bars ? signal.color : '#e5e7eb',
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={[styles.metricText, { color: signal.color }]}>
                          {signal.text}
                        </Text>
                      </View>

                      {/* Last Seen */}
                      <View style={styles.metric}>
                        <Ionicons name="time" size={16} color={colors.text.secondary} />
                        <Text style={styles.metricText}>
                          {Math.round((Date.now() - user.lastSeen) / 1000)}s önce
                        </Text>
                      </View>
                    </View>

                    {/* Navigate Button */}
                    {user.location && (
                      <Pressable
                        style={styles.navigateButton}
                        onPress={() => handleNavigateToUser(user)}
                      >
                        <Ionicons name="navigate" size={16} color="#ffffff" />
                        <Text style={styles.navigateText}>Konuma Git</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              );
            })}

            {/* Clear All Button */}
            {trappedUsers.length > 0 && (
              <Pressable style={styles.clearButton} onPress={handleClearAll}>
                <Text style={styles.clearButtonText}>Tümünü Temizle</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  toggleContainer: {
    padding: 16,
  },
  toggleButton: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toggleButtonActive: {
    borderColor: '#dc2626',
  },
  toggleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statusIndicator: {
    width: 4,
  },
  userContent: {
    flex: 1,
    padding: 16,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  userMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 12,
  },
  signalBar: {
    width: 3,
    borderRadius: 1,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  navigateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  clearButton: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});


