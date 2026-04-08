/**
 * ID SHARE MODAL - Extracted from FamilyScreen
 * Modal for displaying and sharing the user's AfetNet ID via QR code,
 * WhatsApp, SMS, clipboard, or native share sheet.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, Modal, Alert, Linking,
  ActionSheetIOS, Platform, Share as NativeShare,
} from 'react-native';

let identityService: any = { getUid: () => null, getAfetNetId: () => null, getPublicUserCode: () => null };
try { identityService = require('../../services/IdentityService').identityService; } catch (e: any) { console.error('[IdShareModal] CRITICAL: IdentityService import failed:', e?.message); }

let getDeviceIdFromLib: any = async () => 'unknown';
try { getDeviceIdFromLib = require('../../utils/device').getDeviceId; } catch { /* fallback */ }

let useMeshStore: any = () => ({ connectedPeers: [] });
try { useMeshStore = require('../../services/mesh/MeshStore').useMeshStore; } catch { /* fallback */ }

let QRCode: any = () => null;
try { QRCode = require('react-native-qrcode-svg').default; } catch { /* fallback */ }

let Clipboard: any = { setStringAsync: () => { } };
try { Clipboard = require('expo-clipboard'); } catch { /* fallback */ }

let SMS: any = { isAvailableAsync: async () => false };
try { SMS = require('expo-sms'); } catch { /* fallback */ }

let haptics: any = { impactLight: () => { }, impactMedium: () => { }, notificationSuccess: () => { }, notificationError: () => { }, notificationWarning: () => { } };
try { haptics = require('../../utils/haptics'); } catch { /* fallback */ }

let createLogger: any = (name: string) => ({ info: console.log, error: console.error, warn: console.warn, debug: console.log });
try { createLogger = require('../../utils/logger').createLogger; } catch { /* fallback */ }

let styles: any = {};
try { styles = require('./FamilyScreen.styles').styles; } catch { /* fallback */ }

let colors: any = {};
try { const t = require('../../theme'); colors = t.colors; } catch { /* fallback */ }

const { Ionicons } = require('@expo/vector-icons');

const logger = createLogger('IdShareModal');

// SafeQRCode: Wraps QRCode in error handling
const SafeQRCode: React.FC<{ value: string; size: number }> = ({ value, size }) => {
  try {
    if (!value) return null;
    return <QRCode value={value} size={size} />;
  } catch {
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12 }}>
        <Text style={{ color: '#94a3b8', fontSize: 12 }}>QR kod oluşturulamadı</Text>
      </View>
    );
  }
};

interface IdShareModalProps {
  visible: boolean;
  onClose: () => void;
  myDeviceId: string | null;
  mySharePayload: string;
  onDeviceIdResolved: (deviceId: string) => void;
  onSharePayloadResolved: (payload: string) => void;
  showToast: (message: string) => void;
}

