/**
 * RISK SCORE SCREEN
 * Displays user's earthquake risk score and recommendations
 */

import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { colors, spacing } from '../../theme';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import { RiskLevel, RiskTrend } from '../../ai/types/ai.types';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import { aiAssistantCoordinator } from '../../ai/services/AIAssistantCoordinator';
import { i18nService } from '../../services/I18nService';

const logger = createLogger('RiskScoreScreen');

// ELITE: Güvenli string render helper - Text component hatası önleme
const safeString = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const joined = value.join(', ');
    return joined || '';
  }
  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value);
      return str || '';
    } catch {
      return '';
    }
  }
  try {
    const str = String(value);
    return str || '';
  } catch {
    return '';
  }
};

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
      case 'critical': return i18nService.t('ai.criticalLevel');
      case 'high': return i18nService.t('ai.highRisk');
      case 'medium': return i18nService.t('ai.mediumRisk');
      case 'low': return i18nService.t('ai.lowRisk');
      default: return i18nService.t('common.unknown');
    }
  };

  const getTrendLabel = (trend: RiskTrend) => {
    switch (trend) {
      case 'improving':
        return i18nService.t('ai.improving');
      case 'worsening':
        return i18nService.t('ai.worsening');
      default:
        return i18nService.t('ai.stable');
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
        return i18nService.t('ai.veryHighRisk');
      case 'high':
        return i18nService.t('ai.highRisk');
      case 'medium':
        return i18nService.t('ai.mediumRisk');
      case 'low':
      default:
        return i18nService.t('ai.lowRisk');
    }
  };

  const getDamageLabel = (level: 'minimal' | 'light' | 'moderate' | 'severe' | 'collapse') => {
    switch (level) {
      case 'collapse': return i18nService.t('ai.collapseRisk');
      case 'severe': return i18nService.t('ai.severeDamage');
      case 'moderate': return i18nService.t('ai.moderateDamage');
      case 'light': return i18nService.t('ai.lightDamage');
      case 'minimal': return i18nService.t('ai.minimalDamage');
      default: return i18nService.t('common.unknown');
    }
  };

  const getDamageColor = (level: 'minimal' | 'light' | 'moderate' | 'severe' | 'collapse') => {
    switch (level) {
      case 'collapse': return colors.emergency.critical;
      case 'severe': return colors.emergency.warning;
      case 'moderate': return colors.status.alert;
      case 'light': return colors.status.info;
      case 'minimal': return colors.status.success;
      default: return colors.text.secondary;
    }
  };

  const getUrgencyLabel = (urgency: 'none' | 'low' | 'medium' | 'high' | 'critical') => {
    switch (urgency) {
      case 'critical': return 'Kritik';
      case 'high': return 'Yüksek';
      case 'medium': return 'Orta';
      case 'low': return 'Düşük';
      case 'none': return 'Gerek Yok';
      default: return 'Bilinmiyor';
    }
  };

  const getUrgencyColor = (urgency: 'none' | 'low' | 'medium' | 'high' | 'critical') => {
    switch (urgency) {
      case 'critical': return colors.emergency.critical;
      case 'high': return colors.emergency.warning;
      case 'medium': return colors.status.alert;
      case 'low': return colors.status.info;
      case 'none': return colors.status.success;
      default: return colors.text.secondary;
    }
  };

  const getDifficultyLabel = (difficulty: 'easy' | 'moderate' | 'difficult' | 'critical') => {
    switch (difficulty) {
      case 'critical': return 'Kritik';
      case 'difficult': return 'Zor';
      case 'moderate': return 'Orta';
      case 'easy': return 'Kolay';
      default: return 'Bilinmiyor';
    }
  };

  const getDifficultyColor = (difficulty: 'easy' | 'moderate' | 'difficult' | 'critical') => {
    switch (difficulty) {
      case 'critical': return colors.emergency.critical;
      case 'difficult': return colors.emergency.warning;
      case 'moderate': return colors.status.alert;
      case 'easy': return colors.status.success;
      default: return colors.text.secondary;
    }
  };

  const getRiskLevelLabel = (risk: 'none' | 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'high': return 'Yüksek';
      case 'medium': return 'Orta';
      case 'low': return 'Düşük';
      case 'none': return 'Yok';
      default: return 'Bilinmiyor';
    }
  };

  const getRiskLevelColor = (risk: 'none' | 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'high': return colors.emergency.warning;
      case 'medium': return colors.status.alert;
      case 'low': return colors.status.info;
      case 'none': return colors.status.success;
      default: return colors.text.secondary;
    }
  };

  const getReadinessLabel = (readiness: 'excellent' | 'good' | 'fair' | 'poor') => {
    switch (readiness) {
      case 'excellent': return 'Mükemmel';
      case 'good': return 'İyi';
      case 'fair': return 'Orta';
      case 'poor': return 'Zayıf';
      default: return 'Bilinmiyor';
    }
  };

  const getReadinessColor = (readiness: 'excellent' | 'good' | 'fair' | 'poor') => {
    switch (readiness) {
      case 'excellent': return colors.status.success;
      case 'good': return colors.status.info;
      case 'fair': return colors.status.alert;
      case 'poor': return colors.emergency.warning;
      default: return colors.text.secondary;
    }
  };

  if (riskScoreLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={styles.loadingText}>{safeString(i18nService.t('ai.riskScoreLoading') || 'Risk skoru hesaplanıyor...')}</Text>
      </View>
    );
  }

  if (!riskScore) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="analytics-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>{safeString(i18nService.t('ai.riskScoreNotFound') || 'Risk skoru bulunamadı')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshRiskScore}>
          <Text style={styles.retryButtonText}>{safeString(i18nService.t('common.retry') || 'Tekrar Dene')}</Text>
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
        <Text style={styles.headerTitle}>{safeString(i18nService.t('ai.riskScore'))}</Text>
        <View style={styles.headerRight} />
      </View>

    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {/* Risk Skoru */}
      <LinearGradient
        colors={['#1a1f2e', '#141824']}
        style={styles.scoreCard}
      >
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreTitle}>{safeString(i18nService.t('ai.riskScoreTitle'))}</Text>
          <View style={[styles.scoreBadge, { backgroundColor: getRiskColor(riskScore.level) }]}>
            <Text style={styles.scoreBadgeText}>{safeString(getRiskLabel(riskScore.level))}</Text>
          </View>
        </View>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreValue}>{safeString(riskScore.score)}</Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>
        <Text style={styles.scoreDescription}>
          {safeString(i18nService.t('ai.lastUpdate'))}: {safeString(new Date(riskScore.lastUpdated).toLocaleString('tr-TR'))}
        </Text>
        <View style={styles.scoreMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="trending-up" size={16} color={colors.accent.primary} />
            <Text style={styles.metaPillText}>{safeString(i18nService.t('ai.trend'))}: {safeString(getTrendLabel(riskScore.trend))}</Text>
          </View>
          {typeof riskScore.aftershockProbability === 'number' && (
            <View style={styles.metaPill}>
              <Ionicons name="pulse" size={16} color={colors.emergency.warning} />
              <Text style={styles.metaPillText}>
                {safeString(i18nService.t('ai.aftershockProbability'))} %{safeString(riskScore.aftershockProbability)}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Regional Summary */}
      {riskScore.regionalSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.regionalStatus') || 'Bölgesel Durum')}</Text>
          <View style={styles.regionCard}>
            <View style={styles.regionHeader}>
              <View style={styles.regionBadge}>
                <Ionicons name="earth" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.regionTitle}>{safeString(riskScore.regionalSummary.regionName)}</Text>
                <Text style={styles.regionSubtitle}>
                  {safeString(getHazardLevelLabel(riskScore.regionalSummary.hazardLevel))}
                </Text>
              </View>
            </View>
            <Text style={styles.regionDescription}>{safeString(riskScore.regionalSummary.description)}</Text>
            <View style={styles.regionMetaRow}>
              {typeof riskScore.regionalSummary.distanceKm === 'number' && (
                <View style={styles.regionMetaPill}>
                  <Ionicons name="navigate" size={14} color={colors.accent.primary} />
                  <Text style={styles.regionMetaText}>
                    Merkez mesafesi {safeString(riskScore.regionalSummary.distanceKm.toFixed(0))} km
                  </Text>
                </View>
              )}
              {!!riskScore.regionalSummary.criticalInfrastructure?.length && (
                <View style={styles.regionMetaPill}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.status.info} />
                  <Text style={styles.regionMetaText}>
                    Kritik noktalar: {safeString(riskScore.regionalSummary.criticalInfrastructure.slice(0, 2).join(', '))}
                  </Text>
                </View>
              )}
            </View>
            {!!riskScore.regionalSummary.historicalEvents?.length && (
              <View style={styles.historyContainer}>
                <Text style={styles.historyTitle}>Önemli depremler</Text>
                {riskScore.regionalSummary.historicalEvents.slice(0, 3).map((event, idx) => (
                  <View key={idx} style={styles.historyItem}>
                    <Ionicons name="time" size={14} color={colors.text.secondary} />
                    <Text style={styles.historyText}>
                      {safeString(event.year)} • M{safeString(event.magnitude)} • {safeString(event.note)}
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
        <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.riskFactors') || 'Risk Faktorleri')}</Text>
        {riskScore.factors.map((factor) => (
          <View key={factor.id} style={styles.factorCard}>
            <View style={styles.factorHeader}>
              <Text style={styles.factorName}>{safeString(factor.name)}</Text>
              <Text style={styles.factorValue}>{safeString(factor.value)}%</Text>
            </View>
            <Text style={styles.factorDescription}>{safeString(factor.description)}</Text>
            {factor.severity && (
              <View style={styles.factorSeverity}>
                <View style={[styles.severityDot, { backgroundColor: getSeverityColor(factor.severity) }]} />
                <Text style={[styles.factorSeverityText, { color: getSeverityColor(factor.severity) }]}>
                  {safeString(getRiskLabel(factor.severity))} seviye
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
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.analysisSummary') || 'Analiz Ozeti')}</Text>
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
                <Text style={styles.insightTitle}>{safeString(insight.title)}</Text>
              </View>
              <Text style={styles.insightDescription}>{safeString(insight.description)}</Text>
              {!!insight.actions?.length && (
                <View style={styles.insightActions}>
                  {insight.actions.slice(0, 3).map((action, idx) => (
                    <View key={idx} style={styles.insightActionPill}>
                      <Ionicons name="checkmark" size={12} color={colors.status.success} />
                      <Text style={styles.insightActionText}>{safeString(action)}</Text>
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
        <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.recommendations') || 'Öneriler')}</Text>
        {riskScore.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
            <Text style={styles.recommendationText}>{safeString(rec)}</Text>
          </View>
        ))}
      </View>

      {/* Checklist */}
      {!!riskScore.checklist?.length && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.priorityTasks') || 'Öncelikli Yapılacaklar')}</Text>
          {riskScore.checklist.map((item, idx) => (
            <View key={idx} style={styles.checklistCard}>
              <Ionicons name="square-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.checklistText}>{safeString(item)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Detaylı Bina Analizi */}
      {riskScore.buildingAnalysis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.buildingAnalysis') || 'Bina Analizi')}</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Yapısal Bütünlük</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.buildingAnalysis.structuralIntegrity)}/100</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Yaş Riski</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.buildingAnalysis.ageRisk)}/100</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kat Riski</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.buildingAnalysis.floorRisk)}/100</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Zemin Riski</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.buildingAnalysis.soilRisk)}/100</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tahmini Hasar</Text>
              <Text style={[styles.detailValue, { color: getDamageColor(riskScore.buildingAnalysis.estimatedDamageLevel) }]}>
                {safeString(getDamageLabel(riskScore.buildingAnalysis.estimatedDamageLevel))}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Güçlendirme Aciliyeti</Text>
              <Text style={[styles.detailValue, { color: getUrgencyColor(riskScore.buildingAnalysis.retrofitUrgency) }]}>
                {safeString(getUrgencyLabel(riskScore.buildingAnalysis.retrofitUrgency))}
              </Text>
            </View>
            {riskScore.buildingAnalysis.vulnerabilities.length > 0 && (
              <View style={styles.vulnerabilitiesContainer}>
                <Text style={styles.vulnerabilitiesTitle}>Zayıflıklar</Text>
                {riskScore.buildingAnalysis.vulnerabilities.map((v, idx) => (
                  <View key={idx} style={styles.vulnerabilityItem}>
                    <Ionicons name="warning" size={14} color={colors.emergency.warning} />
                    <Text style={styles.vulnerabilityText}>{safeString(v)}</Text>
                  </View>
                ))}
              </View>
            )}
            {riskScore.buildingAnalysis.strengths.length > 0 && (
              <View style={styles.strengthsContainer}>
                <Text style={styles.strengthsTitle}>Güçlü Yönler</Text>
                {riskScore.buildingAnalysis.strengths.map((s, idx) => (
                  <View key={idx} style={styles.strengthItem}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
                    <Text style={styles.strengthText}>{safeString(s)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Aile Profili */}
      {riskScore.familyProfile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.familyProfile') || 'Aile Profili')}</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Toplam Üye</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.familyProfile.totalMembers)} kişi</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Çocuk Sayısı</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.familyProfile.childrenCount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Yaşlı Sayısı</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.familyProfile.elderlyCount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tahliye Zorluğu</Text>
              <Text style={[styles.detailValue, { color: getDifficultyColor(riskScore.familyProfile.evacuationDifficulty) }]}>
                {safeString(getDifficultyLabel(riskScore.familyProfile.evacuationDifficulty))}
              </Text>
            </View>
            {riskScore.familyProfile.specialConsiderations.length > 0 && (
              <View style={styles.considerationsContainer}>
                <Text style={styles.considerationsTitle}>Özel Dikkat Gerekenler</Text>
                {riskScore.familyProfile.specialConsiderations.map((c, idx) => (
                  <View key={idx} style={styles.considerationItem}>
                    <Ionicons name="information-circle" size={14} color={colors.accent.primary} />
                    <Text style={styles.considerationText}>{safeString(c)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Çevresel Faktörler */}
      {riskScore.environmentalFactors && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.environmentalFactors') || 'Çevresel Faktörler')}</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fay Yakınlığı</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.environmentalFactors.proximityToFault.toFixed(1))} km</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Zemin Sıvılaşması</Text>
              <Text style={[styles.detailValue, { color: getRiskLevelColor(riskScore.environmentalFactors.soilLiquefactionRisk) }]}>
                {safeString(getRiskLevelLabel(riskScore.environmentalFactors.soilLiquefactionRisk))}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Heyelan Riski</Text>
              <Text style={[styles.detailValue, { color: getRiskLevelColor(riskScore.environmentalFactors.landslideRisk) }]}>
                {safeString(getRiskLevelLabel(riskScore.environmentalFactors.landslideRisk))}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Yangın Riski</Text>
              <Text style={[styles.detailValue, { color: getRiskLevelColor(riskScore.environmentalFactors.fireRisk) }]}>
                {safeString(getRiskLevelLabel(riskScore.environmentalFactors.fireRisk))}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Genel Çevresel Skor</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.environmentalFactors.overallEnvironmentalScore)}/100</Text>
            </View>
          </View>
        </View>
      )}

      {/* Tahliye Hazırlığı */}
      {riskScore.evacuationReadiness && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.evacuationReadiness') || 'Tahliye Hazırlığı')}</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rota Netliği</Text>
              <Text style={[styles.detailValue, { color: getReadinessColor(riskScore.evacuationReadiness.routeClarity) }]}>
                {safeString(getReadinessLabel(riskScore.evacuationReadiness.routeClarity))}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Alternatif Rotalar</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.evacuationReadiness.alternativeRoutes)} rota</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Toplanma Alanı Mesafesi</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.evacuationReadiness.assemblyPointDistance.toFixed(1))} km</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tahliye Süresi</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.evacuationReadiness.evacuationTimeEstimate)} dakika</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hazırlık Skoru</Text>
              <Text style={styles.detailValue}>{safeString(riskScore.evacuationReadiness.readinessScore)}/100</Text>
            </View>
            {riskScore.evacuationReadiness.obstacles.length > 0 && (
              <View style={styles.obstaclesContainer}>
                <Text style={styles.obstaclesTitle}>Engeller</Text>
                {riskScore.evacuationReadiness.obstacles.map((o, idx) => (
                  <View key={idx} style={styles.obstacleItem}>
                    <Ionicons name="alert-circle" size={14} color={colors.emergency.warning} />
                    <Text style={styles.obstacleText}>{safeString(o)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Azaltma Potansiyeli */}
      {riskScore.mitigationPotential && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.mitigationPotential') || 'Risk Azaltma Potansiyeli')}</Text>
          <View style={styles.mitigationCard}>
            <Text style={styles.mitigationSubtitle}>Hızlı Kazanımlar</Text>
            {riskScore.mitigationPotential.quickWins.map((win, idx) => (
              <View key={idx} style={styles.mitigationItem}>
                <View style={styles.mitigationHeader}>
                  <Text style={styles.mitigationAction}>{safeString(win.action)}</Text>
                  <View style={styles.mitigationImpact}>
                    <Text style={styles.mitigationImpactText}>-{safeString(win.impact)} puan</Text>
                  </View>
                </View>
                <View style={styles.mitigationMeta}>
                  <View style={styles.mitigationMetaPill}>
                    <Text style={styles.mitigationMetaText}>{safeString(win.timeframe)}</Text>
                  </View>
                  <View style={styles.mitigationMetaPill}>
                    <Text style={styles.mitigationMetaText}>{safeString(win.cost === 'free' ? 'Ücretsiz' : win.cost === 'low' ? 'Düşük' : win.cost === 'medium' ? 'Orta' : 'Yüksek')}</Text>
                  </View>
                </View>
              </View>
            ))}
            {riskScore.mitigationPotential.longTermImprovements.length > 0 && (
              <>
                <Text style={[styles.mitigationSubtitle, { marginTop: spacing[4] }]}>Uzun Vadeli İyileştirmeler</Text>
                {riskScore.mitigationPotential.longTermImprovements.map((improvement, idx) => (
                  <View key={idx} style={styles.mitigationItem}>
                    <View style={styles.mitigationHeader}>
                      <Text style={styles.mitigationAction}>{safeString(improvement.action)}</Text>
                      <View style={styles.mitigationImpact}>
                        <Text style={styles.mitigationImpactText}>-{safeString(improvement.impact)} puan</Text>
                      </View>
                    </View>
                    <View style={styles.mitigationMeta}>
                      <View style={styles.mitigationMetaPill}>
                        <Text style={styles.mitigationMetaText}>{safeString(improvement.timeframe)}</Text>
                      </View>
                      <View style={styles.mitigationMetaPill}>
                        <Text style={styles.mitigationMetaText}>{safeString(improvement.cost === 'free' ? 'Ücretsiz' : improvement.cost === 'low' ? 'Düşük' : improvement.cost === 'medium' ? 'Orta' : 'Yüksek')}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
            <View style={styles.maxPotentialContainer}>
              <Text style={styles.maxPotentialText}>
                Maksimum potansiyel risk azaltma: <Text style={styles.maxPotentialValue}>-{safeString(riskScore.mitigationPotential.maxPotentialReduction)} puan</Text>
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Hayatta Kalma Olasılığı ve Süre */}
      {(typeof riskScore.survivalProbability === 'number' || typeof riskScore.timeToSafety === 'number') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{safeString(i18nService.t('ai.survivalAnalysis') || 'Hayatta Kalma Analizi')}</Text>
          <View style={styles.survivalCard}>
            {typeof riskScore.survivalProbability === 'number' && (
              <View style={styles.survivalItem}>
                <Ionicons name="shield-checkmark" size={24} color={colors.status.success} />
                <View style={styles.survivalContent}>
                  <Text style={styles.survivalLabel}>Hayatta Kalma Olasılığı</Text>
                  <Text style={styles.survivalValue}>%{safeString(riskScore.survivalProbability)}</Text>
                </View>
              </View>
            )}
            {typeof riskScore.timeToSafety === 'number' && (
              <View style={styles.survivalItem}>
                <Ionicons name="time" size={24} color={colors.accent.primary} />
                <View style={styles.survivalContent}>
                  <Text style={styles.survivalLabel}>Güvenli Bölgeye Ulaşım Süresi</Text>
                  <Text style={styles.survivalValue}>{safeString(riskScore.timeToSafety)} dakika</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
        <Text style={styles.disclaimerText}>
          Bu risk skoru bilgilendirme amaçlıdır. AFAD ve resmi kurumların uyarıları önceliklidir.
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
  detailCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '700',
  },
  vulnerabilitiesContainer: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    gap: spacing[2],
  },
  vulnerabilitiesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.emergency.warning,
    marginBottom: spacing[1],
  },
  vulnerabilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  vulnerabilityText: {
    fontSize: 12,
    color: colors.text.primary,
    flex: 1,
  },
  strengthsContainer: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    gap: spacing[2],
  },
  strengthsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.status.success,
    marginBottom: spacing[1],
  },
  strengthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  strengthText: {
    fontSize: 12,
    color: colors.text.primary,
    flex: 1,
  },
  considerationsContainer: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    gap: spacing[2],
  },
  considerationsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent.primary,
    marginBottom: spacing[1],
  },
  considerationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  considerationText: {
    fontSize: 12,
    color: colors.text.primary,
    flex: 1,
  },
  obstaclesContainer: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    gap: spacing[2],
  },
  obstaclesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.emergency.warning,
    marginBottom: spacing[1],
  },
  obstacleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  obstacleText: {
    fontSize: 12,
    color: colors.text.primary,
    flex: 1,
  },
  mitigationCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[3],
  },
  mitigationSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  mitigationItem: {
    padding: spacing[4],
    backgroundColor: colors.background.elevated,
    borderRadius: 12,
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  mitigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  mitigationAction: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: spacing[2],
  },
  mitigationImpact: {
    backgroundColor: colors.status.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mitigationImpactText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  mitigationMeta: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  mitigationMetaPill: {
    backgroundColor: colors.background.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mitigationMetaText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  maxPotentialContainer: {
    marginTop: spacing[4],
    padding: spacing[4],
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  maxPotentialText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  maxPotentialValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  survivalCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[4],
  },
  survivalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[4],
    backgroundColor: colors.background.elevated,
    borderRadius: 12,
  },
  survivalContent: {
    flex: 1,
  },
  survivalLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  survivalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
});

