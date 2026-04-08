/**
 * EDIT MEMBER MODAL - Extracted from FamilyScreen
 * Modal for editing family member details: name, relationship, phone, notes.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, Modal, Alert, ScrollView, TextInput,
} from 'react-native';
import type { FamilyMember } from '../../types/family';

let useFamilyStore: any = () => ({ members: [], updateMember: () => { } });
try { const mod = require('../../stores/familyStore'); useFamilyStore = mod.useFamilyStore; } catch (e: any) { console.error('[EditMemberModal] CRITICAL: familyStore import failed:', e?.message); }

let haptics: any = { impactLight: () => { }, notificationSuccess: () => { }, notificationError: () => { } };
try { haptics = require('../../utils/haptics'); } catch { /* fallback */ }

let createLogger: any = (name: string) => ({ info: console.log, error: console.error, warn: console.warn, debug: console.log });
try { createLogger = require('../../utils/logger').createLogger; } catch { /* fallback */ }

let styles: any = {};
try { styles = require('./FamilyScreen.styles').styles; } catch { /* fallback */ }

let colors: any = {};
try { const t = require('../../theme'); colors = t.colors; } catch { /* fallback */ }

const { Ionicons } = require('@expo/vector-icons');

const logger = createLogger('EditMemberModal');

const RELATIONSHIP_OPTIONS = [
  { id: 'anne', label: 'Anne', emoji: '👩' },
  { id: 'baba', label: 'Baba', emoji: '👨' },
  { id: 'es', label: 'Es', emoji: '💕' },
  { id: 'kardes', label: 'Kardes', emoji: '👫' },
  { id: 'cocuk', label: 'Cocuk', emoji: '👶' },
  { id: 'akraba', label: 'Akraba', emoji: '👥' },
  { id: 'arkadas', label: 'Arkadas', emoji: '🤝' },
  { id: 'diger', label: 'Diger', emoji: '👤' },
];

interface EditMemberModalProps {
  visible: boolean;
  member: FamilyMember | null;
  onClose: () => void;
}

function EditMemberModalInner({ visible, member, onClose }: EditMemberModalProps) {
  const [editName, setEditName] = useState('');
  const [editRelationship, setEditRelationship] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Sync state when member changes
  useEffect(() => {
    if (member) {
      setEditName(member.name || '');
      setEditRelationship(member.relationship || null);
      setEditPhone(member.phoneNumber || '');
      setEditNotes(member.notes || '');
    }
  }, [member]);

  const resetAndClose = useCallback(() => {
    setEditName('');
    setEditRelationship(null);
    setEditPhone('');
    setEditNotes('');
    onClose();
  }, [onClose]);

  const handleSaveEdit = useCallback(async () => {
    if (!member || !editName.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir isim girin.');
      return;
    }

    if (editName.trim().length < 2) {
      Alert.alert('Hata', 'İsim en az 2 karakter olmalıdır.');
      return;
    }

    if (editName.trim().length > 50) {
      Alert.alert('Hata', 'İsim en fazla 50 karakter olabilir.');
      return;
    }

    if (editPhone.trim()) {
      const phoneRegex = /^(\+?\d{1,4}[-.\s]?)?(\(?\d{1,4}\)?[-.\s]?)?[\d\-.\s]{5,15}$/;
      if (!phoneRegex.test(editPhone.replace(/\s/g, ''))) {
        Alert.alert('Hata', 'Geçersiz telefon numarası formatı.');
        return;
      }
    }

    try {
      await useFamilyStore.getState().updateMember(member.uid, {
        name: editName.trim(),
        relationship: editRelationship || undefined,
        phoneNumber: editPhone.trim() || undefined,
        notes: editNotes.trim() || undefined,
        updatedAt: Date.now(),
      });
      haptics.notificationSuccess();
      resetAndClose();
    } catch (error) {
      logger.error('Failed to update member:', error);
      Alert.alert('Hata', 'Üye güncellenemedi. Lütfen tekrar deneyin.');
    }
  }, [member, editName, editRelationship, editPhone, editNotes, resetAndClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={resetAndClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
          <Pressable
            style={styles.modalCloseButton}
            onPress={resetAndClose}
          >
            <Ionicons name="close" size={28} color={colors.text?.primary ?? '#1e293b'} />
          </Pressable>

          <Text style={styles.modalTitle}>Uyeyi Duzenle</Text>
          <Text style={styles.modalSubtitle}>
            Uye bilgilerini guncelleyin
          </Text>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {/* Isim */}
            <View style={styles.editInputContainer}>
              <Text style={styles.editInputLabel}>Isim *</Text>
              <TextInput
                style={styles.editInput}
                placeholder="Uye ismi"
                placeholderTextColor={colors.text?.tertiary ?? '#94a3b8'}
                value={editName}
                onChangeText={setEditName}
                maxLength={50}
              />
            </View>

            {/* Iliski Turu */}
            <View style={styles.editInputContainer}>
              <Text style={styles.editInputLabel}>Iliski Turu</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {RELATIONSHIP_OPTIONS.map((rel) => (
                  <Pressable
                    key={rel.id}
                    style={[
                      styles.relationshipChip,
                      editRelationship === rel.id && styles.relationshipChipActive
                    ]}
                    onPress={() => {
                      haptics.impactLight();
                      setEditRelationship(editRelationship === rel.id ? null : rel.id);
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{rel.emoji}</Text>
                    <Text style={[
                      styles.relationshipChipText,
                      editRelationship === rel.id && styles.relationshipChipTextActive
                    ]}>{rel.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Telefon */}
            <View style={styles.editInputContainer}>
              <Text style={styles.editInputLabel}>Telefon (Opsiyonel)</Text>
              <TextInput
                style={styles.editInput}
                placeholder="05551234567"
                placeholderTextColor={colors.text?.tertiary ?? '#94a3b8'}
                value={editPhone}
                onChangeText={(text) => setEditPhone(text.replace(/[^\d+\s]/g, '').substring(0, 20))}
                keyboardType="phone-pad"
                maxLength={20}
              />
            </View>

            {/* Notlar */}
            <View style={styles.editInputContainer}>
              <Text style={styles.editInputLabel}>Notlar (Opsiyonel)</Text>
              <TextInput
                style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Ek bilgiler..."
                placeholderTextColor={colors.text?.tertiary ?? '#94a3b8'}
                value={editNotes}
                onChangeText={(text) => setEditNotes(text.substring(0, 500))}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
              {editNotes.length > 0 && (
                <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>
                  {editNotes.length}/500
                </Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={resetAndClose}
            >
              <Text style={styles.modalButtonTextCancel}>Iptal</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSave]}
              onPress={handleSaveEdit}
            >
              <Text style={styles.modalButtonTextSave}>Kaydet</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const EditMemberModal = React.memo(EditMemberModalInner);
