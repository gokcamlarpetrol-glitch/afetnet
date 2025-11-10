/**
 * PREPAREDNESS PLAN SCREEN
 * Displays personalized disaster preparedness plan
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

const logger = createLogger('PreparednessPlanScreen');

export default function PreparednessPlanScreen() {
  const { preparednessPlan, preparednessPlanLoading } = useAIAssistantStore();

  useEffect(() => {
    aiAssistantCoordinator.ensurePreparednessPlan().catch((error) => {
      logger.error('Preparedness plan preload failed:', error);
    });
  }, []);

  const refreshPlan = useCallback(async () => {
    try {
      await aiAssistantCoordinator.ensurePreparednessPlan(true);
      haptics.impactLight();
    } catch (error) {
      logger.error('Preparedness plan refresh failed:', error);
    }
  }, []);

  const toggleItem = (sectionId: string, itemId: string) => {
    if (!preparednessPlan) return;
    
    const updatedSections = preparednessPlan.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          items: section.items.map(item => 
            item.id === itemId ? { ...item, completed: !item.completed } : item
          ),
        };
      }
      return section;
    });

    const completedItems = updatedSections.flatMap(s => s.items).filter(i => i.completed).length;
    const totalItems = updatedSections.flatMap(s => s.items).length;
    const completionRate = Math.round((completedItems / totalItems) * 100);

    useAIAssistantStore.getState().setPreparednessPlan({
      ...preparednessPlan,
      sections: updatedSections,
      completionRate,
      updatedAt: Date.now(),
    });

    haptics.impactLight();
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return colors.emergency.critical;
      case 'medium': return colors.emergency.warning;
      case 'low': return colors.status.info;
    }
  };

  const getPhaseLabel = (phase: 'hazirlik' | 'tatbikat' | 'acil_durum' | 'iyilesme' | undefined) => {
    switch (phase) {
      case 'tatbikat':
        return 'Tatbikat';
      case 'acil_durum':
        return 'Acil Durum';
      case 'iyilesme':
        return 'İyileşme';
      case 'hazirlik':
      default:
        return 'Hazırlık';
    }
  };

  const getImportanceColor = (importance: 'critical' | 'high' | 'medium' | 'low' | undefined) => {
    switch (importance) {
      case 'critical':
        return colors.emergency.critical;
      case 'high':
        return colors.emergency.warning;
      case 'medium':
        return colors.accent.primary;
      case 'low':
      default:
        return colors.text.tertiary;
    }
  };

  const formatDueDate = (dueDate?: number) => {
    if (!dueDate) return null;
    const diff = dueDate - Date.now();
    if (diff <= 0) {
      return 'Öncelikli tamamlanmalı';
    }
    const hours = Math.round(diff / (1000 * 60 * 60));
    if (hours <= 24) {
      return `İlk ${hours} saat içinde`; 
    }
    const days = Math.round(hours / 24);
    return `İlk ${days} gün içinde`;
  };

  if (preparednessPlanLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={styles.loadingText}>Plan olusturuluyor...</Text>
      </View>
    );
  }

  if (!preparednessPlan) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>Plan bulunamadi</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshPlan}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <LinearGradient colors={['#1a1f2e', '#141824']} style={styles.header}>
        <Text style={styles.title}>{preparednessPlan.title}</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${preparednessPlan.completionRate}%` }]} />
          </View>
          <Text style={styles.progressText}>{preparednessPlan.completionRate}% Tamamlandi</Text>
        </View>
        {preparednessPlan.personaSummary && (
          <Text style={styles.personaSummary}>{preparednessPlan.personaSummary}</Text>
        )}
      </LinearGradient>

      {/* Sections */}
      {preparednessPlan.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.summary && <Text style={styles.sectionSummary}>{section.summary}</Text>}
            </View>
            <View style={styles.sectionBadges}>
              <View style={[styles.phaseBadge, { backgroundColor: colors.background.elevated }]}>
                <Ionicons name="layers" size={12} color={colors.text.secondary} />
                <Text style={styles.phaseText}>{getPhaseLabel(section.phase)}</Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(section.priority) }]}>
                <Text style={styles.priorityText}>{section.priority === 'high' ? 'Yuksek' : section.priority === 'medium' ? 'Orta' : 'Dusuk'}</Text>
              </View>
            </View>
          </View>
          {(section.estimatedDurationMinutes || section.resources?.length) && (
            <View style={styles.sectionMetaRow}>
              {section.estimatedDurationMinutes && (
                <View style={styles.sectionMetaPill}>
                  <Ionicons name="time" size={14} color={colors.accent.primary} />
                  <Text style={styles.sectionMetaText}>
                    {Math.round(section.estimatedDurationMinutes / 30) * 30} dk çalışma
                  </Text>
                </View>
              )}
              {!!section.resources?.length && (
                <View style={styles.resourcesContainer}>
                  {section.resources.slice(0, 3).map((resource, idx) => (
                    <View key={idx} style={styles.resourceChip}>
                      <Ionicons name="book" size={12} color={colors.text.secondary} />
                      <Text style={styles.resourceText}>{resource}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          {section.items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.item}
              onPress={() => toggleItem(section.id, item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={item.completed ? colors.status.success : colors.text.tertiary}
              />
              <View style={styles.itemContent}>
                <View style={styles.itemHeaderRow}>
                  <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]}>
                    {item.text}
                  </Text>
                  {item.importance && (
                    <View style={[styles.importanceBadge, { borderColor: getImportanceColor(item.importance) }]}>
                      <Text style={[styles.importanceText, { color: getImportanceColor(item.importance) }]}>
                        {item.importance === 'critical'
                          ? 'Kritik'
                          : item.importance === 'high'
                          ? 'Öncelik'
                          : item.importance === 'medium'
                          ? 'Önemli'
                          : 'Destek'}
                      </Text>
                    </View>
                  )}
                </View>
                {item.instructions && !item.completed && (
                  <Text style={styles.itemInstructions}>{item.instructions}</Text>
                )}
                {formatDueDate(item.dueDate) && (
                  <View style={styles.itemMetaRow}>
                    <Ionicons name="alarm" size={12} color={colors.text.secondary} />
                    <Text style={styles.itemMetaText}>{formatDueDate(item.dueDate)}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
        <Text style={styles.disclaimerText}>
          Bu plan bilgilendirme amaclidir. AFAD ve resmi kurumlarin uyarilari onceliklidir.
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
    padding: spacing[6],
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  personaSummary: {
    marginTop: spacing[3],
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.8)',
  },
  progressContainer: {
    gap: spacing[2],
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background.elevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.status.success,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  sectionBadges: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  sectionSummary: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing[2],
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  phaseText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  sectionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  sectionMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionMetaText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  resourcesContainer: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  resourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background.card,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  resourceText: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  itemContent: {
    flex: 1,
    gap: spacing[2],
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  importanceBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemInstructions: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemMetaText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});

