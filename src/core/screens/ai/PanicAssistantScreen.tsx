/**
 * PANIC ASSISTANT SCREEN
 * Provides emergency actions during disasters
 */

import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import { aiAssistantCoordinator } from '../../ai/services/AIAssistantCoordinator';

const logger = createLogger('PanicAssistantScreen');

const phaseOrder: Record<'before' | 'during' | 'after' | 'check', number> = {
  before: 0,
  during: 1,
  after: 2,
  check: 3,
};

const getPhaseTitle = (phase: 'before' | 'during' | 'after' | 'check') => {
  switch (phase) {
    case 'before':
      return 'Sarsıntı Öncesi';
    case 'during':
      return 'Sarsıntı Anı';
    case 'after':
      return 'Sarsıntı Sonrası';
    case 'check':
    default:
      return 'Kontroller';
  }
};

const getPhaseGradient = (phase: 'before' | 'during' | 'after' | 'check'): [string, string] => {
  switch (phase) {
    case 'before':
      return ['#2563eb', '#1d4ed8'];
    case 'during':
      return ['#dc2626', '#991b1b'];
    case 'after':
      return ['#047857', '#065f46'];
    case 'check':
    default:
      return ['#6b7280', '#4b5563'];
  }
};

export default function PanicAssistantScreen() {
  const { panicAssistant, panicAssistantLoading } = useAIAssistantStore();

  useEffect(() => {
    aiAssistantCoordinator.ensurePanicAssistant('earthquake').catch((error) => {
      logger.error('Panic assistant preload failed:', error);
    });
  }, []);

  const refreshActions = useCallback(async () => {
    try {
      await aiAssistantCoordinator.ensurePanicAssistant('earthquake', true);
      haptics.impactHeavy();
    } catch (error) {
      logger.error('Panic assistant refresh failed:', error);
    }
  }, []);

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
        <TouchableOpacity style={styles.retryButton} onPress={refreshActions}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const orderedPhases: Array<'before' | 'during' | 'after' | 'check'> = ['before', 'during', 'after', 'check'];
  const groupedActions = orderedPhases
    .map((phase) => ({
      phase,
      actions: panicAssistant.actions
        .filter((action) => action.phase === phase)
        .sort((a, b) => a.priority - b.priority),
    }))
    .filter((group) => group.actions.length > 0);

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
        {groupedActions.map((group) => (
          <View key={group.phase} style={styles.phaseSection}>
            <View style={styles.phaseHeader}>
              <Ionicons
                name={group.phase === 'before' ? 'time' : group.phase === 'during' ? 'flash' : group.phase === 'after' ? 'checkmark-done' : 'clipboard'}
                size={20}
                color={colors.text.primary}
              />
              <Text style={styles.phaseTitle}>{getPhaseTitle(group.phase)}</Text>
            </View>
            {group.actions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionCard, action.completed && styles.actionCardCompleted]}
                onPress={() => toggleAction(action.id)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={action.completed ? ['#059669', '#047857'] : getPhaseGradient(group.phase)}
                  style={styles.actionGradient}
                >
                  <View style={styles.actionHeader}>
                    <View style={styles.priorityBadge}>
                      <Text style={styles.priorityText}>{action.priority}</Text>
                    </View>
                    <Ionicons
                      name={action.completed ? 'checkmark-circle' : (action.icon as any)}
                      size={28}
                      color="#fff"
                    />
                  </View>
                  <Text style={styles.actionText}>{action.text}</Text>
                  {action.details && (
                    <Text style={styles.actionDetails}>{action.details}</Text>
                  )}
                  {(action.checklist?.length || action.expectedDurationMinutes) && (
                    <View style={styles.actionMeta}>
                      {typeof action.expectedDurationMinutes === 'number' && (
                        <View style={styles.actionMetaPill}>
                          <Ionicons name="time" size={12} color="#fff" />
                          <Text style={styles.actionMetaText}>
                            {action.expectedDurationMinutes} dk
                          </Text>
                        </View>
                      )}
                      {action.checklist?.slice(0, 2).map((item, idx) => (
                        <View key={idx} style={styles.actionChecklistItem}>
                          <Ionicons name="ellipse" size={6} color="rgba(255,255,255,0.6)" />
                          <Text style={styles.actionChecklistText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
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
    padding: spacing[6],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing[8],
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing[4],
    marginBottom: spacing[6],
  },
  retryButton: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
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
    padding: spacing[8],
    marginBottom: spacing[6],
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: spacing[4],
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing[2],
  },
  actionsContainer: {
    marginBottom: spacing[6],
    gap: spacing[5],
  },
  phaseSection: {
    gap: spacing[3],
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  actionCard: {
    borderRadius: 16,
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  actionCardCompleted: {
    opacity: 0.7,
  },
  actionGradient: {
    padding: spacing[6],
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
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
  actionDetails: {
    marginTop: spacing[2],
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  actionMeta: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  actionMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  actionMetaText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  actionChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionChecklistText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  contactsSection: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  contactsGrid: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  contactCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing[4],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  contactNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  contactLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
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

