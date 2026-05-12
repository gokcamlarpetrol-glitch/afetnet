/**
 * BIOMETRIC LOCK OVERLAY
 *
 * SessionSecurityService `session_locked` veya `reauth_required` event'i fırlatınca
 * tüm ekranı kaplayan biyometrik kilit ekranı gösterir. Kullanıcı Face ID/Touch ID
 * ile başarıyla doğruladığında session unlock olur.
 *
 * Plan: Sprint 2 — BiometricAuthService LoginScreen entegrasyonu.
 * LoginScreen yerine app-level lock pattern: tek seferlik login + biyometrik gate.
 *
 * Aktivasyon:
 *   - Settings → "Face ID ile Uygulamayı Kilitle" toggle açık olmalı (settingsStore.biometricAppLock)
 *   - Toggle açıkken arka planda 5dk+ kalan oturum kilitlenir
 *   - Auto-trigger değil — opsiyonel güvenlik katmanı
 *
 * Fallback:
 *   - 3 başarısız deneme → "Email/Şifre ile Giriş Yap" butonu
 *   - Cihazda biyometrik yoksa toggle otomatik kapalı kalır
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  sessionSecurityService,
  type SessionEvent,
  type SessionState,
} from '../services/security/SessionSecurityService';
import { biometricAuthService } from '../services/security/BiometricAuthService';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import * as haptics from '../utils/haptics';
import { createLogger } from '../utils/logger';

const logger = createLogger('BiometricLockOverlay');

const MAX_ATTEMPTS = 3;

export function BiometricLockOverlay() {
  const insets = useSafeAreaInsets();
  const [locked, setLocked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [authenticating, setAuthenticating] = useState(false);
  const biometricAppLock = useSettingsStore((s) => (s as { biometricAppLock?: boolean }).biometricAppLock === true);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Only listen if biometric lock is enabled by user AND they're logged in
    if (!biometricAppLock || !isAuthenticated) {
      setLocked(false);
      return;
    }

    const unsub = sessionSecurityService.addEventListener((event: SessionEvent, state: SessionState) => {
      if (event === 'session_locked' || event === 'reauth_required') {
        logger.info('Biometric lock triggered', { event });
        setLocked(true);
        setAttempts(0);
      } else if (event === 'session_unlocked') {
        setLocked(false);
        setAttempts(0);
      }
    });

    return unsub;
  }, [biometricAppLock, isAuthenticated]);

  const handleAuthenticate = useCallback(async () => {
    if (authenticating) return;
    setAuthenticating(true);
    try {
      const result = await biometricAuthService.authenticate('AfetNet kilidini aç', {
        allowPasscode: true, // Apple/Android passcode fallback OK
        cancelLabel: 'İptal',
      });
      if (result.success) {
        haptics.notificationSuccess();
        sessionSecurityService.unlockSession();
        setLocked(false);
        setAttempts(0);
        logger.info('Biometric unlock succeeded');
      } else {
        haptics.notificationError();
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        logger.warn(`Biometric unlock failed (${newAttempts}/${MAX_ATTEMPTS})`);
        if (newAttempts >= MAX_ATTEMPTS) {
          handleFallbackLogin();
        }
      }
    } catch (error) {
      logger.error('Biometric authenticate threw:', error);
    } finally {
      setAuthenticating(false);
    }
  }, [authenticating, attempts]);

  const handleFallbackLogin = useCallback(() => {
    Alert.alert(
      'Şifre ile Giriş Yap',
      'Biyometrik doğrulama başarısız. Email ve şifre ile yeniden giriş yapmak ister misiniz?',
      [
        { text: 'Tekrar Dene', style: 'cancel', onPress: () => setAttempts(0) },
        {
          text: 'Şifre ile Giriş',
          style: 'destructive',
          onPress: async () => {
            try {
              const { AuthService } = await import('../services/AuthService');
              await AuthService.signOut();
            } catch (e) {
              logger.error('Fallback signOut failed:', e);
            }
          },
        },
      ],
    );
  }, []);

  // Auto-prompt biometric on lock
  useEffect(() => {
    if (locked && attempts === 0) {
      const timer = setTimeout(() => {
        void handleAuthenticate();
      }, 350); // Small delay for modal animation
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [locked, attempts, handleAuthenticate]);

  if (!locked) return null;

  return (
    <Modal visible={locked} transparent={false} animationType="fade" statusBarTranslucent>
      <LinearGradient
        colors={['#0A1929', '#1E3A5F', '#0A1929']}
        style={styles.container}
      >
        <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={Platform.OS === 'ios' ? 'finger-print' : 'finger-print'}
              size={64}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.title}>AfetNet Kilitli</Text>
          <Text style={styles.subtitle}>
            Devam etmek için biyometrik doğrulama yapın
          </Text>

          {attempts > 0 && (
            <Text style={styles.attemptsText}>
              Deneme: {attempts}/{MAX_ATTEMPTS}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.unlockBtn,
              (pressed || authenticating) && styles.unlockBtnPressed,
            ]}
            onPress={handleAuthenticate}
            disabled={authenticating}
            accessibilityRole="button"
            accessibilityLabel="Biyometrik kilidi aç"
          >
            <Ionicons name="lock-open" size={20} color="#0A1929" />
            <Text style={styles.unlockBtnText}>
              {authenticating ? 'Doğrulanıyor…' : 'Kilidi Aç'}
            </Text>
          </Pressable>

          {attempts >= 1 && (
            <Pressable style={styles.fallbackBtn} onPress={handleFallbackLogin}>
              <Text style={styles.fallbackText}>Şifre ile Giriş Yap</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  attemptsText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 28,
    marginTop: 8,
  },
  unlockBtnPressed: {
    opacity: 0.7,
  },
  unlockBtnText: {
    color: '#0A1929',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  fallbackBtn: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default BiometricLockOverlay;
