/**
 * REPORT MODAL - UGC Content Reporting
 * Reusable modal for reporting inappropriate content.
 * Used in ChatHeader (chat reports) and MapScreen (community reports).
 * Apple Guideline 1.2 compliance.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';
import { reportService, REPORT_REASONS, type ReportReason, type ReportType } from '../services/ReportService';
import { createLogger } from '../utils/logger';

const logger = createLogger('ReportModal');

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportType: ReportType;
  reportedUserId?: string;
  reportedContentId?: string;
  conversationId?: string;
  messageContent?: string;
  location?: { latitude: number; longitude: number };
}

export function ReportModal({
  visible,
  onClose,
  reportType,
  reportedUserId,
  reportedContentId,
  conversationId,
  messageContent,
  location,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetAndClose = useCallback(() => {
    setSelectedReason(null);
    setDescription('');
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) {
      Alert.alert('Eksik Bilgi', 'Lütfen bir neden seçin.');
      return;
    }

    setIsSubmitting(true);

    try {
      const reasonObj = REPORT_REASONS.find((r) => r.key === selectedReason);

      await reportService.submitReport({
        reportedUserId,
        reportedContentId,
        reportType,
        reason: selectedReason,
        reasonLabel: reasonObj?.label || selectedReason,
        description: description.trim() || undefined,
        metadata: {
          conversationId,
          messageContent,
          location,
        },
      });

      Alert.alert(
        'Bildiriminiz Alındı',
        'Bildiriminiz alındı. En kısa sürede değerlendirilecektir. Teşekkür ederiz.',
        [{ text: 'Tamam', onPress: resetAndClose }],
      );
    } catch (error) {
      logger.error('Report submission failed:', error);
      Alert.alert(
        'Hata',
        'Bildirim gönderilemedi. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }],
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedReason, description, reportedUserId, reportedContentId, reportType, conversationId, messageContent, location, resetAndClose]);

  const title = reportType === 'chat_message'
    ? 'Kullanıcıyı / Mesajı Şikayet Et'
    : reportType === 'community_report'
      ? 'İçeriği Raporla'
      : 'Şikayet Et';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={modalStyles.container}
      >
        {/* Header */}
        <View style={modalStyles.header}>
          <Pressable onPress={resetAndClose} style={modalStyles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={modalStyles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={modalStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info */}
          <View style={modalStyles.infoBox}>
            <Ionicons name="shield-checkmark" size={20} color={colors.brand.primary} />
            <Text style={modalStyles.infoText}>
              Bildiriminiz gizli tutulacak ve ekibimiz tarafından incelenecektir.
              Gerekli durumlarda hesap kısıtlaması veya içerik kaldırma işlemi uygulanacaktır.
            </Text>
          </View>

          {/* Reason Selection */}
          <Text style={modalStyles.sectionTitle}>Neden</Text>
          <View style={modalStyles.reasonList}>
            {REPORT_REASONS.map((reason) => {
              const isSelected = selectedReason === reason.key;
              return (
                <Pressable
                  key={reason.key}
                  style={[
                    modalStyles.reasonItem,
                    isSelected && modalStyles.reasonItemSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.key)}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? colors.brand.primary : colors.text.tertiary}
                  />
                  <Text
                    style={[
                      modalStyles.reasonText,
                      isSelected && modalStyles.reasonTextSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Description */}
          <Text style={modalStyles.sectionTitle}>Detay (Opsiyonel)</Text>
          <TextInput
            style={modalStyles.descriptionInput}
            placeholder="Ek bilgi vermek isterseniz buraya yazabilirsiniz..."
            placeholderTextColor={colors.text.tertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />

          {/* Submit Button */}
          <Pressable
            style={[
              modalStyles.submitButton,
              (!selectedReason || isSubmitting) && modalStyles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedReason || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="flag" size={18} color="#fff" />
                <Text style={modalStyles.submitButtonText}>Gönder</Text>
              </>
            )}
          </Pressable>

          {/* Disclaimer */}
          <Text style={modalStyles.disclaimer}>
            Gereksiz veya kötü niyetli bildirimler hesap kısıtlamasına neden olabilir.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: colors.brand.primary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand.primary + '30',
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
    fontSize: 13,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  reasonList: {
    gap: 2,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  reasonItemSelected: {
    backgroundColor: colors.brand.primary + '12',
  },
  reasonText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
  },
  reasonTextSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  descriptionInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.primary,
    minHeight: 100,
    fontSize: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: colors.status.danger,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.h4,
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
});
