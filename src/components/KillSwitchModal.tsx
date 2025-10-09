import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { palette, spacing } from '../ui/theme';
import Button from '../ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { remoteConfigManager } from '../config/remote';

interface KillSwitchModalProps {
  visible: boolean;
  onClose?: () => void;
}

export default function KillSwitchModal({ visible, onClose }: KillSwitchModalProps) {
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadKillSwitchMessage();
    }
  }, [visible]);

  const loadKillSwitchMessage = async () => {
    setIsLoading(true);
    try {
      const config = await remoteConfigManager.getRemoteCfg();
      const killMessage = remoteConfigManager.getKillSwitchMessage();
      setMessage(killMessage);
    } catch (error) {
      console.error('Error loading kill switch message:', error);
      setMessage('Uygulama geçici olarak kullanıma kapatılmıştır.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineMode = () => {
    // Navigate to offline mode (SOS + ICE + Map only)
    console.log('Entering offline mode...');
    // This would typically navigate to a limited offline mode
  };

  const handleRetry = async () => {
    setIsLoading(true);
    try {
      await remoteConfigManager.refreshConfig();
      const isStillKilled = remoteConfigManager.isKillSwitchActive();
      
      if (!isStillKilled) {
        // Kill switch is no longer active, close modal
        onClose?.();
      } else {
        // Still killed, update message
        await loadKillSwitchMessage();
      }
    } catch (error) {
      console.error('Error retrying kill switch check:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="warning" size={48} color={palette.error.main} />
            <Text style={styles.title}>Geçici Olarak Kullanım Durduruldu</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.message}>
              {isLoading ? 'Durum kontrol ediliyor...' : message}
            </Text>

            <View style={styles.info}>
              <Text style={styles.infoTitle}>Sınırlı Mod Kullanılabilir:</Text>
              <Text style={styles.infoItem}>• SOS sinyali gönderme</Text>
              <Text style={styles.infoItem}>• Acil iletişim (ICE)</Text>
              <Text style={styles.infoItem}>• Harita görüntüleme</Text>
              <Text style={styles.infoItem}>• Temel ayarlar</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              label="Sınırlı Mod"
              onPress={handleOfflineMode}
              variant="primary"
              style={styles.actionButton}
            />
            <Button
              label="Tekrar Dene"
              onPress={handleRetry}
              variant="ghost"
              style={styles.actionButton}
              disabled={isLoading}
            />
          </View>

          <Text style={styles.footer}>
            Bu durum geçicidir. Lütfen daha sonra tekrar deneyin.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: palette.background.primary,
    borderRadius: 16,
    padding: spacing.xl,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  content: {
    marginBottom: spacing.xl,
  },
  message: {
    fontSize: 16,
    color: palette.text.primary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  info: {
    backgroundColor: palette.background.secondary,
    padding: spacing.md,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text.primary,
    marginBottom: spacing.sm,
  },
  infoItem: {
    fontSize: 14,
    color: palette.text.primary,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  footer: {
    fontSize: 12,
    color: palette.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
