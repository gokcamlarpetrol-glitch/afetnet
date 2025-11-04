/**
 * PANIC ASSISTANT SCREEN
 * Provides emergency actions during disasters
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import { panicAssistantService } from '../../ai/services/PanicAssistantService';
import * as haptics from '../../utils/haptics';

export default function PanicAssistantScreen() {
  const { panicAssistant, panicAssistantLoading } = useAIAssistantStore();

  useEffect(() => {
    loadActions();
  }, []);

  const loadActions = async () => {
    try {
      useAIAssistantStore.getState().setPanicAssistantLoading(true);
      const actions = await panicAssistantService.getEmergencyActions('earthquake');
      useAIAssistantStore.getState().setPanicAssistant({
        isActive: true,
        currentScenario: 'earthquake',
        actions,
        lastUpdate: Date.now(),
      });
      haptics.impactHeavy();
    } catch (error) {
      console.error('Failed to load actions:', error);
      useAIAssistantStore.getState().setPanicAssistantError('Aksiyonlar yuklenemedi');
    }
  };

  const toggleAction = (actionId: string) => {
    if (!panicAssistant) return;
    
    const updatedActions = panicAssistant.actions.map(action =>
      action.id === actionId ? { ...action, completed: !action.completed } : action
    );

    useAIAssistantStore.getState().setPanicAssistant({
      ...panicAssistant,
      actions: updatedActions,
      lastUpdate: Date.now(),
    });

    haptics.impactMedium();
  };

  if (panicAssistantLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.emergency.critical} />
        <Text style={styles.loadingText}>Acil durum aksiyonlari yukleniyor...</Text>
      </View>
    );
  }

  if (!panicAssistant || panicAssistant.actions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="shield-checkmark-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>Aksiyon bulunamadi</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadActions}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <LinearGradient colors={['#dc2626', '#991b1b']} style={styles.header}>
        <Ionicons name="warning" size={48} color="#fff" />
        <Text style={styles.title}>DEPREM ANI</Text>
        <Text style={styles.subtitle}>Asagidaki adimlari takip edin</Text>
      </LinearGradient>

      {/* Emergency Actions */}
      <View style={styles.actionsContainer}>
        {panicAssistant.actions
          .sort((a, b) => a.priority - b.priority)
          .map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.actionCard, action.completed && styles.actionCardCompleted]}
              onPress={() => toggleAction(action.id)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={action.completed ? ['#059669', '#047857'] : ['#dc2626', '#991b1b']}
                style={styles.actionGradient}
              >
                <View style={styles.actionHeader}>
                  <View style={styles.priorityBadge}>
                    <Text style={styles.priorityText}>{action.priority}</Text>
                  </View>
                  <Ionicons
                    name={action.completed ? 'checkmark-circle' : action.icon as any}
                    size={32}
                    color="#fff"
                  />
                </View>
                <Text style={styles.actionText}>{action.text}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
      </View>

      {/* Emergency Contacts */}
      <View style={styles.contactsSection}>
        <Text style={styles.sectionTitle}>Acil Durum Numaralari</Text>
        <View style={styles.contactsGrid}>
          <TouchableOpacity style={styles.contactCard}>
            <Ionicons name="call" size={24} color={colors.emergency.critical} />
            <Text style={styles.contactNumber}>112</Text>
            <Text style={styles.contactLabel}>Acil Yardim</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard}>
            <Ionicons name="medkit" size={24} color={colors.status.info} />
            <Text style={styles.contactNumber}>110</Text>
            <Text style={styles.contactLabel}>Itfaiye</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard}>
            <Ionicons name="shield" size={24} color={colors.accent.primary} />
            <Text style={styles.contactNumber}>155</Text>
            <Text style={styles.contactLabel}>Polis</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
        <Text style={styles.disclaimerText}>
          Acil durumda once kendi guvenliginizi saglayin. AFAD ve resmi kurumlarin uyarilari onceliklidir.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    borderRadius: 20,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing.xs,
  },
  actionsContainer: {
    marginBottom: spacing.lg,
  },
  actionCard: {
    borderRadius: 16,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  actionCardCompleted: {
    opacity: 0.7,
  },
  actionGradient: {
    padding: spacing.lg,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  priorityBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  actionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 26,
  },
  contactsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  contactsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contactCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  contactNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  contactLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});

