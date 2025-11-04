/**
 * PREPAREDNESS PLAN SCREEN
 * Displays personalized disaster preparedness plan
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import { preparednessPlanService } from '../../ai/services/PreparednessPlanService';
import * as haptics from '../../utils/haptics';

export default function PreparednessPlanScreen() {
  const { preparednessPlan, preparednessPlanLoading } = useAIAssistantStore();

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    try {
      useAIAssistantStore.getState().setPreparednessPlanLoading(true);
      const plan = await preparednessPlanService.generatePlan({});
      useAIAssistantStore.getState().setPreparednessPlan(plan);
      haptics.impactLight();
    } catch (error) {
      console.error('Failed to load plan:', error);
      useAIAssistantStore.getState().setPreparednessPlanError('Plan yuklenemedi');
    }
  };

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
        <TouchableOpacity style={styles.retryButton} onPress={loadPlan}>
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
      </LinearGradient>

      {/* Sections */}
      {preparednessPlan.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(section.priority) }]}>
              <Text style={styles.priorityText}>{section.priority === 'high' ? 'Yuksek' : section.priority === 'medium' ? 'Orta' : 'Dusuk'}</Text>
            </View>
          </View>
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
              <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]}>
                {item.text}
              </Text>
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

