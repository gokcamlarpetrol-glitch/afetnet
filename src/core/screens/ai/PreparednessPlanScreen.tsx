/**
 * PREPAREDNESS PLAN SCREEN
 * Displays personalized disaster preparedness plan
 * ELITE: Completely rewritten to fix all Text rendering errors
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable, StatusBar, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { colors, spacing } from '../../theme';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import { aiAssistantCoordinator } from '../../ai/services/AIAssistantCoordinator';
import { PlanItem, PlanSection } from '../../ai/types/ai.types';
import { i18nService } from '../../services/I18nService';

const logger = createLogger('PreparednessPlanScreen');

// ELITE: Güvenli string render helper - Her zaman string döndürür
// CRITICAL: React Native Text component hatası önleme - object'leri kesinlikle boş string'e çevir
const safeString = (value: any): string => {
  // Null/undefined kontrolü
  if (value === null || value === undefined) return '';
  
  // String kontrolü
  if (typeof value === 'string') {
    // Boş string kontrolü
    return value || '';
  }
  
  // Number kontrolü
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return '';
    return String(value);
  }
  
  // Boolean kontrolü
  if (typeof value === 'boolean') {
    return String(value);
  }
  
  // Array kontrolü - sadece string/number/boolean elemanları işle
  if (Array.isArray(value)) {
    const safeItems = value
      .map(item => {
        if (item === null || item === undefined) return null;
        if (typeof item === 'string') return item;
        if (typeof item === 'number' && !isNaN(item) && isFinite(item)) return String(item);
        if (typeof item === 'boolean') return String(item);
        // Object veya diğer tipler için null döndür (filtrelenecek)
        return null;
      })
      .filter((item): item is string => item !== null && item !== '');
    return safeItems.join(', ') || '';
  }
  
  // Object kontrolü - kesinlikle boş string döndür
  if (typeof value === 'object') {
    // React Native Text component object render edemez
    return '';
  }
  
  // Diğer tipler için güvenli string'e çevirme
  try {
    const str = String(value);
    // [object Object] gibi string'leri boş string'e çevir
    if (str.startsWith('[object ') && str.endsWith(']')) {
      return '';
    }
    // "null" veya "undefined" string'lerini boş string'e çevir
    if (str === 'null' || str === 'undefined') {
      return '';
    }
    return str || '';
  } catch {
    return '';
  }
};

// ELITE: Güvenli sayı helper - Her zaman sayı döndürür
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
};

// ELITE: Güvenli priority helper
const safePriority = (priority: any): 'high' | 'medium' | 'low' => {
  if (priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority;
  }
  return 'low';
};

export default function PreparednessPlanScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { preparednessPlan, preparednessPlanLoading } = useAIAssistantStore();
  const [selectedItem, setSelectedItem] = useState<{ section: PlanSection; item: PlanItem } | null>(null);
  const [filterPhase, setFilterPhase] = useState<'all' | 'hazirlik' | 'tatbikat' | 'acil_durum' | 'iyilesme'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'importance' | 'dueDate' | 'progress'>('default');

  useEffect(() => {
    let isMounted = true;
    
    const loadPlan = async () => {
      if (!isMounted) return;
      
      try {
        logger.info('Loading preparedness plan...');
        
        const currentPlan = useAIAssistantStore.getState().preparednessPlan;
        const forceRegenerate = !currentPlan || 
                                !currentPlan.sections || 
                                currentPlan.sections.length === 0 ||
                                (currentPlan.totalItems || 0) === 0;
        
        if (forceRegenerate && __DEV__) {
          logger.warn('Current plan is empty or invalid, forcing regeneration...');
        }
        
        const plan = await aiAssistantCoordinator.ensurePreparednessPlan(forceRegenerate);
        
        if (!isMounted) return;
        
        if (!plan || !plan.sections || plan.sections.length === 0) {
          logger.error('Plan loaded but is empty! Attempting regeneration...');
          const retryPlan = await aiAssistantCoordinator.ensurePreparednessPlan(true);
          if (!isMounted) return;
          
          if (!retryPlan || !retryPlan.sections || retryPlan.sections.length === 0) {
            logger.error('Plan regeneration failed - plan is still empty!');
          }
        }
        
        if (__DEV__ && isMounted) {
          logger.info('Plan loaded:', {
            hasPlan: !!plan,
            sections: plan?.sections?.length || 0,
            totalItems: plan?.totalItems || 0,
            completedItems: plan?.completedItems || 0,
            planTitle: plan?.title,
          });
        }
      } catch (error: any) {
        if (!isMounted) return;
        
        logger.error('Preparedness plan preload failed:', {
          error: error?.message || error,
          errorType: error?.name || typeof error,
        });
        
        try {
          logger.info('Retrying plan generation after error...');
          await aiAssistantCoordinator.ensurePreparednessPlan(true);
        } catch (retryError) {
          if (isMounted) {
            logger.error('Plan retry also failed:', retryError);
          }
        }
      }
    };
    
    loadPlan();
    
    return () => {
      isMounted = false;
    };
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
    
    const updatedSections = (preparednessPlan.sections || []).map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          items: (section.items || []).map(item => 
            item.id === itemId ? { ...item, completed: !item.completed } : item
          ),
        };
      }
      return section;
    });

    const completedItems = updatedSections.flatMap(s => s.items || []).filter(i => i.completed).length;
    const totalItems = updatedSections.flatMap(s => s.items || []).length;
    const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    useAIAssistantStore.getState().setPreparednessPlan({
      ...preparednessPlan,
      sections: updatedSections,
      completionRate,
      updatedAt: Date.now(),
    });

    haptics.impactLight();
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low' | undefined) => {
    const safePriorityValue = safePriority(priority);
    switch (safePriorityValue) {
      case 'high': return colors.emergency.critical;
      case 'medium': return colors.emergency.warning;
      case 'low': return colors.status.info;
    }
  };

  const getPhaseLabel = (phase: 'hazirlik' | 'tatbikat' | 'acil_durum' | 'iyilesme' | undefined): string => {
    switch (phase) {
      case 'tatbikat':
        return safeString(i18nService.t('preparedness.drill'));
      case 'acil_durum':
        return safeString(i18nService.t('preparedness.emergency'));
      case 'iyilesme':
        return safeString(i18nService.t('preparedness.recovery'));
      case 'hazirlik':
      default:
        return safeString(i18nService.t('preparedness.preparation'));
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

  const formatDueDate = (dueDate?: number): string => {
    if (!dueDate) return '';
    const diff = dueDate - Date.now();
    if (diff <= 0) {
      return safeString(i18nService.t('preparedness.priority'));
    }
    const hours = Math.round(diff / (1000 * 60 * 60));
    if (hours <= 24) {
      return safeString(i18nService.t('preparedness.dueInHours', { hours: safeString(hours) })); 
    }
    const days = Math.round(hours / 24);
    return safeString(i18nService.t('preparedness.dueInDays', { days: safeString(days) }));
  };

  // Filtrelenmiş ve sıralanmış section'lar
  const filteredSections = useMemo(() => {
    if (!preparednessPlan || !preparednessPlan.sections) {
      if (__DEV__) {
        logger.debug('No preparedness plan available');
      }
      return [];
    }
    
    let sections = (preparednessPlan.sections || []).filter(s => s != null);
    
    if (__DEV__) {
      logger.debug('Preparedness plan sections:', {
        totalSections: sections.length,
        totalItems: sections.reduce((sum, s) => sum + ((s && s.items) ? s.items.length : 0), 0),
        planTotalItems: preparednessPlan.totalItems,
        planCompletedItems: preparednessPlan.completedItems,
      });
    }
    
    // Faz filtresi
    if (filterPhase !== 'all') {
      sections = sections.filter((s) => s.phase === filterPhase);
    }
    
    // Öncelik filtresi
    if (filterPriority !== 'all') {
      sections = sections.filter((s) => s.priority === filterPriority);
    }
    
    // Sıralama
    if (sortBy === 'importance') {
      sections = [...sections].sort((a, b) => {
        const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const aPriority = safePriority(a.priority);
        const bPriority = safePriority(b.priority);
        return (priorityOrder[bPriority] || 0) - (priorityOrder[aPriority] || 0);
      });
    } else if (sortBy === 'progress') {
      sections = [...sections].sort((a, b) => {
        const aRate = safeNumber(a.completionRate, 0);
        const bRate = safeNumber(b.completionRate, 0);
        return bRate - aRate;
      });
    }
    
    if (__DEV__) {
      logger.debug('Filtered sections:', {
        filteredCount: sections.length,
        filterPhase,
        filterPriority,
      });
    }
    
    return sections;
  }, [preparednessPlan, filterPhase, filterPriority, sortBy]);

  if (preparednessPlanLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={styles.loadingText}>{safeString(i18nService.t('preparedness.planLoading'))}</Text>
      </View>
    );
  }

  if (!preparednessPlan) {
    if (__DEV__) {
      logger.warn('No preparedness plan available in store');
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>{safeString(i18nService.t('preparedness.planNotFound'))}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshPlan}>
          <Text style={styles.retryButtonText}>{safeString(i18nService.t('preparedness.retry'))}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!preparednessPlan.sections || preparednessPlan.sections.length === 0) {
    if (__DEV__) {
      logger.error('Preparedness plan has no sections!', {
        plan: preparednessPlan,
      });
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.emergency.warning} />
        <Text style={styles.emptyText}>{safeString(i18nService.t('preparedness.planError'))}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshPlan}>
          <Text style={styles.retryButtonText}>{safeString(i18nService.t('preparedness.retry'))}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const completionRate = safeNumber(preparednessPlan.completionRate, 0);
  const completedItems = safeNumber(preparednessPlan.completedItems, 0);
  const totalItems = safeNumber(preparednessPlan.totalItems, 0);
  const criticalItemsRemaining = safeNumber(preparednessPlan.criticalItemsRemaining, 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header with Back Button */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <Pressable 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{safeString(i18nService.t('preparedness.plan'))}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <LinearGradient colors={['#1a1f2e', '#141824']} style={styles.header}>
          <Text style={styles.title}>{safeString(preparednessPlan.title)}</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Number(safeString(completionRate))}%` as any }]} />
            </View>
            <Text style={styles.progressText}>
              {`${safeString(completionRate)}% ${safeString(i18nService.t('preparedness.completed'))} (${safeString(completedItems)}/${safeString(totalItems)} ${safeString(i18nService.t('preparedness.task'))})`}
            </Text>
          </View>
          {(() => {
            const personaSummaryText = safeString(preparednessPlan.personaSummary);
            return personaSummaryText.length > 0 ? (
              <Text style={styles.personaSummary}>{personaSummaryText}</Text>
            ) : null;
          })()}
          {criticalItemsRemaining > 0 ? (
            <View style={styles.criticalBadge}>
              <Ionicons name="alert-circle" size={16} color={colors.emergency.critical} />
              <Text style={styles.criticalText}>{`${safeString(criticalItemsRemaining)} ${safeString(i18nService.t('preparedness.criticalTasksRemaining'))}`}</Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* Filtreler ve Sıralama */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            <TouchableOpacity
              style={[styles.filterChip, filterPhase === 'all' && styles.filterChipActive]}
              onPress={() => setFilterPhase('all')}
            >
              <Text style={[styles.filterChipText, filterPhase === 'all' && styles.filterChipTextActive]}>{safeString(i18nService.t('preparedness.all'))}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterPhase === 'hazirlik' && styles.filterChipActive]}
              onPress={() => setFilterPhase('hazirlik')}
            >
              <Text style={[styles.filterChipText, filterPhase === 'hazirlik' && styles.filterChipTextActive]}>{safeString(i18nService.t('preparedness.preparation'))}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterPhase === 'tatbikat' && styles.filterChipActive]}
              onPress={() => setFilterPhase('tatbikat')}
            >
              <Text style={[styles.filterChipText, filterPhase === 'tatbikat' && styles.filterChipTextActive]}>{safeString(i18nService.t('preparedness.drill'))}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterPhase === 'acil_durum' && styles.filterChipActive]}
              onPress={() => setFilterPhase('acil_durum')}
            >
              <Text style={[styles.filterChipText, filterPhase === 'acil_durum' && styles.filterChipTextActive]}>{safeString(i18nService.t('preparedness.emergency'))}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterPhase === 'iyilesme' && styles.filterChipActive]}
              onPress={() => setFilterPhase('iyilesme')}
            >
              <Text style={[styles.filterChipText, filterPhase === 'iyilesme' && styles.filterChipTextActive]}>{safeString(i18nService.t('preparedness.recovery'))}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Milestone'lar */}
        {preparednessPlan.milestones && preparednessPlan.milestones.length > 0 ? (
          <View style={styles.milestonesSection}>
            <Text style={styles.sectionTitle}>{safeString(i18nService.t('preparedness.milestones'))}</Text>
            {preparednessPlan.milestones.map((milestone) => {
              const milestoneItems = milestone.items || [];
              const completedItems = milestoneItems.filter((itemId) => {
                const item = (preparednessPlan.sections || [])
                  .flatMap((s) => s.items || [])
                  .find((i) => i && i.id === itemId);
                return item?.completed;
              }).length;
              const progress = milestoneItems.length > 0 ? (completedItems / milestoneItems.length) * 100 : 0;
              const progressRounded = Math.round(progress);
              
              return (
                <View key={milestone.id} style={styles.milestoneCard}>
                  <View style={styles.milestoneHeader}>
                    <Ionicons
                      name={milestone.completed ? 'checkmark-circle' : 'flag-outline'}
                      size={24}
                      color={milestone.completed ? colors.status.success : colors.accent.primary}
                    />
                    <View style={{ flex: 1, marginLeft: spacing[3] }}>
                      <Text style={styles.milestoneTitle}>{safeString(milestone.title)}</Text>
                      <Text style={styles.milestoneDescription}>{safeString(milestone.description)}</Text>
                    </View>
                  </View>
                  <View style={styles.milestoneProgress}>
                    <View style={styles.milestoneProgressBar}>
                      <View style={[styles.milestoneProgressFill, { width: `${Number(safeString(progressRounded))}%` as any }]} />
                    </View>
                    <Text style={styles.milestoneProgressText}>{safeString(progressRounded)}%</Text>
                  </View>
                  {(() => {
                    const rewardText = safeString(milestone.reward);
                    return rewardText.length > 0 ? (
                      <View style={styles.milestoneReward}>
                        <Ionicons name="trophy" size={16} color={colors.accent.primary} />
                        <Text style={styles.milestoneRewardText}>{rewardText}</Text>
                      </View>
                    ) : null;
                  })()}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Sections */}
        {filteredSections.map((section) => {
          const sectionCompletionRate = safeNumber(section.completionRate, 0);
          const sectionPriority = safePriority(section.priority);
          
          return (
            <View key={section.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{safeString(section.title)}</Text>
                    {section.completionRate !== undefined ? (
                      <View style={styles.sectionProgressBadge}>
                        <Text style={styles.sectionProgressText}>{safeString(sectionCompletionRate)}%</Text>
                      </View>
                    ) : null}
                  </View>
                  {(() => {
                    const sectionSummaryText = safeString(section.summary);
                    return sectionSummaryText.length > 0 ? (
                      <Text style={styles.sectionSummary}>{sectionSummaryText}</Text>
                    ) : null;
                  })()}
                </View>
                <View style={styles.sectionBadges}>
                  <View style={[styles.phaseBadge, { backgroundColor: colors.background.elevated }]}>
                    <Ionicons name="layers" size={12} color={colors.text.secondary} />
                    <Text style={styles.phaseText}>{safeString(getPhaseLabel(section.phase))}</Text>
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(section.priority) }]}>
                    <Text style={styles.priorityText}>{safeString(i18nService.t(`preparedness.${sectionPriority}`))}</Text>
                  </View>
                </View>
              </View>
              {section.completionRate !== undefined ? (
                <View style={styles.sectionProgressBar}>
                  <View style={[styles.sectionProgressFill, { width: `${Number(safeString(sectionCompletionRate))}%` as any }]} />
                </View>
              ) : null}
              {(section.estimatedDurationMinutes || section.resources?.length) ? (
                <View style={styles.sectionMetaRow}>
                  {section.estimatedDurationMinutes ? (
                    <View style={styles.sectionMetaPill}>
                      <Ionicons name="time" size={14} color={colors.accent.primary} />
                      <Text style={styles.sectionMetaText}>
                        {safeString(i18nService.t('preparedness.estimatedDuration', { minutes: safeString(Math.round(section.estimatedDurationMinutes / 30) * 30) }))}
                      </Text>
                    </View>
                  ) : null}
                  {section.resources && section.resources.length > 0 ? (
                    <View style={styles.resourcesContainer}>
                      {(section.resources || []).slice(0, 3).map((resource, idx) => {
                        const resourceString = typeof resource === 'string' ? resource : '';
                        return (
                          <View key={idx} style={styles.resourceChip}>
                            <Ionicons name="book" size={12} color={colors.text.secondary} />
                            <Text style={styles.resourceText}>{safeString(resourceString)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}
              {(section.items || []).map((item) => {
                const itemImportance = item.importance || 'low';
                const subTasksCount = safeNumber(item.subTasks?.length, 0);
                const checklistCount = safeNumber(item.checklist?.length, 0);
                const resourcesCount = safeNumber(item.resources?.length, 0);
                
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.item}
                    onPress={() => {
                      if (item.subTasks?.length || item.checklist?.length || item.resources?.length) {
                        setSelectedItem({ section, item });
                      } else {
                        toggleItem(section.id, item.id);
                      }
                    }}
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
                          {safeString(item.text)}
                        </Text>
                        {item.importance ? (
                          <View style={[styles.importanceBadge, { borderColor: getImportanceColor(item.importance) }]}>
                            <Text style={[styles.importanceText, { color: getImportanceColor(item.importance) }]}>
                              {itemImportance === 'critical'
                                ? safeString(i18nService.t('preparedness.critical'))
                                : itemImportance === 'high'
                                ? safeString(i18nService.t('preparedness.importance'))
                                : itemImportance === 'medium'
                                ? safeString(i18nService.t('preparedness.important'))
                                : safeString(i18nService.t('preparedness.support'))}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {(() => {
                        const instructionsText = safeString(item.instructions);
                        return item.instructions && !item.completed && instructionsText.length > 0 ? (
                          <Text style={styles.itemInstructions}>{instructionsText}</Text>
                        ) : null;
                      })()}
                      {(() => {
                        const dueDateText = formatDueDate(item.dueDate);
                        return dueDateText && dueDateText.length > 0 ? (
                          <View style={styles.itemMetaRow}>
                            <Ionicons name="alarm" size={12} color={colors.text.secondary} />
                            <Text style={styles.itemMetaText}>{dueDateText}</Text>
                          </View>
                        ) : null;
                      })()}
                      {(subTasksCount > 0 || checklistCount > 0 || resourcesCount > 0) ? (
                        <View style={styles.itemMetaRow}>
                          <Ionicons name="chevron-forward" size={12} color={colors.accent.primary} />
                          <Text style={styles.itemDetailText}>
                            {(() => {
                              const subTasksLabel = safeString(i18nService.t('preparedness.subTasks')).toLowerCase();
                              const checklistLabel = safeString(i18nService.t('preparedness.checklist')).toLowerCase();
                              const resourcesLabel = safeString(i18nService.t('preparedness.resources')).toLowerCase();
                              const parts: string[] = [];
                              if (subTasksCount > 0) {
                                parts.push(`${safeString(subTasksCount)} ${subTasksLabel}`);
                              }
                              if (checklistCount > 0) {
                                parts.push(`${safeString(checklistCount)} ${checklistLabel}`);
                              }
                              if (resourcesCount > 0) {
                                parts.push(`${safeString(resourcesCount)} ${resourcesLabel}`);
                              }
                              return safeString(parts.join(', '));
                            })()}
                          </Text>
                        </View>
                      ) : null}
                      {item.estimatedCost && item.estimatedCost > 0 ? (
                        <View style={styles.itemMetaRow}>
                          <Ionicons name="cash" size={12} color={colors.text.secondary} />
                          <Text style={styles.itemMetaText}>{safeString(i18nService.t('preparedness.estimatedCost', { cost: safeString(item.estimatedCost) }))}</Text>
                        </View>
                      ) : null}
                      {item.estimatedDurationMinutes ? (
                        <View style={styles.itemMetaRow}>
                          <Ionicons name="time" size={12} color={colors.text.secondary} />
                          <Text style={styles.itemMetaText}>{safeString(i18nService.t('preparedness.estimatedTime', { minutes: safeString(item.estimatedDurationMinutes) }))}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* Detaylı Görev Modal */}
        <Modal
          visible={selectedItem !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedItem(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedItem ? (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{safeString(selectedItem.item.text)}</Text>
                    <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.modalCloseButton}>
                      <Ionicons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.modalScroll}>
                    {(() => {
                      const instructionsText = safeString(selectedItem.item.instructions);
                      return instructionsText.length > 0 ? (
                        <View style={styles.modalSection}>
                          <Text style={styles.modalSectionTitle}>{safeString(i18nService.t('preparedness.instructions'))}</Text>
                          <Text style={styles.modalSectionText}>{instructionsText}</Text>
                        </View>
                      ) : null;
                    })()}
                    {selectedItem.item.subTasks && selectedItem.item.subTasks.length > 0 ? (
                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionTitle}>{safeString(i18nService.t('preparedness.subTasks'))}</Text>
                        {(selectedItem.item.subTasks || [])
                          .filter((subTask) => subTask != null && subTask.id != null)
                          .map((subTask) => {
                            const subTaskText = safeString(subTask.text);
                            return subTaskText.length > 0 ? (
                              <View key={subTask.id} style={styles.subTaskItem}>
                                <Ionicons
                                  name={subTask.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={20}
                                  color={subTask.completed ? colors.status.success : colors.text.tertiary}
                                />
                                <Text style={[styles.subTaskText, subTask.completed && styles.subTaskTextCompleted]}>
                                  {subTaskText}
                                </Text>
                              </View>
                            ) : null;
                          })}
                      </View>
                    ) : null}
                    {selectedItem.item.checklist && selectedItem.item.checklist.length > 0 ? (
                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionTitle}>{safeString(i18nService.t('preparedness.checklist'))}</Text>
                        {(selectedItem.item.checklist || [])
                          .filter((checkItem) => checkItem != null)
                          .map((checkItem, idx) => {
                            const checkItemText = safeString(checkItem);
                            return checkItemText.length > 0 ? (
                              <View key={idx} style={styles.checklistItem}>
                                <Ionicons name="square-outline" size={18} color={colors.text.secondary} />
                                <Text style={styles.checklistText}>{checkItemText}</Text>
                              </View>
                            ) : null;
                          })}
                      </View>
                    ) : null}
                    {selectedItem.item.resources && selectedItem.item.resources.length > 0 ? (
                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionTitle}>{safeString(i18nService.t('preparedness.resources'))}</Text>
                        {(selectedItem.item.resources || [])
                          .filter((resource) => resource != null)
                          .map((resource, idx) => {
                            // ELITE: Resource can be string or object
                            const resourceTitle = typeof resource === 'string' ? resource : (resource?.title || '');
                            const resourceDescription = typeof resource === 'object' && resource != null ? (resource.description || '') : '';
                            const resourceType = typeof resource === 'object' && resource != null ? (resource.type || 'document') : 'document';
                            const resourceTitleText = safeString(resourceTitle);
                            const resourceDescriptionText = safeString(resourceDescription);
                            
                            return resourceTitleText.length > 0 ? (
                              <TouchableOpacity key={resource?.id || idx} style={styles.resourceItem}>
                                <Ionicons
                                  name={resourceType === 'website' ? 'globe' : resourceType === 'video' ? 'videocam' : resourceType === 'app' ? 'phone-portrait' : 'document'}
                                  size={20}
                                  color={colors.accent.primary}
                                />
                                <View style={{ flex: 1, marginLeft: spacing[2] }}>
                                  <Text style={styles.resourceTitle}>{resourceTitleText}</Text>
                                  {resourceDescriptionText.length > 0 ? (
                                    <Text style={styles.resourceDescription}>{resourceDescriptionText}</Text>
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            ) : null;
                          })}
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={styles.completeButton}
                      onPress={() => {
                        toggleItem(selectedItem.section.id, selectedItem.item.id);
                        setSelectedItem(null);
                      }}
                    >
                      <Ionicons
                        name={selectedItem.item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={selectedItem.item.completed ? colors.status.success : '#fff'}
                      />
                      <Text style={styles.completeButtonText}>
                        {selectedItem.item.completed ? safeString(i18nService.t('preparedness.completed')) : safeString(i18nService.t('preparedness.complete'))}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
          <Text style={styles.disclaimerText}>
            {safeString(i18nService.t('preparedness.disclaimer') || 'Bu plan bilgilendirme amaçlıdır. AFAD ve resmi kurumların uyarıları önceliklidir.')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.background.primary,
    zIndex: 10,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  sectionProgressBadge: {
    backgroundColor: colors.background.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionProgressText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  sectionProgressBar: {
    height: 4,
    backgroundColor: colors.background.elevated,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  sectionProgressFill: {
    height: '100%',
    backgroundColor: colors.status.success,
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
  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  criticalText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.emergency.critical,
  },
  filtersContainer: {
    marginBottom: spacing[4],
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 999,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginRight: spacing[2],
  },
  filterChipActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  milestonesSection: {
    marginBottom: spacing[6],
  },
  milestoneCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing[5],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  milestoneDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  milestoneProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  milestoneProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.background.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  milestoneProgressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
  },
  milestoneProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 40,
  },
  milestoneReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  milestoneRewardText: {
    fontSize: 12,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  itemDetailText: {
    fontSize: 11,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: spacing[6],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginRight: spacing[3],
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    flex: 1,
    padding: spacing[5],
  },
  modalSection: {
    marginBottom: spacing[5],
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  modalSectionText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  subTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.background.elevated,
    borderRadius: 8,
    marginBottom: spacing[2],
  },
  subTaskText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  subTaskTextCompleted: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.background.elevated,
    borderRadius: 8,
    marginBottom: spacing[2],
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.background.elevated,
    borderRadius: 12,
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  resourceDescription: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[4],
    backgroundColor: colors.accent.primary,
    borderRadius: 16,
    marginTop: spacing[4],
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
