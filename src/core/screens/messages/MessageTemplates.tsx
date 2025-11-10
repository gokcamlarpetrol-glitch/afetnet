/**
 * MESSAGE TEMPLATES - Quick Emergency Messages
 * 4 pre-defined templates for one-tap sending via BLE mesh
 * Energy-efficient communication in disaster situations
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMeshStore } from '../../stores/meshStore';
import { useMessageStore } from '../../stores/messageStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { colors, typography } from '../../theme';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MessageTemplates');

interface MessageTemplate {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  color: string;
  priority: 'critical' | 'high' | 'normal';
}

const TEMPLATES: MessageTemplate[] = [
  {
    id: 'safe',
    icon: 'checkmark-circle',
    title: 'Güvendeyim',
    message: 'Hayattayım, güvendeyim. Yardıma ihtiyacım yok.',
    color: '#10b981',
    priority: 'normal',
  },
  {
    id: 'trapped',
    icon: 'alert-circle',
    title: 'Enkaz Altındayım',
    message: 'Yardım gerekiyor, enkaz altındayım. Lütfen kurtarma ekiplerini gönderin.',
    color: '#dc2626',
    priority: 'critical',
  },
  {
    id: 'injured',
    icon: 'medkit',
    title: 'Yaralıyım',
    message: 'Yaralıyım, sağlık ekibi gerekli. Acil tıbbi yardım bekliyorum.',
    color: '#f59e0b',
    priority: 'high',
  },
  {
    id: 'mesh',
    icon: 'git-network',
    title: 'Mesh Ağındayım',
    message: 'İletişim kuramıyorum, mesh ağındayım. Konumumu takip edin.',
    color: '#6366f1',
    priority: 'normal',
  },
];

export default function MessageTemplates() {
  const ensureMeshReady = async (): Promise<boolean> => {
    const meshStore = useMeshStore.getState();
    let deviceId = bleMeshService.getMyDeviceId() || meshStore.myDeviceId;

    if (!deviceId) {
      try {
        await bleMeshService.start();
      } catch (error) {
        // ELITE: Use logger for error handling
        logger.warn('Mesh start error:', error);
      }
      deviceId = bleMeshService.getMyDeviceId() || meshStore.myDeviceId;
    }

    if (!deviceId) {
      Alert.alert(
        'Mesh Ağı Kapalı',
        'Bluetooth açık değil veya mesh ağı başlatılamadı. Lütfen Bluetoothu etkinleştirip tekrar deneyin.'
      );
      haptics.notificationError();
      return false;
    }

    // Persist device ID in store so mesajlaşma akışları kullanılabilir
    if (meshStore.myDeviceId !== deviceId) {
      meshStore.setMyDeviceId(deviceId);
    }
    if (!meshStore.isConnected) {
      meshStore.setConnected(true);
    }

    return true;
  };

  const sendTemplate = async (template: MessageTemplate) => {
    try {
      haptics.impactMedium();

      // ELITE: Validate template before sending
      if (!template || !template.message || !template.id) {
        logger.error('Invalid template:', template);
        Alert.alert('Hata', 'Geçersiz mesaj şablonu.');
        haptics.notificationError();
        return;
      }

      const meshReady = await ensureMeshReady();
      if (!meshReady) {
        return;
      }

      const senderId = bleMeshService.getMyDeviceId() || useMeshStore.getState().myDeviceId;
      if (!senderId) {
        Alert.alert(
          'Bluetooth Kapalı',
          'Bluetooth ve konum izinleri kapalı olduğu için mesaj gönderilemedi. Lütfen her iki izni de açıp tekrar deneyin.'
        );
        haptics.notificationError();
        return;
      }

      // ELITE: Validate message content length
      if (template.message.length > 500) {
        logger.error('Message too long:', template.message.length);
        Alert.alert('Hata', 'Mesaj çok uzun. Maksimum 500 karakter.');
        haptics.notificationError();
        return;
      }
      
      // ELITE: Create message content with proper structure
      const messageContent = template.message; // Send plain message text, not JSON
      
      // ELITE: Send via BLE mesh service broadcast
      try {
        await bleMeshService.broadcastMessage({
          content: messageContent,
          priority: template.priority as 'critical' | 'high' | 'normal',
          type: 'broadcast',
          ttl: 5,
          ackRequired: false,
          sequence: 0,
          attempts: 0,
        });

        const timestamp = Date.now();
        const messageId = `template_${template.id}_${timestamp}`;
        
        // ELITE: Add message to store for local display
        useMessageStore.getState().addMessage({
          id: messageId,
          from: 'me',
          to: 'broadcast',
          content: template.message,
          timestamp,
          delivered: true,
          read: true,
        });

        // ELITE: Update conversations
        useMessageStore.getState().updateConversations();
        
        logger.info(`Template "${template.title}" sent successfully`);
        
        // ELITE: Show success feedback
        Alert.alert(
          'Mesaj Gönderildi',
          `"${template.title}" mesajı mesh ağına yayınlandı.`,
          [{ text: 'Tamam' }]
        );
        
        haptics.notificationSuccess();
      } catch (sendError) {
        logger.error('BLE send error:', sendError);
        Alert.alert(
          'Gönderim Hatası',
          'Mesaj gönderilirken bir hata oluştu. Lütfen Bluetooth\'un açık olduğundan emin olun ve tekrar deneyin.'
        );
        haptics.notificationError();
      }
    } catch (error) {
      // ELITE: Comprehensive error handling
      logger.error('Template send error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      Alert.alert(
        'Hata',
        `Mesaj gönderilemedi: ${errorMessage}. Lütfen tekrar deneyin.`
      );
      haptics.notificationError();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hızlı Mesajlar</Text>
      <Text style={styles.subtitle}>Tek dokunuşla acil durum mesajı gönderin</Text>

      <View style={styles.grid}>
        {TEMPLATES.map((template) => (
          <TouchableOpacity
            key={template.id}
            activeOpacity={0.7}
            onPress={() => sendTemplate(template)}
          >
            <LinearGradient
              colors={[`${template.color}20`, `${template.color}10`]}
              style={styles.card}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${template.color}30` }]}>
                <Ionicons name={template.icon} size={32} color={template.color} />
              </View>
              
              <Text style={styles.title}>{template.title}</Text>
              <Text style={styles.message} numberOfLines={2}>
                {template.message}
              </Text>
              
              {template.priority === 'critical' && (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>KRİTİK</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.info}>
        <Ionicons name="information-circle" size={16} color={colors.text.secondary} />
        <Text style={styles.infoText}>
          Mesajlar Bluetooth mesh ağı üzerinden gönderilir (internet gerekmez)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  header: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 24,
  },
  grid: {
    gap: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    lineHeight: 20,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    lineHeight: 18,
  },
});

