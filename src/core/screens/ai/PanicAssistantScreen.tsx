/**
 * PANIC ASSISTANT SCREEN
 * Provides emergency actions during disasters
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable, StatusBar, Modal, Dimensions, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { colors, spacing } from '../../theme';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import { aiAssistantCoordinator } from '../../ai/services/AIAssistantCoordinator';
import { EmergencyAction } from '../../ai/types/ai.types';

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getWarningLevelColor = (level?: 'info' | 'warning' | 'critical' | 'emergency'): string => {
  switch (level) {
    case 'emergency':
      return '#dc2626';
    case 'critical':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'info':
    default:
      return '#3b82f6';
  }
};

const getWarningLevelIcon = (level?: 'info' | 'warning' | 'critical' | 'emergency'): string => {
  switch (level) {
    case 'emergency':
      return 'alert-circle';
    case 'critical':
      return 'warning';
    case 'warning':
      return 'alert';
    case 'info':
    default:
      return 'information-circle';
  }
};

export default function PanicAssistantScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { panicAssistant, panicAssistantLoading } = useAIAssistantStore();
  const [selectedAction, setSelectedAction] = useState<EmergencyAction | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    aiAssistantCoordinator.ensurePanicAssistant('earthquake').catch((error) => {
      if (isMounted) {
        logger.error('Panic assistant preload failed:', error);
      }
    });
    
    return () => {
      isMounted = false;
    };
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
      action.id === actionId ? { ...action, completed: !action.completed, completedAt: !action.completed ? Date.now() : undefined } : action
    );

    const completedCount = updatedActions.filter(a => a.completed).length;
    const totalCount = updatedActions.length;
    const criticalRemaining = updatedActions.filter(a => !a.completed && (a.warningLevel === 'critical' || a.warningLevel === 'emergency')).length;

    useAIAssistantStore.getState().setPanicAssistant({
      ...panicAssistant,
      actions: updatedActions,
      lastUpdate: Date.now(),
      completedActionsCount: completedCount,
      totalActionsCount: totalCount,
      progressPercentage: Math.round((completedCount / totalCount) * 100),
      criticalActionsRemaining: criticalRemaining,
      lastActionCompletedAt: updatedActions.find(a => a.id === actionId && a.completed)?.completedAt,
    });

    haptics.impactMedium();
  };

  const toggleStep = (actionId: string, stepId: string) => {
    if (!panicAssistant) return;
    
    const updatedActions = panicAssistant.actions.map(action => {
      if (action.id === actionId && action.stepByStepGuide) {
        const updatedSteps = action.stepByStepGuide.map(step =>
          step.id === stepId ? { ...step, completed: !step.completed } : step
        );
        const completedSteps = updatedSteps.filter(s => s.completed).length;
        const progress = Math.round((completedSteps / updatedSteps.length) * 100);
        return { ...action, stepByStepGuide: updatedSteps, progress };
      }
      return action;
    });

    useAIAssistantStore.getState().setPanicAssistant({
      ...panicAssistant,
      actions: updatedActions,
      lastUpdate: Date.now(),
    });

    haptics.impactLight();
  };

  if (panicAssistantLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.emergency.critical} />
        <Text style={styles.loadingText}>Acil durum aksiyonları yükleniyor...</Text>
      </View>
    );
  }

  if (!panicAssistant || panicAssistant.actions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="shield-checkmark-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>Aksiyon bulunamadı</Text>
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
        <Text style={styles.headerTitle}>Afet Rehberi</Text>
        <View style={styles.headerRight} />
      </View>

    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {/* Header */}
      <LinearGradient colors={['#dc2626', '#991b1b']} style={styles.header}>
        <Ionicons name="warning" size={48} color="#fff" />
        <Text style={styles.title}>DEPREM ANI</Text>
        <Text style={styles.subtitle}>Aşağıdaki adımları takip edin</Text>
        {panicAssistant && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${panicAssistant.progressPercentage || 0}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {panicAssistant.completedActionsCount || 0} / {panicAssistant.totalActionsCount || 0} tamamlandı
            </Text>
            {panicAssistant.criticalActionsRemaining > 0 && (
              <View style={styles.criticalBadge}>
                <Ionicons name="alert-circle" size={14} color="#fff" />
                <Text style={styles.criticalText}>
                  {panicAssistant.criticalActionsRemaining} kritik aksiyon kaldı
                </Text>
              </View>
            )}
          </View>
        )}
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
            {group.actions.map((action) => {
              const isExpanded = expandedActionId === action.id;
              const warningColor = getWarningLevelColor(action.warningLevel);
              
              return (
                <View key={action.id} style={styles.actionCardWrapper}>
                  <TouchableOpacity
                    style={[styles.actionCard, action.completed && styles.actionCardCompleted]}
                    onPress={() => {
                      if (action.stepByStepGuide?.length || action.checklist?.length || action.safetyNotes?.length) {
                        setExpandedActionId(isExpanded ? null : action.id);
                        haptics.impactLight();
                      } else {
                        toggleAction(action.id);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={action.completed ? ['#059669', '#047857'] : getPhaseGradient(group.phase)}
                      style={styles.actionGradient}
                    >
                      <View style={styles.actionHeader}>
                        <View style={styles.actionHeaderLeft}>
                          <View style={[styles.priorityBadge, action.timeCritical && styles.priorityBadgeCritical]}>
                            <Text style={styles.priorityText}>{action.priority}</Text>
                          </View>
                          {action.warningLevel && (
                            <View style={[styles.warningBadge, { backgroundColor: warningColor }]}>
                              <Ionicons name={getWarningLevelIcon(action.warningLevel) as any} size={12} color="#fff" />
                            </View>
                          )}
                          {action.timeCritical && (
                            <View style={styles.timeCriticalBadge}>
                              <Ionicons name="time" size={10} color="#fff" />
                              <Text style={styles.timeCriticalText}>ACİL</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.actionHeaderRight}>
                          {action.estimatedRiskReduction && (
                            <View style={styles.riskReductionBadge}>
                              <Text style={styles.riskReductionText}>-%{action.estimatedRiskReduction}</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => toggleAction(action.id)}
                            style={styles.completeButton}
                            hitSlop={8}
                          >
                            <Ionicons
                              name={action.completed ? 'checkmark-circle' : 'ellipse-outline'}
                              size={28}
                              color="#fff"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.actionContent}>
                        <View style={styles.actionIconRow}>
                          <Ionicons
                            name={action.completed ? 'checkmark-circle' : (action.icon as any)}
                            size={24}
                            color="#fff"
                          />
                          <Text style={styles.actionText}>{action.text}</Text>
                        </View>
                        {action.details && (
                          <Text style={styles.actionDetails}>{action.details}</Text>
                        )}
                        {(action.location || action.toolsNeeded?.length) && (
                          <View style={styles.actionInfoRow}>
                            {action.location && (
                              <View style={styles.actionInfoPill}>
                                <Ionicons name="location" size={12} color="#fff" />
                                <Text style={styles.actionInfoText}>{action.location}</Text>
                              </View>
                            )}
                            {action.toolsNeeded?.length && (
                              <View style={styles.actionInfoPill}>
                                <Ionicons name="construct" size={12} color="#fff" />
                                <Text style={styles.actionInfoText}>{action.toolsNeeded.length} araç</Text>
                              </View>
                            )}
                          </View>
                        )}
                        {(action.checklist?.length || action.expectedDurationMinutes || action.progress !== undefined) && (
                          <View style={styles.actionMeta}>
                            {typeof action.expectedDurationMinutes === 'number' && (
                              <View style={styles.actionMetaPill}>
                                <Ionicons name="time" size={12} color="#fff" />
                                <Text style={styles.actionMetaText}>
                                  {action.expectedDurationMinutes} dk
                                </Text>
                              </View>
                            )}
                            {action.progress !== undefined && (
                              <View style={styles.progressBadge}>
                                <Text style={styles.progressText}>%{action.progress}</Text>
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
                        {(action.stepByStepGuide?.length || action.checklist?.length || action.safetyNotes?.length) && (
                          <TouchableOpacity
                            onPress={() => {
                              setExpandedActionId(isExpanded ? null : action.id);
                              haptics.impactLight();
                            }}
                            style={styles.expandButton}
                          >
                            <Text style={styles.expandButtonText}>
                              {isExpanded ? 'Daha Az Göster' : 'Detayları Göster'}
                            </Text>
                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <View style={styles.expandedDetails}>
                      {/* Step by Step Guide */}
                      {action.stepByStepGuide && action.stepByStepGuide.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailSectionTitle}>Adım Adım Rehber</Text>
                          {action.stepByStepGuide.map((step, idx) => (
                            <TouchableOpacity
                              key={step.id}
                              style={[styles.stepItem, step.completed && styles.stepItemCompleted]}
                              onPress={() => toggleStep(action.id, step.id)}
                            >
                              <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>{step.order}</Text>
                              </View>
                              <View style={styles.stepContent}>
                                <Text style={[styles.stepText, step.completed && styles.stepTextCompleted]}>
                                  {step.text}
                                </Text>
                                {step.estimatedSeconds && (
                                  <Text style={styles.stepTime}>~{step.estimatedSeconds} saniye</Text>
                                )}
                                {step.visualCue && (
                                  <Text style={styles.stepVisualCue}>💡 {step.visualCue}</Text>
                                )}
                              </View>
                              <Ionicons
                                name={step.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                size={20}
                                color={step.completed ? '#059669' : '#6b7280'}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Checklist */}
                      {action.checklist && action.checklist.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailSectionTitle}>Kontrol Listesi</Text>
                          {action.checklist.map((item, idx) => (
                            <View key={idx} style={styles.checklistItem}>
                              <Ionicons name="checkmark-circle-outline" size={16} color={colors.text.secondary} />
                              <Text style={styles.checklistItemText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Safety Notes */}
                      {action.safetyNotes && action.safetyNotes.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailSectionTitle}>⚠️ Güvenlik Notları</Text>
                          {action.safetyNotes.map((note, idx) => (
                            <View key={idx} style={styles.safetyNoteItem}>
                              <Ionicons name="warning" size={16} color="#f59e0b" />
                              <Text style={styles.safetyNoteText}>{note}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Common Mistakes */}
                      {action.commonMistakes && action.commonMistakes.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailSectionTitle}>❌ Yaygın Hatalar</Text>
                          {action.commonMistakes.map((mistake, idx) => (
                            <View key={idx} style={styles.mistakeItem}>
                              <Ionicons name="close-circle" size={16} color="#ef4444" />
                              <Text style={styles.mistakeText}>{mistake}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Success Criteria */}
                      {action.successCriteria && action.successCriteria.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailSectionTitle}>✅ Başarı Kriterleri</Text>
                          {action.successCriteria.map((criterion, idx) => (
                            <View key={idx} style={styles.criterionItem}>
                              <Ionicons name="checkmark-circle" size={16} color="#059669" />
                              <Text style={styles.criterionText}>{criterion}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Tools Needed */}
                      {action.toolsNeeded && action.toolsNeeded.length > 0 && (
                        <View style={styles.detailSection}>
                          <Text style={styles.detailSectionTitle}>🔧 Gerekli Araçlar</Text>
                          <View style={styles.toolsContainer}>
                            {action.toolsNeeded.map((tool, idx) => (
                              <View key={idx} style={styles.toolPill}>
                                <Text style={styles.toolText}>{tool}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Emergency Number */}
                      {action.emergencyNumber && (
                        <TouchableOpacity 
                          style={styles.emergencyButton}
                          onPress={() => {
                            haptics.impactHeavy();
                            Linking.openURL(`tel:${action.emergencyNumber}`).catch(() => {
                              Alert.alert('Hata', `${action.emergencyNumber} numarası aranamadı`);
                            });
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="call" size={20} color="#fff" />
                          <Text style={styles.emergencyButtonText}>{action.emergencyNumber}'yi Ara</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Emergency Contacts */}
      <View style={styles.contactsSection}>
        <Text style={styles.sectionTitle}>Acil Durum Numaraları</Text>
        <View style={styles.contactsGrid}>
          <TouchableOpacity 
            style={styles.contactCard}
            onPress={() => {
              haptics.impactMedium();
              Linking.openURL('tel:112').catch(() => {
                Alert.alert('Hata', '112 numarası aranamadı');
              });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={24} color={colors.emergency.critical} />
            <Text style={styles.contactNumber}>112</Text>
            <Text style={styles.contactLabel}>Acil Yardım</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.contactCard}
            onPress={() => {
              haptics.impactMedium();
              Linking.openURL('tel:110').catch(() => {
                Alert.alert('Hata', '110 numarası aranamadı');
              });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="medkit" size={24} color={colors.status.info} />
            <Text style={styles.contactNumber}>110</Text>
            <Text style={styles.contactLabel}>İtfaiye</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.contactCard}
            onPress={() => {
              haptics.impactMedium();
              Linking.openURL('tel:155').catch(() => {
                Alert.alert('Hata', '155 numarası aranamadı');
              });
            }}
            activeOpacity={0.8}
          >
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
          Acil durumda önce kendi güvenliğinizi sağlayın. AFAD ve resmi kurumların uyarıları önceliklidir.
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
  // Yeni stiller
  progressContainer: {
    width: '100%',
    marginTop: spacing[4],
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '600',
  },
  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing[2],
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    alignSelf: 'center',
  },
  criticalText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  actionCardWrapper: {
    marginBottom: spacing[3],
  },
  actionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  actionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  priorityBadgeCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderColor: '#fff',
  },
  warningBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeCriticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
  },
  timeCriticalText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
  riskReductionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.3)',
    borderRadius: 8,
  },
  riskReductionText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  completeButton: {
    padding: 4,
  },
  actionContent: {
    gap: spacing[2],
  },
  actionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  actionInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  actionInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
  },
  actionInfoText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  progressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing[2],
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  expandButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  expandedDetails: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing[4],
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  detailSection: {
    marginBottom: spacing[4],
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    marginBottom: spacing[2],
  },
  stepItemCompleted: {
    opacity: 0.7,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
    gap: spacing[1],
  },
  stepText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  stepTime: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  stepVisualCue: {
    fontSize: 11,
    color: colors.accent.primary,
    fontStyle: 'italic',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  checklistItemText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
  safetyNoteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[2],
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    marginBottom: spacing[2],
  },
  safetyNoteText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
  mistakeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[2],
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    marginBottom: spacing[2],
  },
  mistakeText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
  criterionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[2],
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderRadius: 8,
    marginBottom: spacing[2],
  },
  criterionText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
  toolsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  toolPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toolText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '500',
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[4],
    backgroundColor: colors.emergency.critical,
    borderRadius: 12,
    marginTop: spacing[2],
  },
  emergencyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

