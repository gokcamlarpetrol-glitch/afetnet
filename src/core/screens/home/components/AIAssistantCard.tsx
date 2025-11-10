/**
 * AI ASSISTANT CARD - Home Screen Component
 * Provides access to AI features: Risk Score, Preparedness Plan, Panic Assistant
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Alert, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../theme';
import * as haptics from '../../../utils/haptics';
import { useAIAssistantStore } from '../../../ai/stores/aiAssistantStore';
import { aiAssistantCoordinator } from '../../../ai/services/AIAssistantCoordinator';
import { createLogger } from '../../../utils/logger';
import { RiskLevel } from '../../../ai/types/ai.types';

interface Props {
  navigation: any;
}

const logger = createLogger('AIAssistantCard');

const getRiskColor = (level?: RiskLevel) => {
  switch (level) {
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

const getRiskLabel = (level?: RiskLevel) => {
  switch (level) {
    case 'critical':
      return 'Kritik Seviye';
    case 'high':
      return 'Yüksek Risk';
    case 'medium':
      return 'Orta Risk';
    case 'low':
      return 'Düşük Risk';
    default:
      return 'Hazırlanmadı';
  }
};

const formatUpdateTime = (timestamp?: number | null) => {
  if (!timestamp) return 'Veri bekleniyor';
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return 'Az önce';
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.round(diff / (60 * 1000));
    return `${minutes} dk önce`;
  }
  return new Date(timestamp).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AIAssistantCard({ navigation }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [expanded, setExpanded] = useState(false);

  const riskScore = useAIAssistantStore((state) => state.riskScore);
  const riskScoreLoading = useAIAssistantStore((state) => state.riskScoreLoading);
  const riskScoreFetchedAt = useAIAssistantStore((state) => state.riskScoreFetchedAt);
  const preparednessPlan = useAIAssistantStore((state) => state.preparednessPlan);
  const preparednessPlanLoading = useAIAssistantStore((state) => state.preparednessPlanLoading);
  const preparednessPlanFetchedAt = useAIAssistantStore((state) => state.preparednessPlanFetchedAt);
  const panicAssistant = useAIAssistantStore((state) => state.panicAssistant);
  const panicAssistantLoading = useAIAssistantStore((state) => state.panicAssistantLoading);
  const panicAssistantFetchedAt = useAIAssistantStore((state) => state.panicAssistantFetchedAt);

  const anyLoading = riskScoreLoading || preparednessPlanLoading || panicAssistantLoading;

  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      try {
        const state = useAIAssistantStore.getState();
        const tasks: Promise<unknown>[] = [];

        if (!state.riskScore && !state.riskScoreLoading) {
          tasks.push(aiAssistantCoordinator.ensureRiskScore());
        }
        if (!state.preparednessPlan && !state.preparednessPlanLoading) {
          tasks.push(aiAssistantCoordinator.ensurePreparednessPlan());
        }
        if (!state.panicAssistant && !state.panicAssistantLoading) {
          tasks.push(aiAssistantCoordinator.ensurePanicAssistant('earthquake'));
        }

        if (tasks.length === 0) return;
        await Promise.all(tasks);
      } catch (error) {
        if (!cancelled) {
          logger.warn('AI assistant ön yüklemesi kısmen tamamlandı', error);
        }
      }
    };

    preload();

    return () => {
      cancelled = true;
    };
  }, []);

  const riskMetric = useMemo(() => {
    if (riskScore) {
      return {
        value: riskScore.score.toString(),
        suffix: '/100',
        status: getRiskLabel(riskScore.level),
        statusColor: getRiskColor(riskScore.level),
        updated: formatUpdateTime(riskScore.lastUpdated || riskScoreFetchedAt),
      };
    }
    if (riskScoreLoading) {
      return {
        value: '•••',
        suffix: '',
        status: 'Hesaplanıyor',
        statusColor: colors.text.secondary,
        updated: 'İşleniyor',
      };
    }
    return {
      value: '--',
      suffix: '',
      status: 'Hazırlanmadı',
      statusColor: colors.text.secondary,
      updated: 'Veri bekleniyor',
    };
  }, [riskScore, riskScoreLoading, riskScoreFetchedAt]);

  const planMetric = useMemo(() => {
    if (preparednessPlan) {
      const totalItems = preparednessPlan.sections.reduce((acc, section) => acc + section.items.length, 0);
      const completedItems = preparednessPlan.sections.reduce(
        (acc, section) => acc + section.items.filter((item) => item.completed).length,
        0
      );
      const remainingItems = Math.max(0, totalItems - completedItems);
      return {
        value: `${preparednessPlan.completionRate}%`,
        suffix: '',
        status: remainingItems > 0 ? `${remainingItems} adım kaldı` : 'Tüm görevler hazır',
        statusColor: remainingItems > 0 ? colors.status.info : colors.status.success,
        updated: formatUpdateTime(preparednessPlan.updatedAt || preparednessPlanFetchedAt),
      };
    }
    if (preparednessPlanLoading) {
      return {
        value: '•••',
        suffix: '',
        status: 'Oluşturuluyor',
        statusColor: colors.text.secondary,
        updated: 'İşleniyor',
      };
    }
    return {
      value: '--',
      suffix: '',
      status: 'Plan oluştur',
      statusColor: colors.text.secondary,
      updated: 'Veri bekleniyor',
    };
  }, [preparednessPlan, preparednessPlanLoading, preparednessPlanFetchedAt]);

  const panicMetric = useMemo(() => {
    if (panicAssistant) {
      const total = panicAssistant.actions.length;
      const completed = panicAssistant.actions.filter((action) => action.completed).length;
      const percent = total ? Math.round((completed / total) * 100) : 0;
      return {
        value: total ? `${completed}/${total}` : '--',
        suffix: '',
        status: total ? `%${percent} hazır` : 'Aksiyon yükleniyor',
        statusColor: percent >= 75 ? colors.status.success : colors.accent.primary,
        updated: formatUpdateTime(panicAssistant.lastUpdate || panicAssistantFetchedAt),
      };
    }
    if (panicAssistantLoading) {
      return {
        value: '•••',
        suffix: '',
        status: 'Hazırlanıyor',
        statusColor: colors.text.secondary,
        updated: 'İşleniyor',
      };
    }
    return {
      value: '--',
      suffix: '',
      status: 'Hazırlığı başlat',
      statusColor: colors.text.secondary,
      updated: 'Veri bekleniyor',
    };
  }, [panicAssistant, panicAssistantLoading, panicAssistantFetchedAt]);

  const statsData = useMemo(
    () => [
      {
        key: 'risk',
        label: 'Risk Skoru',
        value: riskMetric.value,
        suffix: riskMetric.suffix,
        caption: riskMetric.status,
        updated: riskMetric.updated,
        accent: '#60a5fa',
        background: 'rgba(96, 165, 250, 0.12)',
      },
      {
        key: 'plan',
        label: 'Hazırlık Planı',
        value: planMetric.value,
        suffix: planMetric.suffix,
        caption: planMetric.status,
        updated: planMetric.updated,
        accent: '#34d399',
        background: 'rgba(52, 211, 153, 0.12)',
      },
      {
        key: 'panic',
        label: 'Afet Anı Rehberi',
        value: panicMetric.value,
        suffix: panicMetric.suffix,
        caption: panicMetric.status,
        updated: panicMetric.updated,
        accent: '#f87171',
        background: 'rgba(248, 113, 113, 0.12)',
      },
    ],
    [riskMetric.value, riskMetric.suffix, riskMetric.status, riskMetric.updated, planMetric.value, planMetric.suffix, planMetric.status, planMetric.updated, panicMetric.value, panicMetric.suffix, panicMetric.status, panicMetric.updated]
  );

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const animatePress = () =>
    new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.97,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

  const handlePress = async (screen: 'RiskScore' | 'PreparednessPlan' | 'PanicAssistant') => {
    haptics.impactMedium();
    await animatePress();

    // CRITICAL: AI assistant navigation with timeout and error handling
    try {
      // CRITICAL: Ensure data with timeout (15 seconds per service)
      const ensurePromises: Promise<unknown>[] = [];
      
      if (screen === 'RiskScore') {
        const ensurePromise = aiAssistantCoordinator.ensureRiskScore(true);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RiskScore timeout')), 15000)
        );
        ensurePromises.push(Promise.race([ensurePromise, timeoutPromise]));
      } else if (screen === 'PreparednessPlan') {
        const ensurePromise = aiAssistantCoordinator.ensurePreparednessPlan(true);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PreparednessPlan timeout')), 15000)
        );
        ensurePromises.push(Promise.race([ensurePromise, timeoutPromise]));
      } else {
        const ensurePromise = aiAssistantCoordinator.ensurePanicAssistant('earthquake', true);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PanicAssistant timeout')), 15000)
        );
        ensurePromises.push(Promise.race([ensurePromise, timeoutPromise]));
      }

      // Wait for data preparation (with timeout)
      await Promise.race([
        Promise.all(ensurePromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Overall timeout')), 20000)
        )
      ]);

      // CRITICAL: Navigate with error handling
      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate(screen);
      } else {
        throw new Error('Navigation not available');
      }
    } catch (error: any) {
      logger.error('AI assistant action failed:', error);
      
      // CRITICAL: Still try to navigate even if data loading failed
      // User can see loading state on the detail screen
      try {
        if (navigation && typeof navigation.navigate === 'function') {
          navigation.navigate(screen);
        } else {
          Alert.alert(
            'Navigasyon Hatası',
            'Ekrana geçiş yapılamadı. Lütfen tekrar deneyin.'
          );
        }
      } catch (navError) {
        Alert.alert(
          'AI Asistan servisi',
          'Veri alınırken bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.'
        );
      }
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={['#1a1f2e', '#141824']}
        style={styles.gradient}
      >
        <Pressable
          style={styles.header}
          onPress={toggleExpanded}
          hitSlop={12}
          accessibilityRole="button"
        >
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Ionicons name="sparkles" size={20} color="#60a5fa" />
            </View>
            <View>
              <Text style={styles.title}>AI Asistan</Text>
              <Text style={styles.subtitle}>Hayat kurtaran analiz ve yönlendirme</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Ionicons
              name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={18}
              color={colors.text.secondary}
            />
          </View>
        </Pressable>

        {expanded && (
          <>
            <View style={styles.statsRow}>
              {statsData.map((stat) => (
                <View key={stat.key} style={[styles.statsCard, { backgroundColor: stat.background }]}> 
                  <Text style={styles.statsLabel}>{stat.label}</Text>
                  <View
                    style={[
                      styles.statsValueRow,
                      stat.key !== 'risk' && styles.statsValueRowCompact,
                    ]}
                  >
                    <Text style={[styles.statsValue, { color: stat.accent }]}>{stat.value}</Text>
                    {stat.suffix ? <Text style={[styles.statsSuffix, { color: stat.accent }]}>{stat.suffix}</Text> : null}
                  </View>
                  <Text style={styles.statsCaption} numberOfLines={1}>{stat.caption}</Text>
                  <Text style={styles.statsUpdated}>Son: {stat.updated}</Text>
                </View>
              ))}
            </View>

            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => handlePress('RiskScore')}
                disabled={anyLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#1d4ed8', '#1e40af']}
                  style={[styles.buttonGradient, riskScoreLoading && styles.buttonGradientLoading]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.buttonTitleRow}>
                    <Text style={styles.buttonTitleLarge}>Risk Skoru</Text>
                    {riskScoreLoading ? (
                      <ActivityIndicator size="small" color="#bfdbfe" />
                    ) : null}
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => handlePress('PreparednessPlan')}
                disabled={anyLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={[styles.buttonGradient, preparednessPlanLoading && styles.buttonGradientLoading]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.buttonTitleRow}>
                    <Text style={styles.buttonTitleLarge}>Hazırlık Planı</Text>
                    {preparednessPlanLoading ? (
                      <ActivityIndicator size="small" color="#d1fae5" />
                    ) : null}
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => handlePress('PanicAssistant')}
                disabled={anyLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#ef4444', '#dc2626']}
                  style={[styles.buttonGradient, panicAssistantLoading && styles.buttonGradientLoading]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.buttonTitleRow}>
                    <Text style={styles.buttonTitleLarge}>Afet Rehberi</Text>
                    {panicAssistantLoading ? (
                      <ActivityIndicator size="small" color="#fee2e2" />
                    ) : null}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.disclaimer}>
              <Ionicons name="information-circle-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.disclaimerText}>
                Bu içerik bilgilendirme amaçlıdır. AFAD ve resmi kurumların uyarıları önceliklidir.
              </Text>
            </View>
          </>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[6],
  },
  gradient: {
    borderRadius: 18,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  statsCard: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  statsLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  statsValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing[4],
  },
  statsValueRowCompact: {
    marginTop: spacing[3],
  },
  statsValue: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
    color: colors.text.primary,
  },
  statsSuffix: {
    fontSize: 16,
    fontWeight: '700',
    paddingBottom: 2,
    color: colors.text.primary,
  },
  statsCaption: {
    marginTop: spacing[2],
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.9)',
  },
  statsUpdated: {
    marginTop: spacing[1],
    fontSize: 11,
    color: colors.text.tertiary,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  button: {
    flex: 1,
  },
  buttonGradient: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 88,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonGradientLoading: {
    opacity: 0.8,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  buttonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  buttonTitleLarge: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
});

