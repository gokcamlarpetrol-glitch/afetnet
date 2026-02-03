import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../theme';
import * as haptics from '../../../utils/haptics';
import { useAIAssistantStore } from '../../../ai/stores/aiAssistantStore';
import { aiAssistantCoordinator } from '../../../ai/services/AIAssistantCoordinator';
import { createLogger } from '../../../utils/logger';
import { i18nService } from '../../../services/I18nService';
import { PremiumMaterialSurface } from '../../../components/PremiumMaterialSurface';
import { LinearGradient } from 'expo-linear-gradient';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/native';

const logger = createLogger('AIAssistantCard');

// ELITE: Typed navigation prop
type AIAssistantNavigationProp = StackNavigationProp<ParamListBase>;

interface AIAssistantCardProps {
  navigation: AIAssistantNavigationProp;
}

const formatUpdateTime = (timestamp?: number | null) => {
  if (!timestamp) return i18nService.t('ai.dataPending');
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return i18nService.t('ai.justNow');
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.round(diff / (60 * 1000));
    return i18nService.t('ai.minutesAgo', { minutes: minutes.toString() });
  }
  return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

export default function AIAssistantCard({ navigation }: AIAssistantCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [expanded, setExpanded] = useState(false);

  const riskScore = useAIAssistantStore((state) => state.riskScore);
  const loading = useAIAssistantStore((state) => state.riskScoreLoading);
  const plan = useAIAssistantStore((state) => state.preparednessPlan);
  const panic = useAIAssistantStore((state) => state.panicAssistant);

  useEffect(() => {
    aiAssistantCoordinator.ensureRiskScore().catch(() => { });
    aiAssistantCoordinator.ensurePreparednessPlan().catch(() => { });
    aiAssistantCoordinator.ensurePanicAssistant('earthquake').catch(() => { });
  }, []);

  const toggleExpanded = useCallback(() => {
    haptics.selectionChanged();
    setExpanded((prev) => !prev);
  }, []);

  const animatePress = () => new Promise<void>((resolve) => {
    Animated.sequence([Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }), Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true })]).start(() => resolve());
  });

  const handlePress = async (screen: string) => { haptics.impactMedium(); await animatePress(); navigation.navigate(screen); };

  // Helper to calculate completions
  const planProgress = useMemo(() => plan ? Math.round(plan.completionRate) : 0, [plan]);
  const panicProgress = useMemo(() => panic ? panic.progressPercentage : 0, [panic]);
  const riskVal = useMemo(() => riskScore ? riskScore.score : 0, [riskScore]);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <PremiumMaterialSurface variant="A">
        <View style={styles.cardContent}>
          <Pressable style={styles.header} onPress={toggleExpanded} hitSlop={12}>
            <View style={styles.headerLeft}>
              {/* Logo: Soft Lavender Icon Box */}
              <View style={[styles.iconContainer, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="sparkles" size={18} color="#a855f7" />
              </View>
              <View>
                <Text style={styles.title}>{i18nService.t('ai.assistant')}</Text>
                <Text style={styles.subtitle}>{i18nService.t('ai.assistantSubtitle')}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" style={{ marginLeft: 8 }} />
            </View>
          </Pressable>

          {expanded && (
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Risk Score - Soft Serenity Blue */}
                <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={() => handlePress('RiskScore')}>
                  <LinearGradient colors={['#e0f2fe', '#bae6fd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
                    <View style={styles.buttonTopRow}>
                      <Ionicons name="shield-checkmark" size={24} color="#0ea5e9" />
                      <Text style={[styles.scoreText, { color: '#0369a1' }]}>{riskVal}</Text>
                    </View>
                    <Text style={[styles.buttonLabel, { color: '#0284c7' }]}>{i18nService.t('ai.riskScore')}</Text>
                    <Text style={[styles.buttonSub, { color: '#38bdf8' }]}>Güvenlik Durumu</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Plan - Soft Sage/Mint */}
                <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={() => handlePress('PreparednessPlan')}>
                  <LinearGradient colors={['#dcfce7', '#bbf7d0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
                    <View style={styles.buttonTopRow}>
                      <Ionicons name="leaf" size={24} color="#16a34a" />
                      <Text style={[styles.scoreText, { color: '#15803d' }]}>%{planProgress}</Text>
                    </View>
                    <Text style={[styles.buttonLabel, { color: '#16a34a' }]}>{i18nService.t('ai.preparednessPlan')}</Text>
                    <Text style={[styles.buttonSub, { color: '#4ade80' }]}>Hazırlık Seviyesi</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                {/* Panic - Soft Antique Rose */}
                <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={() => handlePress('PanicAssistant')}>
                  <LinearGradient colors={['#ffe4e6', '#fecdd3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
                    <View style={styles.buttonTopRow}>
                      <Ionicons name="heart" size={24} color="#e11d48" />
                      <Text style={[styles.scoreText, { color: '#be123c' }]}>%{panicProgress}</Text>
                    </View>
                    <Text style={[styles.buttonLabel, { color: '#e11d48' }]}>{i18nService.t('ai.disasterGuide')}</Text>
                    <Text style={[styles.buttonSub, { color: '#fb7185' }]}>Acil Durum</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* AI - Soft Lavender Mist */}
                <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={() => navigation.navigate('LocalAIAssistant')}>
                  <LinearGradient colors={['#f3e8ff', '#e9d5ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
                    <View style={styles.buttonTopRow}>
                      <Ionicons name="sparkles" size={24} color="#9333ea" />
                      <Ionicons name="arrow-forward" size={18} color="#c084fc" />
                    </View>
                    <Text style={[styles.buttonLabel, { color: '#9333ea' }]}>Asistan</Text>
                    <Text style={[styles.buttonSub, { color: '#c084fc' }]}>Yapay Zeka</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </PremiumMaterialSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing[6], marginHorizontal: 4 },
  cardContent: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '500', color: '#64748b', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  button: { borderRadius: 24, overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 },
  buttonGradient: { padding: 16, minHeight: 110, justifyContent: 'space-between' },
  buttonTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  scoreText: { fontSize: 22, fontWeight: '800' },
  buttonLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  buttonSub: { fontSize: 11, fontWeight: '600' },
});
