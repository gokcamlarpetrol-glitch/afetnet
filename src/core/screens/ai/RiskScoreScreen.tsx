/**
 * RISK SCORE SCREEN
 * Displays user's earthquake risk score and recommendations
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import { riskScoringService } from '../../ai/services/RiskScoringService';
import { RiskLevel } from '../../ai/types/ai.types';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('RiskScoreScreen');
const LOAD_TIMEOUT = 5000; // 5 seconds

export default function RiskScoreScreen() {
  const { riskScore, riskScoreLoading } = useAIAssistantStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRiskScore();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const loadRiskScore = async () => {
    try {
      useAIAssistantStore.getState().setRiskScoreLoading(true);
      
      // Timeout ekle - 5 saniye sonra fallback'e geç
      timeoutRef.current = setTimeout(() => {
        logger.warn('Risk score loading timeout, using fallback');
        useAIAssistantStore.getState().setRiskScoreLoading(false);
      }, LOAD_TIMEOUT);
      
      const score = await riskScoringService.calculateRiskScore({});
      
      // Timeout'u iptal et
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      useAIAssistantStore.getState().setRiskScore(score);
      haptics.impactLight();
    } catch (error) {
      logger.error('Failed to load risk score:', error);
      useAIAssistantStore.getState().setRiskScoreError('Risk skoru yuklenemedi');
    } finally {
      // Her durumda loading'i kapat
      useAIAssistantStore.getState().setRiskScoreLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case 'critical': return colors.emergency.critical;
      case 'high': return colors.emergency.warning;
      case 'medium': return colors.status.alert;
      case 'low': return colors.status.success;
      default: return colors.text.secondary;
    }
  };

  const getRiskLabel = (level: RiskLevel) => {
    switch (level) {
      case 'critical': return 'Kritik';
      case 'high': return 'Yuksek';
      case 'medium': return 'Orta';
      case 'low': return 'Dusuk';
      default: return 'Bilinmiyor';
    }
  };

  if (riskScoreLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={styles.loadingText}>Risk skoru hesaplaniyor...</Text>
      </View>
    );
  }

  if (!riskScore) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="analytics-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>Risk skoru bulunamadi</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRiskScore}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Risk Skoru */}
      <LinearGradient
        colors={['#1a1f2e', '#141824']}
        style={styles.scoreCard}
      >
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreTitle}>Risk Skorunuz</Text>
          <View style={[styles.scoreBadge, { backgroundColor: getRiskColor(riskScore.level) }]}>
            <Text style={styles.scoreBadgeText}>{getRiskLabel(riskScore.level)}</Text>
          </View>
        </View>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreValue}>{riskScore.score}</Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>
        <Text style={styles.scoreDescription}>
          Son guncelleme: {new Date(riskScore.lastUpdated).toLocaleString('tr-TR')}
        </Text>
      </LinearGradient>

      {/* Risk Faktorleri */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk Faktorleri</Text>
        {riskScore.factors.map((factor) => (
          <View key={factor.id} style={styles.factorCard}>
            <View style={styles.factorHeader}>
              <Text style={styles.factorName}>{factor.name}</Text>
              <Text style={styles.factorValue}>{factor.value}%</Text>
            </View>
            <Text style={styles.factorDescription}>{factor.description}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${factor.value}%`, backgroundColor: getRiskColor(riskScore.level) }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Oneriler */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Oneriler</Text>
        {riskScore.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
            <Text style={styles.recommendationText}>{rec}</Text>
          </View>
        ))}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
        <Text style={styles.disclaimerText}>
          Bu risk skoru bilgilendirme amaclidir. AFAD ve resmi kurumlarin uyarilari onceliklidir.
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
  scoreCard: {
    borderRadius: 20,
    padding: spacing[8],
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 8,
    borderColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scoreMax: {
    fontSize: 18,
    color: colors.text.secondary,
  },
  scoreDescription: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  section: {
    marginBottom: spacing[8],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  factorCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  factorValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  factorDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: spacing[3],
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.background.elevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
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

