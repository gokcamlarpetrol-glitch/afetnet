/**
 * RISK SCORE SCREEN
 * Displays user's earthquake risk score and recommendations
 */

import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import { RiskLevel, RiskTrend } from '../../ai/types/ai.types';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import { aiAssistantCoordinator } from '../../ai/services/AIAssistantCoordinator';

const logger = createLogger('RiskScoreScreen');

export default function RiskScoreScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { riskScore, riskScoreLoading } = useAIAssistantStore();

  useEffect(() => {
    aiAssistantCoordinator.ensureRiskScore().catch((error) => {
      logger.error('Risk score preload failed:', error);
    });
  }, []);

  const refreshRiskScore = useCallback(async () => {
    try {
      await aiAssistantCoordinator.ensureRiskScore(true);
      haptics.impactLight();
    } catch (error) {
      logger.error('Risk score refresh failed:', error);
    }
  }, []);

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

  const getTrendLabel = (trend: RiskTrend) => {
    switch (trend) {
      case 'improving':
        return 'İyileşiyor';
      case 'worsening':
        return 'Artıyor';
      default:
        return 'Stabil';
    }
  };

  const getSeverityColor = (severity?: RiskLevel) => {
    if (!severity) return colors.text.secondary;
    switch (severity) {
      case 'critical':
        return colors.emergency.critical;
      case 'high':
        return colors.emergency.warning;
      case 'medium':
        return colors.status.alert;
      case 'low':
      default:
        return colors.status.success;
    }
  };

  const getHazardLevelLabel = (hazardLevel: 'very_high' | 'high' | 'medium' | 'low') => {
    switch (hazardLevel) {
      case 'very_high':
        return 'Çok Yüksek Risk';
      case 'high':
        return 'Yüksek Risk';
      case 'medium':
        return 'Orta Risk';
      case 'low':
      default:
        return 'Düşük Risk';
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
        <TouchableOpacity style={styles.retryButton} onPress={refreshRiskScore}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Risk Skoru</Text>
        <View style={styles.headerRight} />
      </View>

    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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
        <View style={styles.scoreMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="trending-up" size={16} color={colors.accent.primary} />
            <Text style={styles.metaPillText}>Trend: {getTrendLabel(riskScore.trend)}</Text>
          </View>
          {typeof riskScore.aftershockProbability === 'number' && (
            <View style={styles.metaPill}>
              <Ionicons name="pulse" size={16} color={colors.emergency.warning} />
              <Text style={styles.metaPillText}>
                Artci Olasiligi %{riskScore.aftershockProbability}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Regional Summary */}
      {riskScore.regionalSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bolgesel Durum</Text>
          <View style={styles.regionCard}>
            <View style={styles.regionHeader}>
              <View style={styles.regionBadge}>
                <Ionicons name="earth" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.regionTitle}>{riskScore.regionalSummary.regionName}</Text>
                <Text style={styles.regionSubtitle}>
                  {getHazardLevelLabel(riskScore.regionalSummary.hazardLevel)}
                </Text>
              </View>
            </View>
            <Text style={styles.regionDescription}>{riskScore.regionalSummary.description}</Text>
            <View style={styles.regionMetaRow}>
              {typeof riskScore.regionalSummary.distanceKm === 'number' && (
                <View style={styles.regionMetaPill}>
                  <Ionicons name="navigate" size={14} color={colors.accent.primary} />
                  <Text style={styles.regionMetaText}>
                    Merkez mesafesi {riskScore.regionalSummary.distanceKm.toFixed(0)} km
                  </Text>
                </View>
              )}
              {!!riskScore.regionalSummary.criticalInfrastructure?.length && (
                <View style={styles.regionMetaPill}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.status.info} />
                  <Text style={styles.regionMetaText}>
                    Kritik noktalar: {riskScore.regionalSummary.criticalInfrastructure.slice(0, 2).join(', ')}
                  </Text>
                </View>
              )}
            </View>
            {!!riskScore.regionalSummary.historicalEvents?.length && (
              <View style={styles.historyContainer}>
                <Text style={styles.historyTitle}>Onemli depremler</Text>
                {riskScore.regionalSummary.historicalEvents.slice(0, 3).map((event, idx) => (
                  <View key={idx} style={styles.historyItem}>
                    <Ionicons name="time" size={14} color={colors.text.secondary} />
                    <Text style={styles.historyText}>
                      {event.year} • M{event.magnitude} • {event.note}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

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
            {factor.severity && (
              <View style={styles.factorSeverity}>
                <View style={[styles.severityDot, { backgroundColor: getSeverityColor(factor.severity) }]} />
                <Text style={[styles.factorSeverityText, { color: getSeverityColor(factor.severity) }]}>
                  {getRiskLabel(factor.severity)} seviye
                </Text>
              </View>
            )}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${factor.value}%`, backgroundColor: getRiskColor(riskScore.level) }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Insights */}
      {!!riskScore.insights?.length && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analiz Ozeti</Text>
          {riskScore.insights.map((insight) => (
            <View key={insight.id} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <View style={[styles.insightBadge, { backgroundColor: getSeverityColor(insight.severity === 'critical' ? 'critical' : insight.severity === 'warning' ? 'high' : 'low') }]}>
                  <Ionicons
                    name={insight.severity === 'critical' ? 'alert-circle' : insight.severity === 'warning' ? 'warning' : 'information-circle'}
                    size={16}
                    color="#fff"
                  />
                </View>
                <Text style={styles.insightTitle}>{insight.title}</Text>
              </View>
              <Text style={styles.insightDescription}>{insight.description}</Text>
              {!!insight.actions?.length && (
                <View style={styles.insightActions}>
                  {insight.actions.slice(0, 3).map((action, idx) => (
                    <View key={idx} style={styles.insightActionPill}>
                      <Ionicons name="checkmark" size={12} color={colors.status.success} />
                      <Text style={styles.insightActionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

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

      {/* Checklist */}
      {!!riskScore.checklist?.length && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Oncelikli Yapilacaklar</Text>
          {riskScore.checklist.map((item, idx) => (
            <View key={idx} style={styles.checklistCard}>
              <Ionicons name="square-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.checklistText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
        <Text style={styles.disclaimerText}>
          Bu risk skoru bilgilendirme amaclidir. AFAD ve resmi kurumlarin uyarilari onceliklidir.
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
  scoreMetaRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaPillText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '600',
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
  factorSeverity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  factorSeverityText: {
    fontSize: 11,
    fontWeight: '600',
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
  regionCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[3],
  },
  regionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  regionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  regionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  regionSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  regionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.primary,
  },
  regionMetaRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  regionMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background.elevated,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  regionMetaText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  historyContainer: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  historyText: {
    fontSize: 11,
    color: colors.text.tertiary,
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
  insightCard: {
    backgroundColor: colors.background.card,
    borderRadius: 14,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing[3],
    gap: spacing[3],
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  insightBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  insightDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.primary,
  },
  insightActions: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  insightActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  insightActionText: {
    fontSize: 11,
    color: colors.status.success,
    fontWeight: '600',
  },
  checklistCard: {
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
  checklistText: {
    flex: 1,
    fontSize: 13,
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

