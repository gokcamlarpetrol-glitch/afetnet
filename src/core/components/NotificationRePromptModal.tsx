/**
 * NOTIFICATION RE-PROMPT MODAL
 *
 * Bildirim izni reddedildikten >=24h sonra, app foreground'a geldiginde
 * egitici bir modal goster: "Deprem uyarisi icin bildirim gerekli". Kullanici
 * kabul ederse system permission dialog'u (ya da iOS'ta Settings) acilir.
 *
 * Kotu patternlerden kacinmak icin:
 *   - Auto-open degil - user'a explicit "Etkinlestir" buton
 *   - "Simdi degil" -> 24h sessizlik (saldirgan degil)
 *   - 3'uncu denial sonrasi kullaniciyi taciz etme (PermissionRePromptService gates this)
 *
 * Mount: App.tsx globally. Auth + foreground'a duyarli.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { permissionRePromptService } from '../services/PermissionRePromptService';
import { useAuthStore } from '../stores/authStore';
import * as haptics from '../utils/haptics';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotificationRePromptModal');

export function NotificationRePromptModal() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const checkAndShow = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const should = await permissionRePromptService.shouldRePrompt();
      if (should && !visible) {
        logger.info('Showing notification re-prompt modal');
        setVisible(true);
      }
    } catch (e) {
      logger.debug('checkAndShow error:', e);
    }
  }, [isAuthenticated, visible]);

  useEffect(() => {
    // Check once after auth resolved + delay (avoid flooding cold start)
    if (!isAuthenticated) return;
    const t = setTimeout(() => { void checkAndShow(); }, 6000);
    return () => clearTimeout(t);
  }, [isAuthenticated, checkAndShow]);

  useEffect(() => {
    // Re-check on foreground transitions
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setTimeout(() => { void checkAndShow(); }, 1500);
      }
    });
    return () => sub.remove();
  }, [checkAndShow]);

  const handleEnable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      haptics.impactLight();
      const result = await permissionRePromptService.triggerPrompt();
      logger.info('Re-prompt result:', result);
      setVisible(false);
    } catch (e) {
      logger.error('triggerPrompt failed:', e);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleDismiss = useCallback(() => {
    haptics.selectionChanged();
    setVisible(false);
    // Kullanici "Daha Sonra" dedi - re-prompt service state'i degisiklik kaydetmez,
    // 24h sessizlik dolduginda tekrar gosterilir (shouldRePrompt kontrolu ile).
  }, []);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={['#DC2626', '#B91C1C']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="notifications" size={36} color="#FFFFFF" />
            <Text style={styles.title}>Bildirimleri Aç</Text>
            <Text style={styles.subtitle}>Hayat kurtaran saniyeler için</Text>
          </LinearGradient>

          <View style={styles.body}>
            <BenefitRow
              icon="warning"
              title="Deprem Erken Uyarısı"
              description="Sarsıntı başlamadan saniyeler önce uyarı al. Bildirim kapalıyken uyarı alamayız."
            />
            <BenefitRow
              icon="people"
              title="Aile SOS"
              description="Aile üyelerinden gelen acil sinyalleri kaçırma."
            />
            <BenefitRow
              icon="medkit"
              title="Kurtarma Bilgileri"
              description="Yakın AFAD/112 talimatları ve toplanma alanı güncellemeleri."
            />

            <View style={styles.noteBox}>
              <Ionicons name="lock-closed" size={14} color="#6B7C8E" />
              <Text style={styles.noteText}>
                AfetNet sadece hayat-güvenliği için bildirim gönderir. Reklam veya pazarlama yapmaz.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel="Daha sonra"
            >
              <Text style={styles.btnSecondaryText}>Daha Sonra</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                (pressed || busy) && styles.btnPressed,
              ]}
              onPress={handleEnable}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Bildirimleri Etkinleştir"
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>{busy ? 'Açılıyor…' : 'Etkinleştir'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BenefitRow({ icon, title, description }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon} size={18} color="#DC2626" />
      </View>
      <View style={styles.benefitText}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: 0.4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  body: {
    padding: 20,
    gap: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7C8E',
    lineHeight: 17,
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#F5F7FA',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7C8E',
    lineHeight: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,58,95,0.08)',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  btnPrimary: {
    backgroundColor: '#DC2626',
  },
  btnSecondary: {
    backgroundColor: '#F1F4F7',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  btnSecondaryText: {
    color: '#6B7C8E',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NotificationRePromptModal;
