/**
 * FEEDBACK MODAL
 *
 * Kullanici geri bildirim modal'i. Settings ekraninda "Geri Bildirim Gonder"
 * butonu ile acilir.
 *
 * Pattern:
 *   - 4 tip: Hata / Ozellik / Tesekkur / Diger
 *   - Opsiyonel 1-5 yildiz rating
 *   - 5000 karakter limit
 *   - Otomatik baglam (versiyon, ekran, kullanici uid+email)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedbackService, type FeedbackType } from '../services/FeedbackService';
import * as haptics from '../utils/haptics';
import { createLogger } from '../utils/logger';

const logger = createLogger('FeedbackModal');

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  /** Hangi ekrandan açıldığı (debug + analytics için) */
  fromScreen?: string;
}

const TYPE_OPTIONS: Array<{ id: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = [
  { id: 'bug', label: 'Hata', icon: 'bug', color: '#DC2626' },
  { id: 'feature', label: 'Özellik', icon: 'bulb', color: '#F59E0B' },
  { id: 'praise', label: 'Teşekkür', icon: 'heart', color: '#EC4899' },
  { id: 'other', label: 'Diğer', icon: 'chatbubble-ellipses', color: '#6366F1' },
];

export function FeedbackModal({ visible, onClose, fromScreen }: FeedbackModalProps) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<FeedbackType>('bug');
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [contactEmail, setContactEmail] = useState('');

  const reset = useCallback(() => {
    setType('bug');
    setRating(0);
    setMessage('');
    setContactEmail('');
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      Alert.alert('Çok Kısa', 'Lütfen geri bildiriminizi yazın (en az 3 karakter).');
      return;
    }

    setSubmitting(true);
    try {
      await feedbackService.submit({
        type,
        rating: rating > 0 ? rating : undefined,
        message: trimmed,
        screen: fromScreen,
        contactEmail: contactEmail.trim() || undefined,
      });
      haptics.notificationSuccess();
      Alert.alert(
        'Teşekkürler!',
        'Geri bildiriminiz alındı. İncelenecek ve gerekirse size dönüş yapılacaktır.',
        [{ text: 'Tamam', onPress: () => { reset(); onClose(); } }],
      );
    } catch (error: unknown) {
      haptics.notificationError();
      const msg = error instanceof Error ? error.message : 'Geri bildirim gönderilemedi.';
      Alert.alert('Hata', msg);
      logger.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  }, [type, rating, message, contactEmail, fromScreen, onClose, reset]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Geri Bildirim</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
              <Ionicons name="close-circle" size={26} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Geri bildirim türü</Text>
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  style={({ pressed }) => [
                    styles.typeChip,
                    type === opt.id && { backgroundColor: opt.color + '18', borderColor: opt.color },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => { haptics.selectionChanged(); setType(opt.id); }}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  <Ionicons name={opt.icon} size={18} color={type === opt.id ? opt.color : '#64748b'} />
                  <Text style={[styles.typeLabel, type === opt.id && { color: opt.color, fontWeight: '700' }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Genel deneyiminiz (opsiyonel)</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => { haptics.selectionChanged(); setRating(rating === n ? 0 : n); }}
                  hitSlop={5}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} yıldız`}
                >
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={30}
                    color={n <= rating ? '#F59E0B' : '#cbd5e1'}
                  />
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Mesajınız</Text>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder={
                type === 'bug'
                  ? 'Ne oldu? Hangi adımlarda yaşadınız? Beklenen davranış neydi?'
                  : type === 'feature'
                    ? 'Hangi özelliği eklemek istersiniz? Nasıl yardımcı olur?'
                    : type === 'praise'
                      ? 'Neyi beğendiniz? Hangi özellik en faydalı?'
                      : 'Mesajınızı yazın...'
              }
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={6}
              maxLength={5000}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{message.length} / 5000</Text>

            <Text style={styles.sectionLabel}>İletişim e-postası (opsiyonel)</Text>
            <TextInput
              style={styles.inputSingle}
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="size dönüş yapabilmemiz için"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={120}
            />

            <View style={styles.privacyNote}>
              <Ionicons name="information-circle" size={14} color="#6B7C8E" />
              <Text style={styles.privacyText}>
                Mesajınızla birlikte: kullanıcı adınız, e-posta adresiniz, uygulama sürümü
                ve cihaz modeli iletilir. Bu bilgiler sadece geri bildirimi yanıtlamak için kullanılır.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                (pressed || submitting) && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={submitting || message.trim().length < 3}
              accessibilityRole="button"
              accessibilityLabel="Gönder"
            >
              <Ionicons name="send" size={16} color="#FFFFFF" />
              <Text style={styles.submitText}>{submitting ? 'Gönderiliyor…' : 'Gönder'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,58,95,0.08)',
  },
  title: { fontSize: 18, fontWeight: '900', color: '#1E3A5F', letterSpacing: 0.3 },
  body: { paddingHorizontal: 20, paddingTop: 12 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F1F4F7',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  starRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  input: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1E3A5F',
    backgroundColor: '#F8FAFC',
  },
  inputSingle: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E3A5F',
    backgroundColor: '#F8FAFC',
  },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  privacyNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    color: '#6B7C8E',
    lineHeight: 15,
  },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E3A5F',
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});

export default FeedbackModal;
