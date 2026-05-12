/**
 * SOS FAILURE BANNER — Global persistent alert
 *
 * SOSChannelRouter `SOS_ALL_CHANNELS_FAILED` event'i fırlatınca, kullanıcının
 * SOS'sının HİÇBİR kanaldan gönderilmediğini açıkça bildirir. Bu life-safety
 * kritik durumdur: kullanıcı kurtarıldığını sanır, ekipler haberdar değildir.
 *
 * UX:
 *   - Üst kısımda kırmızı, dismiss edilemez banner
 *   - "Tekrar Dene" butonu (sosChannelRouter.broadcastSOS yeniden tetikler)
 *   - "112 Ara" butonu (telefon uygulamasına yönlendirir)
 *   - Sadece SOS aktive iken görünür; deactivate edilince otomatik kaybolur
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  DeviceEventEmitter,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSOSStore } from '../services/sos/SOSStateManager';
import { createLogger } from '../utils/logger';
import * as haptics from '../utils/haptics';

const logger = createLogger('SOSFailureBanner');

interface FailureEvent {
  failedChannels: string[];
  timestamp: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  mesh: 'BLE Mesh',
  firebase: 'Bulut',
  backend: 'Backend',
  push: 'Push',
  family: 'Aile',
  nearbyUsers: 'Yakın Kullanıcılar',
};

export function SOSFailureBanner() {
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<FailureEvent | null>(null);
  const [retrying, setRetrying] = useState(false);
  const sosActive = useSOSStore((s) => s.isActive);
  const currentSignal = useSOSStore((s) => s.currentSignal);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'SOS_ALL_CHANNELS_FAILED',
      (payload: FailureEvent) => {
        logger.error('🆘 SOS_ALL_CHANNELS_FAILED received', payload);
        haptics.notificationError();
        setEvent(payload);
      },
    );
    return () => sub.remove();
  }, []);

  // Auto-hide when SOS is deactivated
  useEffect(() => {
    if (!sosActive && event) {
      setEvent(null);
    }
  }, [sosActive, event]);

  const handleRetry = useCallback(async () => {
    if (!currentSignal || retrying) return;
    setRetrying(true);
    try {
      const { sosChannelRouter } = await import('../services/sos/SOSChannelRouter');
      await sosChannelRouter.broadcastSOS(currentSignal);
      // If retry succeeded (some channel worked), no further failure event fires
      logger.info('SOS retry triggered');
    } catch (e) {
      logger.error('SOS retry failed:', e);
    } finally {
      setRetrying(false);
    }
  }, [currentSignal, retrying]);

  const handleCall112 = useCallback(async () => {
    haptics.impactHeavy();
    try {
      const url = Platform.OS === 'android' ? 'tel:112' : 'telprompt:112';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL('tel:112');
      }
    } catch (e) {
      logger.error('Call 112 failed:', e);
    }
  }, []);

  if (!event) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.row}>
        <Ionicons name="warning" size={22} color="#FFFFFF" />
        <Text style={styles.title}>SOS GÖNDERİLEMEDİ</Text>
      </View>
      <Text style={styles.subtitle}>
        Tüm {event.failedChannels.length} kanal başarısız oldu. Ekipler durumdan haberdar değil.
      </Text>
      <Text style={styles.channelList}>
        Başarısız: {event.failedChannels.map((c) => CHANNEL_LABELS[c] || c).join(', ')}
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnRetry,
            (pressed || retrying) && styles.btnPressed,
          ]}
          onPress={handleRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel="SOS tekrar dene"
        >
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.btnText}>{retrying ? 'Deniyor…' : 'Tekrar Dene'}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnCall, pressed && styles.btnPressed]}
          onPress={handleCall112}
          accessibilityRole="button"
          accessibilityLabel="112 acil yardımı ara"
        >
          <Ionicons name="call" size={16} color="#B91C1C" />
          <Text style={[styles.btnText, styles.btnTextOnLight]}>112 Ara</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#B91C1C',
    paddingHorizontal: 16,
    paddingBottom: 14,
    zIndex: 9998, // Below EEW (9999), above everything else
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  channelList: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  btnRetry: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  btnCall: {
    backgroundColor: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnTextOnLight: {
    color: '#B91C1C',
  },
});

export default SOSFailureBanner;