function IdShareModalInner({
  visible,
  onClose,
  myDeviceId,
  mySharePayload,
  onDeviceIdResolved,
  onSharePayloadResolved,
  showToast,
}: IdShareModalProps) {
  /** Full QR payload for QR code encoding */
  const getQRValue = useCallback((): string => {
    const payload = mySharePayload.trim();
    if (payload.length > 0) return payload;
    return myDeviceId || '';
  }, [myDeviceId, mySharePayload]);

  /** Human-readable publicUserCode for display, copy, and share */
  const shareDisplayId = useMemo(() => {
    const code = identityService.getPublicUserCode?.();
    if (code) return code;
    const payload = mySharePayload.trim();
    if (payload) {
      try {
        const parsed = JSON.parse(payload) as { code?: string; uid?: string };
        if (parsed.code) return parsed.code;
      } catch { /* not JSON */ }
    }
    return myDeviceId || '';
  }, [mySharePayload, myDeviceId]);

  const handleCopyId = useCallback(async () => {
    if (!shareDisplayId) return;
    await Clipboard.setStringAsync(shareDisplayId);
    haptics.notificationSuccess();
    showToast(`ID kopyalandı: ${shareDisplayId}`);
  }, [shareDisplayId, showToast]);

  const handleShareIdWhatsApp = useCallback(async () => {
    if (!shareDisplayId) return;

    const shareMessage = `AfetNet ile beni ekle!\n\nKullanici Kodum: ${shareDisplayId}\n\nAfetNet uygulamasinda bu kodu girerek beni ekleyebilirsin.`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        haptics.notificationSuccess();
        return;
      }

      const webWhatsAppUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
      const canOpenWeb = await Linking.canOpenURL(webWhatsAppUrl);
      if (canOpenWeb) {
        await Linking.openURL(webWhatsAppUrl);
        haptics.notificationSuccess();
        return;
      }

      const result = await NativeShare.share({ message: shareMessage });
      if (result.action === NativeShare.sharedAction) {
        haptics.notificationSuccess();
      }
    } catch (error) {
      logger.error('WhatsApp share error:', error);
      try {
        await Clipboard.setStringAsync(shareDisplayId);
        haptics.notificationSuccess();
        showToast(`ID kopyalandı: ${shareDisplayId}`);
      } catch {
        Alert.alert('Hata', 'Paylaşım yapılamadı. Lütfen tekrar deneyin.');
      }
    }
  }, [shareDisplayId, showToast]);

  const handleShareIdSMS = useCallback(async () => {
    if (!shareDisplayId) return;

    const shareMessage = `AfetNet ile beni ekle!\n\nKullanici Kodum: ${shareDisplayId}\n\nAfetNet uygulamasinda bu kodu girerek beni ekleyebilirsin.`;

    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync([], shareMessage);
        haptics.notificationSuccess();
      } else {
        Alert.alert('SMS', 'SMS gonderimi bu cihazda desteklenmiyor');
      }
    } catch (error) {
      logger.error('SMS share error:', error);
      Alert.alert('Hata', 'SMS ile paylasilamadi');
    }
  }, [shareDisplayId]);

  const handleShareIdOther = useCallback(async () => {
    if (!shareDisplayId) return;

    const shareMessage = `AfetNet ile beni ekle!\n\nKullanici Kodum: ${shareDisplayId}\n\nAfetNet uygulamasinda bu kodu girerek beni ekleyebilirsin.`;

    try {
      const result = await NativeShare.share({ message: shareMessage });
      if (result.action === NativeShare.sharedAction || result.action === NativeShare.dismissedAction) {
        haptics.notificationSuccess();
      } else {
        await handleCopyId();
      }
    } catch (error) {
      logger.error('Share error:', error);
      await handleCopyId();
    }
  }, [shareDisplayId, handleCopyId]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Pressable
            style={styles.modalCloseButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={28} color={colors.text?.primary ?? '#1e293b'} />
          </Pressable>

          <Text style={styles.modalTitle}>Benim ID'm</Text>
          <Text style={styles.modalSubtitle}>
            Bu ID'yi baskalarıyla paylasarak sizi ekleyebilirler
          </Text>

          {(myDeviceId || mySharePayload) ? (
            <>
              <View style={styles.qrContainer}>
                <SafeQRCode
                  value={getQRValue() || myDeviceId || ''}
                  size={200}
                />
              </View>

              <View style={styles.idContainer}>
                <Text style={styles.idLabel}>ID:</Text>
                <Text style={styles.idValue} selectable>{shareDisplayId}</Text>
              </View>

              <View style={styles.modalButtons}>
                <Pressable style={styles.modalButtonSmall} onPress={handleCopyId}>
                  <Ionicons name="copy-outline" size={18} color="#fff" />
                  <Text style={styles.modalButtonTextSmall}>Kopyala</Text>
                </Pressable>
                <Pressable style={styles.modalButtonSmall} onPress={handleShareIdWhatsApp}>
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={styles.modalButtonTextSmall}>WhatsApp</Text>
                </Pressable>
                <Pressable style={styles.modalButtonSmall} onPress={handleShareIdSMS}>
                  <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                  <Text style={styles.modalButtonTextSmall}>SMS</Text>
                </Pressable>
                <Pressable style={styles.modalButtonSmall} onPress={handleShareIdOther}>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={styles.modalButtonTextSmall}>Diger</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.errorText}>ID alınamadı</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

export const IdShareModal = React.memo(IdShareModalInner);
