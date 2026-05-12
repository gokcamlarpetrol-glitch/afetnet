/**
 * KVKK CONSENT SECTION
 *
 * Sağlık verisi (KVKK Madde 6 — Özel Nitelikli Kişisel Veri) için
 * açık rıza UI'ı. İki bağımsız onay sunar:
 *   1. Bulut Yedekleme (Firebase Firestore)
 *   2. Kurtarma Ekibi Paylaşımı (AfetNet rescue backend)
 *
 * Default kapalı. Kullanıcı toggle açtığında, ne için kullanıldığını
 * açıklayan modal gösterilir ve açık rıza alınır. İptal her zaman
 * mümkündür; veri sunucudan silinir.
 *
 * Yasal gereklilik: KVKK Madde 6, GDPR Article 9 (special categories).
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useHealthProfileStore } from '../../stores/healthProfileStore';
import * as haptics from '../../utils/haptics';
import { logger } from '../../utils/logger';

type ConsentType = 'cloud' | 'backend';

interface ConsentModalProps {
  visible: boolean;
  type: ConsentType;
  onAccept: () => void;
  onDismiss: () => void;
}

function ConsentModal({ visible, type, onAccept, onDismiss }: ConsentModalProps) {
  const isCloud = type === 'cloud';
  const title = isCloud ? 'Bulut Yedekleme — Açık Rıza' : 'Kurtarma Ekibi Paylaşımı — Açık Rıza';
  const headerColor = isCloud ? '#10b981' : '#ef4444';
  const headerIcon: keyof typeof Ionicons.glyphMap = isCloud ? 'cloud-upload' : 'medkit';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <LinearGradient
            colors={[headerColor, `${headerColor}80`]}
            style={styles.modalHeader}
          >
            <Ionicons name={headerIcon} size={32} color="#ffffff" />
            <Text style={styles.modalTitle}>{title}</Text>
          </LinearGradient>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalSectionHeader}>KVKK Madde 6 — Özel Nitelikli Kişisel Veri</Text>
            <Text style={styles.modalText}>
              6698 sayılı Kişisel Verilerin Korunması Kanunu Madde 6 uyarınca sağlık verisi
              özel nitelikli kişisel veridir ve işlenmesi için açık rıza zorunludur.
            </Text>

            <Text style={styles.modalSectionHeader}>Bu Rıza Ne İçin?</Text>
            {isCloud ? (
              <>
                <Text style={styles.modalText}>
                  • Sağlık verileriniz (kan grubu, alerji, kronik hastalık, ilaçlar, acil iletişim
                  bilgileri) Firebase Firestore'a AES-256 ile şifrelenmiş olarak yedeklenir.
                </Text>
                <Text style={styles.modalText}>
                  • Cihazınız bozulur, kaybolur veya değiştirirseniz aynı hesapla giriş yaparak
                  verilerinizi geri yükleyebilirsiniz.
                </Text>
                <Text style={styles.modalText}>
                  • Yalnızca sizin Firebase Auth hesabınızdan erişilebilir.
                </Text>
                <Text style={styles.modalText}>
                  • Veriler Google'ın AB içi (europe-west1, Belçika) veri merkezlerinde işlenir.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.modalText}>
                  • Sağlık özetiniz (kan grubu, alerji, hastalık, ilaç, acil iletişim) AfetNet
                  kurtarma backend'ine iletilir.
                </Text>
                <Text style={styles.modalText}>
                  • Bu bilgi, siz SOS gönderdiğinizde 112/AFAD/yerel kurtarma ekiplerinin tedavi
                  protokolünü hızlandırması içindir (örn. alerjik şok riski).
                </Text>
                <Text style={styles.modalText}>
                  • Bilgiler yalnızca AKTIF SOS sırasında ve sadece sizin acil durum konumunuza
                  yakın kurtarma birimlerine açılır.
                </Text>
                <Text style={styles.modalText}>
                  • Veri 90 gün sonra otomatik silinir.
                </Text>
              </>
            )}

            <Text style={styles.modalSectionHeader}>Rızanızı Geri Çekme Hakkınız</Text>
            <Text style={styles.modalText}>
              Bu rızayı istediğiniz zaman aynı toggle'ı kapatarak geri çekebilirsiniz. Geri
              çekildiğinde sunucudaki kopyası silinir; cihazınızdaki şifrelenmiş kopya kalır.
            </Text>

            <Text style={styles.modalSectionHeader}>Veri Sorumlusu</Text>
            <Text style={styles.modalText}>
              AfetNet (gokcamlarpetrol@gmail.com). KVKK ve GDPR kapsamındaki haklarınız için
              uygulamadaki Ayarlar → Gizlilik bölümüne bakınız.
            </Text>
          </ScrollView>

          <View style={styles.modalButtons}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnCancel,
                pressed && styles.modalBtnPressed,
              ]}
            >
              <Text style={styles.modalBtnTextCancel}>Vazgeç</Text>
            </Pressable>
            <Pressable
              onPress={onAccept}
              style={({ pressed }) => [
                styles.modalBtn,
                { backgroundColor: headerColor },
                pressed && styles.modalBtnPressed,
              ]}
            >
              <Text style={styles.modalBtnText}>Açık Rıza Veriyorum</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function KVKKConsentSection() {
  const profile = useHealthProfileStore((s) => s.profile);
  const updateProfile = useHealthProfileStore((s) => s.updateProfile);
  const [modal, setModal] = useState<ConsentType | null>(null);

  const cloudConsent = profile.cloudSyncConsent === true;
  const backendConsent = profile.backendShareConsent === true;

  const handleToggle = useCallback(
    (type: ConsentType, nextValue: boolean) => {
      const currentValue = type === 'cloud' ? cloudConsent : backendConsent;
      if (nextValue && !currentValue) {
        // Open consent modal for explicit acceptance
        haptics.impactLight();
        setModal(type);
        return;
      }
      // Withdraw consent
      Alert.alert(
        'Rızayı Geri Çek',
        type === 'cloud'
          ? 'Bulut yedekleme rızasını geri çekmek istiyor musunuz? Sunucudaki kopyanız silinecektir; cihazınızdaki veriniz kalır.'
          : 'Kurtarma ekibi paylaşım rızasını geri çekmek istiyor musunuz? Acil durumda 112/AFAD tıbbi bilginize otomatik erişemeyecektir.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Geri Çek',
            style: 'destructive',
            onPress: () => {
              haptics.notificationWarning();
              updateProfile(
                type === 'cloud'
                  ? { cloudSyncConsent: false }
                  : { backendShareConsent: false },
              );
              if (type === 'cloud') {
                // Best-effort: delete server copy immediately
                void deleteCloudCopy();
              }
              logger.info(`KVKK consent withdrawn: ${type}`);
            },
          },
        ],
      );
    },
    [cloudConsent, backendConsent, updateProfile],
  );

  const handleAccept = useCallback(() => {
    if (!modal) return;
    haptics.notificationSuccess();
    updateProfile(
      modal === 'cloud'
        ? { cloudSyncConsent: true, consentTimestamp: Date.now() }
        : { backendShareConsent: true, consentTimestamp: Date.now() },
    );
    logger.info(`KVKK consent granted: ${modal}`);
    setModal(null);
  }, [modal, updateProfile]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="lock-closed" size={20} color="#1E3A5F" />
        <Text style={styles.title}>Veri Paylaşımı (KVKK Madde 6)</Text>
      </View>

      <Text style={styles.subtitle}>
        Sağlık veriniz varsayılan olarak yalnızca bu cihazda şifrelenmiş tutulur. Aşağıdaki
        seçenekleri etkinleştirmediğiniz sürece hiçbir sunucuya gönderilmez.
      </Text>

      <ToggleRow
        title="Bulut Yedekleme"
        description="Cihaz kaybında veri kurtarma için Firebase'e şifreli yedeklensin"
        icon="cloud-upload"
        iconColor="#10b981"
        value={cloudConsent}
        onValueChange={(v) => handleToggle('cloud', v)}
      />

      <ToggleRow
        title="Kurtarma Ekibi Paylaşımı"
        description="SOS sırasında 112/AFAD ekiplerinin tıbbi bilginize erişebilmesi için"
        icon="medkit"
        iconColor="#ef4444"
        value={backendConsent}
        onValueChange={(v) => handleToggle('backend', v)}
      />

      <ConsentModal
        visible={modal !== null}
        type={modal ?? 'cloud'}
        onAccept={handleAccept}
        onDismiss={() => setModal(null)}
      />
    </View>
  );
}

interface ToggleRowProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}

function ToggleRow({ title, description, icon, iconColor, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.toggleIcon, { backgroundColor: `${iconColor}20` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d1d5db', true: iconColor }}
        thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
        ios_backgroundColor="#d1d5db"
      />
    </View>
  );
}

async function deleteCloudCopy() {
  try {
    const { getFirebaseAuth } = await import('../../../lib/firebase');
    const auth = getFirebaseAuth();
    const uid = auth?.currentUser?.uid;
    if (!uid) return;
    const { doc, deleteDoc } = await import('firebase/firestore');
    const { getFirestoreInstanceAsync } = await import('../../services/firebase/FirebaseInstanceManager');
    const db = await getFirestoreInstanceAsync();
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid, 'health', 'current'));
    logger.info('KVKK: cloud health copy deleted on consent withdrawal');
  } catch (error) {
    logger.error('KVKK: failed to delete cloud copy:', error);
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.08)',
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A5F',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7C8E',
    lineHeight: 17,
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 58, 95, 0.06)',
  },
  toggleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A5F',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 11,
    color: '#8FA8BE',
    lineHeight: 14,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  modalScrollContent: {
    paddingVertical: 16,
    paddingBottom: 8,
  },
  modalSectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A5F',
    marginTop: 14,
    marginBottom: 6,
  },
  modalText: {
    fontSize: 13,
    color: '#37475A',
    lineHeight: 19,
    marginBottom: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 58, 95, 0.08)',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F1F4F7',
  },
  modalBtnPressed: {
    opacity: 0.7,
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBtnTextCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7C8E',
  },
});

export default KVKKConsentSection;
