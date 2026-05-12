/**
 * NOTIFICATION DISABLED BANNER
 *
 * Sprint Audit FIX A10: Permission Live Check.
 *
 * Kullanici bildirim iznini KAPALI tutuyorsa, uygulama gunluk kullanim sirasinda
 * gorunur bir banner ile uyarir. Bu life-safety kritik cunku:
 *   - EEW uyarisi kapali bildirimle ulasamaz
 *   - SOS gelmeyecek (FCM token yine yazilir ama iOS APNs sessizce reddeder)
 *
 * Pattern:
 *   - App start + AppState 'active' transition'da permission check
 *   - Denied veya kanal restrict ise → ust kismda turuncu banner
 *   - "Bildirimleri Aç" butonu Settings'i acar
 *   - Granted olur olmaz banner kaybolur
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  AppState,
  type AppStateStatus,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { getPermissionStatus } from '../services/notifications/NotificationPermissionHandler';
import { useAuthStore } from '../stores/authStore';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotificationDisabledBanner');

export function NotificationDisabledBanner() {
  const insets = useSafeAreaInsets();
  const [shouldShow, setShouldShow] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const checkPermission = useCallback(async () => {
    if (!isAuthenticated) {
      setShouldShow(false);
      return;
    }
    try {
      const status = await getPermissionStatus();
      // Show banner if explicitly denied (not undetermined — that's onboarding's job)
      const isDenied = status.status === 'denied';
      setShouldShow(isDenied);
      if (isDenied) {
        logger.warn('Notification permission DENIED — banner shown to user');
      }
    } catch (e) {
      logger.debug('checkPermission failed:', e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void checkPermission();
  }, [checkPermission, isAuthenticated]);

  useEffect(() => {
    // Re-check on foreground transition (user may have changed setting)
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setTimeout(() => { void checkPermission(); }, 800);
      }
    });
    return () => sub.remove();
  }, [checkPermission]);

  const openSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (e) {
      logger.error('openSettings failed:', e);
    }
  }, []);

  if (!shouldShow) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      exiting={FadeOutUp.duration(180)}
      style={[styles.container, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
    >
      <View style={styles.row}>
        <Ionicons name="notifications-off" size={20} color="#FFFFFF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>BİLDİRİMLER KAPALI</Text>
          <Text style={styles.subtitle}>
            EEW + SOS uyarıları ulaşmaz. Hayat-güvenliği için bildirimleri açın.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
          onPress={openSettings}
          accessibilityRole="button"
          accessibilityLabel="Bildirim ayarlarını aç"
        >
          <Text style={styles.btnText}>Aç</Text>
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
    backgroundColor: '#EA580C',
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 9996,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    marginTop: 2,
  },
  btn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnText: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default NotificationDisabledBanner;
