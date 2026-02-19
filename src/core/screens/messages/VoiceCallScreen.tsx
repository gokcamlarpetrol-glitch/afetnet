/**
 * VOICE CALL SCREEN - ELITE EDITION
 * Full-screen call interface with mute, speaker, hangup controls.
 * Handles both outgoing and incoming calls.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  DeviceEventEmitter,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import * as haptics from '../../utils/haptics';
import { voiceCallService, VOICE_CALL_EVENTS, CallStatus } from '../../services/VoiceCallService';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';

type VoiceCallNavigationProp = StackNavigationProp<MainStackParamList, 'VoiceCall'>;
type VoiceCallRouteProp = RouteProp<MainStackParamList, 'VoiceCall'>;

interface Props {
  navigation: VoiceCallNavigationProp;
  route: VoiceCallRouteProp;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function VoiceCallScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { recipientUid, recipientName, callId: incomingCallId, isIncoming } = route.params;

  const [callStatus, setCallStatus] = useState<CallStatus>(isIncoming ? 'ringing' : 'idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [duration, setDuration] = useState(0);
  const [activeCallId, setActiveCallId] = useState<string | null>(incomingCallId || null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const hasInitiated = useRef(false);

  // Pulse animation for ringing state
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (callStatus === 'ringing' || callStatus === 'connecting') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
    }
  }, [callStatus, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Start outgoing call
  useEffect(() => {
    if (hasInitiated.current) return;
    hasInitiated.current = true;

    if (isIncoming && incomingCallId) {
      // Answer incoming call
      setCallStatus('connecting');
      voiceCallService.answerCall(incomingCallId).then((success) => {
        if (!success) {
          Alert.alert('Arama Hatası', 'Arama yanıtlanamadı.');
          navigation.goBack();
        }
      });
    } else {
      // Start outgoing call
      setCallStatus('ringing');
      voiceCallService.startCall(recipientUid, recipientName).then((newCallId) => {
        if (newCallId) {
          setActiveCallId(newCallId);
        } else {
          Alert.alert('Arama Hatası', 'Arama başlatılamadı. Lütfen tekrar deneyin.');
          navigation.goBack();
        }
      });
    }
  }, [isIncoming, incomingCallId, recipientUid, recipientName, navigation]);

  // Listen for call events
  useEffect(() => {
    const connSub = DeviceEventEmitter.addListener(VOICE_CALL_EVENTS.CALL_CONNECTED, () => {
      setCallStatus('connected');
      haptics.notificationSuccess();
    });

    const endSub = DeviceEventEmitter.addListener(VOICE_CALL_EVENTS.CALL_ENDED, () => {
      setCallStatus('ended');
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 1500);
    });

    const failSub = DeviceEventEmitter.addListener(VOICE_CALL_EVENTS.CALL_FAILED, ({ reason }: { reason: string }) => {
      setCallStatus('ended');
      Alert.alert('Arama Başarısız', reason || 'Bağlantı kurulamadı.');
      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 1000);
    });

    return () => {
      connSub.remove();
      endSub.remove();
      failSub.remove();
    };
  }, [navigation]);

  // Duration timer
  useEffect(() => {
    if (callStatus === 'connected') {
      durationInterval.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    };
  }, [callStatus]);

  const handleHangup = useCallback(() => {
    haptics.impactHeavy();
    voiceCallService.endCall();
  }, []);

  const handleToggleMute = useCallback(() => {
    haptics.impactLight();
    const newMuted = voiceCallService.toggleMute();
    setIsMuted(newMuted);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    haptics.impactLight();
    const newSpeaker = voiceCallService.toggleSpeaker();
    setIsSpeaker(newSpeaker);
  }, []);

  const getStatusText = (): string => {
    switch (callStatus) {
      case 'ringing': return isIncoming ? 'Yanıtlanıyor...' : 'Aranıyor...';
      case 'connecting': return 'Bağlanıyor...';
      case 'connected': return formatDuration(duration);
      case 'ended': return 'Arama Sonlandı';
      default: return 'Hazırlanıyor...';
    }
  };

  const initials = recipientName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={
          callStatus === 'connected'
            ? ['#065f46', '#059669', '#10b981']
            : callStatus === 'ended'
              ? ['#1e293b', '#334155', '#475569']
              : ['#1e3a5f', '#1e40af', '#3b82f6']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Top area */}
      <View style={[styles.topArea, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.statusLabel}>
          {callStatus === 'connected' ? 'Arama Devam Ediyor' : 'Sesli Arama'}
        </Text>
      </View>

      {/* Center - Avatar and Info */}
      <View style={styles.centerArea}>
        <Animated.View style={[styles.avatarContainer, pulseStyle]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {(callStatus === 'ringing' || callStatus === 'connecting') && (
            <View style={styles.avatarRing} />
          )}
        </Animated.View>

        <Text style={styles.contactName}>{recipientName}</Text>
        <Text style={styles.callStatusText}>{getStatusText()}</Text>

        {callStatus === 'connected' && (
          <Animated.View entering={FadeIn} style={styles.connectedBadge}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>Bağlı</Text>
          </Animated.View>
        )}
      </View>

      {/* Bottom - Controls */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 30 }]}>
        {callStatus !== 'ended' && (
          <View style={styles.controlsRow}>
            {/* Mute */}
            <Pressable
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={handleToggleMute}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={28}
                color={isMuted ? '#ef4444' : '#fff'}
              />
              <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>
                {isMuted ? 'Sessiz' : 'Mikrofon'}
              </Text>
            </Pressable>

            {/* Speaker */}
            <Pressable
              style={[styles.controlButton, isSpeaker && styles.controlButtonActive]}
              onPress={handleToggleSpeaker}
            >
              <Ionicons
                name={isSpeaker ? 'volume-high' : 'volume-medium'}
                size={28}
                color={isSpeaker ? '#3b82f6' : '#fff'}
              />
              <Text style={[styles.controlLabel, isSpeaker && styles.controlLabelActive]}>
                {isSpeaker ? 'Hoparlör' : 'Hoparlör'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Hangup Button */}
        <Pressable
          style={({ pressed }) => [
            styles.hangupButton,
            callStatus === 'ended' && styles.hangupButtonDisabled,
            pressed && { opacity: 0.8 },
          ]}
          onPress={callStatus === 'ended' ? () => navigation.goBack() : handleHangup}
        >
          <Ionicons
            name={callStatus === 'ended' ? 'close' : 'call'}
            size={32}
            color="#fff"
            style={callStatus !== 'ended' ? { transform: [{ rotate: '135deg' }] } : undefined}
          />
        </Pressable>

        {callStatus === 'ended' && (
          <Text style={styles.endedHint}>Geri dönmek için dokunun</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topArea: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
  },
  avatarRing: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 68,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  contactName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  callStatusText: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  connectedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22c55e',
  },
  bottomArea: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 40,
  },
  controlButton: {
    alignItems: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  controlLabelActive: {
    color: '#fff',
  },
  hangupButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  hangupButtonDisabled: {
    backgroundColor: '#64748b',
  },
  endedHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 16,
  },
});
