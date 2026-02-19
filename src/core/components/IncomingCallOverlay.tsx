/**
 * INCOMING CALL OVERLAY
 * Shows a full-screen incoming call alert when a voice call arrives.
 * Uses DeviceEventEmitter to listen for incoming call events.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  DeviceEventEmitter,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as haptics from '../utils/haptics';
import {
  voiceCallService,
  VOICE_CALL_EVENTS,
  IncomingCallData,
} from '../services/VoiceCallService';

export default function IncomingCallOverlay() {
  const [visible, setVisible] = useState(false);
  const [callData, setCallData] = useState<IncomingCallData | null>(null);

  // Pulse animation
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    }
  }, [visible, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Listen for incoming calls
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      VOICE_CALL_EVENTS.INCOMING_CALL,
      (data: IncomingCallData) => {
        setCallData(data);
        setVisible(true);

        // Haptic burst for incoming call
        haptics.impactHeavy();
        setTimeout(() => haptics.impactHeavy(), 300);
        setTimeout(() => haptics.impactHeavy(), 600);
        setTimeout(() => haptics.impactHeavy(), 900);
      },
    );

    return () => sub.remove();
  }, []);

  // Auto-dismiss after 45 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      handleReject();
    }, 45_000);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleAnswer = useCallback(() => {
    if (!callData) return;
    setVisible(false);
    haptics.impactMedium();

    // Navigate to VoiceCallScreen
    import('../navigation/navigationRef').then(({ navigateTo }) => {
      navigateTo('VoiceCall', {
        recipientUid: callData.callerUid,
        recipientName: callData.callerName,
        callId: callData.callId,
        isIncoming: true,
      });
    }).catch(() => {});
  }, [callData]);

  const handleReject = useCallback(() => {
    if (callData) {
      voiceCallService.rejectCall(callData.callId).catch(() => {});
    }
    setVisible(false);
    setCallData(null);
  }, [callData]);

  if (!visible || !callData) return null;

  const initials = callData.callerName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleReject}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#0f172a', '#1e3a5f', '#1e40af']}
          style={StyleSheet.absoluteFill}
        />

        {/* Close / Reject */}
        <Pressable style={styles.closeButton} onPress={handleReject}>
          <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <View style={styles.content}>
          <Text style={styles.label}>Gelen Arama</Text>

          <Animated.View style={[styles.avatarContainer, pulseStyle]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </Animated.View>

          <Text style={styles.callerName}>{callData.callerName}</Text>
          <Text style={styles.subtitle}>AfetNet Sesli Arama</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.rejectBtn, pressed && { opacity: 0.8 }]}
            onPress={handleReject}
          >
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.actionLabel}>Reddet</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.answerBtn, pressed && { opacity: 0.8 }]}
            onPress={handleAnswer}
          >
            <Ionicons name="call" size={32} color="#fff" />
            <Text style={styles.actionLabel}>Yanıtla</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 30,
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
  },
  callerName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    paddingBottom: Platform.OS === 'ios' ? 80 : 60,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  rejectBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
});
