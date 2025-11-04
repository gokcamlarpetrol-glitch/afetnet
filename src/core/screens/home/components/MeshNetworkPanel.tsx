/**
 * MESH NETWORK PANEL - Enhanced Information Display
 * Shows real mesh network stats with progress bars and detailed info
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMesh } from '../../../hooks/useMesh';
import { colors, typography, shadows, spacing } from '../../../theme';
import * as haptics from '../../../utils/haptics';

export default function MeshNetworkPanel() {
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const { peers, isConnected, messages } = useMesh();
  const peerCount = Object.keys(peers).length;

  // Real data from mesh store
  const messageCount = messages ? messages.length : 0;
  
  // Calculate real signal strength from peer RSSI values
  const signalStrength = useMemo(() => {
    if (peerCount === 0) return 0;
    
    const peerArray = Object.values(peers);
    const rssiValues = peerArray
      .map((peer: any) => peer.rssi)
      .filter((rssi: number) => rssi != null && rssi !== 0);
    
    if (rssiValues.length === 0) return 50; // Default if no RSSI data
    
    // Average RSSI to signal strength (RSSI ranges from -100 to 0)
    const avgRssi = rssiValues.reduce((a: number, b: number) => a + b, 0) / rssiValues.length;
    // Convert RSSI to percentage: -50 = 100%, -100 = 0%
    const strength = Math.max(0, Math.min(100, ((avgRssi + 100) / 50) * 100));
    return Math.round(strength);
  }, [peers, peerCount]);
  
  // Progress bar animation
  const signalProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(signalProgress, {
      toValue: signalStrength / 100,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [signalStrength]);

  // Network status text
  const getNetworkStatus = () => {
    if (!isConnected) return { text: 'KAPALI', color: colors.status.offline };
    if (signalStrength >= 80) return { text: 'GÜÇLÜ', color: colors.status.success };
    if (signalStrength >= 50) return { text: 'ORTA', color: colors.status.alert };
    return { text: 'ZAYIF', color: colors.status.danger };
  };

  const networkStatus = getNetworkStatus();

  const toggleExpanded = () => {
    haptics.impactLight();
    setExpanded(!expanded);
    
    Animated.spring(heightAnim, {
      toValue: expanded ? 0 : 1,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  };

  useEffect(() => {
    // İlk render'da animasyon değerini ayarla
    if (expanded) {
      heightAnim.setValue(1);
    } else {
      heightAnim.setValue(0);
    }
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.secondary, colors.background.elevated]}
        style={styles.gradient}
      >
        {/* Header - Tıklanabilir Accordion */}
        <TouchableOpacity 
          onPress={toggleExpanded} 
          activeOpacity={0.7}
          style={styles.headerButton}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="git-network" size={20} color={colors.mesh.primary} />
              <Text style={styles.title}>Mesh Ağı</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.statusBadge, { 
                backgroundColor: isConnected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                borderColor: isConnected ? colors.mesh.primary : colors.status.offline,
              }]}>
                <View style={[styles.statusDot, { 
                  backgroundColor: isConnected ? colors.mesh.primary : colors.status.offline,
                }]} />
                <Text style={[styles.statusText, { 
                  color: isConnected ? colors.mesh.primary : colors.status.offline,
                }]}>
                  {isConnected ? 'CANLI' : 'KAPALI'}
                </Text>
              </View>
              <Ionicons 
                name={expanded ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={colors.text.secondary}
                style={styles.chevron}
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Collapsible Content */}
        {expanded && (
          <Animated.View
            style={[
              styles.collapsibleContent,
              {
                opacity: heightAnim,
                maxHeight: heightAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1000],
                }),
                overflow: 'hidden',
              },
            ]}
          >
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Ionicons name="people" size={18} color={colors.mesh.primary} />
                </View>
                <Text style={styles.statValue}>{peerCount}</Text>
                <Text style={styles.statLabel}>Cihaz</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="chatbubbles" size={18} color={colors.status.online} />
                </View>
                <Text style={styles.statValue}>{messageCount}</Text>
                <Text style={styles.statLabel}>Mesaj</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Ionicons name="pulse" size={18} color={colors.status.alert} />
                </View>
                <Text style={styles.statValue}>{signalStrength}%</Text>
                <Text style={styles.statLabel}>Sinyal</Text>
              </View>
            </View>

            {/* Signal Strength Progress Bar */}
            {isConnected && (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Ağ Durumu</Text>
                  <Text style={[styles.progressStatus, { color: networkStatus.color }]}>
                    {networkStatus.text}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: signalProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: networkStatus.color,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Connected Devices List */}
            {isConnected && peerCount > 0 && (
              <View style={styles.devicesSection}>
                <Text style={styles.devicesTitle}>Bağlı Cihazlar</Text>
                <View style={styles.devicesList}>
                  {Object.values(peers).slice(0, 3).map((peer: any, index) => (
                    <View key={index} style={styles.deviceItem}>
                      <View style={styles.deviceDot} />
                      <Text style={styles.deviceName}>
                        Cihaz {index + 1}
                      </Text>
                    </View>
                  ))}
                  {peerCount > 3 && (
                    <Text style={styles.moreDevices}>+{peerCount - 3} daha</Text>
                  )}
                </View>
              </View>
            )}

            {/* Last Activity */}
            <View style={styles.footer}>
              <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.footerText}>
                {isConnected
                  ? peerCount > 0
                    ? 'Son Aktivite: Az önce'
                    : 'Bağlantı kuruldu, cihaz bekleniyor'
                  : 'Mesh ağı kapalı'}
              </Text>
            </View>
          </Animated.View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    ...shadows.md,
  },
  gradient: {
    padding: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    minHeight: 60, // Kapalıyken minimum yükseklik
  },
  headerButton: {
    // TouchableOpacity için
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chevron: {
    // Animasyon Animated.View ile yapılıyor
  },
  collapsibleContent: {
    // Animated.View için
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  progressStatus: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  devicesSection: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  devicesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  devicesList: {
    gap: 10,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mesh.primary,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  moreDevices: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
});
