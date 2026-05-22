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

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  ScrollView,
  Linking,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from './SafeBlurView';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// theme colors managed via inline styles
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
  reason?: EmergencyReason;
  message?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SOSModal({
  visible,
  onClose,
  reason = EmergencyReason.MANUAL_SOS,
  message = 'Acil yardım gerekiyor!',
}: SOSModalProps) {
  // Safe area insets for Dynamic Island / notch
  const insets = useSafeAreaInsets();

  // Store
  const {
    currentSignal,
    isCountingDown,
    countdownSeconds,
    countdownTotalSeconds,
    isActive,
  } = useSOSStore();

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // CRITICAL: Ref guard to prevent duplicate SOS triggers
  const hasFiredRef = useRef(false);

  // P0-9: Channel/device details start collapsed so the human action
  // (STOP, 112, ÇÖK-KAPAN-TUTUN) is what the user sees first.
  const [showChannelDetails, setShowChannelDetails] = useState(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Trigger SOS exactly once when modal opens (visible transitions false→true)
  useEffect(() => {
    if (visible && !hasFiredRef.current) {
      hasFiredRef.current = true;
      // FIX: Wrap in async IIFE to properly await cancelSOS() for stale SOS cleanup
      (async () => {
        const state = useSOSStore.getState();
        // Reset any stale state from a previous crashed session
        if (state.isCountingDown && !state.isActive) {
          state.reset();
        }
        // CRITICAL FIX: Stale active SOS from killed app sessions.
        // If SOS has been "active" for 30+ minutes, it's orphaned.
        // Must use cancelSOS() instead of state.reset() to:
        // 1. Update Firestore documents to 'cancelled' (family/nearby users stop seeing active SOS)
        // 2. Stop beacon service
        // 3. Clear isSOS location flag
        // 4. Broadcast cancellation via mesh
        if (state.isActive && state.currentSignal) {
          const ageMs = Date.now() - state.currentSignal.timestamp;
          if (ageMs > 30 * 60 * 1000) {
            // FIX: await cancelSOS() — it's async (broadcasts cancellation, stops beacon).
            // Without await, the freshState read below may see stale isActive=true.
            await unifiedSOSController.cancelSOS();
          }
        }
        // Re-read state after potential cancel (cancelSOS sets isActive=false synchronously in store)
        const freshState = useSOSStore.getState();
        if (!freshState.isActive) {
          // F1: await triggerSOS so broadcast failures surface to UI instead of
          // being silently swallowed. Channel status (failed/sent) is rendered in
          // the active-SOS screen below, but trigger-time exceptions (auth missing,
          // location permission revoked, controller not initialized) would
          // otherwise stay hidden in the catch handler.
          try {
            await unifiedSOSController.triggerSOS(reason, message);
          } catch (triggerErr) {
            if (__DEV__) console.error('SOSModal triggerSOS failed:', triggerErr);
            // Surface a clear, Turkish, user-facing error. Crisis UX: tell the user
            // to fall back to 112 — never let a silent failure leave them thinking
            // help was dispatched.
            try {
              const { Alert } = require('react-native');
              Alert.alert(
                'SOS Gönderilemedi',
                'Yardım çağrısı başlatılamadı. Lütfen hemen 112\'yi arayın ve uygulamayı kapatıp yeniden açın.',
                [{ text: 'Tamam' }],
              );
            } catch { /* fallback already logged */ }
          }
        }
      })().catch(e => { if (__DEV__) console.warn('SOSModal trigger error:', e); });
    } else if (!visible) {
      // Reset guard when modal closes so next open can trigger again.
      // Delay reset to prevent double-trigger: modal fade animation takes ~200ms.
      // Without delay, rapid SOS button tap during fade re-opens modal with
      // hasFiredRef already false → triggers SOS twice.
      const resetTimer = setTimeout(() => { hasFiredRef.current = false; }, 300);
      return () => clearTimeout(resetTimer);
    }
  }, [visible, reason, message]);

  // Start health data broadcast when SOS becomes active
  useEffect(() => {
    if (isActive) {
      // Start broadcasting health data via BLE mesh
      emergencyHealthSharingService.startBroadcast().catch((err) => {
        if (__DEV__) console.debug('Health broadcast start error:', err);
      });
    }
    // FIX: Stop broadcast on unmount/deactivation to prevent orphaned BLE broadcast
    // when modal is closed without explicit Cancel/Stop press
    return () => {
      if (isActive) {
        emergencyHealthSharingService.stopBroadcast().catch(() => {});
      }
    };
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

  // FIX: SOSModal should NOT modify countdown state — UnifiedSOSController's setInterval
  // handles all countdown logic including background catch-up via absolute timestamps.
  // Instead, just force a UI re-render on foreground resume so the display updates.
  const [, setForceRender] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setForceRender(n => n + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  // Countdown haptic feedback
  // KRİTİK (görev #26): Haptik ipuçlarını geri sayım toplamına göre ölçekle.
  // Önceki kod 3/2/1 saniyelerine sabitti; 30 sn'lik otomatik tetik geri
  // sayımında ilk 27 saniye sessiz kalıyordu — kullanıcı SOS'un yaklaştığını
  // hissetmiyordu. Son 3 saniye her zaman tırmanan ipucu verir; daha uzun
  // geri sayımlarda her 5. saniyede de hafif bir uyarı çalar.
  useEffect(() => {
    if (isCountingDown && countdownSeconds > 0) {
      if (countdownSeconds === 3) {
        haptics.impactMedium();
      } else if (countdownSeconds === 2) {
        haptics.impactHeavy();
      } else if (countdownSeconds === 1) {
        haptics.notificationWarning();
        Vibration.vibrate([0, 200, 100, 200]);
      } else {
        // Uzun geri sayım (ör. 30 sn otomatik tetik): son 3 sn dışında
        // her 5. saniyede hafif bir nabız ver — DEFAULT 5 sn'lik manuel
        // geri sayımda bu dal tetiklenmez (4. saniye 5'e bölünmez).
        const total = typeof countdownTotalSeconds === 'number' && countdownTotalSeconds > 0
          ? countdownTotalSeconds
          : 5;
        if (total > 5 && countdownSeconds % 5 === 0) {
          haptics.impactLight();
        }
      }
    }
  }, [isCountingDown, countdownSeconds, countdownTotalSeconds]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCancel = useCallback(() => {
    haptics.impactLight();
    unifiedSOSController.cancelSOS();
    emergencyHealthSharingService.stopBroadcast().catch(e => { if (__DEV__) console.debug('Health stop error:', e); });
    onClose();
  }, [onClose]);

  const handleStop = useCallback(() => {
    haptics.impactMedium();
    unifiedSOSController.cancelSOS();
    emergencyHealthSharingService.stopBroadcast().catch(e => { if (__DEV__) console.debug('Health stop error:', e); });
    onClose();
  }, [onClose]);

  const handleCall112 = useCallback(() => {
    haptics.impactHeavy();
    Linking.openURL('tel:112');
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const _getChannelIcon = (status: ChannelStatus): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'sent':
      case 'acked':
        return 'checkmark-circle';
      case 'sending':
      case 'pending':
        return 'ellipse';
      case 'queued':
        // F3: distinct icon — packet waiting in transport queue, not failed
        return 'hourglass';
      case 'failed':
        return 'close-circle';
      default:
        return 'ellipse-outline';
    }
  };

  const _getChannelColor = (status: ChannelStatus): string => {
    switch (status) {
      case 'sent':
      case 'acked':
        return '#4CAF50';
      case 'sending':
        return '#FFC107';
      case 'pending':
        return '#9E9E9E';
      case 'queued':
        // F3: amber — visually distinct from "failed" (red)
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return '#616161';
    }
  };

  const getLocationAccuracyText = (): string => {
    if (!currentSignal?.location) return 'Bekleniyor...';
    const accuracy = currentSignal.location.accuracy;
    if (!accuracy || accuracy <= 0) return 'Alınıyor...';
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

  // PREMIUM FAZ 2: SURVIVAL MODE LOGIC
  // If networkStatus === 'offline' (No Wi-Fi, No Cellular) -> Trigger Survival Mode
  // If it's pure mesh, we can also consider it partially survival, but let's strictly use 'offline' definition for max battery saving
  const isSurvivalMode = currentSignal?.device.networkStatus === 'offline';
  const bgColors = isSurvivalMode
    ? ['#000000', '#0a0a0a'] as const // OLED true black for battery saving
    : ['rgba(220, 38, 38, 0.5)', 'rgba(153, 27, 27, 0.9)'] as const; // Red emergency gradient

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        {/* BlurView stays mounted across mode switches; survival mode overlays an
            opaque OLED-black layer on top instead of unmounting the blur. This
            avoids native-view churn on the (rare) survival-mode transition. */}
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        {isSurvivalMode && (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}
            pointerEvents="none"
          />
        )}
        <LinearGradient
          colors={bgColors}
          style={styles.gradient}
        >
          {/* Close Button (only during countdown) */}
          {isCountingDown && (
            <TouchableOpacity
              style={[styles.closeButton, { top: Math.max(insets.top + 8, 50) }]}
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

                {/* Silent Mode Toggle (Elite) */}
                <TouchableOpacity
                  style={[styles.silentToggle, currentSignal?.isSilent && styles.silentToggleActive]}
                  onPress={() => useSOSStore.getState().setSilentMode(!currentSignal?.isSilent)}
                  accessibilityRole="switch"
                  accessibilityLabel="Sessiz mod"
                  accessibilityState={{ checked: !!currentSignal?.isSilent }}
                  accessibilityHint="Sessiz modda alarm sesi çıkmaz, yalnızca yardım sinyali gönderilir."
                >
                  <Ionicons name={currentSignal?.isSilent ? 'volume-mute' : 'volume-high'} size={20} color={currentSignal?.isSilent ? '#000' : '#fff'} />
                  <Text style={[styles.silentToggleText, currentSignal?.isSilent && styles.silentToggleTextActive]}>
                    {currentSignal?.isSilent ? 'SESSİZ MOD AKTİF' : 'SESSİZ MODA GEÇ'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Active State — P0-9: Human-first layout.
                Survival instruction + Stop + 112 buttons are at the TOP.
                Channel statuses move into a collapsible section below so the
                user is never staring at "Push: pending" when they need to
                actually do something. */}
            {isActive && currentSignal && (
              <View style={styles.stateContainer}>
                {isSurvivalMode && (
                  <View style={styles.survivalBadge}>
                    <Ionicons name="battery-dead" size={16} color="#fbbf24" />
                    <Text style={styles.survivalBadgeText}>SURVIVAL MODU AKTİF</Text>
                  </View>
                )}

                {/* WP-3.2: SOS dürüstlük banner'ı — bu SOS'un 112'nin yerini
                    tutmadığını net söyler. Hiçbir kanaldan ulaşılamıyorsa kritik
                    kırmızı uyarıya döner; kullanıcı "yardım gönderildi" yanılgısına
                    düşüp 112'yi aramayı atlamamalı. */}
                {(() => {
                  const reached = Object.values(currentSignal.channels).some(
                    (s) => s === 'sent' || s === 'acked',
                  );
                  const meshPeers = currentSignal.device.meshPeers ?? 0;
                  const noOneReached = !reached && meshPeers === 0;
                  return (
                    <View style={[styles.honestyBanner, noOneReached && styles.honestyBannerCritical]}>
                      <Ionicons
                        name={noOneReached ? 'warning' : 'information-circle'}
                        size={18}
                        color={noOneReached ? '#fff' : '#fde68a'}
                      />
                      <Text style={[styles.honestyBannerText, noOneReached && styles.honestyBannerTextCritical]}>
                        {noOneReached
                          ? 'Hiçbir kanaldan ulaşılamıyor. HEMEN 112’yi arayın.'
                          : 'Bu SOS uygulamadaki kişilere ve yakındaki cihazlara iletilir; 112’nin yerini tutmaz — resmi yardım için 112’yi de arayın.'}
                      </Text>
                    </View>
                  );
                })()}

                {/* P0-9: Top life-safety instruction (Çök-Kapan-Tutun) */}
                <Text style={[styles.activeTitle, isSurvivalMode && { color: '#fbbf24', fontSize: 28 }]}>
                  ÇÖK • KAPAN • TUTUN
                </Text>
                <Text style={[styles.subtitle, { marginTop: 4 }, isSurvivalMode && { color: '#ef4444', fontWeight: '800' }]}>
                  {isSurvivalMode ? 'Offline SOS yayını' : 'SOS aktif — yayında'}
                </Text>

                {/* P0-9: STOP first, then 112 — both in first viewport. */}
                <TouchableOpacity
                  style={[styles.stopButton, { marginTop: 24 }, isSurvivalMode && styles.stopButtonSurvival]}
                  onPress={handleStop}
                  accessibilityLabel="SOS'u Durdur"
                  accessibilityRole="button"
                >
                  <Text style={[styles.stopButtonText, isSurvivalMode && { color: '#000' }]}>SOS&apos;U DURDUR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.call112Button, { marginTop: 12 }]}
                  onPress={handleCall112}
                  accessibilityLabel="112 Acil Ara"
                  accessibilityRole="button"
                >
                  <Ionicons name="call" size={22} color="#fff" />
                  <Text style={styles.call112ButtonText}>112 ACİL ARA</Text>
                </TouchableOpacity>

                {/* ACKs — surface immediately when a rescuer responds */}
                {currentSignal.acks.length > 0 && (
                  <BlurView intensity={isSurvivalMode ? 10 : 30} tint="light" style={[styles.ackContainer, isSurvivalMode && { borderColor: '#ef4444', borderWidth: 1 }]}>
                    <Text style={[styles.sectionTitle, isSurvivalMode && { color: '#fbbf24' }]}>
                      Yanıt Alındı ({currentSignal.acks.length})
                    </Text>
                    {currentSignal.acks.slice(0, 3).map((ack, index) => (
                      <View key={ack.id} style={styles.ackItem}>
                        <Ionicons
                          name={ack.type === 'onsite' ? 'location' : 'person'}
                          size={16}
                          color={isSurvivalMode ? '#fbbf24' : '#4CAF50'}
                        />
                        <Text style={[styles.ackText, isSurvivalMode && { color: '#fff' }]}>
                          {ack.receiverName || `Kurtarıcı ${index + 1}`}
                          {ack.type === 'onsite' && ' - Yolda!'}
                        </Text>
                      </View>
                    ))}
                  </BlurView>
                )}

                {/* P0-9: Collapsible technical detail. Default collapsed.
                    The full channel/device status shows on tap so the user
                    isn't drowning in "Mesh: sending… Push: pending…" lines
                    when they need to take action. */}
                <TouchableOpacity
                  style={[styles.detailsToggle, { marginTop: 20 }]}
                  onPress={() => setShowChannelDetails(v => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showChannelDetails ? 'Yayın detaylarını gizle' : 'Yayın detaylarını göster'}
                >
                  <Ionicons name={showChannelDetails ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
                  <Text style={styles.detailsToggleText}>
                    Yayın detayları • Beacon #{currentSignal.beaconCount}
                  </Text>
                </TouchableOpacity>

                {showChannelDetails && (
                  <>
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
                        // KRİTİK (görev #26): getBatteryLevel "bilinmiyor" için -1
                        // döndürebilir; "Pil -1%" göstermek yerine "Bilinmiyor" yaz.
                        value={
                          currentSignal.device.batteryLevel < 0
                            ? 'Bilinmiyor'
                            : `${currentSignal.device.batteryLevel}%`
                        }
                      />
                      <StatusItem
                        icon={currentSignal.device.networkStatus === 'offline' ? 'cloud-offline' : 'wifi'}
                        label="Ağ"
                        value={getNetworkStatusText()}
                      />
                    </BlurView>
                  </>
                )}
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
      case 'queued':
        return 'hourglass';
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
      case 'queued':
        return '#FF9800';
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
    // top is set dynamically via useSafeAreaInsets
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
  silentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  silentToggleActive: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  silentToggleText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 14,
  },
  silentToggleTextActive: {
    color: '#000',
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
    color: 'rgba(255, 255, 255, 0.9)',
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
  call112Button: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  call112ButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  stopButtonSurvival: {
    backgroundColor: '#ef4444',
  },
  // P0-9
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  detailsToggleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
  survivalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  honestyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    width: '100%',
  },
  honestyBannerCritical: {
    backgroundColor: '#dc2626',
    borderColor: '#fff',
  },
  honestyBannerText: {
    flex: 1,
    color: '#fde68a',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  honestyBannerTextCritical: {
    color: '#fff',
  },
  survivalBadgeText: {
    color: '#fbbf24',
    fontWeight: '900',
    letterSpacing: 1,
    marginLeft: 6,
    fontSize: 12,
  },
});
