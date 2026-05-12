/**
 * CLOCK SKEW BANNER
 *
 * Cihaz saati sunucudan ±5dk fazla saparsa kullanıcıya görünür uyarı.
 * Aksi takdirde Firestore yazımları sessizce başarısız olur — mesaj gönderilmez,
 * SOS sinyali kabul edilmez. Bu life-safety açısından sessiz hatadan beterdir.
 *
 * Banner:
 *   - Üst kısımda turuncu, dismiss edilemez
 *   - "Cihaz saatini düzelt" yönergesi
 *   - "Yeniden Kontrol Et" butonu (kullanıcı saati düzelttikten sonra)
 *   - Otomatik gizlenir (skew recovered event'i ile)
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
import { clockSkewService, type ClockSkewState } from '../services/ClockSkewService';
import { createLogger } from '../utils/logger';

const logger = createLogger('ClockSkewBanner');

export function ClockSkewBanner() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ClockSkewState | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Pick up current state if banner mounts mid-skew
    const initial = clockSkewService.getState();
    if (initial?.isCritical) setState(initial);

    const subCritical = DeviceEventEmitter.addListener(
      'CLOCK_SKEW_CRITICAL',
      (payload: ClockSkewState) => {
        logger.warn('Clock skew critical banner shown');
        setState(payload);
      },
    );
    const subRecover = DeviceEventEmitter.addListener('CLOCK_SKEW_RECOVERED', () => {
      logger.info('Clock skew recovered — hiding banner');
      setState(null);
    });

    return () => {
      subCritical.remove();
      subRecover.remove();
    };
  }, []);

  const handleRecheck = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await clockSkewService.check();
      if (result && !result.isCritical) {
        setState(null);
      }
    } finally {
      setChecking(false);
    }
  }, [checking]);

  const handleOpenSettings = useCallback(() => {
    // Best-effort: deep-link to platform date/time settings.
    // Apple does not allow direct deep links to Settings.app/Date — open generic Settings.
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => {
        Linking.openSettings().catch(() => { /* no-op */ });
      });
    } else {
      // Android: deep link to date settings
      Linking.sendIntent('android.settings.DATE_SETTINGS').catch(() => {
        Linking.openSettings().catch(() => { /* no-op */ });
      });
    }
  }, []);

  if (!state || !state.isCritical) return null;

  const skewMin = Math.round(state.skewMs / 60000);
  const skewDirection = state.skewMs > 0 ? 'geride' : 'ileride';
  const skewAbsMin = Math.abs(skewMin);

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      exiting={FadeOutUp.duration(180)}
      style={[styles.container, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
    >
      <View style={styles.row}>
        <Ionicons name="time-outline" size={20} color="#FFFFFF" />
        <Text style={styles.title}>CİHAZ SAATİ HATALI</Text>
      </View>
      <Text style={styles.subtitle}>
        Saatiniz sunucudan ~{skewAbsMin}dk {skewDirection}. Bu yüzden mesaj/SOS gönderimi başarısız olabilir.
      </Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnSettings, pressed && styles.btnPressed]}
          onPress={handleOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Saat ayarlarını aç"
        >
          <Ionicons name="settings" size={14} color="#9A3412" />
          <Text style={[styles.btnText, styles.btnTextOnLight]}>Ayarları Aç</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnRecheck,
            (pressed || checking) && styles.btnPressed,
          ]}
          onPress={handleRecheck}
          disabled={checking}
          accessibilityRole="button"
          accessibilityLabel="Saati yeniden kontrol et"
        >
          <Ionicons name="refresh" size={14} color="#FFFFFF" />
          <Text style={styles.btnText}>{checking ? 'Kontrol…' : 'Yeniden Kontrol'}</Text>
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
    backgroundColor: '#C2410C',
    paddingHorizontal: 14,
    paddingBottom: 10,
    zIndex: 9997,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    justifyContent: 'center',
  },
  btnSettings: {
    backgroundColor: '#FFFFFF',
  },
  btnRecheck: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnTextOnLight: {
    color: '#9A3412',
  },
});

export default ClockSkewBanner;
