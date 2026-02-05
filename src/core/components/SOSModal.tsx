/**
 * SOS MODAL - ELITE V2
 * Full-screen emergency modal with channel status and ACK tracking
 * 
 * FEATURES:
 * - Countdown visualization
 * - Multi-channel status display
 * - ACK notifications
 * - Location accuracy indicator
 * - Unified SOS Controller integration
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';
import * as haptics from '../utils/haptics';
import {
  useSOSStore,
  unifiedSOSController,
  EmergencyReason,
  ChannelStatus,
} from '../services/sos';
import { emergencyHealthSharingService } from '../services/EmergencyHealthSharingService';

// ============================================================================
// PROPS
// ============================================================================

interface SOSModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  reason?: EmergencyReason;
  message?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SOSModal({
  visible,
  onClose,
  onConfirm,
  reason = EmergencyReason.MANUAL_SOS,
  message = 'Acil yardım gerekiyor!',
}: SOSModalProps) {
  // Store
  const {
    currentSignal,
    isCountingDown,
    countdownSeconds,
    isActive,
  } = useSOSStore();

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Trigger SOS when modal opens
  useEffect(() => {
    if (visible && !isActive && !isCountingDown) {
      unifiedSOSController.triggerSOS(reason, message);
    }
  }, [visible, isActive, isCountingDown, reason, message]);

  // Start health data broadcast when SOS becomes active
  useEffect(() => {
    if (isActive) {
      // Start broadcasting health data via BLE mesh
      emergencyHealthSharingService.startBroadcast().catch((err) => {
        console.debug('Health broadcast start error:', err);
      });
    }
  }, [isActive]);

  // Pulse animation
  useEffect(() => {
    if (!visible) return undefined;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => pulse.stop();
  }, [visible, pulseAnim]);

  // Shake animation when active
  useEffect(() => {
    if (!isActive) return undefined;

    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ]),
    );

    shake.start();

    return () => shake.stop();
  }, [isActive, shakeAnim]);

  // Countdown haptic feedback
  useEffect(() => {
    if (isCountingDown && countdownSeconds > 0) {
      if (countdownSeconds === 3) {
        haptics.impactMedium();
      } else if (countdownSeconds === 2) {
        haptics.impactHeavy();
      } else if (countdownSeconds === 1) {
        haptics.notificationWarning();
        Vibration.vibrate([0, 200, 100, 200]);
      }
    }
  }, [isCountingDown, countdownSeconds]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCancel = useCallback(() => {
    haptics.impactLight();
    unifiedSOSController.cancelSOS();
    emergencyHealthSharingService.stopBroadcast(); // Stop health broadcast
    onClose();
  }, [onClose]);

  const handleStop = useCallback(() => {
    haptics.impactMedium();
    unifiedSOSController.cancelSOS();
    emergencyHealthSharingService.stopBroadcast(); // Stop health broadcast
    onClose();
  }, [onClose]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getChannelIcon = (status: ChannelStatus): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'sent':
      case 'acked':
        return 'checkmark-circle';
      case 'sending':
      case 'pending':
        return 'ellipse';
      case 'failed':
        return 'close-circle';
      default:
        return 'ellipse-outline';
    }
  };

  const getChannelColor = (status: ChannelStatus): string => {
    switch (status) {
      case 'sent':
      case 'acked':
        return '#4CAF50';
      case 'sending':
        return '#FFC107';
      case 'pending':
        return '#9E9E9E';
      case 'failed':
        return '#F44336';
      default:
        return '#616161';
    }
  };

  const getLocationAccuracyText = (): string => {
    if (!currentSignal?.location) return 'Bekleniyor...';
    const accuracy = currentSignal.location.accuracy;
    if (accuracy < 20) return `Yüksek (${accuracy.toFixed(0)}m)`;
    if (accuracy < 50) return `Orta (${accuracy.toFixed(0)}m)`;
    return `Düşük (${accuracy.toFixed(0)}m)`;
  };

  const getNetworkStatusText = (): string => {
    if (!currentSignal) return 'Bilinmiyor';
    switch (currentSignal.device.networkStatus) {
      case 'online':
        return 'Bağlı';
      case 'mesh':
        return `Mesh (${currentSignal.device.meshPeers} peer)`;
      case 'offline':
        return 'Çevrimdışı';
      default:
        return 'Bilinmiyor';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(220, 38, 38, 0.5)', 'rgba(153, 27, 27, 0.9)']}
          style={styles.gradient}
        >
          {/* Close Button (only during countdown) */}
          {isCountingDown && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCancel}
              accessibilityLabel="İptal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          )}

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transform: [
                    { scale: pulseAnim },
                    {
                      translateX: shakeAnim.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: [-5, 0, 5],
                      })
                    }
                  ]
                }
              ]}
            >
              <Ionicons
                name={isActive ? 'radio' : 'alert-circle'}
                size={120}
                color="#fff"
                style={styles.mainIcon}
              />
            </Animated.View>

            {/* Countdown State */}
            {isCountingDown && (
              <View style={styles.stateContainer}>
                <Text style={styles.countdownText}>{countdownSeconds}</Text>
                <Text style={styles.title}>Yardım Çağrısı Başlıyor</Text>
                <Text style={styles.subtitle}>İptal etmek için X'e dokunun</Text>
              </View>
            )}

            {/* Active State */}
            {isActive && currentSignal && (
              <View style={styles.stateContainer}>
                <Text style={styles.activeTitle}>🆘 SOS AKTİF</Text>
                <Text style={styles.subtitle}>
                  Yayın yapılıyor • Beacon #{currentSignal.beaconCount}
                </Text>

                {/* Channel Status */}
                <BlurView intensity={30} tint="light" style={styles.channelContainer}>
                  <Text style={styles.sectionTitle}>Yayın Kanalları</Text>

                  <View style={styles.channelRow}>
                    <ChannelItem
                      icon="bluetooth"
                      label="Mesh (BLE)"
                      status={currentSignal.channels.mesh}
                    />
                    <ChannelItem
                      icon="cloud"
                      label="Firebase"
                      status={currentSignal.channels.firebase}
                    />
                  </View>

                  <View style={styles.channelRow}>
                    <ChannelItem
                      icon="server"
                      label="Backend"
                      status={currentSignal.channels.backend}
                    />
                    <ChannelItem
                      icon="notifications"
                      label="Push"
                      status={currentSignal.channels.push}
                    />
                  </View>
                </BlurView>

                {/* Device Status */}
                <BlurView intensity={30} tint="light" style={styles.statusContainer}>
                  <StatusItem
                    icon="location"
                    label="Konum"
                    value={getLocationAccuracyText()}
                  />
                  <StatusItem
                    icon="battery-half"
                    label="Pil"
                    value={`${currentSignal.device.batteryLevel}%`}
                  />
                  <StatusItem
                    icon={currentSignal.device.networkStatus === 'offline' ? 'cloud-offline' : 'wifi'}
                    label="Ağ"
                    value={getNetworkStatusText()}
                  />
                </BlurView>

                {/* ACKs */}
                {currentSignal.acks.length > 0 && (
                  <BlurView intensity={30} tint="light" style={styles.ackContainer}>
                    <Text style={styles.sectionTitle}>
                      ✅ Yanıt Alındı ({currentSignal.acks.length})
                    </Text>
                    {currentSignal.acks.slice(0, 3).map((ack, index) => (
                      <View key={ack.id} style={styles.ackItem}>
                        <Ionicons
                          name={ack.type === 'onsite' ? 'location' : 'person'}
                          size={16}
                          color="#4CAF50"
                        />
                        <Text style={styles.ackText}>
                          {ack.receiverName || `Kurtarıcı ${index + 1}`}
                          {ack.type === 'onsite' && ' - Yolda!'}
                        </Text>
                      </View>
                    ))}
                  </BlurView>
                )}

                {/* Stop Button */}
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={handleStop}
                  accessibilityLabel="SOS'u Durdur"
                  accessibilityRole="button"
                >
                  <Text style={styles.stopButtonText}>SOS'U DURDUR</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ChannelItem({
  icon,
  label,
  status
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  status: ChannelStatus;
}) {
  const statusIcon = useMemo(() => {
    switch (status) {
      case 'sent':
      case 'acked':
        return 'checkmark-circle';
      case 'sending':
        return 'sync';
      case 'failed':
        return 'close-circle';
      default:
        return 'ellipse-outline';
    }
  }, [status]);

  const statusColor = useMemo(() => {
    switch (status) {
      case 'sent':
      case 'acked':
        return '#4CAF50';
      case 'sending':
        return '#FFC107';
      case 'failed':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  }, [status]);

  return (
    <View style={styles.channelItem}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.channelLabel}>{label}</Text>
      <Ionicons name={statusIcon} size={16} color={statusColor} />
    </View>
  );
}

function StatusItem({
  icon,
  label,
  value
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statusItem}>
      <Ionicons name={icon} size={20} color="#fff" style={styles.statusIcon} />
      <View>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusValue}>{value}</Text>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  iconContainer: {
    marginBottom: 24,
  },
  mainIcon: {
    textShadowColor: 'rgba(255, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  stateContainer: {
    alignItems: 'center',
    width: '100%',
  },
  countdownText: {
    fontSize: 96,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  activeTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    opacity: 0.9,
  },
  channelContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  channelLabel: {
    fontSize: 13,
    color: '#fff',
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 16,
    overflow: 'hidden',
    width: '100%',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  ackContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  ackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  ackText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  stopButton: {
    marginTop: 32,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
});
